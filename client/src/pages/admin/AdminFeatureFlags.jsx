import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Card, Alert, Skeleton, Checkbox, IconButton,
  Switch, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, Chip, MenuItem, Avatar, ListItem, ListItemAvatar, ListItemText,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FlagIcon from '@mui/icons-material/Flag';
import TuneIcon from '@mui/icons-material/Tune';

import { api } from '../../utils/axiosInstance';

const TIERS = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];

const TIER_COLOR = {
  FREE: '#9E9E9E', BASIC: '#0277BD', PRO: '#2E7D32', ENTERPRISE: '#FF6F00',
};

export default function AdminFeatureFlags() {
  const theme = useTheme();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingFor, setSavingFor] = useState(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [overrideFor, setOverrideFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/feature-flags');
      setFlags(data.flags || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load flags');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTier = async (flag, tier) => {
    const key = `${flag.featureName}:${tier}`;
    setSavingFor((s) => new Set(s).add(key));
    const current = new Set(flag.enabledForTiers || []);
    if (current.has(tier)) current.delete(tier); else current.add(tier);
    const newTiers = Array.from(current);
    // Optimistic
    setFlags((fs) => fs.map((f) => f.featureName === flag.featureName ? { ...f, enabledForTiers: newTiers } : f));
    try {
      await api.put('/admin/feature-flags', { featureName: flag.featureName, enabledForTiers: newTiers });
    } catch (e) {
      setError(e.response?.data?.error || 'Update failed');
      load();
    } finally {
      setSavingFor((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const toggleGlobal = async (flag) => {
    const next = !flag.globalOverride;
    setFlags((fs) => fs.map((f) => f.featureName === flag.featureName ? { ...f, globalOverride: next } : f));
    try {
      await api.put('/admin/feature-flags', { featureName: flag.featureName, globalOverride: next });
    } catch (e) { setError(e.response?.data?.error || 'Update failed'); load(); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
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
            Feature flags
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tick a tier to enable a feature for that tier. Global override forces everyone on.
            Per-user overrides bypass tier rules.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AddCircleOutlineIcon />}
            variant="contained"
            onClick={() => setCreateOpen(true)}
            sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
          >
            Add flag
          </Button>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TierLimitsCard />

      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />)}
        </Stack>
      ) : flags.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: 4, textAlign: 'center',
            background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
          }}
        >
          <FlagIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No feature flags defined</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Add your first flag to gate features by tier or per user.
          </Typography>
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => setCreateOpen(true)}>
            Add flag
          </Button>
        </Card>
      ) : (
        <Card
          elevation={0}
          sx={{
            background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '2fr repeat(4, 1fr) 80px 80px', md: '2.4fr repeat(4, 1fr) 100px 80px' },
              gap: 1, alignItems: 'center',
              p: 1.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
              fontSize: '0.7rem', fontWeight: 800, letterSpacing: 0.6,
              color: 'text.secondary',
              background: theme.palette.action.hover,
            }}
          >
            <Box>FEATURE</Box>
            {TIERS.map((t) => (
              <Box key={t} sx={{ textAlign: 'center', color: TIER_COLOR[t] }}>{t}</Box>
            ))}
            <Box sx={{ textAlign: 'center' }}>GLOBAL</Box>
            <Box sx={{ textAlign: 'center' }}>USERS</Box>
          </Box>

          {/* Rows */}
          {flags.map((flag, i) => (
            <motion.div
              key={flag.featureName}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.3 }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '2fr repeat(4, 1fr) 80px 80px', md: '2.4fr repeat(4, 1fr) 100px 80px' },
                  gap: 1, alignItems: 'center',
                  p: 1.5,
                  borderBottom: i < flags.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                  transition: 'background .2s',
                  '&:hover': { background: theme.palette.action.hover },
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
                    {flag.featureName}
                  </Typography>
                  {flag.description && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {flag.description}
                    </Typography>
                  )}
                </Box>

                {TIERS.map((tier) => {
                  const enabled = (flag.enabledForTiers || []).includes(tier);
                  const key = `${flag.featureName}:${tier}`;
                  const saving = savingFor.has(key);
                  return (
                    <Box key={tier} sx={{ textAlign: 'center', position: 'relative' }}>
                      <Checkbox
                        checked={enabled}
                        onChange={() => toggleTier(flag, tier)}
                        disabled={saving || flag.globalOverride}
                        sx={{
                          color: TIER_COLOR[tier],
                          '&.Mui-checked': { color: TIER_COLOR[tier] },
                        }}
                      />
                      {saving && (
                        <CircularProgress
                          size={14}
                          sx={{ position: 'absolute', top: 12, right: 'calc(50% - 7px)', pointerEvents: 'none' }}
                        />
                      )}
                    </Box>
                  );
                })}

                <Box sx={{ textAlign: 'center' }}>
                  <Switch
                    checked={!!flag.globalOverride}
                    onChange={() => toggleGlobal(flag)}
                    color="warning"
                  />
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    size="small"
                    onClick={() => setOverrideFor(flag)}
                    sx={{ fontWeight: 700, minWidth: 60 }}
                  >
                    {flag.userOverrides?.length || 0}
                  </Button>
                </Box>
              </Box>
            </motion.div>
          ))}
        </Card>
      )}

      <CreateFlagDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
      />

      <UserOverridesDialog
        flag={overrideFor}
        onClose={() => setOverrideFor(null)}
        onChange={load}
      />
    </Box>
  );
}

