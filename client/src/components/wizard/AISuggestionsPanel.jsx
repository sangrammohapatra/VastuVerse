import { useMemo, useState } from 'react';
import {
  Box, Stack, Alert, AlertTitle, Typography, Skeleton, Chip, IconButton, Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReplayIcon from '@mui/icons-material/Replay';

const SEVERITY_TO_MUI = {
  green: 'success',
  orange: 'warning',
  red: 'error',
};

const FEASIBILITY_META = {
  good:  { label: 'Feasible',      color: 'success' },
  tight: { label: 'Tight fit',     color: 'warning' },
  over:  { label: 'Over capacity', color: 'error' },
};

/**
 * AI suggestions panel.
 *
 *   status         "idle" | "loading" | "ready" | "error"
 *   suggestions    [{ id, severity: 'green'|'orange'|'red', message }]
 *   warnings       same shape — rendered first as RED compliance issues
 *   maxBUA         number (sqft)
 *   feasibilityRating  "good" | "tight" | "over"
 *   onRetry        () => void (shown on error)
 *
 * Local state: dismissed ids (resets when a new fetch yields fresh ids).
 */
export default function AISuggestionsPanel({
  status = 'idle',
  suggestions = [],
  warnings = [],
  maxBUA,
  feasibilityRating,
  onRetry,
}) {
  const theme = useTheme();
  const [dismissed, setDismissed] = useState(() => new Set());

  // Combine warnings first (always red), then suggestions
  const items = useMemo(() => {
    const all = [
      ...warnings.map((w) => ({ ...w, severity: w.severity || 'red' })),
      ...suggestions,
    ];
    return all.filter((s) => !dismissed.has(s.id));
  }, [warnings, suggestions, dismissed]);

  const dismiss = (id) => setDismissed((prev) => new Set(prev).add(id));

  /* ---- skeleton loader (dark-mode aware) ---- */
  if (status === 'loading') {
    return (
      <Box
        sx={{
          p: 2.5,
          borderRadius: 3,
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <AutoAwesomeIcon sx={{ color: 'info.main' }} />
          <Typography sx={{ fontWeight: 700 }}>Analyzing your home…</Typography>
        </Stack>
        <Stack spacing={1.2}>
          {[68, 82, 60].map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
            >
              <Skeleton
                variant="rounded"
                height={48}
                width={`${w}%`}
                sx={{
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.06)',
                }}
              />
            </motion.div>
          ))}
        </Stack>
      </Box>
    );
  }

  /* ---- error state ---- */
  if (status === 'error') {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <IconButton color="inherit" size="small" onClick={onRetry}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          )
        }
      >
        Couldn't fetch suggestions. Try again in a moment.
      </Alert>
    );
  }

  /* ---- idle (haven't fetched yet) ---- */
  if (status === 'idle') {
    return (
      <Box
        sx={{
          p: 2.5,
          textAlign: 'center',
          borderRadius: 3,
          border: `1px dashed ${theme.palette.divider}`,
          color: 'text.secondary',
        }}
      >
        <AutoAwesomeIcon sx={{ color: 'info.main', mb: 0.5 }} />
        <Typography variant="body2">
          AI feasibility suggestions will appear here as you build your room plan.
        </Typography>
      </Box>
    );
  }

  /* ---- ready ---- */
  const feas = FEASIBILITY_META[feasibilityRating] || null;

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
      }}
    >
      {/* Header row */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        sx={{ mb: 2, gap: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeIcon sx={{ color: 'info.main' }} />
          <Typography sx={{ fontWeight: 700 }}>AI suggestions</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {feas && (
            <Chip
              label={feas.label}
              size="small"
              color={feas.color}
              variant="filled"
              sx={{ fontWeight: 700 }}
            />
          )}
          {maxBUA > 0 && (
            <Tooltip title="Maximum built-up area allowed for your plot (area × FSI)">
              <Chip
                label={`Max BUA ~${maxBUA.toLocaleString('en-IN')} sqft`}
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* Chip list — stagger fade-in */}
      <Stack spacing={1.2}>
        <AnimatePresence initial={false}>
          {items.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                All clear — no notes for this configuration.
              </Typography>
            </motion.div>
          )}
          {items.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{
                delay: Math.min(i, 8) * 0.06,
                duration: 0.32,
                ease: 'easeOut',
              }}
            >
              <Alert
                severity={SEVERITY_TO_MUI[s.severity] || 'info'}
                onClose={() => dismiss(s.id)}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  alignItems: 'flex-start',
                  '& .MuiAlert-message': { flex: 1 },
                }}
              >
                {s.category === 'compliance' && s.severity === 'red' && (
                  <AlertTitle sx={{ fontWeight: 700 }}>NBC compliance</AlertTitle>
                )}
                {s.message}
              </Alert>
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>
    </Box>
  );
}
