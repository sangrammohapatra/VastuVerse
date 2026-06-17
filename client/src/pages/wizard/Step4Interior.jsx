import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Button, Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import HomeIcon from '@mui/icons-material/Home';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import BrushIcon from '@mui/icons-material/Brush';
import ConstructionIcon from '@mui/icons-material/Construction';
import TempleHinduIcon from '@mui/icons-material/TempleHindu';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PaletteIcon from '@mui/icons-material/Palette';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';

import StyleCard from '../../components/wizard/StyleCard';
import PaletteSwatches from '../../components/wizard/PaletteSwatches';
import PerRoomStyleAccordion from '../../components/wizard/PerRoomStyleAccordion';
import KitchenConfigurator from '../../components/wizard/KitchenConfigurator';
import RenderImageCard from '../../components/wizard/RenderImageCard';
import UpgradeDialog from '../../components/wizard/UpgradeDialog';

/* ─── Style catalogue ──────────────────────────────────────────────── */

export const INTERIOR_STYLES = [
  { id: 'modern',         label: 'Modern',        Icon: HomeIcon,            gradient: 'linear-gradient(135deg,#4FC3F7,#00BCD4)',   description: 'Clean lines, large windows, neutral palette.' },
  { id: 'minimalist',     label: 'Minimalist',    Icon: BlurOnIcon,          gradient: 'linear-gradient(135deg,#F5F5F5,#9E9E9E)',   description: 'Negative space, soft whites, single accent.' },
  { id: 'traditional',    label: 'Traditional',   Icon: TempleHinduIcon,     gradient: 'linear-gradient(135deg,#C49A3F,#7B1E1E)',   description: 'Carved teak, brass, jali patterns.' },
  { id: 'contemporary',   label: 'Contemporary',  Icon: BrushIcon,           gradient: 'linear-gradient(135deg,#6C757D,#1B1B1B)',   description: 'Statement lighting, bold neutrals.' },
  { id: 'industrial',     label: 'Industrial',    Icon: ConstructionIcon,    gradient: 'linear-gradient(135deg,#B85C38,#3D2B1F)',   description: 'Exposed brick, metal beams, concrete.' },
  { id: 'indo-colonial',  label: 'Indo-Colonial', Icon: SelfImprovementIcon, gradient: 'linear-gradient(135deg,#1B365D,#D4A017)',   description: 'High ceilings, arched doorways, rattan.' },
];

/* ─── Helper: derive room list from saved floor plan ──────────────── */

function deriveRooms(value) {
  const fp = value.floorPlan || {};
  const sel = fp.options?.find((o) => o.id === fp.selectedOptionId);
  if (!sel?.rooms) return [];

  // De-dupe by id (some chip ids end with __f1 suffix for per-floor copies)
  const seen = new Set();
  return sel.rooms
    .filter((r) => r.kind !== 'staircase' && r.kind !== 'balcony') // skip vertical/outdoor
    .reduce((acc, r) => {
      const key = r.id.split('__')[0];
      if (seen.has(key)) return acc;
      seen.add(key);
      acc.push({ id: key, label: r.label, kind: r.kind, w: r.w, h: r.h });
      return acc;
    }, []);
}

/* ─────────────────────────────────────────────────────────────────── */

