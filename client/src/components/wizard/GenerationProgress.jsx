import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, LinearProgress } from '@mui/material';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTheme } from '@mui/material/styles';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const DEFAULT_MESSAGES = [
  'Analysing your plot…',
  'Applying NBC norms…',
  'Placing rooms…',
  'Rendering options…',
];

/**
 * Animated progress block during AI generation.
 *
 *   progress       0–100 (smooth bar)
 *   messages       optional override of the cycling captions
 *   intervalMs     time between message rotations (default 2.6s)
 */
export default function GenerationProgress({
  progress = 0,
  messages = DEFAULT_MESSAGES,
  intervalMs = 2600,
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (messages.length <= 1) return undefined;
    timer.current = setInterval(() => {
      setIdx((prev) => (prev + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(timer.current);
  }, [messages.length, intervalMs]);

  return (
    <Box
      sx={{
        p: { xs: 3, md: 5 },
        borderRadius: 2,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
        textAlign: 'center',
        maxWidth: 640,
        mx: 'auto',
      }}
    >
      {/* Pulsing AI sparkle */}
      <motion.div
        animate={reduce ? {} : { scale: [1, 1.12, 1], rotate: [0, 4, -4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ display: 'inline-flex' }}
      >
        <Box
          sx={{
            width: 64, height: 64,
            borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: theme.vastu.gradientBrand,
            color: '#fff',
            mb: 2,
            boxShadow: theme.vastu.glowAccent,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 32 }} />
        </Box>
      </motion.div>

      {/* Cycling message */}
      <Box sx={{ minHeight: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1.5 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={idx}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', md: '1.15rem' } }}>
              {messages[idx]}
            </Typography>
          </motion.div>
        </AnimatePresence>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        Generation takes 30–90 seconds. You can leave this page — we'll notify you when it's ready.
      </Typography>

      {/* Animated progress bar */}
      <LinearProgress
        variant={progress > 0 ? 'determinate' : 'indeterminate'}
        value={progress}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            background: theme.vastu.gradientBrand,
          },
        }}
      />

      {progress > 0 && (
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Working on your home
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {Math.round(progress)}%
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
