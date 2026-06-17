import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Card, Chip, MenuItem, TextField, IconButton,
  Menu, Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArchiveIcon from '@mui/icons-material/Archive';

import { api } from '../../utils/axiosInstance';

const STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

const STATUS_COLOR = {
  DRAFT:       'default',
  IN_PROGRESS: 'warning',
  COMPLETED:   'success',
  ARCHIVED:    'default',
};

export default function AdminPlans() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [actionAnchor, setActionAnchor] = useState({ el: null, row: null });
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.pageSize };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get('/admin/plans', { params });
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load plans');
    } finally { setLoading(false); }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  const archive = async () => {
    if (!confirmArchive) return;
    try {
      await api.put(`/admin/plans/${confirmArchive.id}/archive`);
      setConfirmArchive(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Archive failed');
    }
  };

  const columns = useMemo(() => [
    {
      field: 'title', headerName: 'Plan', flex: 1.4, minWidth: 200,
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {p.row.title || '(untitled)'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            Step {p.row.currentStep || 1} / 10
          </Typography>
        </Box>
      ),
    },
    {
      field: 'ownerEmail', headerName: 'Owner', flex: 1.2, minWidth: 180,
      renderCell: (p) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {p.row.ownerName || '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {p.row.ownerEmail}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip
          size="small" label={p.value}
          color={STATUS_COLOR[p.value] || 'default'}
          sx={{ fontWeight: 800, letterSpacing: 0.5 }}
        />
      ),
    },
    {
      field: 'city', headerName: 'Location', width: 160,
      valueGetter: (params) => {
        if (!params?.row) return '—';
        return [params.row.city, params.row.state].filter(Boolean).join(', ') || '—';
      },
    },
    {
      field: 'createdAt', headerName: 'Created', width: 130,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'completedAt', headerName: 'Completed', width: 130,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'actions', headerName: '', width: 60, sortable: false, filterable: false,
      renderCell: (p) => (
        <IconButton size="small" onClick={(e) => setActionAnchor({ el: e.currentTarget, row: p.row })}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ], []);

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
        Plans
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        All plans across the platform — {total.toLocaleString('en-IN')} total.
      </Typography>

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
            select size="small" label="Status" value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField
            size="small" label="Search title or city" value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
        </Stack>
      </Card>

      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          height: 'calc(100vh - 280px)', minHeight: 400,
        }}
      >
        <DataGrid
          rows={rows} columns={columns} loading={loading}
          rowCount={total} paginationMode="server"
          paginationModel={pagination} onPaginationModelChange={setPagination}
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
        />
      </Card>

      <Menu
        anchorEl={actionAnchor.el}
        open={Boolean(actionAnchor.el)}
        onClose={() => setActionAnchor({ el: null, row: null })}
      >
        <MenuItem
          component={RouterLink}
          to={`/plans/${actionAnchor.row?.id}/step/${actionAnchor.row?.currentStep || 1}`}
          target="_blank"
          onClick={() => setActionAnchor({ el: null, row: null })}
        >
          <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} /> Open plan
        </MenuItem>
        {actionAnchor.row?.status !== 'ARCHIVED' && (
          <MenuItem
            onClick={() => { setConfirmArchive(actionAnchor.row); setActionAnchor({ el: null, row: null }); }}
            sx={{ color: 'error.main' }}
          >
            <ArchiveIcon fontSize="small" sx={{ mr: 1 }} /> Archive
          </MenuItem>
        )}
      </Menu>

      <Dialog open={!!confirmArchive} onClose={() => setConfirmArchive(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Archive plan?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            "{confirmArchive?.title || '(untitled)'}" will be marked ARCHIVED. The owner
            can still view it but won't be able to edit. This action is reversible by editing
            the plan's status field.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmArchive(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={archive} startIcon={<ArchiveIcon />}>
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
