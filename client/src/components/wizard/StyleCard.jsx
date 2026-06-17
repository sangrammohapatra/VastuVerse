import { Card, CardActionArea, Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

const MotionCard = motion(Card);

/**
 * Reusable gradient-band style card.
 *
 *   style.id, style.label, style.gradient, style.description, style.Icon?
 *   selected            boolean
 *   onSelect(id)
 *   index               stagger delay
 *   compact             tighter padding for exterior (where the palette is denser)
 */
export default function StyleCard({
  style,
  selected = false,
  onSelect,
  index = 0,
  compact = false,
}) {
  const theme = useTheme();
  const Icon = style.Icon;

  return (
    <MotionCard
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05, ease: 'easeOut' }}
      whileHover={selected ? undefined : { y: -3 }}
      elevation={0}
      sx={{
        overflow: 'hidden',
        background: theme.vastu.cardBg,
        border: selected
          ? `2px solid ${theme.palette.primary.main}`
          : theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: selected ? theme.vastu.glowPrimary : theme.vastu.cardShadow,
        transition: 'border-color .25s, box-shadow .25s',
        height: '100%',
      }}
    >
      <CardActionArea
        onClick={() => onSelect?.(style.id)}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Gradient band */}
        <Box
          sx={{
            height: compact ? 36 : 56,
            background: style.gradient,
            position: 'relative',
          }}
        >
          {/* Subtle radial highlight on the band */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 80% 30%, rgba(255,255,255,0.35), transparent 60%)',
            }}
          />
        </Box>

        <Box sx={{ p: compact ? 1.5 : 2, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            {Icon && <Icon sx={{ color: 'info.main', fontSize: 22 }} />}
            <Typography sx={{ fontWeight: 700, fontSize: '0.98rem' }}>{style.label}</Typography>
          </Stack>
          {style.description && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.5, fontSize: '0.82rem', lineHeight: 1.4 }}
            >
              {style.description}
            </Typography>
          )}
        </Box>
      </CardActionArea>
    </MotionCard>
  );
}
