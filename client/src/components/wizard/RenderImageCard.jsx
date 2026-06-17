import { Card, Box, Stack, Typography, Skeleton, Button, IconButton, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import ReplayIcon from '@mui/icons-material/Replay';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const MotionCard = motion(Card);

/**
 * Generated-image card with skeleton + regenerate.
 *
 *   title, subtitle             header text
 *   status                      'idle' | 'generating' | 'ready' | 'error'
 *   imageUrl                    set when status === 'ready'
 *   onRegenerate()              hides if undefined
 *   extraHeader                 React node (e.g. left/right toggle)
 *   index                       stagger delay
 *   regenerateLabel             default "Regenerate"
 *   errorMessage                fallback text on error
 */
export default function RenderImageCard({
  title,
  subtitle,
  status = 'idle',
  imageUrl,
  onRegenerate,
  extraHeader,
  index = 0,
  regenerateLabel = 'Regenerate',
  errorMessage = "Couldn't render this view.",
}) {
  const theme = useTheme();

  return (
    <MotionCard
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      elevation={0}
      sx={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ p: 1.5, pb: 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {extraHeader}
      </Stack>

      {/* Body */}
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '1 / 1',
          background: theme.palette.mode === 'dark' ? '#0A0E1A' : '#F4F4F4',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          {status === 'generating' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Skeleton
                variant="rectangular"
                width="100%"
                height="100%"
                animation="wave"
                sx={{
                  bgcolor: theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.05)',
                  position: 'absolute',
                  inset: 0,
                }}
              />
              <Box
                sx={{
                  position: 'relative',
                  textAlign: 'center',
                  zIndex: 1,
                  color: 'text.secondary',
                  background: theme.palette.background.paper + 'BB',
                  borderRadius: 3,
                  px: 2.2,
                  py: 1.4,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <CircularProgress size={28} sx={{ mb: 0.8 }} />
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                  Rendering…
                </Typography>
              </Box>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center',
              }}
            >
              <ErrorOutlineIcon color="error" sx={{ fontSize: 36, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {errorMessage}
              </Typography>
              {onRegenerate && (
                <Button
                  size="small"
                  startIcon={<ReplayIcon />}
                  onClick={onRegenerate}
                  sx={{ mt: 1.5 }}
                >
                  Try again
                </Button>
              )}
            </motion.div>
          )}

          {status === 'ready' && imageUrl && (
            <motion.img
              key={imageUrl}
              src={imageUrl}
              alt={title}
              loading="lazy"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}

          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.palette.text.secondary,
                fontSize: 13,
              }}
            >
              Awaiting generation
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Footer */}
      {onRegenerate && status === 'ready' && (
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 1 }}>
          <IconButton size="small" onClick={onRegenerate} title={regenerateLabel}>
            <ReplayIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
    </MotionCard>
  );
}
