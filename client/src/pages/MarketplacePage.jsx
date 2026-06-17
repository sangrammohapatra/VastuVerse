import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, Alert, Card, Tabs, Tab, Skeleton, Snackbar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import StorefrontIcon from '@mui/icons-material/Storefront';

import { api } from '../utils/axiosInstance';
import { getSocket, setAuthToken } from '../utils/socketClient';
import { useAuth } from '../context/AuthContext';

import PostRequestPanel from '../components/marketplace/PostRequestPanel';
import RequestCard from '../components/marketplace/RequestCard';
import ReviewSubmissionView from '../components/marketplace/ReviewSubmissionView';

const TABS = [
  { id: 'open',      label: 'Open' },
  { id: 'inReview',  label: 'In review' },
  { id: 'completed', label: 'Completed' },
  { id: 'all',       label: 'All' },
];

function matchesTab(req, tab) {
  if (tab === 'all') return true;
  if (tab === 'open')      return req.status === 'OPEN';
  if (tab === 'inReview')  return req.status === 'IN_REVIEW';
  if (tab === 'completed') return req.status === 'COMPLETED';
  return true;
}

export default function MarketplacePage() {
  const theme = useTheme();
  const { user, accessToken } = useAuth();

  const [requests, setRequests] = useState([]);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);

  const [completedPlans, setCompletedPlans] = useState([]);
  const [postOpen, setPostOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('open');
  const [openReviewId, setOpenReviewId] = useState(null);

  const [toast, setToast] = useState(null);

  const loadRequests = useCallback(async () => {
    setPhase('loading');
    try {
      const { data } = await api.get('/marketplace/review-requests/mine');
      setRequests(data.requests || []);
      setPhase('ready');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load requests');
      setPhase('error');
    }
  }, []);

  const loadCompletedPlans = useCallback(async () => {
    try {
      const { data } = await api.get('/plans', { params: { status: 'COMPLETED', limit: 50 } });
      setCompletedPlans(data.plans || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadRequests(); loadCompletedPlans(); }, [loadRequests, loadCompletedPlans]);

  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  useEffect(() => {
    const socket = getSocket();
    const onNewBid = (payload) => {
      setToast({
        severity: 'info',
        message: `New bid · ₹${(payload.proposedFee / 100).toLocaleString('en-IN')} from ${payload.architect?.fullName || 'an architect'}`,
      });
      loadRequests();
    };
    const onReviewSubmitted = () => {
      setToast({ severity: 'success', message: 'Your architect submitted a review' });
      loadRequests();
    };
    socket.on('marketplace:newBid', onNewBid);
    socket.on('marketplace:reviewSubmitted', onReviewSubmitted);
    return () => {
      socket.off('marketplace:newBid', onNewBid);
      socket.off('marketplace:reviewSubmitted', onReviewSubmitted);
    };
  }, [loadRequests]);

  const filtered = useMemo(() => requests.filter((r) => matchesTab(r, activeTab)), [requests, activeTab]);

  const counts = useMemo(() => ({
    open:      requests.filter((r) => r.status === 'OPEN').length,
    inReview:  requests.filter((r) => r.status === 'IN_REVIEW').length,
    completed: requests.filter((r) => r.status === 'COMPLETED').length,
    all:       requests.length,
  }), [requests]);

  if (openReviewId) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
        <ReviewSubmissionView
          requestId={openReviewId}
          onBack={() => { setOpenReviewId(null); loadRequests(); }}
          onAccepted={() => {
            setToast({ severity: 'success', message: 'Payout released to architect. Thank you for using VastuVerse!' });
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            mb: 3,
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute', top: -80, right: -80,
              width: 240, height: 240, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(46,125,50,0.20), transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
            sx={{ position: 'relative' }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 56, height: 56, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                  boxShadow: theme.vastu.glowPrimary,
                }}
              >
                <StorefrontIcon sx={{ color: '#fff', fontSize: 30 }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontFamily: '"Playfair Display", serif',
                    fontWeight: 700,
                    fontSize: { xs: '1.6rem', md: '2rem' },
                    background: theme.vastu.gradientText,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Architect Marketplace
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 540 }}>
                  Post your completed plan for review. Licensed architects bid; you pick one;
                  payout is escrowed and released only after you accept the submitted review.
                </Typography>
              </Box>
            </Stack>

            <Button
              size="large"
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setPostOpen(true)}
              disabled={completedPlans.length === 0}
              sx={{
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                boxShadow: theme.vastu.glowPrimary,
                '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
              }}
            >
              Post review request
            </Button>
          </Stack>
        </Card>
      </motion.div>

      <Tabs
        value={activeTab}
        onChange={(_e, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={`${t.label} (${counts[t.id] || 0})`}
            sx={{ fontWeight: 700 }}
          />
        ))}
      </Tabs>

      {phase === 'loading' ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />)}
        </Stack>
      ) : phase === 'error' ? (
        <Alert severity="error">{error}</Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          completedPlansCount={completedPlans.length}
          activeTab={activeTab}
          onPost={() => setPostOpen(true)}
        />
      ) : (
        <Stack spacing={2}>
          <AnimatePresence>
            {filtered.map((req, i) => (
              <RequestCard
                key={req._id}
                request={req}
                index={i}
                onChange={loadRequests}
                onOpenReview={() => setOpenReviewId(req._id)}
              />
            ))}
          </AnimatePresence>
        </Stack>
      )}

      <PostRequestPanel
        open={postOpen}
        onClose={() => setPostOpen(false)}
        completedPlans={completedPlans}
        onCreated={() => { loadRequests(); setToast({ severity: 'success', message: 'Request posted to architects' }); }}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ minWidth: 280 }}>
            {toast.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  );
}

function EmptyState({ completedPlansCount, activeTab, onPost }) {
  const theme = useTheme();

  if (completedPlansCount === 0) {
    return (
      <Card
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          textAlign: 'center',
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <StorefrontIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No completed plans yet</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420, mx: 'auto' }}>
          Finish a plan and mark it as <strong>Completed</strong> in step 10. You can then post it for
          architect review here.
        </Typography>
      </Card>
    );
  }

  const label = activeTab === 'open' ? 'open'
              : activeTab === 'inReview' ? 'in-review'
              : activeTab === 'completed' ? 'completed'
              : '';
  return (
    <Card
      elevation={0}
      sx={{
        p: { xs: 3, md: 5 },
        textAlign: 'center',
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
      }}
    >
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No {label} requests</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        {activeTab === 'open'
          ? "You don't have any active review requests right now."
          : `You haven't reached the ${label} stage yet.`}
      </Typography>
      <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={onPost}>
        Post a request
      </Button>
    </Card>
  );
}
