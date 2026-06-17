import { useState } from 'react';
import {
  Card, Box, Stack, Typography, Chip, IconButton, Collapse, Button, Avatar,
  Rating, Divider, Alert, CircularProgress, Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PaidIcon from '@mui/icons-material/Paid';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { api } from '../../utils/axiosInstance';
import { openCheckout } from '../../utils/razorpayClient';
import { useAuth } from '../../context/AuthContext';

const STATUS_META = {
  OPEN:        { color: '#2E7D32', bg: 'rgba(46,125,50,0.10)', label: 'OPEN — accepting bids' },
  IN_REVIEW:   { color: '#F57F17', bg: 'rgba(255,143,0,0.10)', label: 'IN REVIEW' },
  COMPLETED:   { color: '#0277BD', bg: 'rgba(2,119,189,0.10)', label: 'COMPLETED' },
  CANCELLED:   { color: '#C62828', bg: 'rgba(198,40,40,0.10)', label: 'CANCELLED' },
  EXPIRED:     { color: '#616161', bg: 'rgba(97,97,97,0.10)',  label: 'EXPIRED' },
};

const MotionCard = motion(Card);

function inr(paise) { return '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN'); }
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN');
}

/**
 * Homeowner-facing request card.
 *
 *   request     server response (with .bids inlined)
 *   onChange()  refetch after a bid is accepted / a review is opened
 *   onOpenReview(reviewId)  navigate to ReviewSubmissionView
 */
export default function RequestCard({ request, index = 0, onChange, onOpenReview }) {
  const theme = useTheme();
  const { user } = useAuth();

  const [expanded, setExpanded] = useState(request.status === 'OPEN');
  const [acceptingBidId, setAcceptingBidId] = useState(null);
  const [error, setError] = useState(null);

  const meta = STATUS_META[request.status] || STATUS_META.OPEN;
  const bids = request.bids || [];

  /* ─── Razorpay flow: accept a bid ─────────────────────────────── */
  const acceptBid = async (bid) => {
    setAcceptingBidId(bid.id);
    setError(null);
    try {
      const { data: order } = await api.post(`/marketplace/bids/${bid.id}/accept`);

      const result = await openCheckout({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        orderId: order.orderId,
        name: 'VastuVerse — Marketplace',
        description: order.description || 'Accept architect bid',
        prefill: { name: user?.fullName, email: user?.email, contact: user?.phone },
      });

      await api.post(`/marketplace/bids/${bid.id}/accept/verify`, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      onChange?.();
    } catch (e) {
      if (e?.code === 'dismissed') { setAcceptingBidId(null); return; }
      setError(e?.message || e.response?.data?.error || 'Could not accept bid');
    } finally {
      setAcceptingBidId(null);
    }
  };

  return (
    <MotionCard
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      elevation={0}
      sx={{
        p: 2.4,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
        borderLeft: `4px solid ${meta.color}`,
      }}
    >
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.2}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
              {request.title}
            </Typography>
            <motion.div
              key={request.status}                       // re-mount triggers transition on status change
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              <Chip
                label={meta.label}
                size="small"
                sx={{
                  fontWeight: 800, letterSpacing: 0.6,
                  background: meta.bg, color: meta.color,
                  border: `1px solid ${meta.color}55`,
                }}
              />
            </motion.div>
          </Stack>
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
                  {request.cityState.city}
                </Typography>
              </Stack>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              posted {timeAgo(request.createdAt)} · {bids.length} bid{bids.length === 1 ? '' : 's'}
            </Typography>
          </Stack>
        </Box>

        {request.status === 'IN_REVIEW' || request.status === 'COMPLETED' ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => onOpenReview?.(request._id)}
            sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
          >
            View review
          </Button>
        ) : (
          <IconButton
            size="small"
            onClick={() => setExpanded((v) => !v)}
            sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .25s' }}
          >
            <ExpandMoreIcon />
          </IconButton>
        )}
      </Stack>

      {request.description && (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mt: 1.2, fontSize: '0.88rem', lineHeight: 1.5 }}
        >
          {request.description}
        </Typography>
      )}

      {/* Bids — expandable */}
      <Collapse in={expanded} unmountOnExit>
        <Divider sx={{ my: 1.6 }} />
        {bids.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
            No bids yet. Architects will see your request in their feed.
          </Typography>
        ) : (
          <Stack spacing={1.2}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.7 }}>
              {bids.length} BID{bids.length === 1 ? '' : 'S'}
            </Typography>
            <AnimatePresence>
              {bids.map((bid, i) => (
                <BidRow
                  key={bid.id}
                  bid={bid}
                  index={i}
                  acceptDisabled={request.status !== 'OPEN' || acceptingBidId !== null}
                  accepting={acceptingBidId === bid.id}
                  onAccept={() => acceptBid(bid)}
                />
              ))}
            </AnimatePresence>
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      </Collapse>
    </MotionCard>
  );
}

/* ─── Individual bid row ──────────────────────────────────────────── */

function BidRow({ bid, index, onAccept, accepting, acceptDisabled }) {
  const theme = useTheme();
  const a = bid.architect || {};
  const initials = (a.fullName || a.email || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.05, duration: 0.35 }}
    >
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: bid.status === 'accepted'
            ? theme.palette.mode === 'dark' ? 'rgba(76,175,80,0.08)' : 'rgba(46,125,50,0.05)'
            : 'transparent',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Avatar src={a.avatarUrl} sx={{ width: 40, height: 40 }}>{initials}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {a.fullName || a.email || 'Architect'}
              </Typography>
              {a.rating?.count > 0 && (
                <Tooltip title={`${a.rating.average} avg from ${a.rating.count} review${a.rating.count === 1 ? '' : 's'}`}>
                  <Stack direction="row" alignItems="center" spacing={0.4}>
                    <Rating value={a.rating.average} precision={0.1} size="small" readOnly />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ({a.rating.count})
                    </Typography>
                  </Stack>
                </Tooltip>
              )}
              {a.totalReviewsCompleted > 0 && (
                <Chip
                  label={`${a.totalReviewsCompleted} done`}
                  size="small"
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                />
              )}
            </Stack>
            {bid.coverNote && (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                {bid.coverNote}
              </Typography>
            )}
            <Stack direction="row" spacing={1.5} sx={{ mt: 0.6 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {inr(bid.proposedFee)}
              </Typography>
              {bid.proposedTimeline && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {bid.proposedTimeline}d
                </Typography>
              )}
              {a.cityState?.city && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {a.cityState.city}
                </Typography>
              )}
            </Stack>
          </Box>

          {bid.status === 'accepted' ? (
            <Chip label="ACCEPTED" color="success" size="small" sx={{ fontWeight: 800 }} icon={<HowToRegIcon />} />
          ) : bid.status === 'rejected' ? (
            <Chip label="REJECTED" size="small" sx={{ fontWeight: 700 }} />
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={accepting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
              onClick={onAccept}
              disabled={acceptDisabled}
              sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
            >
              {accepting ? 'Opening…' : `Accept · ${inr(bid.proposedFee)}`}
            </Button>
          )}
        </Stack>
      </Box>
    </motion.div>
  );
}
