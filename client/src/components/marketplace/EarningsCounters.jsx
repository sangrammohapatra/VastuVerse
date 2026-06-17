import { Card, Box, Stack, Typography, Skeleton, Rating } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';

import PaidIcon from '@mui/icons-material/Paid';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import StarIcon from '@mui/icons-material/Star';

/**
 * Architect earnings dashboard counters.
 *
 *   data    server response from GET /marketplace/architects/me/earnings
 *           {
 *             totalEarningsPaise, pendingPayoutPaise, totalReviewsCompleted,
 *             rating: { average, count }, bidCounts: {...}, commissionPct
 *           }
 *   loading boolean
 */
export default function EarningsCounters({ data, loading = false }) {
  const theme = useTheme();

  const totalRupees   = (data?.totalEarningsPaise || 0) / 100;
  const pendingRupees = (data?.pendingPayoutPaise || 0) / 100;
  const completed     = data?.totalReviewsCompleted || 0;
  const avg           = data?.rating?.average || 0;
  const ratingCount   = data?.rating?.count || 0;

  const cards = [
    {
      key: 'total',
      Icon: PaidIcon,
      label: 'Total earnings',
      accent: theme.palette.primary.main,
      glow: 'rgba(46,125,50,0.18)',
      render: () => (
        <Stack direction="row" alignItems="baseline" spacing={0.3}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.secondary' }}>₹</Typography>
          <CountUp
            end={totalRupees}
            duration={1.4}
            separator=","
            decimals={totalRupees < 1000 ? 0 : 0}
            style={{ fontSize: '1.7rem', fontWeight: 800 }}
          />
        </Stack>
      ),
      sub: data?.commissionPct ? `after ${data.commissionPct}% platform commission` : null,
    },
    {
      key: 'pending',
      Icon: HourglassEmptyIcon,
      label: 'Pending payout',
      accent: theme.palette.warning.main,
      glow: 'rgba(255,143,0,0.18)',
      render: () => (
        <Stack direction="row" alignItems="baseline" spacing={0.3}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.secondary' }}>₹</Typography>
          <CountUp
            end={pendingRupees}
            duration={1.4}
            separator=","
            decimals={0}
            style={{ fontSize: '1.7rem', fontWeight: 800 }}
          />
        </Stack>
      ),
      sub: data?.bidCounts?.accepted
        ? `${data.bidCounts.accepted} active engagement${data.bidCounts.accepted === 1 ? '' : 's'}`
        : 'no active engagements',
    },
    {
      key: 'completed',
      Icon: HowToRegIcon,
      label: 'Reviews completed',
      accent: theme.palette.info.main,
      glow: 'rgba(0,188,212,0.18)',
      render: () => (
        <CountUp
          end={completed}
          duration={1.2}
          separator=","
          style={{ fontSize: '1.7rem', fontWeight: 800 }}
        />
      ),
      sub: data?.bidCounts?.pending
        ? `${data.bidCounts.pending} pending bid${data.bidCounts.pending === 1 ? '' : 's'}`
        : null,
    },
    {
      key: 'rating',
      Icon: StarIcon,
      label: 'Average rating',
      accent: '#FFB300',
      glow: 'rgba(255,179,0,0.18)',
      render: () => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CountUp
            end={avg}
            duration={1.4}
            decimals={1}
            style={{ fontSize: '1.7rem', fontWeight: 800 }}
          />
          <Rating
            value={avg}
            precision={0.1}
            readOnly
            size="small"
            sx={{ '& .MuiRating-iconFilled': { color: '#FFB300' } }}
          />
        </Stack>
      ),
      sub: ratingCount > 0
        ? `from ${ratingCount} review${ratingCount === 1 ? '' : 's'}`
        : 'no ratings yet',
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        gap: 2,
      }}
    >
      {cards.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
              borderTop: `3px solid ${c.accent}`,
              transition: 'transform .25s, box-shadow .25s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 0 32px ${c.glow}`,
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
                background: c.glow,
                filter: 'blur(28px)',
                pointerEvents: 'none',
              }}
            />
            <Stack spacing={1} sx={{ position: 'relative' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <c.Icon sx={{ color: c.accent, fontSize: 20 }} />
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.7 }}
                >
                  {c.label.toUpperCase()}
                </Typography>
              </Stack>
              <Box sx={{ minHeight: 40 }}>
                {loading ? <Skeleton width={110} height={36} /> : c.render()}
              </Box>
              {c.sub && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                  {c.sub}
                </Typography>
              )}
            </Stack>
          </Card>
        </motion.div>
      ))}
    </Box>
  );
}
