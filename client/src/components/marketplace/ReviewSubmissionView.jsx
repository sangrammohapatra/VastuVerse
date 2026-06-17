import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Box, Stack, Typography, Button, Alert, CircularProgress, Chip, Avatar,
  Rating, TextField, Divider, Skeleton, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DangerousOutlinedIcon from '@mui/icons-material/DangerousOutlined';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';

import { api } from '../../utils/axiosInstance';

const SEVERITY_META = {
  info:     { color: '#0277BD', bg: 'rgba(2,119,189,0.10)',   Icon: InfoOutlinedIcon,         label: 'INFO' },
  minor:    { color: '#F57F17', bg: 'rgba(245,127,23,0.10)',  Icon: ReportProblemOutlinedIcon, label: 'MINOR' },
  major:    { color: '#E64A19', bg: 'rgba(230,74,25,0.10)',   Icon: ErrorOutlineIcon,         label: 'MAJOR' },
  critical: { color: '#C62828', bg: 'rgba(198,40,40,0.10)',   Icon: DangerousOutlinedIcon,    label: 'CRITICAL' },
};

const STEP_LABELS = {
  step1: 'Land', step2: 'Rooms', step3: 'Floor Plan', step4: 'Interior',
  step5: 'Exterior', step6: 'Utilities', step7: 'Cost', step8: '3D View',
  step9: 'Municipal', step10: 'Review',
};

/**
 * Homeowner's view of an architect's submitted review.
 *
 *   requestId   the ReviewRequest id
 *   onBack()    navigate back to Marketplace list
 *   onAccepted() callback when review is accepted + rated
 */
export default function ReviewSubmissionView({ requestId, onBack, onAccepted }) {
  const theme = useTheme();

  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [review, setReview] = useState(null);
  const [error, setError]   = useState(null);

  const [accepting, setAccepting] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  const load = useCallback(async () => {
    if (!requestId) return;
    setPhase('loading'); setError(null);
    try {
      const { data } = await api.get(`/marketplace/review-requests/${requestId}/review`);
      setReview(data.review);
      setPhase('ready');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load review');
      setPhase('error');
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  const annotationsBySeverity = useMemo(() => {
    if (!review?.annotations) return { critical: [], major: [], minor: [], info: [] };
    return review.annotations.reduce((acc, a) => {
      const sev = a.severity || 'info';
      (acc[sev] ||= []).push(a);
      return acc;
    }, { critical: [], major: [], minor: [], info: [] });
  }, [review]);

  const acceptReview = async () => {
    setAccepting(true); setError(null);
    try {
      await api.post(`/marketplace/reviews/${review._id}/accept`);
      await load();
      setRatingOpen(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not accept review');
    } finally {
      setAccepting(false);
    }
  };

  const handleRated = () => {
    setRatingOpen(false);
    onAccepted?.();
    load();
  };

  /* ─── Loading ─── */
  if (phase === 'loading') {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={480} sx={{ borderRadius: 2 }} />
        <Stack spacing={1.2}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 2 }} />)}
        </Stack>
      </Stack>
    );
  }

  /* ─── Error ─── */
  if (phase === 'error' || !review) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start' }}>
          Back to requests
        </Button>
        <Alert severity="error">{error || 'No review available yet.'}</Alert>
      </Stack>
    );
  }

  const arch = review.architectId || {};
  const isAccepted = review.status === 'accepted';
  const isRated = !!review.userRating;
  const initials = (arch.fullName || arch.email || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back to requests
        </Button>
        {isAccepted && (
          <Chip
            icon={<CheckCircleIcon />}
            label={`ACCEPTED · ₹${Math.round((review.bidId ? 0 : 0)).toLocaleString('en-IN')} released`}
            color="success"
            sx={{ fontWeight: 800 }}
          />
        )}
      </Stack>

      {/* Architect intro card */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.4, md: 3 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Stack direction="row" spacing={1.8} alignItems="center">
            <Avatar src={arch.avatarUrl} sx={{ width: 56, height: 56, fontSize: '1.2rem' }}>
              {initials}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {arch.fullName || arch.email || 'Architect review'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Review submitted {review.submittedAt
                  ? new Date(review.submittedAt).toLocaleString('en-IN')
                  : '—'}
                {' · '}
                {review.annotations?.length || 0} annotation{(review.annotations?.length || 0) === 1 ? '' : 's'}
              </Typography>
            </Box>
          </Stack>

          {!isAccepted ? (
            <Button
              size="large"
              variant="contained"
              startIcon={accepting
                ? <CircularProgress size={20} sx={{ color: '#fff' }} />
                : <VerifiedIcon />}
              onClick={acceptReview}
              disabled={accepting}
              sx={{
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                boxShadow: theme.vastu.glowPrimary,
                '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
              }}
            >
              {accepting ? 'Releasing payout…' : 'Accept review & release payout'}
            </Button>
          ) : isRated ? (
            <Chip
              icon={<StarIcon />}
              label={`You rated ${review.userRating}/5`}
              sx={{ fontWeight: 800, fontSize: '0.85rem' }}
              color="primary"
              variant="outlined"
            />
          ) : (
            <Button variant="outlined" startIcon={<StarIcon />} onClick={() => setRatingOpen(true)}>
              Rate the architect
            </Button>
          )}
        </Stack>

        {review.summary && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              Architect's summary
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.6, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {review.summary}
            </Typography>
          </>
        )}

        {review.recommendedChanges?.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              Recommended changes
            </Typography>
            <Stack component="ul" sx={{ mt: 0.6, pl: 2.5, mb: 0 }} spacing={0.5}>
              {review.recommendedChanges.map((c, i) => (
                <Typography key={i} component="li" variant="body2">{c}</Typography>
              ))}
            </Stack>
          </>
        )}
      </Card>

      {/* PDF embed */}
      {review.reportUrl ? (
        <Card
          elevation={0}
          sx={{
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ p: 1.4, borderBottom: `1px solid ${theme.palette.divider}` }}
          >
            <DescriptionIcon sx={{ color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 700, flex: 1 }}>Annotated PDF</Typography>
            <Button
              size="small"
              component="a"
              href={review.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in new tab
            </Button>
          </Stack>
          <Box
            component="iframe"
            src={review.reportUrl}
            title="Architect review PDF"
            sx={{
              width: '100%',
              height: { xs: 480, md: 680 },
              border: 'none',
              display: 'block',
              background: theme.palette.background.paper,
            }}
          />
        </Card>
      ) : (
        <Alert severity="info">
          The architect did not attach a PDF — the review is captured entirely as annotations + summary.
        </Alert>
      )}

      {/* Annotations — grouped by severity, critical first */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.2 }}>
          Annotations
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            fontSize: '1.4rem',
            mb: 1.5,
          }}
        >
          {review.annotations?.length || 0} item{(review.annotations?.length || 0) === 1 ? '' : 's'} from the architect
        </Typography>

        <Stack spacing={1.2}>
          <AnimatePresence>
            {['critical', 'major', 'minor', 'info'].map((sev) => {
              const items = annotationsBySeverity[sev];
              if (!items.length) return null;
              return items.map((a, i) => (
                <AnnotationCard
                  key={`${sev}-${i}`}
                  annotation={a}
                  index={i + (sev === 'critical' ? 0 : sev === 'major' ? 5 : sev === 'minor' ? 10 : 15)}
                />
              ));
            })}
          </AnimatePresence>
        </Stack>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Rating dialog */}
      <RatingDialog
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        reviewId={review._id}
        architectName={arch.fullName || arch.email || 'the architect'}
        onRated={handleRated}
      />
    </Stack>
  );
}

