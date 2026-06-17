import { Box, Card, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

const MotionCard = motion(Card);

/**
 * Triple-palette picker — one card per palette, each with circular swatches.
 *
 *   palettes        [{ id, name, description, colors: [hex,…] }]
 *   loading         boolean — show 3 skeleton cards
 *   selectedId      string
 *   onSelect(id)
 */
export default function PaletteSwatches({
  palettes = [],
  loading = false,
  selectedId,
  onSelect,
}) {
  const theme = useTheme();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Card
            key={i}
            elevation={0}
            sx={{
              p: 2.2,
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
            }}
          >
            <Skeleton variant="text" width="60%" height={20} />
            <Stack direction="row" spacing={1.2} sx={{ mt: 1.5 }}>
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} variant="circular" width={44} height={44} />
              ))}
            </Stack>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 2,
      }}
    >
      {palettes.map((p, i) => {
        const isSelected = selectedId === p.id;
        return (
          <MotionCard
            key={p.id}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.4,
              delay: i * 0.1,
              type: 'spring',
              stiffness: 220,
              damping: 18,
            }}
            elevation={0}
            onClick={() => onSelect?.(p.id)}
            sx={{
              p: 2.2,
              cursor: 'pointer',
              background: theme.vastu.cardBg,
              border: isSelected
                ? `2px solid ${theme.palette.success.main}`
                : theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              WebkitBackdropFilter: theme.vastu.cardBlur,
              transition: 'border-color .25s',
              position: 'relative',
            }}
          >
            {/* Pulsing border ring when selected */}
            {isSelected && (
              <motion.div
                aria-hidden
                animate={{
                  boxShadow: [
                    `0 0 0 0 ${theme.palette.success.main}66`,
                    `0 0 0 10px ${theme.palette.success.main}00`,
                  ],
                }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: 'inherit',
                  pointerEvents: 'none',
                }}
              />
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</Typography>
              {isSelected && (
                <Typography
                  variant="caption"
                  sx={{ color: 'success.main', fontWeight: 700 }}
                >
                  Selected
                </Typography>
              )}
            </Stack>
            {p.description && (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', mt: 0.4, fontSize: '0.8rem' }}
              >
                {p.description}
              </Typography>
            )}

            {/* Swatch row */}
            <Stack direction="row" spacing={1.2} sx={{ mt: 1.5 }}>
              {(p.colors || []).slice(0, 4).map((c, j) => (
                <motion.div
                  key={j}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: i * 0.1 + j * 0.06,
                    type: 'spring',
                    stiffness: 380,
                    damping: 18,
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: c,
                    border: `2px solid ${theme.palette.background.paper}`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                  }}
                  title={c}
                />
              ))}
            </Stack>
          </MotionCard>
        );
      })}
    </Box>
  );
}
