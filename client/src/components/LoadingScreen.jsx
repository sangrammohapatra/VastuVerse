import { Box, Typography, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import { useMotionPreferences } from '../hooks/useMotionPreferences';

/**
 * Full-screen loading state with VastuVerse logo + morphing-circle animation.
 *
 *   <LoadingScreen />                          standalone (Suspense fallback)
 *   <LoadingScreen message="Compiling…" />     custom hint
 *   <LoadingScreen variant="inline" />         smaller, fits inside a card
 *
 * The morph cycles through circle → rounded square → circle. When
 * prefers-reduced-motion is set, we fall back to a simple pulsing logo
 * with a fade.
 */
export default function LoadingScreen({ message, variant = 'full' }) {
  const theme = useTheme();
  const { reduced } = useMotionPreferences();

  const size = variant === 'inline' ? 80 : 120;

  return (
    <Box
      sx={{
        // 'full' mode covers the viewport; 'inline' fills its parent container
        minHeight: variant === 'full' ? '100vh' : 240,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: variant === 'full' ? theme.palette.background.default : 'transparent',
        position: variant === 'full' ? 'fixed' : 'relative',
        inset: variant === 'full' ? 0 : 'auto',
        zIndex: variant === 'full' ? 1300 : 'auto',
      }}
      // Accessibility — announce that loading is happening for screen readers
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Stack spacing={3} alignItems="center">
        {/* ─── Animated logo ─── */}
        <Box sx={{ position: 'relative', width: size, height: size }}>
          {/* Outer halo */}
          {!reduced && (
            <motion.div
              animate={{
                scale: [1, 1.18, 1],
                opacity: [0.18, 0.32, 0.18],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${theme.palette.primary.main}, transparent 70%)`,
                filter: 'blur(20px)',
              }}
            />
          )}

          {/* Morphing logo SVG. The path interpolates through 3 keyframes
              over 3s. SMIL-style animation in pure SVG would work too but
              Framer's keyframes give us prefers-reduced-motion control. */}
          <motion.svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            style={{
              position: 'relative',
              display: 'block',
              filter: `drop-shadow(0 0 20px ${theme.palette.primary.main}55)`,
            }}
            initial={false}
            animate={
              reduced
                ? { rotate: 0 }
                : {
                    rotate: [0, 90, 180, 270, 360],
                  }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 4, repeat: Infinity, ease: 'linear' }
            }
          >
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.palette.primary.main} />
                <stop offset="100%" stopColor={theme.palette.info.main} />
              </linearGradient>
            </defs>

            {/* Morphing shape — circle ↔ rounded square ↔ circle */}
            <motion.path
              fill="url(#logo-grad)"
              initial={false}
              animate={
                reduced
                  ? {
                      // Static circle for reduced-motion users
                      d: 'M 50 6 A 44 44 0 1 1 50 94 A 44 44 0 1 1 50 6 Z',
                    }
                  : {
                      d: [
                        // Frame 1: circle
                        'M 50 6 A 44 44 0 1 1 50 94 A 44 44 0 1 1 50 6 Z',
                        // Frame 2: rounded square
                        'M 18 18 Q 18 6 30 6 L 70 6 Q 82 6 82 18 L 82 82 Q 82 94 70 94 L 30 94 Q 18 94 18 82 Z',
                        // Frame 3: back to circle
                        'M 50 6 A 44 44 0 1 1 50 94 A 44 44 0 1 1 50 6 Z',
                      ],
                    }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }
            />

            {/* House icon (overlaid; counter-rotates so it stays upright
                while the morphing shape spins beneath it) */}
            <motion.g
              animate={reduced ? {} : { rotate: [0, -90, -180, -270, -360] }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 4, repeat: Infinity, ease: 'linear' }
              }
              style={{ transformOrigin: '50px 50px' }}
              fill="#fff"
            >
              {/* Roof */}
              <path d="M 30 48 L 50 32 L 70 48 Z" />
              {/* Body */}
              <rect x="34" y="48" width="32" height="22" rx="2" />
              {/* Door */}
              <rect x="46" y="58" width="8" height="12" rx="1" fill={theme.palette.primary.main} />
            </motion.g>
          </motion.svg>
        </Box>

        {/* ─── Wordmark + optional message ─── */}
        <Stack spacing={0.5} alignItems="center">
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: variant === 'inline' ? '1.2rem' : '1.6rem',
              letterSpacing: 0.5,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            VastuVerse
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {message || 'Loading'}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
