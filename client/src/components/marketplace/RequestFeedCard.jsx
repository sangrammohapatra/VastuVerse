import { Card, Box, Stack, Typography, Button, Chip, Avatar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import GavelIcon from '@mui/icons-material/Gavel';
import PaidIcon from '@mui/icons-material/Paid';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';

function inr(paise) { return '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN'); }
function initials(s = '') {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

const MotionCard = motion(Card);

const BID_STATUS_META = {
  pending:  { color: '#F57F17', label: 'Bid pending' },
  accepted: { color: '#2E7D32', label: 'Bid accepted' },
  rejected: { color: '#C62828', label: 'Bid rejected' },
  completed:{ color: '#0277BD', label: 'Completed' },
};

/**
 * Open-request preview for the architect feed.
 *
 *   request    one item from GET /marketplace/review-requests
 *   onBid()    opens PlaceBidPanel
 *   index      stagger position
 */
export default function RequestFeedCard({ request, onBid, index = 0 }) {
  const theme = useTheme();
  const me = request.myBid;
  const meta = me ? BID_STATUS_META[me.status] : null;

  return (
    <MotionCard
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      elevation={0}
      sx={{
        p: 2.2,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        transition: 'transform .25s, box-shadow .25s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.vastu.glowPrimary,
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 0.6 }}>
            <Avatar
              src={request.homeowner?.avatarUrl}
              sx={{ width: 32, height: 32, fontSize: '0.78rem' }}
            >
              {initials(request.homeowner?.fullName || 'H')}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                {request.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                by {request.homeowner?.fullName || 'a VastuVerse user'} · {timeAgo(request.createdAt)}
              </Typography>
            </Box>
          </Stack>

          {request.description && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary', fontSize: '0.85rem',
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
                mt: 0.5, mb: 1.2,
              }}
            >
              {request.description}
            </Typography>
          )}

          <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <PaidIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                up to {inr(request.maxBudgetInr)}
              </Typography>
            </Stack>
            {request.preferredTimelineDays && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {request.preferredTimelineDays}d
                </Typography>
              </Stack>
            )}
            {request.cityState?.city && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {request.cityState.city}{request.cityState.state && `, ${request.cityState.state}`}
                </Typography>
              </Stack>
            )}
            <Chip
              label={`${request.bidCount || 0} bid${(request.bidCount || 0) === 1 ? '' : 's'}`}
              size="small"
              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
            />
          </Stack>
        </Box>

        {me ? (
          <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Chip
              label={meta?.label || me.status}
              size="small"
              sx={{
                fontWeight: 800, letterSpacing: 0.5,
                bgcolor: `${meta?.color || '#666'}1A`,
                color: meta?.color || 'text.secondary',
                border: `1px solid ${meta?.color || theme.palette.divider}55`,
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
              Your bid: {inr(me.proposedFee)}
            </Typography>
          </Stack>
        ) : (
          <Button
            variant="contained"
            size="medium"
            startIcon={<GavelIcon />}
            onClick={() => onBid?.(request)}
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              boxShadow: theme.vastu.glowPrimary,
              '&:hover': { boxShadow: `0 0 32px ${theme.palette.primary.main}` },
            }}
          >
            Place Bid
          </Button>
        )}
      </Stack>
    </MotionCard>
  );
}
