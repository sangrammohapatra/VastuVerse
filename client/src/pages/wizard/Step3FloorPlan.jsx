import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, Card, Alert, AlertTitle,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReplayIcon from '@mui/icons-material/Replay';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';

import GenerationProgress from '../../components/wizard/GenerationProgress';
import FloorPlanCard from '../../components/wizard/FloorPlanCard';
import UpgradeDialog from '../../components/wizard/UpgradeDialog';

const POLL_FALLBACK_DELAY_MS = 10_000; // start polling after 10s of socket silence
const POLL_INTERVAL_MS = 3_000;

/**
 * Step 3 — AI floor plan generation.
 *
 *   value.floorPlan holds { options[], selectedOptionId, jobId, generatedAt }.
 *   - Empty           → show "Generate" CTA
 *   - jobId in flight → show progress (socket-listen + poll fallback)
 *   - options ready   → render 3 cards
 *   - 429             → upgrade dialog with tier comparison
 */
export default function Step3FloorPlan({ value, onChange }) {
  const theme = useTheme();
  const { accessToken, user } = useAuth();

  const planId = useMemo(() => {
    // PlanWizard doesn't pass plan id explicitly; pull it from URL since this
    // component only renders inside PlanWizard which has :planId in route.
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  const floorPlan = value.floorPlan || {};
  const hasOptions = Array.isArray(floorPlan.options) && floorPlan.options.length > 0;

  const [phase, setPhase] = useState(hasOptions ? 'ready' : 'idle'); // idle|generating|ready|error|limit
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(floorPlan.jobId || null);
  const [error, setError] = useState(null);
  const [upgradeData, setUpgradeData] = useState(null);

  const pollTimerRef = useRef(null);
  const pollKickoffRef = useRef(null);
  const lastSocketEventRef = useRef(0);

  /* ─── Socket wire-up ──────────────────────────────────────────────── */
  useEffect(() => {
    if (accessToken) setAuthToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (phase !== 'generating' || !jobId) return undefined;
    const socket = getSocket();

    const onComplete = (payload) => {
      if (payload.jobId !== jobId) return;
      lastSocketEventRef.current = Date.now();
      stopPolling();
      handleResult(payload.result);
    };
    const onFailed = (payload) => {
      if (payload.jobId !== jobId) return;
      lastSocketEventRef.current = Date.now();
      stopPolling();
      setPhase('error');
      setError(payload.error || 'Generation failed');
    };

    socket.on('generation:complete', onComplete);
    socket.on('generation:failed', onFailed);
    return () => {
      socket.off('generation:complete', onComplete);
      socket.off('generation:failed', onFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, jobId]);

  /* ─── Polling fallback ────────────────────────────────────────────── */
  const stopPolling = () => {
    if (pollKickoffRef.current) { clearTimeout(pollKickoffRef.current); pollKickoffRef.current = null; }
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  };

  const startPollingFallback = useCallback((forJobId) => {
    stopPolling();
    pollKickoffRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastSocketEventRef.current;
      if (elapsed < POLL_FALLBACK_DELAY_MS && lastSocketEventRef.current > 0) return;

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
            setProgress(Math.max(progress, data.progress));
          }
        } catch (e) {
          // 404 on jobId — give up polling
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

  /* ─── Result handler ──────────────────────────────────────────────── */
  const handleResult = (result) => {
    if (!result?.options?.length) {
      setPhase('error');
      setError(
        result?.error?.message ||
        'No floor plan options could be generated. Check your room configuration and plot area, then try again.'
      );
      return;
    }
    setProgress(100);
    setPhase('ready');
    onChange({
      floorPlan: {
        ...floorPlan,
        options: result.options,
        jobId,
        generatedAt: new Date().toISOString(),
      },
    });
  };

  /* ─── Smooth progress while generating ────────────────────────────── */
  useEffect(() => {
    if (phase !== 'generating') return undefined;
    const t = setInterval(() => {
      setProgress((p) => Math.min(95, p + 1.5));
    }, 600);
    return () => clearInterval(t);
  }, [phase]);

  /* ─── Generate / regenerate ───────────────────────────────────────── */
  const startGeneration = async () => {
    if (!planId) {
      setPhase('error');
      setError('No plan id in route');
      return;
    }
    setPhase('generating');
    setProgress(8);
    setError(null);
    setJobId(null);
    lastSocketEventRef.current = 0;

    try {
      const payload = {
        roomConfig: value.roomConfig || {},
        landDetails: value.landDetails || {},
        vastuEnabled: !!value.vastuEnabled,
      };
      const { data } = await api.post(`/plans/${planId}/generate/floor-plan`, { payload });
      setJobId(data.jobId);
      startPollingFallback(data.jobId);
    } catch (e) {
      if (e.response?.status === 429) {
        setPhase('limit');
        setUpgradeData(e.response.data?.upgradePrompt || null);
      } else {
        setPhase('error');
        setError(e.response?.data?.error || 'Could not start generation');
      }
    }
  };

  const onSelectOption = (option) => {
    onChange({
      floorPlan: {
        ...floorPlan,
        selectedOptionId: option.id,
      },
    });
  };

  const onRegenerate = () => startGeneration();

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <Stack spacing={3}>
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
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>
              AI floor plan generation
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 560 }}>
              We'll generate 3 layout options based on your land, rooms and Vastu preference.
              Pick the one you like — you can regenerate any time.
            </Typography>
          </Box>
          {phase === 'ready' && (
            <Button
              variant="outlined"
              startIcon={<ReplayIcon />}
              onClick={onRegenerate}
            >
              Regenerate
            </Button>
          )}
        </Stack>

        {/* State views */}
        <Box sx={{ mt: 3 }}>
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Button
                    size="large"
                    variant="contained"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={startGeneration}
                    disabled={!planId}
                    sx={{
                      px: 4, fontWeight: 700,
                      boxShadow: theme.vastu.glowPrimary,
                      '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                    }}
                  >
                    Generate floor plans
                  </Button>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
                    Tier: <strong>{user?.tier || 'FREE'}</strong> · uses 1 AI credit
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
                transition={{ duration: 0.3 }}
              >
                <GenerationProgress progress={progress} />
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Alert
                  severity="error"
                  action={<Button color="inherit" size="small" onClick={startGeneration}>Try again</Button>}
                >
                  <AlertTitle>Generation failed</AlertTitle>
                  {error || 'Please try again in a moment.'}
                </Alert>
              </motion.div>
            )}

            {phase === 'limit' && (
              <motion.div
                key="limit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Alert severity="warning">
                  <AlertTitle>Daily limit reached</AlertTitle>
                  See your upgrade options.
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Card>

      {/* Options grid */}
      {phase === 'ready' && hasOptions && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {floorPlan.options.map((opt, i) => (
            <FloorPlanCard
              key={opt.id}
              option={opt}
              index={i}
              selected={floorPlan.selectedOptionId === opt.id}
              vastuEnabled={!!value.vastuEnabled}
              onSelect={onSelectOption}
            />
          ))}
        </Box>
      )}

      {/* Selection callout */}
      {phase === 'ready' && hasOptions && (
        <Alert
          severity={floorPlan.selectedOptionId ? 'success' : 'info'}
          sx={{ borderRadius: 3 }}
        >
          {floorPlan.selectedOptionId
            ? 'Floor plan selected. Click "Save & continue" to move to interior design.'
            : 'Pick one of the 3 options above to continue.'}
        </Alert>
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
