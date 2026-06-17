import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Stack, Typography, Button, Alert, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReplayIcon from '@mui/icons-material/Replay';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';

import GenerationProgress from '../../components/wizard/GenerationProgress';
import UtilityLayerToggles, { LAYER_DEFS } from '../../components/wizard/UtilityLayerToggles';
import UtilitySVG from '../../components/wizard/UtilitySVG';
import UtilitySummaryCards from '../../components/wizard/UtilitySummaryCards';
import UpgradeDialog from '../../components/wizard/UpgradeDialog';

const POLL_FALLBACK_DELAY_MS = 10_000;
const POLL_INTERVAL_MS = 3_000;

/* ─────────────────────────────────────────────────────────────────── */

export default function Step6Utilities({ value, onChange }) {
  const theme = useTheme();
  const { accessToken, user } = useAuth();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  const utilities = value.utilities || {};
  const hasOutput = !!(utilities.layers && Object.keys(utilities.layers).length > 0);
  const selectedFloorPlan = useMemo(() => {
    const fp = value.floorPlan || {};
    return fp.options?.find((o) => o.id === fp.selectedOptionId);
  }, [value.floorPlan]);

  /* ─── State machine ─────────────────────────────────────────────── */
  const [phase, setPhase] = useState(hasOutput ? 'ready' : 'idle'); // idle|generating|ready|error|limit
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(utilities.jobId || null);
  const [error, setError] = useState(null);
  const [upgradeData, setUpgradeData] = useState(null);

  /* ─── Active layers (default: all on) ───────────────────────────── */
  const [active, setActive] = useState(() => {
    if (Array.isArray(utilities.activeLayers) && utilities.activeLayers.length > 0) {
      return new Set(utilities.activeLayers);
    }
    return new Set(LAYER_DEFS.map((l) => l.id));
  });

  // Persist user's active-layer choice through saveStep
  useEffect(() => {
    if (!hasOutput) return;
    onChange({
      utilities: {
        ...utilities,
        activeLayers: Array.from(active),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.from(active).sort().join(','), hasOutput]);

  const toggleLayer = (id) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const setAll = () => setActive(new Set(LAYER_DEFS.map((l) => l.id)));
  const setNone = () => setActive(new Set());

  /* ─── Socket subscription ───────────────────────────────────────── */
  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  const pollTimerRef = useRef(null);
  const pollKickoffRef = useRef(null);

  const stopPolling = () => {
    if (pollKickoffRef.current) { clearTimeout(pollKickoffRef.current); pollKickoffRef.current = null; }
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  };

  const handleResult = (result) => {
    if (!result?.utilities) {
      setPhase('error');
      setError('Empty result');
      return;
    }
    setProgress(100);
    setPhase('ready');
    onChange({
      utilities: {
        ...result.utilities,
        jobId,
        generatedAt: new Date().toISOString(),
        activeLayers: Array.from(active),
      },
    });
  };

  useEffect(() => {
    if (phase !== 'generating' || !jobId) return undefined;
    const socket = getSocket();
    const onComplete = (p) => {
      if (p.jobId !== jobId || p.type !== 'utilities') return;
      stopPolling();
      handleResult(p.result);
    };
    const onFailed = (p) => {
      if (p.jobId !== jobId || p.type !== 'utilities') return;
      stopPolling();
      setPhase('error');
      setError(p.error || 'Generation failed');
    };
    socket.on('generation:complete', onComplete);
    socket.on('generation:failed', onFailed);
    return () => {
      socket.off('generation:complete', onComplete);
      socket.off('generation:failed', onFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, jobId]);

  const startPollingFallback = useCallback((forJobId) => {
    stopPolling();
    pollKickoffRef.current = setTimeout(() => {
      pollTimerRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/ai/jobs/${forJobId}`);
          if (data.status === 'completed' && data.result) {
            stopPolling();
            handleResult(data.result);
          } else if (data.status === 'failed') {
            stopPolling();
            setPhase('error');
            setError(data.error || 'Generation failed');
          } else if (typeof data.progress === 'number') {
            setProgress((p) => Math.max(p, data.progress));
          }
        } catch (e) {
          if (e.response?.status === 404) {
            stopPolling();
            setPhase('error');
            setError('Job not found');
          }
        }
      }, POLL_INTERVAL_MS);
    }, POLL_FALLBACK_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopPolling(), []);

  /* ─── Smooth progress ticker ─────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'generating') return undefined;
    const t = setInterval(() => setProgress((p) => Math.min(95, p + 2.5)), 500);
    return () => clearInterval(t);
  }, [phase]);

  /* ─── Generate ───────────────────────────────────────────────────── */
  const startGeneration = async () => {
    if (!planId) { setPhase('error'); setError('No plan id'); return; }
    if (!selectedFloorPlan) { setPhase('error'); setError('Select a floor plan first'); return; }

    setPhase('generating');
    setProgress(10);
    setError(null);
    setJobId(null);

    try {
      const payload = {
        floorPlan: value.floorPlan,
        roomConfig: value.roomConfig,
        landDetails: value.landDetails,
      };
      const { data } = await api.post(`/plans/${planId}/generate/utilities`, { payload });
      setJobId(data.jobId);
      startPollingFallback(data.jobId);
    } catch (e) {
      if (e.response?.status === 429) {
        setPhase('limit');
        setUpgradeData(e.response.data?.upgradePrompt || null);
      } else if (e.response?.status === 422) {
        setPhase('error');
        setError('Select a floor plan in Step 3 first.');
      } else {
        setPhase('error');
        setError(e.response?.data?.error || 'Could not start generation');
      }
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────── */
  if (!selectedFloorPlan) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        Select a floor plan in Step 3 first — utilities are routed around the rooms in your chosen layout.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Header card */}
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
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>
              Utility plan
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 560 }}>
              Routing for plumbing, electrical, HVAC, water tanks, sewage and solar — overlaid on your selected floor plan. Toggle layers below.
            </Typography>
          </Box>
          {phase === 'ready' && (
            <Button
              variant="outlined"
              startIcon={<ReplayIcon />}
              onClick={startGeneration}
            >
              Regenerate
            </Button>
          )}
        </Stack>

        <Box sx={{ mt: 3 }}>
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Button
                    size="large"
                    variant="contained"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={startGeneration}
                    sx={{
                      px: 4, fontWeight: 700,
                      boxShadow: theme.vastu.glowPrimary,
                      '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                    }}
                  >
                    Generate utility plan
                  </Button>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
                    Tier <strong>{user?.tier || 'FREE'}</strong> · 1 AI credit
                  </Typography>
                </Box>
              </motion.div>
            )}

            {phase === 'generating' && (
              <motion.div
                key="generating"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <SkeletonFloorPlan option={selectedFloorPlan} />
                <Box sx={{ mt: 2 }}>
                  <GenerationProgress
                    progress={progress}
                    messages={[
                      'Reading your floor plan…',
                      'Routing plumbing risers…',
                      'Sizing electrical circuits…',
                      'Estimating water tanks…',
                      'Placing solar panels…',
                    ]}
                  />
                </Box>
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Alert
                  severity="error"
                  action={<Button color="inherit" size="small" onClick={startGeneration}>Try again</Button>}
                >
                  {error || 'Could not generate utilities.'}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Card>

      {/* Render area (only after first generation) */}
      {phase === 'ready' && hasOutput && (
        <>
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
            <UtilityLayerToggles
              active={active}
              onToggle={toggleLayer}
              onAll={setAll}
              onNone={setNone}
            />
            <UtilitySVG
              option={selectedFloorPlan}
              utilities={utilities}
              active={active}
              vastuEnabled={!!value.vastuEnabled}
              height={420}
            />
          </Card>

          <UtilitySummaryCards
            summary={utilities.summary || {}}
            onToggle={toggleLayer}
            active={active}
          />
        </>
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

/* ─── Skeleton floor plan — pulsing boxes matching room layout ──── */

function SkeletonFloorPlan({ option }) {
  const theme = useTheme();
  const plotW = option?.plotDimensions?.plotW || 30;
  const plotH = option?.plotDimensions?.plotH || 30;
  const rooms = (option?.rooms || []).filter((r) => r.floor === 1);

  const height = 320;
  const aspect = plotW / plotH;
  const svgW = Math.round(height * aspect);
  const svgH = height;
  const sx = svgW / plotW;
  const sy = svgH / plotH;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: svgW,
        mx: 'auto',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.mode === 'dark' ? '#0A0E1A' : '#F4F7F2',
      }}
    >
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height={svgH} xmlns="http://www.w3.org/2000/svg">
        {rooms.map((r, i) => {
          const x = r.x * sx;
          const y = r.y * sy;
          const w = r.w * sx;
          const h = r.h * sy;
          return (
            <motion.rect
              key={r.id + i}
              x={x + 1.5} y={y + 1.5}
              width={Math.max(0, w - 3)} height={Math.max(0, h - 3)}
              rx={4} ry={4}
              fill={theme.palette.mode === 'dark' ? '#FFFFFF' : '#1A1A1A'}
              animate={{ opacity: [0.05, 0.15, 0.05] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: (i % 8) * 0.08,
              }}
            />
          );
        })}
        <rect x={1} y={1} width={svgW - 2} height={svgH - 2} fill="none" stroke={theme.palette.primary.main} strokeWidth={1.5} rx={6} ry={6} />
      </svg>
    </Box>
  );
}
