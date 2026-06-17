import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Card, Chip, Alert, Skeleton, IconButton, LinearProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

import MemoryIcon from '@mui/icons-material/Memory';
import RefreshIcon from '@mui/icons-material/Refresh';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';

import { api } from '../../utils/axiosInstance';

const POLL_MS = 5000;

const STATE_META = {
  waiting:   { Icon: HourglassEmptyIcon,    color: '#FF8F00', label: 'Waiting'   },
  active:    { Icon: PlayCircleFilledIcon,  color: '#0277BD', label: 'Active'    },
  completed: { Icon: CheckCircleIcon,       color: '#2E7D32', label: 'Completed' },
  failed:    { Icon: ErrorIcon,             color: '#C62828', label: 'Failed'    },
  delayed:   { Icon: ScheduleIcon,          color: '#7B1FA2', label: 'Delayed'   },
  paused:    { Icon: PauseCircleIcon,       color: '#616161', label: 'Paused'    },
};

export default function AdminAIMonitoring() {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/admin/ai-monitoring');
      setData(data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load monitoring data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  // Queue depth = pending work (waiting + delayed). Animated fill bar.
  const pending = (data?.queue?.waiting || 0) + (data?.queue?.delayed || 0);
  const active  = data?.queue?.active || 0;
  // Capacity heuristic: concurrency × 10 (rough headroom)
  const capacity = Math.max(20, (data?.concurrency || 2) * 10);
  const fillPct = Math.min(100, Math.round(((pending + active) / capacity) * 100));
  const fillColor = fillPct > 80 ? '#C62828' : fillPct > 50 ? '#FF8F00' : '#2E7D32';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
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
            AI Monitoring
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Providers, BullMQ queue depth, and recent failures. Auto-refreshes every 5s.
          </Typography>
        </Box>
        <IconButton onClick={() => load()}><RefreshIcon /></IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Provider badges */}
      <Card
        elevation={0}
        sx={{
          p: 2.5, mb: 2,
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Active providers</Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
            <ProviderBadge label="Plan generation"  value={data?.providers?.plan}  meta={data?.providers?.openaiPlanModel || data?.providers?.ollamaUrl} />
            <ProviderBadge label="Image generation" value={data?.providers?.image} meta={data?.providers?.openaiImageModel} />
            <ProviderBadge label="Worker concurrency" value={`${data?.concurrency || 2}`} meta="parallel jobs" />
          </Stack>
        )}
      </Card>

      {/* Queue depth fill bar */}
      <Card
        elevation={0}
        sx={{
          p: 2.5, mb: 2,
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.2 }}>
          <Typography sx={{ fontWeight: 700 }}>Queue depth</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {pending + active} of ~{capacity} capacity
          </Typography>
        </Stack>

        {loading ? (
          <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 1 }} />
        ) : (
          <>
            <Box sx={{ position: 'relative', height: 32, borderRadius: 1, overflow: 'hidden', background: theme.palette.action.hover, mb: 1.5 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${fillColor}, ${fillColor}AA)`,
                  boxShadow: `0 0 16px ${fillColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 10,
                  color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                }}
              >
                {fillPct > 14 && `${fillPct}%`}
              </motion.div>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
                gap: 1.5,
              }}
            >
              {Object.entries(STATE_META).map(([state, m]) => (
                <QueueStat key={state} state={state} count={data?.queue?.[state] || 0} meta={m} />
              ))}
            </Box>
          </>
        )}
      </Card>

      {/* Jobs by type + recent failures */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
        }}
      >
        <Card
          elevation={0}
          sx={{ p: 2.5, background: theme.vastu.cardBg, border: theme.vastu.cardBorder, backdropFilter: theme.vastu.cardBlur }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Pending + active jobs by type</Typography>
          {loading ? (
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
          ) : data?.jobsByType?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.jobsByType} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis type="number" stroke={theme.palette.text.secondary} fontSize={11} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke={theme.palette.text.secondary} fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8, fontSize: '0.85rem',
                  }}
                />
                <Bar dataKey="count" fill={theme.palette.primary.main} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              No pending or active jobs.
            </Typography>
          )}
        </Card>

        <Card
          elevation={0}
          sx={{ p: 2.5, background: theme.vastu.cardBg, border: theme.vastu.cardBorder, backdropFilter: theme.vastu.cardBlur }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>
            Recent failures{data?.lastFailed?.length ? ` (${data.lastFailed.length})` : ''}
          </Typography>
          {loading ? (
            <Stack spacing={1}>
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />)}
            </Stack>
          ) : data?.lastFailed?.length ? (
            <Stack spacing={1.2} sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {data.lastFailed.map((j) => (
                <Box
                  key={j.id}
                  sx={{
                    p: 1.2,
                    borderRadius: 1.5,
                    border: '1px solid rgba(198,40,40,0.3)',
                    background: 'rgba(198,40,40,0.05)',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>{j.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      attempts: {j.attemptsMade}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#C62828', wordBreak: 'break-word' }}>
                    {j.failedReason || '—'}
                  </Typography>
                  {j.finishedAt && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {new Date(j.finishedAt).toLocaleString('en-IN')}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              No recent failures. 🎉
            </Typography>
          )}
        </Card>
      </Box>
    </Box>
  );
}

function ProviderBadge({ label, value, meta }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flex: 1, minWidth: 200,
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.action.hover,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.7 }}>
        {label.toUpperCase()}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.4 }}>
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#2E7D32',
            boxShadow: '0 0 8px #2E7D32',
          }}
        />
        <Typography sx={{ fontWeight: 800, textTransform: 'capitalize' }}>{value || '—'}</Typography>
      </Stack>
      {meta && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3, wordBreak: 'break-all' }}>
          {meta}
        </Typography>
      )}
    </Box>
  );
}

function QueueStat({ state, count, meta }) {
  const Icon = meta.Icon;
  return (
    <Stack alignItems="center" spacing={0.3}>
      <Icon sx={{ color: meta.color, fontSize: 22 }} />
      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{count.toLocaleString('en-IN')}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{meta.label}</Typography>
    </Stack>
  );
}
