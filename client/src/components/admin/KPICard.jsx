import { Card, Box, Stack, Typography, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';

/**
 * KPI card with animated counter.
 *
 *   icon       MUI icon component
 *   label      uppercase eyebrow text
 *   value      number to animate to
 *   decimals   default 0
 *   prefix     e.g. '₹'
 *   suffix     e.g. ' active'
 *   accent     CSS color
 *   loading    boolean
 *   index      stagger position
 *   sub        small sub-text below value
 */
export default function KPICard({
  icon: Icon,
  label,
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  accent,
  loading = false,
  index = 0,
  sub,
}) {
  const theme = useTheme();
  const color = accent || theme.palette.primary.main;
  const glow = color + '24'; // 14% opacity hex

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.4 },
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          WebkitBackdropFilter: theme.vastu.cardBlur,
          borderTop: `3px solid ${color}`,
          transition: 'transform .25s, box-shadow .25s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 0 32px ${glow}`,
          },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -30, right: -30,
            width: 100, height: 100,
            borderRadius: '50%',
            background: glow,
            filter: 'blur(28px)',
            pointerEvents: 'none',
          }}
        />
        <Stack spacing={1} sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {Icon && <Icon sx={{ color, fontSize: 20 }} />}
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.7 }}
            >
              {label.toUpperCase()}
            </Typography>
          </Stack>
          <Box sx={{ minHeight: 40 }}>
            {loading ? (
              <Skeleton width={110} height={36} />
            ) : (
              <Stack direction="row" alignItems="baseline" spacing={0.3}>
                {prefix && (
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.secondary' }}>
                    {prefix}
                  </Typography>
                )}
                <CountUp
                  end={Number.isFinite(value) ? value : 0}
                  duration={1.4}
                  decimals={decimals}
                  separator=","
                  style={{ fontSize: '1.7rem', fontWeight: 800 }}
                />
                {suffix && (
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>
                    {suffix}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
          {sub && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              {sub}
            </Typography>
          )}
        </Stack>
      </Card>
    </motion.div>
  );
}