/* ─── Annotation card ─────────────────────────────────────────────── */

function AnnotationCard({ annotation, index = 0 }) {
  const theme = useTheme();
  const meta = SEVERITY_META[annotation.severity || 'info'];
  const Icon = meta.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        elevation={0}
        sx={{
          p: 1.6,
          background: meta.bg,
          border: `1px solid ${meta.color}55`,
          borderLeft: `4px solid ${meta.color}`,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.4}>
          <Icon sx={{ color: meta.color, mt: 0.2 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap="wrap"
              sx={{ mb: 0.4 }}
            >
              <Chip
                label={meta.label}
                size="small"
                sx={{
                  fontWeight: 800, letterSpacing: 0.7, height: 18, fontSize: '0.62rem',
                  background: meta.color, color: '#fff',
                }}
              />
              {annotation.stepName && (
                <Chip
                  label={STEP_LABELS[annotation.stepName] || annotation.stepName}
                  size="small"
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                />
              )}
              {annotation.roomId && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {annotation.roomId}
                </Typography>
              )}
            </Stack>
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}
            >
              {annotation.note}
            </Typography>
          </Box>
        </Stack>
      </Card>
    </motion.div>
  );
}

/* ─── Rating dialog ───────────────────────────────────────────────── */

function RatingDialog({ open, onClose, reviewId, architectName, onRated }) {
  const theme = useTheme();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!stars) return;
    setSending(true); setError(null);
    try {
      await api.post(`/marketplace/reviews/${reviewId}/rating`, { stars, comment: comment.trim() });
      setStars(5); setComment('');
      onRated?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not submit rating');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !sending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Rate {architectName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
          <Rating
            name="architect-rating"
            value={stars}
            onChange={(_e, v) => setStars(v || 0)}
            size="large"
            sx={{ '& .MuiRating-iconFilled': { color: '#FFB300' }, fontSize: '2.4rem' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {stars === 5 ? 'Excellent'
              : stars === 4 ? 'Very good'
              : stars === 3 ? 'Good'
              : stars === 2 ? 'Below average'
              : stars === 1 ? 'Poor'
              : 'Pick a rating'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={5}
            label="Optional comment"
            placeholder="What did the architect do well? Anything they could improve?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            size="small"
            inputProps={{ maxLength: 2000 }}
          />
          {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={sending}>Skip</Button>
        <Button
          variant="contained"
          onClick={send}
          disabled={!stars || sending}
          startIcon={sending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <StarIcon />}
          sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
        >
          {sending ? 'Submitting…' : 'Submit rating'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
