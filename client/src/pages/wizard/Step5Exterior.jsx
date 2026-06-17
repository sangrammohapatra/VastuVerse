import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Button, Switch, FormControlLabel, FormControl,
  Select, MenuItem, InputLabel, ToggleButton, ToggleButtonGroup, Checkbox, Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import HomeIcon from '@mui/icons-material/Home';
import VillaIcon from '@mui/icons-material/Villa';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CottageIcon from '@mui/icons-material/Cottage';
import TempleHinduIcon from '@mui/icons-material/TempleHindu';
import GrassIcon from '@mui/icons-material/Grass';
import ParkIcon from '@mui/icons-material/Park';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import WaterIcon from '@mui/icons-material/Water';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';

import StyleCard from '../../components/wizard/StyleCard';
import RenderImageCard from '../../components/wizard/RenderImageCard';
import UpgradeDialog from '../../components/wizard/UpgradeDialog';

/* ─── Catalogues ────────────────────────────────────────────────── */

const FACADE_STYLES = [
  { id: 'contemporary', label: 'Contemporary', Icon: HomeIcon,        gradient: 'linear-gradient(135deg,#90CAF9,#1E88E5)', description: 'Glass panes, mixed cladding.' },
  { id: 'colonial',     label: 'Indo-Colonial',Icon: CottageIcon,     gradient: 'linear-gradient(135deg,#D4A017,#1B365D)', description: 'Columns, arches, clay tiles.' },
  { id: 'modern',       label: 'Modern',       Icon: ApartmentIcon,   gradient: 'linear-gradient(135deg,#B0BEC5,#37474F)', description: 'Flat roof, clean lines.' },
  { id: 'minimalist',   label: 'Minimalist',   Icon: VillaIcon,       gradient: 'linear-gradient(135deg,#F5F5F5,#9E9E9E)', description: 'White walls, geometric form.' },
  { id: 'traditional',  label: 'Traditional',  Icon: TempleHinduIcon, gradient: 'linear-gradient(135deg,#C49A3F,#7B1E1E)', description: 'Jharokha, ornamental cornice.' },
];

const ROOF_TYPES = [
  { id: 'flat',            label: 'Flat (RCC)' },
  { id: 'sloped',          label: 'Sloped (sheet)' },
  { id: 'mangalore-tile',  label: 'Mangalore tile' },
  { id: 'metal',           label: 'Standing-seam metal' },
];

const BOUNDARY_WALLS = [
  { id: 'brick',         label: 'Brick' },
  { id: 'compound',      label: 'Compound (plaster)' },
  { id: 'iron-railing',  label: 'Iron railing' },
  { id: 'composite',     label: 'Composite (brick + railing)' },
];

const MAIN_GATES = [
  { id: 'sliding',        label: 'Sliding (automatic)' },
  { id: 'swing',          label: 'Swing (manual)' },
  { id: 'modern-grill',   label: 'Modern grill' },
  { id: 'classic-wood',   label: 'Classic wood + iron' },
];

const DRIVEWAY_MATERIALS = [
  { id: 'concrete',  label: 'Stamped concrete' },
  { id: 'pavers',    label: 'Cement-paver block' },
  { id: 'stone',     label: 'Natural stone' },
  { id: 'gravel',    label: 'Gravel + edging' },
];

const LANDSCAPING = [
  { id: 'lawn',           label: 'Manicured lawn',  Icon: GrassIcon },
  { id: 'garden',         label: 'Flowering garden',Icon: LocalFloristIcon },
  { id: 'trees',          label: 'Shade trees',     Icon: ParkIcon },
  { id: 'water-feature',  label: 'Water feature',   Icon: WaterIcon },
];

/* ─────────────────────────────────────────────────────────────────── */

