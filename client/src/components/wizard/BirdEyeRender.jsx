import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Stack, Typography, Button, Skeleton, IconButton, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';
import GenerationProgress from './GenerationProgress';

/**
 * Bird's-eye AI render card.
 *
 *   planId        string
 *   plan          full plan object (for prompt context)
 *   birdEyeView   plan.birdEyeView (server-persisted state)
 *   onUpdated()   callback after the worker writes a new render
 */
export default function BirdEyeRender({ planId, plan, birdEyeView, onUpdated }) {
  const theme = useTheme();
  const { accessToken } = useAuth();
  const initialUrl = birdEyeView?.imageUrl || null;

  const [phase, setPhase] = useState(initialUrl ? 'ready' : 'idle'); // idle|generating|ready|error
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [jobId, setJobId] = useState(birdEyeView?.jobId || null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  /* ─── Socket subscription ───────────────────────────────────────── */
  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  const pollTimerRef = useRef(null);
  const stopPolling = () => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  };

  useEffect(() => {
    if (phase !== 'generating' || !jobId) return undefined;
    const socket = getSocket();
    const onComplete = (p) => {
      if (p.jobId !== jobId || p.type !== 'bird-eye-3d') return;
      stopPolling();
      setProgress(100);
      setImageUrl(p.result?.imageUrl || p.imageUrl);
      setPhase('ready');
      onUpdated?.();
    };
    const onFailed = (p) => {
      if (p.jobId !== jobId || p.type !== 'bird-eye-3d') return;
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

  // Polling fallback
  useEffect(() => {
    if (phase !== 'generating' || !jobId) return undefined;
    const start = setTimeout(() => {
      pollTimerRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/ai/jobs/${jobId}`);
          if (data.status === 'completed' && data.result) {
            stopPolling();
            setImageUrl(data.result.imageUrl);
            setPhase('ready');
            onUpdated?.();
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
      }, 4000);
    }, 10_000);
    return () => { clearTimeout(start); stopPolling(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, jobId]);

  // Smooth progress ticker
  useEffect(() => {
    if (phase !== 'generating') return undefined;
    const t = setInterval(() => setProgress((p) => Math.min(95, p + 2)), 600);
    return () => clearInterval(t);
  }, [phase]);

  /* ─── Trigger generation ────────────────────────────────────────── */
  const startGeneration = async () => {
    if (!planId) return;
    setPhase('generating');
    setProgress(8);
    setError(null);

    const fp = plan?.floorPlan || {};
    const sel = fp.options?.find((o) => o.id === fp.selectedOptionId);
    const ext = plan?.exterior || {};

    const payload = {
      facadeStyle: ext.facadeStyle,
      roofType: ext.roofType,
      boundaryWall: ext.boundaryWall,
      mainGate: ext.mainGate,
      driveway: ext.driveway,
      landscaping: ext.landscaping || [],
      plotW: sel?.plotDimensions?.plotW,
      plotH: sel?.plotDimensions?.plotH,
      floors: plan?.landDetails?.floors || 1,
      vastuEnabled: !!plan?.vastuEnabled,
      cityState: plan?.cityState,
      seed: Math.floor(Math.random() * 1_000_000),
    };

    try {
      const { data } = await api.post(`/plans/${planId}/generate/bird-eye`, payload);
      setJobId(data.jobId);
    } catch (e) {
      setPhase('error');
      setError(e.response?.data?.error || 'Could not start generation');
    }
  };

  /* ─── Download ──────────────────────────────────────────────────── */
  const download = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl, { credentials: 'omit' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (plan?.title || 'birds-eye').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      a.href = url; a.download = `${safeTitle}-birds-eye.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening in a new tab
      window.open(imageUrl, '_blank', 'noopener');
    }
  };

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <Card
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Bird's-eye view (AI render)</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Drone-perspective photoreal overview of your home.
          </Typography>
        </Box>
        {phase === 'ready' && imageUrl && (
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={startGeneration} title="Regenerate">
              <ReplayIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={download} title="Download">
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Stack>

      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 10',
          background: theme.palette.mode === 'dark' ? '#0A0E1A' : '#F4F4F4',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 24, textAlign: 'center',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Click below to generate a high-resolution overhead render.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={startGeneration}
                sx={{
                  fontWeight: 700,
                  boxShadow: theme.vastu.glowPrimary,
                  '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                }}
              >
                Generate 3D bird's-eye view
              </Button>
            </motion.div>
          )}

          {phase === 'generating' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Skeleton
                variant="rectangular"
                width="100%"
                height="100%"
                animation="wave"
                sx={{ position: 'absolute', inset: 0 }}
              />
              <Box
                sx={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: theme.palette.background.paper + 'CC',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 3,
                  px: 3, py: 2,
                  minWidth: 300,
                }}
              >
                <GenerationProgress
                  progress={progress}
                  messages={[
                    'Studying your floor plan…',
                    'Composing the aerial frame…',
                    'Painting the facade…',
                    'Adding the landscape…',
                    'Finishing touches…',
                  ]}
                />
              </Box>
            </motion.div>
          )}

          {phase === 'ready' && imageUrl && (
            <motion.img
              key={imageUrl}
              src={imageUrl}
              alt={`Bird's-eye view of ${plan?.title || 'your home'}`}
              loading="lazy"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
              }}
            />
          )}

          {phase === 'error' && (
            <motion.div
              key="err"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                display: 'grid', placeItems: 'center',
                padding: 24,
              }}
            >
              <Alert
                severity="error"
                action={<Button color="inherit" size="small" onClick={startGeneration}>Retry</Button>}
              >
                {error || "Couldn't render bird's-eye view."}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Card>
  );
}