/* ─── AI Generation Daily Limits card ────────────────────────────── */

function TierLimitsCard() {
  const theme = useTheme();
  const [limits, setLimits] = useState({ FREE: 5, BASIC: 20, PRO: 0, ENTERPRISE: 0 });
  const [draft, setDraft]   = useState(null); // null = not dirty
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState(null);

  useEffect(() => {
    api.get('/admin/tier-limits')
      .then(({ data }) => setLimits(data.limits))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const effective = draft ?? limits;
  const isDirty   = draft !== null;

  const handleChange = (tier, value) => {
    const n = parseInt(value, 10);
    setDraft((d) => ({ ...(d ?? limits), [tier]: Number.isNaN(n) ? 0 : Math.max(0, n) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setAlert(null);
    try {
      const { data } = await api.put('/admin/tier-limits', effective);
      setLimits(data.limits ?? effective);
      setDraft(null);
      setAlert({ severity: 'success', message: 'Generation limits saved.' });
    } catch (e) {
      setAlert({ severity: 'error', message: e.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        p: 2.5, mb: 3,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TuneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography sx={{ fontWeight: 700 }}>AI Generation Daily Limits</Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Enter 0 for unlimited. Changes take effect within 60 s without a restart.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {isDirty && (
            <Button size="small" onClick={() => setDraft(null)}>
              Reset
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={!isDirty || saving}
            startIcon={saving && <CircularProgress size={14} sx={{ color: 'inherit' }} />}
            sx={{ fontWeight: 700, minWidth: 80 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Stack>

      {alert && (
        <Alert severity={alert.severity} onClose={() => setAlert(null)} sx={{ mb: 2, borderRadius: 1 }}>
          {alert.message}
        </Alert>
      )}

      {loading ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={72} sx={{ flex: 1, borderRadius: 1 }} />
          ))}
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {TIERS.map((tier) => {
            const val = effective[tier] ?? 0;
            return (
              <Box key={tier} sx={{ flex: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    color: TIER_COLOR[tier],
                    mb: 0.5,
                  }}
                >
                  {tier}
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  value={val}
                  onChange={(e) => handleChange(tier, e.target.value)}
                  inputProps={{ min: 0, step: 1, style: { textAlign: 'center', fontWeight: 700 } }}
                  helperText={val === 0 ? 'Unlimited' : `${val} / day`}
                  FormHelperTextProps={{
                    sx: {
                      textAlign: 'center',
                      fontWeight: val === 0 ? 700 : 400,
                      color: val === 0 ? '#2E7D32' : 'text.secondary',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': { borderColor: TIER_COLOR[tier] },
                    },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}

/* ─── Create flag dialog ──────────────────────────────────────────── */

function CreateFlagDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setName(''); setDescription(''); setTiers([]); setError(null); } }, [open]);

  const create = async () => {
    if (!name.trim()) { setError('Name required'); return; }
    setSaving(true); setError(null);
    try {
      await api.put('/admin/feature-flags', {
        featureName: name.trim(),
        description: description.trim(),
        enabledForTiers: tiers,
      });
      onCreated?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Create failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add feature flag</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Feature name"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
            placeholder="e.g. ai_video_walkthrough"
            helperText="Lowercase + underscores. Used as the lookup key."
            size="small" fullWidth autoFocus
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small" fullWidth multiline minRows={2}
            placeholder="What this flag gates"
            inputProps={{ maxLength: 500 }}
          />
          <TextField
            select label="Initially enabled for"
            SelectProps={{ multiple: true, value: tiers, onChange: (e) => setTiers(e.target.value) }}
            size="small" fullWidth
          >
            {TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={create} disabled={saving || !name.trim()}
          startIcon={saving && <CircularProgress size={16} sx={{ color: '#fff' }} />}
          sx={{ fontWeight: 700 }}
        >
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Per-user overrides dialog ───────────────────────────────────── */

function UserOverridesDialog({ flag, onClose, onChange }) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    if (!flag) { setSearch(''); setOptions([]); setSelected(null); }
  }, [flag]);

  useEffect(() => {
    if (search.length < 2) { setOptions([]); return undefined; }
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/admin/users/search', { params: { q: search } });
        setOptions(data.users || []);
      } catch (_) {}
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  const addOverride = async (enabled) => {
    if (!selected || !flag) return;
    setSaving(true);
    try {
      await api.post(`/admin/feature-flags/${flag.featureName}/user-override`, {
        userId: selected._id || selected.id,
        enabled,
      });
      setSelected(null); setSearch(''); setOptions([]);
      onChange?.();
    } catch (_) {}
    finally { setSaving(false); }
  };

  const removeOverride = async (userId) => {
    if (!flag) return;
    try {
      await api.delete(`/admin/feature-flags/${flag.featureName}/user-override`, {
        data: { userId },
      });
      onChange?.();
    } catch (_) {}
  };

  if (!flag) return null;

  return (
    <Dialog open onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        User overrides · <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace', color: 'primary.main' }}>{flag.featureName}</Box>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Per-user overrides bypass tier rules. Use this for beta testers, support escalations,
            or to selectively disable a feature for a problem user.
          </Typography>

          <Autocomplete
            options={options}
            value={selected}
            onChange={(_e, v) => setSelected(v)}
            inputValue={search}
            onInputChange={(_e, v) => setSearch(v)}
            getOptionLabel={(o) => o.email || ''}
            isOptionEqualToValue={(o, v) => o._id === v._id}
            loading={searching}
            noOptionsText={search.length < 2 ? 'Type at least 2 characters' : 'No users found'}
            renderOption={(props, opt) => (
              <ListItem {...props} key={opt._id}>
                <ListItemAvatar>
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.78rem' }}>
                    {(opt.fullName || opt.email || '?').charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>{opt.fullName || opt.email}</Typography>}
                  secondary={`${opt.email} · ${opt.tier} · ${opt.role}`}
                />
              </ListItem>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Search user by email or name" size="small" autoFocus />
            )}
          />

          {selected && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained" color="success" onClick={() => addOverride(true)} disabled={saving}
                startIcon={<PersonAddAltIcon />}
                sx={{ fontWeight: 700 }}
              >
                Enable for {selected.fullName || selected.email}
              </Button>
              <Button
                variant="outlined" color="error" onClick={() => addOverride(false)} disabled={saving}
                sx={{ fontWeight: 700 }}
              >
                Disable
              </Button>
            </Stack>
          )}

          {/* Existing overrides */}
          {flag.userOverrides?.length > 0 && (
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
                Current overrides ({flag.userOverrides.length})
              </Typography>
              <Stack spacing={0.8} sx={{ mt: 0.8 }}>
                {flag.userOverrides.map((o, i) => (
                  <Stack
                    key={i}
                    direction="row" alignItems="center" spacing={1}
                    sx={{
                      p: 1, borderRadius: 1.5,
                      border: `1px solid ${theme.palette.divider}`,
                      background: theme.palette.action.hover,
                    }}
                  >
                    <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem' }}>
                      {(o.user?.fullName || o.user?.email || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {o.user?.fullName || o.user?.email || 'Unknown user'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {o.user?.email}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={o.enabled ? 'ENABLED' : 'DISABLED'}
                      color={o.enabled ? 'success' : 'default'}
                      sx={{ fontWeight: 800, fontSize: '0.62rem', height: 18 }}
                    />
                    <IconButton size="small" onClick={() => removeOverride(o.user?.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