export default function Step5Exterior({ value, onChange }) {
  const theme = useTheme();
  const { accessToken, user } = useAuth();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  const ext = value.exterior || {};
  const persistedSides = ext.sides || {};

  const facadeStyle = ext.facadeStyle || null;
  const roofType = ext.roofType || '';
  const boundaryWall = ext.boundaryWall || '';
  const mainGate = ext.mainGate || '';
  const driveway = ext.driveway || { enabled: false, material: 'pavers' };
  const landscaping = ext.landscaping || [];

  const patchExterior = (patch) => onChange({ exterior: { ...ext, ...patch } });

  /* ─── Socket / token ──────────────────────────────────────────── */
  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  /* ─── Side render state ──────────────────────────────────────── */
  const [sideRenders, setSideRenders] = useState(() => ({ ...persistedSides }));
  const [sidePref, setSidePref] = useState('left'); // which side to show in the "side" card
  const jobToSideRef = useRef(new Map());
  const pollTimersRef = useRef(new Map());

  useEffect(() => {
    setSideRenders((prev) => ({ ...persistedSides, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persistedSides)]);

  useEffect(() => {
    const socket = getSocket();
    const onComplete = (p) => {
      if (p.type !== 'exterior-render') return;
      const side = p.side || jobToSideRef.current.get(p.jobId);
      if (!side) return;
      setSideRenders((prev) => ({
        ...prev,
        [side]: { ...prev[side], status: 'ready', imageUrl: p.result?.imageUrl || p.imageUrl },
      }));
      stopPolling(side);
    };
    const onFailed = (p) => {
      if (p.type !== 'exterior-render') return;
      const side = jobToSideRef.current.get(p.jobId);
      if (!side) return;
      setSideRenders((prev) => ({
        ...prev,
        [side]: { ...prev[side], status: 'error' },
      }));
      stopPolling(side);
    };
    socket.on('generation:complete', onComplete);
    socket.on('generation:failed', onFailed);
    return () => {
      socket.off('generation:complete', onComplete);
      socket.off('generation:failed', onFailed);
    };
  }, []);

  useEffect(() => () => pollTimersRef.current.forEach(clearInterval), []);

  const stopPolling = (side) => {
    const t = pollTimersRef.current.get(side);
    if (t) { clearInterval(t); pollTimersRef.current.delete(side); }
  };

  const pollFallback = (side, jobId) => {
    stopPolling(side);
    const ticker = setInterval(async () => {
      try {
        const { data } = await api.get(`/ai/jobs/${jobId}`);
        if (data.status === 'completed' && data.result) {
          setSideRenders((prev) => ({
            ...prev,
            [side]: { ...prev[side], status: 'ready', imageUrl: data.result.imageUrl },
          }));
          stopPolling(side);
        } else if (data.status === 'failed') {
          setSideRenders((prev) => ({
            ...prev,
            [side]: { ...prev[side], status: 'error' },
          }));
          stopPolling(side);
        }
      } catch (e) {
        if (e.response?.status === 404) {
          setSideRenders((prev) => ({
            ...prev,
            [side]: { ...prev[side], status: 'error' },
          }));
          stopPolling(side);
        }
      }
    }, 4000);
    pollTimersRef.current.set(side, ticker);
    setTimeout(() => stopPolling(side), 180_000);
  };

  /* ─── Generation ───────────────────────────────────────────────── */
  const [phase, setPhase] = useState('idle'); // idle|generating|done|error|limit
  const [upgradeData, setUpgradeData] = useState(null);

  const enqueueSides = async (sides) => {
    if (!planId || !facadeStyle) return;

    setSideRenders((prev) => {
      const next = { ...prev };
      sides.forEach((s) => { next[s] = { ...next[s], status: 'generating' }; });
      return next;
    });

    const payload = {
      sides,
      facadeStyle,
      roofType,
      boundaryWall,
      mainGate,
      driveway,
      landscaping,
      vastuEnabled: !!value.vastuEnabled,
      cityState: value.cityState,
    };

    try {
      const { data } = await api.post(`/plans/${planId}/generate/exterior`, payload);
      (data.jobs || []).forEach((j) => {
        jobToSideRef.current.set(j.jobId, j.side);
        setSideRenders((prev) => ({
          ...prev,
          [j.side]: { ...prev[j.side], jobId: j.jobId, status: 'generating' },
        }));
        setTimeout(() => pollFallback(j.side, j.jobId), 10_000);
      });
      setPhase('generating');
    } catch (e) {
      if (e.response?.status === 429) {
        setPhase('limit');
        setUpgradeData(e.response.data?.upgradePrompt || null);
      } else {
        setPhase('error');
      }
      // rollback optimistic generating
      setSideRenders((prev) => {
        const next = { ...prev };
        sides.forEach((s) => {
          if (next[s]?.status === 'generating' && !next[s]?.jobId) {
            next[s] = { ...next[s], status: 'error' };
          }
        });
        return next;
      });
    }
  };

  const generateExterior = () => enqueueSides(['front', sidePref]);
  const regenerateFront = () => enqueueSides(['front']);
  const regenerateSide = () => enqueueSides([sidePref]);

  const handleSideToggle = (newSide) => {
    if (!newSide || newSide === sidePref) return;
    setSidePref(newSide);
    // If this side hasn't been generated yet, kick off a render
    if (!sideRenders[newSide]?.imageUrl && phase !== 'idle') {
      enqueueSides([newSide]);
    }
  };

  /* ─── Render ──────────────────────────────────────────────────── */
  const hasAnyRender = sideRenders.front || sideRenders.left || sideRenders.right;
  const canGenerate = !!facadeStyle;

  return (
    <Stack spacing={3}>
      {/* Façade style */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Façade style</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          Sets the overall character of your home's exterior.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 1.5,
          }}
        >
          {FACADE_STYLES.map((s, i) => (
            <StyleCard
              key={s.id}
              style={s}
              index={i}
              selected={facadeStyle === s.id}
              onSelect={(id) => patchExterior({ facadeStyle: id })}
              compact
            />
          ))}
        </Box>
      </Card>

      {/* Materials & gate */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 2 }}>Materials</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Roof type</InputLabel>
            <Select
              value={roofType}
              label="Roof type"
              onChange={(e) => patchExterior({ roofType: e.target.value })}
            >
              {ROOF_TYPES.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Boundary wall</InputLabel>
            <Select
              value={boundaryWall}
              label="Boundary wall"
              onChange={(e) => patchExterior({ boundaryWall: e.target.value })}
            >
              {BOUNDARY_WALLS.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Main gate</InputLabel>
            <Select
              value={mainGate}
              label="Main gate"
              onChange={(e) => patchExterior({ mainGate: e.target.value })}
            >
              {MAIN_GATES.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Driveway */}
        <Box sx={{ mt: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={!!driveway.enabled}
                onChange={(e) => patchExterior({ driveway: { ...driveway, enabled: e.target.checked } })}
              />
            }
            label={
              <Typography sx={{ fontWeight: 600 }}>
                Driveway
              </Typography>
            }
          />
          <AnimatePresence>
            {driveway.enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <Box sx={{ mt: 1.5, maxWidth: 360 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Driveway material</InputLabel>
                    <Select
                      value={driveway.material || 'pavers'}
                      label="Driveway material"
                      onChange={(e) => patchExterior({ driveway: { ...driveway, material: e.target.value } })}
                    >
                      {DRIVEWAY_MATERIALS.map((r) => (
                        <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Card>

      {/* Landscaping */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Landscaping</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Choose any combination of garden features for the front exterior.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {LANDSCAPING.map(({ id, label, Icon }) => {
            const selected = landscaping.includes(id);
            return (
              <motion.div
                key={id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
              >
                <Box
                  onClick={() => {
                    const next = selected
                      ? landscaping.filter((x) => x !== id)
                      : [...landscaping, id];
                    patchExterior({ landscaping: next });
                  }}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderRadius: 2,
                    background: theme.vastu.cardBg,
                    border: selected
                      ? `2px solid ${theme.palette.primary.main}`
                      : theme.vastu.cardBorder,
                    boxShadow: selected ? theme.vastu.glowPrimary : 'none',
                    transition: 'border-color .2s, box-shadow .2s',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Checkbox checked={selected} sx={{ p: 0.5 }} onClick={(e) => e.stopPropagation()} />
                    <Icon sx={{ color: selected ? 'primary.main' : 'info.main' }} />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</Typography>
                  </Stack>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Card>

      {/* Generate CTA */}
      {facadeStyle && (
        <Box sx={{ textAlign: 'center' }}>
          <Button
            size="large"
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={generateExterior}
            disabled={!canGenerate}
            sx={{
              px: 4, fontWeight: 700,
              boxShadow: theme.vastu.glowPrimary,
              '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
            }}
          >
            Generate exterior renders
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
            2 AI credits (front + 1 side) · Tier <strong>{user?.tier || 'FREE'}</strong>
          </Typography>
        </Box>
      )}

      {/* Render grid */}
      {hasAnyRender && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          <RenderImageCard
            title="Front elevation"
            subtitle={FACADE_STYLES.find((s) => s.id === facadeStyle)?.label}
            status={sideRenders.front?.status || 'idle'}
            imageUrl={sideRenders.front?.imageUrl}
            onRegenerate={regenerateFront}
            regenerateLabel="Regenerate front"
            index={0}
            errorMessage="Front elevation failed to render."
          />
          <RenderImageCard
            title="Side elevation"
            subtitle={sidePref === 'left' ? 'Left side' : 'Right side'}
            status={sideRenders[sidePref]?.status || 'idle'}
            imageUrl={sideRenders[sidePref]?.imageUrl}
            onRegenerate={regenerateSide}
            regenerateLabel="Regenerate side"
            index={1}
            errorMessage="Side elevation failed to render."
            extraHeader={
              <ToggleButtonGroup
                size="small"
                exclusive
                value={sidePref}
                onChange={(_e, v) => handleSideToggle(v)}
              >
                <ToggleButton value="left" sx={{ px: 1.5 }}>Left</ToggleButton>
                <ToggleButton value="right" sx={{ px: 1.5 }}>Right</ToggleButton>
              </ToggleButtonGroup>
            }
          />
        </Box>
      )}

      <UpgradeDialog
        open={phase === 'limit'}
        onClose={() => setPhase('idle')}
        tiers={upgradeData?.tiers}
        currentTier={user?.tier || 'FREE'}
        title={upgradeData?.title}
        message={upgradeData?.message}
        onUpgrade={() => { window.location.href = '/profile'; }}
      />
    </Stack>
  );
}
