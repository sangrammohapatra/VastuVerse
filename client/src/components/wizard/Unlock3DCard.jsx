import { Box, Card, Stack, Typography, Button, Chip, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import LockIcon from '@mui/icons-material/Lock';
import ThreeDRotationIcon from '@mui/icons-material/ThreeDRotation';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';

const PERKS = [
  { Icon: VisibilityIcon,       label: 'Interactive Three.js walkthrough with hover labels' },
  { Icon: ThreeDRotationIcon,   label: 'AI bird\'s-eye photoreal render' },
  { Icon: ShareIcon,            label: 'Shareable read-only link for clients (30 days)' },
  { Icon: DownloadIcon,         label: 'High-res image downloads for presentations' },
];

const MotionCard = motion(Card);

/**
 * Locked-state card for Step 8.
 *
 *   onUnlock          () => Promise — invoked when "Unlock 3D View" clicked
 *   priceInr          numeric ₹ amount (display only)
 *   loading           true while creating order / opening Razorpay
 *   error             string | null
 */
export default function Unlock3DCard({ onUnlock, priceInr = 499, loading = false, error }) {
  const theme = useTheme();

  return (
    <MotionCard
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 220,
        damping: 14,        // low damping → springy bounce
        mass: 0.9,
      }}
      elevation={0}
      sx={{
        p: { xs: 3, md: 5 },
        position: 'relative',
        overflow: 'hidden',
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
      }}
    >
      {/* Decorative gradient blob */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,111,0,0.20), transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 3, md: 5 }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ position: 'relative' }}
      >
        {/* Lock illustration */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Box
            sx={{
              width: 110, height: 110, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              boxShadow: theme.vastu.glowPrimary,
              flexShrink: 0,
            }}
          >
            <LockIcon sx={{ fontSize: 52, color: '#fff' }} />
          </Box>
        </motion.div>

        {/* Pitch + CTA */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Chip
            label="PREMIUM"
            size="small"
            sx={{
              mb: 1.5,
              fontWeight: 800,
              letterSpacing: 1.2,
              background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
              color: '#fff',
              boxShadow: theme.vastu.glowSecondary,
            }}
          />
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '1.6rem', md: '2rem' },
              mb: 1,
              background: theme.vastu.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Unlock the 3D view
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, maxWidth: 540 }}>
            See your home in three dimensions. Walk through it from any angle, then
            get an AI bird's-eye render perfect for client presentations.
          </Typography>

          {/* Perks */}
          <Stack spacing={1} sx={{ mb: 3 }}>
            {PERKS.map(({ Icon, label }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
              >
                <Stack direction="row" alignItems="center" spacing={1.2}>
                  <Icon sx={{ color: 'primary.main', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>{label}</Typography>
                </Stack>
              </motion.div>
            ))}
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* CTA */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={2}
          >
            <Button
              size="large"
              variant="contained"
              disabled={loading}
              onClick={onUnlock}
              startIcon={loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <LockIcon />}
              sx={{
                px: 4,
                py: 1.5,
                fontWeight: 800,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                boxShadow: theme.vastu.glowPrimary,
                '&:hover': {
                  boxShadow: `0 0 44px ${theme.palette.primary.main}`,
                },
              }}
            >
              {loading ? 'Preparing checkout…' : `Unlock 3D View — ₹${priceInr}`}
            </Button>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              One-time unlock · Razorpay secure checkout · GST included
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </MotionCard>
  );
}
