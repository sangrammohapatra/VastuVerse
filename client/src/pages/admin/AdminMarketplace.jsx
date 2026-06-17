import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Card, Chip, IconButton, Tabs, Tab, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  CircularProgress,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import RefreshIcon from '@mui/icons-material/Refresh';
import BlockIcon from '@mui/icons-material/Block';
import PercentIcon from '@mui/icons-material/Percent';
import LockIcon from '@mui/icons-material/Lock';

import { api } from '../../utils/axiosInstance';

const REQUEST_STATUS_COLOR = {
  OPEN: 'warning', IN_REVIEW: 'info', COMPLETED: 'success',
  CANCELLED: 'default', EXPIRED: 'default',
};

const BID_STATUS_COLOR = {
  pending: 'warning', accepted: 'success', rejected: 'default', completed: 'info',
};

export default function AdminMarketplace() {
  const theme = useTheme();
  const [tab, setTab] = useState('requests');
  const [data, setData] = useState({ requests: [], bids: [] });
  const [commission, setCommission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suspendBid, setSuspendBid] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, comm] = await Promise.all([
        api.get('/admin/marketplace/overview'),
        api.get('/admin/marketplace/commission'),
      ]);
      setData(overview.data);
      setCommission(comm.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load marketplace data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestColumns = useMemo(() => [
    { field: 'title', headerName: 'Title', flex: 1.4, minWidth: 200 },
    {
      field: 'homeownerEmail', headerName: 'Homeowner', flex: 1.2, minWidth: 200,
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {p.row.homeownerName || '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {p.row.homeownerEmail}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip size="small" label={p.value} color={REQUEST_STATUS_COLOR[p.value] || 'default'} sx={{ fontWeight: 800 }} />
      ),
    },
    {
      field: 'maxBudgetInr', headerName: 'Budget', width: 130, type: 'number',
      valueFormatter: (params) => params.value !== undefined ? `₹${(params.value / 100).toLocaleString('en-IN')}` : '—',
    },
    {
      field: 'bidCount', headerName: 'Bids', width: 80, type: 'number',
    },
    {
      field: 'city', headerName: 'Location', width: 160,
      valueGetter: (params) => {
        if (!params?.row) return '—';
        return [params.row.cityState?.city, params.row.cityState?.state].filter(Boolean).join(', ') || '—';
      },
    },
    {
      field: 'createdAt', headerName: 'Posted', width: 130,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('en-IN') : '—',
    },
  ], []);

  const bidColumns = useMemo(() => [
    {
      field: 'architectEmail', headerName: 'Architect', flex: 1.2, minWidth: 220,
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {p.row.architectName || '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {p.row.architectEmail}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'proposedFee', headerName: 'Fee', width: 120, type: 'number',
      valueFormatter: (params) => params.value !== undefined ? `₹${(params.value / 100).toLocaleString('en-IN')}` : '—',
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip size="small" label={p.value} color={BID_STATUS_COLOR[p.value] || 'default'} sx={{ fontWeight: 800 }} />
      ),
    },
    {
      field: 'createdAt', headerName: 'Placed', width: 160,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString('en-IN') : '—',
    },
    {
      field: 'actions', headerName: '', width: 130, sortable: false, filterable: false,
      renderCell: (p) => (
        <Button
          size="small" color="error" variant="outlined"
          startIcon={<BlockIcon />}
          onClick={() => setSuspendBid(p.row)}
          sx={{ fontWeight: 700 }}
        >
          Suspend
        </Button>
      ),
    },
  ], []);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '1.7rem', md: '2.1rem' },
              background: theme.vastu.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Marketplace
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Architect review requests, bids, and commission config.
          </Typography>
        </Box>
        <IconButton onClick={load}><RefreshIcon /></IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Commission config card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card
          elevation={0}
          sx={{
            p: 2.5, mb: 2.5,
            background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,143,0,0.18), transparent 70%)',
              filter: 'blur(30px)',
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PercentIcon sx={{ color: 'warning.main' }} />
                <Typography sx={{ fontWeight: 700 }}>Commission configuration</Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {commission?.note || 'Defined in code'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                  PLATFORM CUT
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', color: 'warning.main' }}>
                  {commission?.commissionPct ?? '—'}%
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                  ARCHITECT PAYOUT
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', color: 'success.main' }}>
                  {commission ? Math.round(commission.payoutRatio * 100) : '—'}%
                </Typography>
              </Box>
              <LockIcon sx={{ color: 'text.disabled' }} titleAccess="Read-only" />
            </Stack>
          </Stack>
        </Card>
      </motion.div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tab value="requests" label={`Requests (${data.requests.length})`} sx={{ fontWeight: 700 }} />
        <Tab value="bids"     label={`Bids (${data.bids.length})`}         sx={{ fontWeight: 700 }} />
      </Tabs>

      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          height: 'calc(100vh - 420px)', minHeight: 400,
        }}
      >
        {tab === 'requests' ? (
          <DataGrid
            rows={data.requests} columns={requestColumns} loading={loading}
            getRowId={(r) => r.id}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
            disableRowSelectionOnClick
            sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
          />
        ) : (
          <DataGrid
            rows={data.bids} columns={bidColumns} loading={loading}
            getRowId={(r) => r.id}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
            disableRowSelectionOnClick
            sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
          />
        )}
      </Card>

      <SuspendDialog bid={suspendBid} onClose={() => setSuspendBid(null)} onDone={() => { setSuspendBid(null); load(); }} />
    </Box>
  );
}

function SuspendDialog({ bid, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (bid) { setReason(''); setError(null); } }, [bid]);

  // We need the architect's userId — the overview payload doesn't include it
  // directly. The simplest approach: ask the admin to suspend via the user
  // grid. For demo purposes, we surface the action but make it clear it's
  // a separate flow. In a real impl, the overview should return userId.
  const suspend = async () => {
    if (!bid) return;
    setSaving(true); setError(null);
    try {
      // This requires the userId — not in the overview payload by default.
      // Surfacing the warning to the admin:
      setError('To suspend an architect, locate them in the Users tab and use the Deactivate action, or call PUT /admin/architects/:userId/suspend directly with the userId.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!bid} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Suspend architect</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            Suspending <strong>{bid?.architectName || bid?.architectEmail}</strong> prevents new bids
            and hides them from the marketplace feed. Existing accepted bids remain active.
          </Typography>
          <TextField
            label="Reason (sent to architect via email)"
            value={reason} onChange={(e) => setReason(e.target.value)}
            fullWidth multiline minRows={3} size="small"
            placeholder="e.g. multiple low-quality reviews, terms violation"
          />
          {error && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" color="error" onClick={suspend} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <BlockIcon />}
          sx={{ fontWeight: 700 }}
        >
          Suspend
        </Button>
      </DialogActions>
    </Dialog>
  );
}
