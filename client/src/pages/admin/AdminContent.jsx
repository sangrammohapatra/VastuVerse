import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Card, Chip, IconButton, Tabs, Tab, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, CircularProgress,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';

import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';

import { api } from '../../utils/axiosInstance';

export default function AdminContent() {
  const theme = useTheme();
  const [tab, setTab] = useState('cost');

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
        Content management
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Material costs by state/city and municipal compliance rules.
      </Typography>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tab value="cost"      label="Cost datasets" sx={{ fontWeight: 700 }} />
        <Tab value="municipal" label="Municipal rules" sx={{ fontWeight: 700 }} />
      </Tabs>

      {tab === 'cost' ? <CostDatasetGrid /> : <MunicipalRuleGrid />}
    </Box>
  );
}

/* ─── Cost datasets ───────────────────────────────────────────────── */

function CostDatasetGrid() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/cost-datasets');
      setRows(data.rows.map((r) => ({ ...r, id: r._id })));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load datasets');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!deleteRow) return;
    try {
      await api.delete(`/admin/cost-datasets/${deleteRow.id}`);
      setDeleteRow(null);
      setSuccess(`Deleted ${deleteRow.materialType} for ${deleteRow.state}`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
    }
  };

  const columns = useMemo(() => [
    { field: 'state',        headerName: 'State',    width: 140 },
    { field: 'city',         headerName: 'City',     width: 140, valueFormatter: (params) => params.value || '(any)' },
    { field: 'materialType', headerName: 'Material', width: 140 },
    { field: 'unitType',     headerName: 'Unit',     width: 110, valueFormatter: (params) => params.value || '—' },
    {
      field: 'economy', headerName: 'Economy ₹', width: 110, type: 'number',
      valueGetter: (params) => params?.row?.costs?.economy,
      valueFormatter: (params) => Number.isFinite(params.value) ? `₹${params.value.toLocaleString('en-IN')}` : '—',
    },
    {
      field: 'standard', headerName: 'Standard ₹', width: 110, type: 'number',
      valueGetter: (params) => params?.row?.costs?.standard,
      valueFormatter: (params) => Number.isFinite(params.value) ? `₹${params.value.toLocaleString('en-IN')}` : '—',
    },
    {
      field: 'premium', headerName: 'Premium ₹', width: 110, type: 'number',
      valueGetter: (params) => params?.row?.costs?.premium,
      valueFormatter: (params) => Number.isFinite(params.value) ? `₹${params.value.toLocaleString('en-IN')}` : '—',
    },
    {
      field: 'lastUpdated', headerName: 'Updated', width: 130,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'actions', headerName: '', width: 90, sortable: false, filterable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => setEditRow(p.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => setDeleteRow(p.row)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ], []);

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="contained" startIcon={<AddIcon />}
          onClick={() => setEditRow({ id: 'new', state: '', city: '', materialType: '', unitType: '', costs: {} })}
          sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
        >
          Add row
        </Button>
        <Button
          variant="outlined" startIcon={<UploadFileIcon />}
          onClick={() => setImportOpen(true)}
          sx={{ fontWeight: 700 }}
        >
          Import CSV
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
          {rows.length.toLocaleString('en-IN')} rows
        </Typography>
        <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
      </Stack>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

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
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
        />
      </Card>

      <CostDatasetEditDialog
        row={editRow} onClose={() => setEditRow(null)}
        onSaved={() => { setEditRow(null); setSuccess('Saved'); load(); }}
      />
      <CsvImportDialog
        open={importOpen} onClose={() => setImportOpen(false)}
        onImported={(result) => {
          setImportOpen(false);
          setSuccess(`Imported ${result.upserted} rows · ${result.skipped} skipped`);
          load();
        }}
      />

      <Dialog open={!!deleteRow} onClose={() => setDeleteRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete row?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove <strong>{deleteRow?.materialType}</strong> for <strong>{deleteRow?.state}
            {deleteRow?.city ? `, ${deleteRow.city}` : ''}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteRow(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={remove}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function CostDatasetEditDialog({ row, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (row) {
      setForm({
        state: row.state || '',
        city: row.city || '',
        materialType: row.materialType || '',
        unitType: row.unitType || '',
        economy:  row.costs?.economy ?? '',
        standard: row.costs?.standard ?? '',
        premium:  row.costs?.premium ?? '',
      });
      setError(null);
    }
  }, [row]);

  const save = async () => {
    if (!row) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        state: form.state.trim(),
        city: form.city.trim() || null,
        materialType: form.materialType.trim(),
        unitType: form.unitType.trim() || null,
        costs: {
          economy:  form.economy  === '' ? undefined : Number(form.economy),
          standard: form.standard === '' ? undefined : Number(form.standard),
          premium:  form.premium  === '' ? undefined : Number(form.premium),
        },
      };
      await api.put(`/admin/cost-datasets/${row.id}`, payload);
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  if (!row) return null;
  const isNew = row.id === 'new';

  return (
    <Dialog open onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isNew ? 'Add cost row' : 'Edit cost row'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" label="State *" value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
            <TextField fullWidth size="small" label="City (optional)" value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              helperText="Leave blank for state-level baseline" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" label="Material *" value={form.materialType}
              onChange={(e) => setForm((f) => ({ ...f, materialType: e.target.value }))}
              placeholder="e.g. cement, steel, brick, labour" />
            <TextField fullWidth size="small" label="Unit" value={form.unitType}
              onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value }))}
              placeholder="e.g. per_bag, per_kg, per_sqft" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" label="Economy ₹" type="number" value={form.economy}
              onChange={(e) => setForm((f) => ({ ...f, economy: e.target.value }))} />
            <TextField fullWidth size="small" label="Standard ₹" type="number" value={form.standard}
              onChange={(e) => setForm((f) => ({ ...f, standard: e.target.value }))} />
            <TextField fullWidth size="small" label="Premium ₹" type="number" value={form.premium}
              onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))} />
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={save} disabled={saving || !form.state || !form.materialType}
          startIcon={saving && <CircularProgress size={16} sx={{ color: '#fff' }} />}
          sx={{ fontWeight: 700 }}
        >
          {saving ? 'Saving…' : (isNew ? 'Create' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CsvImportDialog({ open, onClose, onImported }) {
  const [csv, setCsv] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => { if (open) { setCsv(''); setError(null); setResult(null); } }, [open]);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(reader.result);
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!csv.trim()) { setError('Paste CSV or upload a file'); return; }
    setSaving(true); setError(null); setResult(null);
    try {
      const { data } = await api.post('/admin/cost-datasets/import', csv, {
        headers: { 'Content-Type': 'text/csv' },
      });
      setResult(data);
      if (data.errors?.length === 0) {
        setTimeout(() => onImported?.(data), 1500);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Import cost datasets · CSV</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info" icon={<DownloadIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Expected columns</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace' }}>
              state, city, material, unit, economy, standard, premium
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Rows are upserted by (state, city, material). Existing rows are overwritten.
            </Typography>
          </Alert>

          <Button
            variant="outlined" component="label"
            startIcon={<UploadFileIcon />}
            sx={{ fontWeight: 700, alignSelf: 'flex-start' }}
          >
            Upload .csv file
            <input
              type="file" accept=".csv,text/csv" hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </Button>

          <TextField
            label="…or paste CSV content"
            value={csv} onChange={(e) => setCsv(e.target.value)}
            multiline minRows={6} maxRows={14} fullWidth
            sx={{ '& textarea': { fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' } }}
            placeholder={'state,city,material,unit,economy,standard,premium\nMaharashtra,Mumbai,cement,per_bag,380,420,480\n…'}
          />

          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity={result.errors?.length ? 'warning' : 'success'}>
              Upserted {result.upserted} · skipped {result.skipped}
              {result.errors?.length > 0 && ` · ${result.errors.length} errors`}
              {result.errors?.slice(0, 3).map((e, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  Row {e.index + 2}: {e.error}
                </Typography>
              ))}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={submit} disabled={saving || !csv.trim()}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <UploadFileIcon />}
          sx={{ fontWeight: 700 }}
        >
          {saving ? 'Importing…' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Municipal rules ─────────────────────────────────────────────── */

function MunicipalRuleGrid() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/municipal-rules');
      setRows(data.rows.map((r) => ({ ...r, id: r._id })));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load rules');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!deleteRow) return;
    try {
      await api.delete(`/admin/municipal-rules/${deleteRow.id}`);
      setDeleteRow(null);
      load();
    } catch (e) { setError(e.response?.data?.error || 'Delete failed'); }
  };

  const columns = useMemo(() => [
    { field: 'state', headerName: 'State', width: 140 },
    { field: 'city',  headerName: 'City',  width: 140 },
    { field: 'zone',  headerName: 'Zone',  width: 120, valueFormatter: (params) => params.value || 'default' },
    {
      field: 'fsiLimit', headerName: 'FSI', width: 80, type: 'number',
      valueFormatter: (params) => Number.isFinite(params.value) ? params.value.toFixed(2) : '—',
    },
    {
      field: 'maxHeight', headerName: 'Max ht (m)', width: 100, type: 'number',
      valueFormatter: (params) => params.value || '—',
    },
    {
      field: 'maxFloors', headerName: 'Max floors', width: 100, type: 'number',
      valueFormatter: (params) => params.value || '—',
    },
    {
      field: 'roadWidthRequired', headerName: 'Road width (m)', width: 130, type: 'number',
      valueFormatter: (params) => params.value || '—',
    },
    {
      field: 'actions', headerName: '', width: 90, sortable: false, filterable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => setEditRow(p.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => setDeleteRow(p.row)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ], []);

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="contained" startIcon={<AddIcon />}
          onClick={() => setEditRow({ id: 'new', state: '', city: '', zone: 'default' })}
          sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
        >
          Add rule
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
          {rows.length.toLocaleString('en-IN')} rules
        </Typography>
        <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

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
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-cell': { outline: 'none !important' } }}
        />
      </Card>

      <MunicipalRuleEditDialog
        row={editRow} onClose={() => setEditRow(null)}
        onSaved={() => { setEditRow(null); load(); }}
      />

      <Dialog open={!!deleteRow} onClose={() => setDeleteRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete rule?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove rules for <strong>{deleteRow?.city}, {deleteRow?.state}</strong>
            {deleteRow?.zone ? ` (${deleteRow.zone})` : ''}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteRow(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={remove}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function MunicipalRuleEditDialog({ row, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (row) {
      setForm({
        state: row.state || '', city: row.city || '', zone: row.zone || 'default',
        fsiLimit: row.fsiLimit ?? '',
        maxHeight: row.maxHeight ?? '',
        maxFloors: row.maxFloors ?? '',
        roadWidthRequired: row.roadWidthRequired ?? '',
        frontSetback:  row.setbacks?.front  ?? '',
        rearSetback:   row.setbacks?.rear   ?? '',
        sideSetback:   row.setbacks?.side   ?? '',
        parkingNorms: row.parkingNorms || '',
        fireNorms: row.fireNorms || '',
        additionalRules: row.additionalRules || '',
      });
      setError(null);
    }
  }, [row]);

  const save = async () => {
    if (!row) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        state: form.state.trim(),
        city: form.city.trim(),
        zone: (form.zone || 'default').trim(),
        fsiLimit:          form.fsiLimit  === '' ? undefined : Number(form.fsiLimit),
        maxHeight:         form.maxHeight === '' ? undefined : Number(form.maxHeight),
        maxFloors:         form.maxFloors === '' ? undefined : Number(form.maxFloors),
        roadWidthRequired: form.roadWidthRequired === '' ? undefined : Number(form.roadWidthRequired),
        setbacks: {
          front: form.frontSetback === '' ? undefined : Number(form.frontSetback),
          rear:  form.rearSetback  === '' ? undefined : Number(form.rearSetback),
          side:  form.sideSetback  === '' ? undefined : Number(form.sideSetback),
        },
        parkingNorms: form.parkingNorms || undefined,
        fireNorms: form.fireNorms || undefined,
        additionalRules: form.additionalRules || undefined,
      };
      await api.post('/admin/municipal-rules', payload);
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  if (!row) return null;
  const isNew = row.id === 'new';

  return (
    <Dialog open onClose={() => !saving && onClose()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isNew ? 'Add municipal rule' : `Edit · ${row.city}, ${row.state}`}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth size="small" label="State *" value={form.state || ''}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
            <TextField fullWidth size="small" label="City *" value={form.city || ''}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <TextField fullWidth size="small" label="Zone" value={form.zone || ''}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              placeholder="residential, commercial, mixed-use" />
          </Stack>

          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            FSI · Height · Coverage
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth size="small" type="number" label="FSI limit (e.g. 1.5)" value={form.fsiLimit ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, fsiLimit: e.target.value }))} />
            <TextField fullWidth size="small" type="number" label="Max height (m)" value={form.maxHeight ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, maxHeight: e.target.value }))} />
            <TextField fullWidth size="small" type="number" label="Max floors" value={form.maxFloors ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, maxFloors: e.target.value }))} />
            <TextField fullWidth size="small" type="number" label="Min road width (m)" value={form.roadWidthRequired ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, roadWidthRequired: e.target.value }))} />
          </Stack>

          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            Setbacks (m)
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth size="small" type="number" label="Front" value={form.frontSetback ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, frontSetback: e.target.value }))} />
            <TextField fullWidth size="small" type="number" label="Rear" value={form.rearSetback ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, rearSetback: e.target.value }))} />
            <TextField fullWidth size="small" type="number" label="Side" value={form.sideSetback ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sideSetback: e.target.value }))} />
          </Stack>

          <TextField
            label="Parking norms" value={form.parkingNorms || ''}
            onChange={(e) => setForm((f) => ({ ...f, parkingNorms: e.target.value }))}
            size="small" fullWidth multiline minRows={2}
            placeholder="e.g. 1 covered space per 75 sq.m built-up area"
          />
          <TextField
            label="Fire norms" value={form.fireNorms || ''}
            onChange={(e) => setForm((f) => ({ ...f, fireNorms: e.target.value }))}
            size="small" fullWidth multiline minRows={2}
            placeholder="e.g. NBC 2016 Part 4 — refuge area required above 15m"
          />
          <TextField
            label="Additional rules" value={form.additionalRules || ''}
            onChange={(e) => setForm((f) => ({ ...f, additionalRules: e.target.value }))}
            size="small" fullWidth multiline minRows={2}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={save} disabled={saving || !form.state || !form.city}
          startIcon={saving && <CircularProgress size={16} sx={{ color: '#fff' }} />}
          sx={{ fontWeight: 700 }}
        >
          {saving ? 'Saving…' : (isNew ? 'Create' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
