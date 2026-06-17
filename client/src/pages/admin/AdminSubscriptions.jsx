import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Card, Chip, MenuItem, TextField, IconButton,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Tooltip, CircularProgress,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';

import RefreshIcon from '@mui/icons-material/Refresh';
import BlockIcon from '@mui/icons-material/Block';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

import { api } from '../../utils/axiosInstance';

const TIERS = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];
const SUB_STATUSES = ['active', 'authenticated', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused'];

const TIER_COLOR = {
  FREE: 'default', BASIC: 'info', PRO: 'success', ENTERPRISE: 'warning',
};

const PAY_STATUSES = ['created', 'authorized', 'captured', 'refunded', 'failed'];
const PAY_TYPES = ['subscription', 'pay_per_plan', '3d_unlock', 'marketplace_bid', 'marketplace_payout'];

export default function AdminSubscriptions() {
  const theme = useTheme();
  const [tab, setTab] = useState('subscriptions');

  return (
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
          mb: 0.5,
        }}
      >
        Subscriptions & Payments
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Razorpay-linked subscriptions, manual overrides, and all payment transactions.
      </Typography>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tab value="subscriptions" label="Subscriptions" sx={{ fontWeight: 700 }} />
        <Tab value="payments"      label="Payment transactions" sx={{ fontWeight: 700 }} />
      </Tabs>

      {tab === 'subscriptions' ? <SubscriptionsGrid /> : <PaymentsGrid />}
    </Box>
  );
}

/* ─── Subscriptions ───────────────────────────────────────────────── */

function SubscriptionsGrid() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ tier: '', status: '' });
  const [revokeRow, setRevokeRow] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.tier) params.tier = filters.tier;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/admin/subscriptions', { params });
      setRows(data.rows);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load subscriptions');
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      field: 'email', headerName: 'User', flex: 1.4, minWidth: 220,
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {p.row.fullName || '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {p.row.email}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'tier', headerName: 'Tier', width: 120,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip size="small" label={p.value} color={TIER_COLOR[p.value] || 'default'} sx={{ fontWeight: 800 }} />
          {p.row.adminOverride && (
            <Tooltip title={`Admin grant by ${p.row.adminOverride.grantedBy}: ${p.row.adminOverride.reason || '—'}`}>
              <VerifiedUserIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => <Chip size="small" label={p.value} variant="outlined" sx={{ fontWeight: 700 }} />,
    },
    {
      field: 'razorpaySubscriptionId', headerName: 'Razorpay Sub ID', width: 200,
      valueFormatter: (params) => params.value || '—',
      renderCell: (p) => (
        <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace' }}>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'plansUsedThisMonth', headerName: 'Plans used', width: 110, type: 'number',
    },
    {
      field: 'currentPeriodEnd', headerName: 'Renews', width: 130,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false, filterable: false,
      renderCell: (p) => (
        p.row.tier !== 'FREE' && (
          <Button
            size="small" color="error" variant="outlined"
            startIcon={<BlockIcon />}
            onClick={() => setRevokeRow(p.row)}
            sx={{ fontWeight: 700 }}
          >
            Revoke
          </Button>
        )
      ),
    },
  ], []);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card
        elevation={0}
        sx={{
          p: 2, mb: 2,
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center">
          <TextField
            select size="small" label="Tier" value={filters.tier}
            onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All tiers</MenuItem>
            {TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField
            select size="small" label="Status" value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {SUB_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Stack>
      </Card>

      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          height: 'calc(100vh - 360px)', minHeight: 400,
        }}
      >
        <DataGrid
          rows={rows} columns={columns} loading={loading}
          getRowId={(r) => r.id}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
        />
      </Card>

      <RevokeDialog row={revokeRow} onClose={() => setRevokeRow(null)} onDone={() => { setRevokeRow(null); load(); }} />
    </>
  );
}

function RevokeDialog({ row, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (row) { setReason(''); setError(null); } }, [row]);

  const revoke = async () => {
    if (!row) return;
    setSaving(true); setError(null);
    try {
      await api.post(`/admin/subscriptions/${row.userId}/revoke`, { reason });
      onDone?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Revoke failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!row} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Revoke {row?.tier} subscription</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            {row?.email} will be downgraded to FREE. This bypasses Razorpay's billing
            cycle — useful for support escalations or refunds.
          </Typography>
          <TextField
            label="Reason (audit log)"
            value={reason} onChange={(e) => setReason(e.target.value)}
            fullWidth multiline minRows={2} size="small"
            placeholder="e.g. refund requested, duplicate billing"
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" color="error" onClick={revoke} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <BlockIcon />}
          sx={{ fontWeight: 700 }}
        >
          {saving ? 'Revoking…' : 'Revoke'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Payments ────────────────────────────────────────────────────── */

function PaymentsGrid() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 50 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.pageSize };
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/admin/payments', { params });
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load payments');
    } finally { setLoading(false); }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      field: 'createdAt', headerName: 'Date', width: 160,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString('en-IN') : '—',
    },
    {
      field: 'email', headerName: 'User', flex: 1.2, minWidth: 200,
    },
    {
      field: 'type', headerName: 'Type', width: 160,
      renderCell: (p) => <Chip size="small" label={p.value?.replace(/_/g, ' ')} variant="outlined" sx={{ fontWeight: 700, textTransform: 'capitalize' }} />,
    },
    {
      field: 'amount', headerName: 'Amount', width: 120, type: 'number',
      valueFormatter: (params) => params.value !== undefined ? `₹${(params.value / 100).toLocaleString('en-IN')}` : '—',
      cellClassName: 'font-mono',
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => {
        const color = p.value === 'captured' ? 'success'
                    : p.value === 'failed' ? 'error'
                    : p.value === 'refunded' ? 'warning'
                    : 'default';
        return <Chip size="small" label={p.value} color={color} sx={{ fontWeight: 800, letterSpacing: 0.5 }} />;
      },
    },
    {
      field: 'razorpayOrderId', headerName: 'Razorpay IDs', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace', display: 'block' }} noWrap>
            {p.row.razorpayOrderId || '—'}
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace', color: 'text.secondary' }} noWrap>
            {p.row.razorpayPaymentId || '—'}
          </Typography>
        </Box>
      ),
    },
  ], []);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card
        elevation={0}
        sx={{
          p: 2, mb: 2,
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center">
          <TextField
            select size="small" label="Type" value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All types</MenuItem>
            {PAY_TYPES.map((t) => (
              <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</MenuItem>
            ))}
          </TextField>
          <TextField
            select size="small" label="Status" value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {PAY_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {total.toLocaleString('en-IN')} transactions
          </Typography>
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Stack>
      </Card>

      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          height: 'calc(100vh - 360px)', minHeight: 400,
        }}
      >
        <DataGrid
          rows={rows} columns={columns} loading={loading}
          rowCount={total} paginationMode="server"
          paginationModel={pagination} onPaginationModelChange={setPagination}
          pageSizeOptions={[25, 50, 100]}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
        />
      </Card>
    </>
  );
}
