import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Card, Tabs, Tab, TextField, MenuItem, Button, Alert,
  Skeleton, Snackbar, InputAdornment, Chip, IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArchitectureIcon from '@mui/icons-material/Architecture';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';

import EarningsCounters from '../../components/marketplace/EarningsCounters';
import RequestFeedCard from '../../components/marketplace/RequestFeedCard';
import PlaceBidPanel from '../../components/marketplace/PlaceBidPanel';

const TABS = [
  { id: 'open',     label: 'Open requests' },
  { id: 'myBids',   label: 'My bids' },
];

function inr(paise) { return '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN'); }

export default function ArchitectDashboard() {
  const theme = useTheme();
  const { user, accessToken } = useAuth();

  /* ─── State ─── */
  const [activeTab, setActiveTab] = useState('open');

  const [earnings, setEarnings] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(true);

  const [feed, setFeed] = useState([]);
  const [feedPhase, setFeedPhase] = useState('loading');

  const [myBids, setMyBids] = useState([]);
  const [bidsPhase, setBidsPhase] = useState('loading');

  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters (architect feed)
  const [city, setCity]     = useState('');
  const [state, setState]   = useState('');
  const [minBudget, setMin] = useState('');
  const [maxBudget, setMax] = useState('');

  // Bid panel
  const [bidTarget, setBidTarget] = useState(null);

  /* ─── Loaders ─── */
  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try {
      const { data } = await api.get('/marketplace/architects/me/earnings');
      setEarnings(data);
    } catch (e) {
      // Not-yet-verified architects get 404 here — surface a hint
      if (e.response?.data?.error === 'no_architect_profile') {
        setError('No architect profile found. Complete your profile setup to bid on requests.');
      }
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setFeedPhase('loading');
    try {
      const params = { limit: 30 };
      if (city.trim())  params.city  = city.trim();
      if (state.trim()) params.state = state.trim();
      if (minBudget && Number(minBudget) > 0) params.minBudget = Math.round(Number(minBudget) * 100);
      if (maxBudget && Number(maxBudget) > 0) params.maxBudget = Math.round(Number(maxBudget) * 100);
      const { data } = await api.get('/marketplace/review-requests', { params });
      setFeed(data.requests || []);
      setFeedPhase('ready');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load open requests');
      setFeedPhase('error');
    }
  }, [city, state, minBudget, maxBudget]);

  // For "My bids" we reuse /architects/me/earnings counters above + a
  // separate listing of my bids. Since we don't have a dedicated endpoint
  // we derive from /marketplace/review-requests?bidder=me — but that doesn't
  // exist either. The simplest path: list open requests, the feed marks
  // `myBid`. For accepted/completed bids the architect sees them in earnings.
  // For now, "My bids" tab shows: feed entries with `myBid` populated.
  useEffect(() => {
    if (activeTab === 'myBids') {
      setBidsPhase('loading');
      // We piggyback on the same feed but with a wider net (drop filters)
      api.get('/marketplace/review-requests', { params: { limit: 50 } })
        .then(({ data }) => {
          setMyBids((data.requests || []).filter((r) => r.myBid));
          setBidsPhase('ready');
        })
        .catch(() => setBidsPhase('error'));
    }
  }, [activeTab]);

  useEffect(() => { loadEarnings(); loadFeed(); }, [loadEarnings, loadFeed]);

  /* ─── Sockets: marketplace:newRequest, bidAccepted, reviewAccepted ─── */
  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  useEffect(() => {
    const socket = getSocket();

    const onNewRequest = (payload) => {
      setToast({ severity: 'info', message: `New request: "${payload.title}" · up to ${inr(payload.maxBudgetInr)}` });
      loadFeed();
    };
    const onBidAccepted = (payload) => {
      setToast({
        severity: 'success',
        message: `Your bid was accepted! ${inr(payload.proposedFee)} held in escrow.`,
      });
      loadEarnings(); loadFeed();
    };
    const onReviewAccepted = (payload) => {
      setToast({
        severity: 'success',
        message: `Payout released: ${inr(payload.payoutAmount)} to your account.`,
      });
      loadEarnings();
    };
    const onNewRating = (payload) => {
      setToast({
        severity: 'info',
        message: `New ${payload.stars}-star rating · avg now ${payload.newAverage}`,
      });
      loadEarnings();
    };

    socket.on('marketplace:newRequest',    onNewRequest);
    socket.on('marketplace:bidAccepted',   onBidAccepted);
    socket.on('marketplace:reviewAccepted',onReviewAccepted);
    socket.on('marketplace:newRating',     onNewRating);
    return () => {
      socket.off('marketplace:newRequest',    onNewRequest);
      socket.off('marketplace:bidAccepted',   onBidAccepted);
      socket.off('marketplace:reviewAccepted',onReviewAccepted);
      socket.off('marketplace:newRating',     onNewRating);
    };
  }, [loadEarnings, loadFeed]);

  /* ─── Render ─── */
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
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
              background: 'radial-gradient(circle, rgba(0,188,212,0.20), transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <Stack direction="row" spacing={2} alignItems="center" sx={{ position: 'relative' }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.primary.main})`,
                boxShadow: theme.vastu.glowPrimary,
              }}
            >
              <ArchitectureIcon sx={{ color: '#fff', fontSize: 30 }} />
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
                Architect workspace
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 540 }}>
                Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}.
                Review homeowner requests, place bids, and track earnings — all in one place.
              </Typography>
            </Box>
          </Stack>
        </Card>
      </motion.div>

      {/* Earnings counters */}
      <Box sx={{ mb: 3 }}>
        <EarningsCounters data={earnings} loading={earningsLoading} />
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_e, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} sx={{ fontWeight: 700 }} />
        ))}
      </Tabs>

      {/* Tab body */}
      {activeTab === 'open' ? (
        <Stack spacing={2}>
          <FiltersBar
            city={city} setCity={setCity}
            state={state} setState={setState}
            minBudget={minBudget} setMin={setMin}
            maxBudget={maxBudget} setMax={setMax}
            onRefresh={loadFeed}
          />

          {feedPhase === 'loading' ? (
            <Stack spacing={2}>
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />)}
            </Stack>
          ) : feedPhase === 'error' ? (
            <Alert severity="error">{error || 'Could not load feed.'}</Alert>
          ) : feed.length === 0 ? (
            <EmptyFeed />
          ) : (
            <AnimatePresence>
              {feed.map((req, i) => (
                <RequestFeedCard
                  key={req.id}
                  request={req}
                  index={i}
                  onBid={(r) => setBidTarget(r)}
                />
              ))}
            </AnimatePresence>
          )}
        </Stack>
      ) : (
        <Stack spacing={2}>
          {bidsPhase === 'loading' ? (
            <Stack spacing={2}>
              {[0, 1].map((i) => <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />)}
            </Stack>
          ) : myBids.length === 0 ? (
            <Card
              elevation={0}
              sx={{
                p: 4, textAlign: 'center',
                background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
                backdropFilter: theme.vastu.cardBlur,
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No bids yet</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Bids you place will show here. Switch to <strong>Open requests</strong> to find work.
              </Typography>
            </Card>
          ) : (
            <AnimatePresence>
              {myBids.map((req, i) => (
                <RequestFeedCard key={req.id} request={req} index={i} onBid={() => {}} />
              ))}
            </AnimatePresence>
          )}
        </Stack>
      )}

      {/* Bid drawer */}
      <PlaceBidPanel
        open={!!bidTarget}
        request={bidTarget}
        onClose={() => setBidTarget(null)}
        onPlaced={() => {
          setToast({ severity: 'success', message: 'Bid submitted — the homeowner has been notified.' });
          loadFeed();
        }}
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

/* ─── Filters bar ──────────────────────────────────────────────────── */

function FiltersBar({ city, setCity, state, setState, minBudget, setMin, maxBudget, setMax, onRefresh }) {
  const theme = useTheme();
  const hasFilters = city || state || minBudget || maxBudget;

  return (
    <Card
      elevation={0}
      sx={{
        p: 2,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexShrink: 0 }}>
          <FilterListIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Filter</Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ flex: 1 }}>
          <TextField
            size="small" label="City" value={city} onChange={(e) => setCity(e.target.value)}
            sx={{ flex: 1, minWidth: 120 }}
          />
          <TextField
            size="small" label="State" value={state} onChange={(e) => setState(e.target.value)}
            sx={{ flex: 1, minWidth: 120 }}
          />
          <TextField
            size="small" label="Min budget" value={minBudget}
            onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ''))}
            sx={{ flex: 1, minWidth: 110 }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          />
          <TextField
            size="small" label="Max budget" value={maxBudget}
            onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ''))}
            sx={{ flex: 1, minWidth: 110 }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          {hasFilters && (
            <Button
              size="small"
              onClick={() => { setCity(''); setState(''); setMin(''); setMax(''); }}
            >
              Clear
            </Button>
          )}
          <IconButton size="small" onClick={onRefresh} title="Refresh">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Card>
  );
}

function EmptyFeed() {
  const theme = useTheme();
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
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No open requests match your filters</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Try widening the city/state or removing the budget range. New requests stream in live.
      </Typography>
    </Card>
  );
}