export default function Step4Interior({ value, onChange }) {
  const theme = useTheme();
  const { accessToken, user } = useAuth();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  const interior = value.interior || {};
  const globalStyle = interior.globalStyle || null;
  const perRoomStyles = interior.perRoomStyles || {};
  const kitchenConfig = interior.kitchenConfig || { layout: 'L', appliances: ['fridge', 'chimney'] };
  const selectedPaletteId = interior.selectedPaletteId || null;
  const palettes = interior.palettes || [];
  const persistedRoomMap = interior.rooms || {};

  const rooms = useMemo(() => deriveRooms(value), [value]);
  const hasKitchen = rooms.some((r) => r.kind === 'kitchen');

  /* ─── helpers ─────────────────────────────────────────────────── */
  const patchInterior = (patch) =>
    onChange({ interior: { ...interior, ...patch } });

  /* ─── socket / token ──────────────────────────────────────────── */
  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  /* ─── palette fetch when style changes ────────────────────────── */
  const [paletteStatus, setPaletteStatus] = useState('idle'); // idle|loading|ready|error
  const lastPaletteStyle = useRef(null);

  useEffect(() => {
    if (!globalStyle) return undefined;
    if (lastPaletteStyle.current === globalStyle && palettes.length > 0) return undefined;

    const t = setTimeout(async () => {
      setPaletteStatus('loading');
      try {
        const { data } = await api.post('/ai/color-palettes', {
          style: globalStyle,
          vastuEnabled: !!value.vastuEnabled,
        });
        lastPaletteStyle.current = globalStyle;
        patchInterior({ palettes: data.palettes || [] });
        setPaletteStatus('ready');
      } catch (e) {
        setPaletteStatus('error');
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalStyle]);

  /* ─── per-room render queue ──────────────────────────────────── */
  // Local tracking: { [roomId]: { jobId, status, imageUrl } }
  const [roomRenders, setRoomRenders] = useState(() => ({ ...persistedRoomMap }));
  const jobToRoomRef = useRef(new Map());
  const pollTimersRef = useRef(new Map());

  // Sync from persistedRoomMap when hydration brings server state in
  useEffect(() => {
    setRoomRenders((prev) => ({ ...persistedRoomMap, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persistedRoomMap)]);

  // Socket subscription
  useEffect(() => {
    const socket = getSocket();
    const onComplete = (p) => {
      if (p.type !== 'interior-render') return;
      const roomId = p.roomId || jobToRoomRef.current.get(p.jobId);
      if (!roomId) return;
      setRoomRenders((prev) => ({
        ...prev,
        [roomId]: { ...prev[roomId], status: 'ready', imageUrl: p.result?.imageUrl || p.imageUrl },
      }));
      stopPolling(roomId);
    };
    const onFailed = (p) => {
      if (p.type !== 'interior-render') return;
      const roomId = jobToRoomRef.current.get(p.jobId);
      if (!roomId) return;
      setRoomRenders((prev) => ({
        ...prev,
        [roomId]: { ...prev[roomId], status: 'error' },
      }));
      stopPolling(roomId);
    };
    socket.on('generation:complete', onComplete);
    socket.on('generation:failed', onFailed);
    return () => {
      socket.off('generation:complete', onComplete);
      socket.off('generation:failed', onFailed);
    };
  }, []);

  // Stop on unmount
  useEffect(() => () => pollTimersRef.current.forEach(clearInterval), []);

  const stopPolling = (roomId) => {
    const t = pollTimersRef.current.get(roomId);
    if (t) { clearInterval(t); pollTimersRef.current.delete(roomId); }
  };

  const pollFallback = (roomId, jobId) => {
    stopPolling(roomId);
    const ticker = setInterval(async () => {
      try {
        const { data } = await api.get(`/ai/jobs/${jobId}`);
        if (data.status === 'completed' && data.result) {
          setRoomRenders((prev) => ({
            ...prev,
            [roomId]: { ...prev[roomId], status: 'ready', imageUrl: data.result.imageUrl },
          }));
          stopPolling(roomId);
        } else if (data.status === 'failed') {
          setRoomRenders((prev) => ({
            ...prev,
            [roomId]: { ...prev[roomId], status: 'error' },
          }));
          stopPolling(roomId);
        }
      } catch (e) {
        if (e.response?.status === 404) {
          setRoomRenders((prev) => ({
            ...prev,
            [roomId]: { ...prev[roomId], status: 'error' },
          }));
          stopPolling(roomId);
        }
      }
    }, 4000);
    pollTimersRef.current.set(roomId, ticker);
    // give up after 3 min
    setTimeout(() => stopPolling(roomId), 180_000);
  };

  /* ─── Generate all rooms ──────────────────────────────────────── */
  const [phase, setPhase] = useState('idle'); // idle|generating|partial|done|error|limit
  const [upgradeData, setUpgradeData] = useState(null);

  const palette = palettes.find((p) => p.id === selectedPaletteId);

  const enqueueAll = async (roomList) => {
    if (!planId || roomList.length === 0) return;
    if (!globalStyle) return;

    const payload = {
      rooms: roomList.map((r) => ({
        id: r.id,
        kind: r.kind === 'kitchen' ? 'kitchen' : r.kind,
        w: r.w, h: r.h,
      })),
      style: globalStyle,
      palette,
      vastuEnabled: !!value.vastuEnabled,
      cityState: value.cityState,
    };

    // optimistic state
    setRoomRenders((prev) => {
      const next = { ...prev };
      roomList.forEach((r) => { next[r.id] = { ...next[r.id], status: 'generating' }; });
      return next;
    });

    try {
      const { data } = await api.post(`/plans/${planId}/generate/interior`, payload);
      (data.jobs || []).forEach((j) => {
        jobToRoomRef.current.set(j.jobId, j.roomId);
        setRoomRenders((prev) => ({
          ...prev,
          [j.roomId]: { ...prev[j.roomId], jobId: j.jobId, status: 'generating' },
        }));
        // start polling fallback after 10s if no socket event
        setTimeout(() => pollFallback(j.roomId, j.jobId), 10_000);
      });
      setPhase('generating');
    } catch (e) {
      if (e.response?.status === 429) {
        setPhase('limit');
        setUpgradeData(e.response.data?.upgradePrompt || null);
      } else {
        setPhase('error');
      }
      // rollback optimistic generating to idle
      setRoomRenders((prev) => {
        const next = { ...prev };
        roomList.forEach((r) => {
          if (next[r.id]?.status === 'generating' && !next[r.id]?.jobId) {
            next[r.id] = { ...next[r.id], status: 'error' };
          }
        });
        return next;
      });
    }
  };

  const generateInteriors = () => enqueueAll(rooms);
  const regenerateRoom = (roomId) => {
    const r = rooms.find((x) => x.id === roomId);
    if (r) enqueueAll([r]);
  };

  /* ─── Derived render summary ──────────────────────────────────── */
  const summary = useMemo(() => {
    const counts = { idle: 0, generating: 0, ready: 0, error: 0 };
    rooms.forEach((r) => {
      const s = roomRenders[r.id]?.status || 'idle';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [rooms, roomRenders]);

  /* ─── Render ──────────────────────────────────────────────────── */
  if (rooms.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        Select a floor plan in Step 3 first — interior design works on the rooms in your chosen layout.
      </Alert>
    );
  }

  const canGenerate = !!globalStyle && rooms.length > 0;

  return (
    <Stack spacing={3}>
      {/* Global style picker */}
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
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Pick a global style</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          This applies to every room by default. You can override individual rooms below.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {INTERIOR_STYLES.map((s, i) => (
            <StyleCard
              key={s.id}
              style={s}
              index={i}
              selected={globalStyle === s.id}
              onSelect={(id) => patchInterior({ globalStyle: id })}
            />
          ))}
        </Box>
      </Card>

      {/* Per-room overrides */}
      {globalStyle && (
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
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Per-room style overrides</Typography>
          <PerRoomStyleAccordion
            rooms={rooms}
            globalStyle={globalStyle}
            styles={INTERIOR_STYLES}
            perRoomStyles={perRoomStyles}
            onChange={(map) => patchInterior({ perRoomStyles: map })}
          />
        </Card>
      )}

      {/* Kitchen configurator */}
      {globalStyle && hasKitchen && (
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
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Kitchen configuration</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            Layout and appliances shape the kitchen render.
          </Typography>
          <KitchenConfigurator
            value={kitchenConfig}
            onChange={(patch) => patchInterior({ kitchenConfig: { ...kitchenConfig, ...patch } })}
          />
        </Card>
      )}

      {/* Color palette */}
      {globalStyle && (
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
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <PaletteIcon sx={{ color: 'info.main' }} />
            <Typography sx={{ fontWeight: 700 }}>Colour palette</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            Tap a palette to use it across all rooms.
          </Typography>
          <PaletteSwatches
            palettes={palettes}
            loading={paletteStatus === 'loading'}
            selectedId={selectedPaletteId}
            onSelect={(id) => patchInterior({ selectedPaletteId: id })}
          />
        </Card>
      )}

      {/* Generate CTA */}
      {globalStyle && (
        <Box sx={{ textAlign: 'center' }}>
          <Button
            size="large"
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={generateInteriors}
            disabled={!canGenerate}
            sx={{
              px: 4, fontWeight: 700,
              boxShadow: theme.vastu.glowPrimary,
              '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
            }}
          >
            Generate interiors for {rooms.length} rooms
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
            Each room counts as 1 AI credit · Tier <strong>{user?.tier || 'FREE'}</strong>
          </Typography>
          {summary.generating > 0 && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'info.main' }}>
              {summary.generating} in flight · {summary.ready} ready
            </Typography>
          )}
        </Box>
      )}

      {/* Results grid */}
      {rooms.some((r) => roomRenders[r.id]?.status && roomRenders[r.id]?.status !== 'idle') && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          {rooms.map((r, i) => {
            const rec = roomRenders[r.id] || {};
            const styleId = perRoomStyles[r.id] || globalStyle;
            const styleLabel = INTERIOR_STYLES.find((s) => s.id === styleId)?.label;
            return (
              <RenderImageCard
                key={r.id}
                title={r.label}
                subtitle={styleLabel ? `${styleLabel} · ${r.w}′ × ${r.h}′` : `${r.w}′ × ${r.h}′`}
                status={rec.status || 'idle'}
                imageUrl={rec.imageUrl}
                onRegenerate={() => regenerateRoom(r.id)}
                regenerateLabel="Regenerate this room"
                index={i}
                errorMessage="This room failed to render."
              />
            );
          })}
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
