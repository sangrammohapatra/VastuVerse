import { useMemo, useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Stack, Typography, Button, Chip, Card,
  LinearProgress, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupsIcon from '@mui/icons-material/Groups';
import PaymentsIcon from '@mui/icons-material/Payments';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import RoomIcon from '@mui/icons-material/Room';
import VerifiedIcon from '@mui/icons-material/Verified';

import { useAuth } from '../context/AuthContext';
import { api } from '../utils/axiosInstance';
import PlanCard from '../components/PlanCard';
import { timeAgo } from '../utils/timeAgo';

const TIER_META = {
  FREE:       { color: 'default', label: 'Free' },
  BASIC:      { color: 'primary', label: 'Basic' },
  PRO:        { color: 'secondary', label: 'Pro' },
  ENTERPRISE: { color: 'info', label: 'Enterprise' },
};

/* ----------------------------------------------------------------------- */

function GradientHeading({ children, sx }) {
  const theme = useTheme();
  return (
    <Typography
      component="h1"
      sx={{
        fontFamily: '"Playfair Display", serif',
        fontWeight: 700,
        fontSize: { xs: '1.9rem', md: '2.6rem' },
        lineHeight: 1.15,
        background: theme.vastu.gradientText,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

function GlassPanel({ children, sx }) {
  const theme = useTheme();
  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
        ...sx,
      }}
    >
      {children}
    </Card>
  );
}

/** Animated SVG progress ring driven by Framer Motion strokeDashoffset. */
function ProgressRing({ value, max, size = 130, label, sublabel }) {
  const reduce = useReducedMotion();
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const offset = circumference * (1 - ratio);

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="vvRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2E7D32" />
            <stop offset="100%" stopColor="#00BCD4" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="url(#vvRingGrad)" strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={circumference}
          initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut' }}
        />
      </svg>
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{ position: 'absolute', inset: 0, textAlign: 'center' }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>{label}</Typography>
        {sublabel && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{sublabel}</Typography>
        )}
      </Stack>
    </Box>
  );
}

/* ── Role panes ───────────────────────────────────────────────────────── */

function HomeownerDashboard({ user }) {
  const theme = useTheme();
  const tier = TIER_META[user?.tier] || TIER_META.FREE;
  const [plans, setPlans] = useState([]);
  const [aiUsage, setAiUsage] = useState({ used: 0, limit: 3 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [plansRes, usageRes] = await Promise.all([
          api.get('/plans', { params: { limit: 3 } }),
          api.get('/ai/usage'),
        ]);
        if (!cancelled) {
          setPlans(plansRes.data.plans || []);
          setAiUsage({ used: usageRes.used ?? 0, limit: usageRes.limit ?? 3 });
        }
      } catch (_) {
        // silent — empty state handles the no-data case
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const remaining = Math.max(0, aiUsage.limit - aiUsage.used);
  const displayName = useMemo(() => {
    if (user?.fullName) return user.fullName;
    if (user?.email) return user.email.split('@')[0].replace(/[._-]/g, ' ');
    return 'friend';
  }, [user]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {/* Greeting + CTA */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={3}
        sx={{ mb: 4 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <Chip
              icon={<VerifiedIcon sx={{ fontSize: 16 }} />}
              label={tier.label}
              color={tier.color}
              size="small"
              sx={{ fontWeight: 700 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {user?.role || 'homeowner'}
            </Typography>
          </Stack>
          <GradientHeading sx={{ textTransform: 'capitalize' }}>
            Namaste, {displayName}!
          </GradientHeading>
          <Typography sx={{ color: 'text.secondary', mt: 1, maxWidth: 540 }}>
            Pick up a plan in progress, or start a new one — we'll guide you through every step.
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/plans/new"
          variant="contained"
          size="large"
          startIcon={<AddCircleOutlineIcon />}
          sx={{
            px: 3.5,
            fontWeight: 700,
            boxShadow: theme.vastu.glowPrimary,
            '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
          }}
        >
          Start New Plan
        </Button>
      </Stack>

      {/* Top widgets row: AI usage ring + tier */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        <GlassPanel>
          <Stack direction="row" alignItems="center" spacing={3}>
            <ProgressRing
              value={remaining}
              max={aiUsage.limit}
              label={`${remaining}`}
              sublabel={`/ ${aiUsage.limit} today`}
            />
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AutoAwesomeIcon sx={{ color: 'info.main' }} />
                <Typography sx={{ fontWeight: 700 }}>AI generations remaining</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
                Resets at midnight IST. Upgrade for unlimited generations on Pro.
              </Typography>
              <Button component={RouterLink} to="/profile" size="small" variant="outlined">
                Manage plan
              </Button>
            </Box>
          </Stack>
        </GlassPanel>

        <GlassPanel>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 60, height: 60, borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: theme.vastu.gradientBrand, color: '#fff',
              }}
            >
              <TrendingUpIcon />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>This month</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.1 }}>
                {plans.length} plans
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {plans.filter(p => p.status === 'COMPLETED').length} completed · {plans.filter(p => p.status === 'IN_PROGRESS').length} in progress
              </Typography>
            </Box>
          </Stack>
        </GlassPanel>
      </Box>

      {/* Recent plans grid */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Recent plans</Typography>
        <Button component={RouterLink} to="/plans" size="small">View all</Button>
      </Stack>

      {loading ? (
        <LinearProgress sx={{ borderRadius: 1 }} />
      ) : plans.length === 0 ? (
        <GlassPanel sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>No plans yet</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>
            Start your first plan and we'll guide you through 10 steps from plot to completion.
          </Typography>
          <Button component={RouterLink} to="/plans/new" variant="contained" startIcon={<AddCircleOutlineIcon />}>
            Start your first plan
          </Button>
        </GlassPanel>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {plans.map((p, i) => (
            <PlanCard key={p._id} plan={p} index={i} />
          ))}
        </Box>
      )}
    </Container>
  );
}

function DeveloperDashboard({ user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/plans', { params: { limit: 6 } })
      .then(r => { if (!cancelled) setPlans(r.data.plans || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={3} sx={{ mb: 4 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            {(user?.tier || 'PRO').toUpperCase()} · DEVELOPER
          </Typography>
          <GradientHeading>Projects overview</GradientHeading>
          <Typography sx={{ color: 'text.secondary', mt: 1 }}>
            Manage bulk projects, monitor team activity, and roll out templates across plots.
          </Typography>
        </Box>
        <Button component={RouterLink} to="/plans/new" variant="contained" startIcon={<AddCircleOutlineIcon />}>
          New project
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        <GlassPanel>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Recent plans</Typography>
          {loading ? (
            <LinearProgress sx={{ borderRadius: 1 }} />
          ) : plans.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>No plans yet.</Typography>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {plans.map((p) => (
                <Stack key={p._id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{p.title}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Updated {timeAgo(new Date(p.updatedAt))}
                    </Typography>
                  </Box>
                  <Chip
                    label={p.status}
                    size="small"
                    color={p.status === 'IN_PROGRESS' ? 'primary' : p.status === 'COMPLETED' ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Stack>
              ))}
            </Stack>
          )}
        </GlassPanel>

        <GlassPanel>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <GroupsIcon sx={{ color: 'info.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Collaborate</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Invite team members to your plans to track shared progress here.
          </Typography>
          <Button component={RouterLink} to="/plans" size="small" variant="outlined">
            Open plans
          </Button>
        </GlassPanel>
      </Box>
    </Container>
  );
}

function ArchitectDashboard({ user }) {
  const [earnings, setEarnings] = useState(null);
  const [openRequests, setOpenRequests] = useState([]);
  const [activeBids, setActiveBids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [earnRes, reqRes, bidRes] = await Promise.all([
          api.get('/marketplace/architects/me/earnings'),
          api.get('/marketplace/review-requests', { params: { limit: 5 } }),
          api.get('/marketplace/bids/mine', { params: { status: 'accepted', limit: 5 } }),
        ]);
        if (!cancelled) {
          setEarnings(earnRes.data);
          setOpenRequests(reqRes.data.requests || []);
          setActiveBids(bidRes.data.bids || []);
        }
      } catch (_) {}
      finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const pendingInr  = earnings ? Math.floor((earnings.pendingPayoutPaise  || 0) / 100) : 0;
  const totalInr    = earnings ? Math.floor((earnings.totalEarningsPaise  || 0) / 100) : 0;
  const rating      = earnings?.rating?.average ?? 0;
  const reviewed    = earnings?.totalReviewsCompleted ?? 0;

  function dueDays(bid) {
    if (!bid.acceptedAt || !bid.proposedTimeline) return null;
    return Math.round(
      (new Date(bid.acceptedAt).getTime() + bid.proposedTimeline * 86400000 - Date.now()) / 86400000
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={3} sx={{ mb: 4 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            VERIFIED ARCHITECT
          </Typography>
          <GradientHeading>Your marketplace</GradientHeading>
          <Typography sx={{ color: 'text.secondary', mt: 1 }}>
            Browse open bid requests, track active reviews, and watch your earnings climb.
          </Typography>
        </Box>
        <Button component={RouterLink} to="/architect" variant="contained" startIcon={<AssignmentTurnedInIcon />}>
          Browse bid requests
        </Button>
      </Stack>

      {loading ? (
        <LinearProgress sx={{ borderRadius: 1, mb: 3 }} />
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 3 }}>
            <GlassPanel>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <PaymentsIcon sx={{ color: 'info.main' }} />
                <Typography sx={{ fontWeight: 700 }}>Pending payout</Typography>
              </Stack>
              <Typography sx={{ fontWeight: 800, fontSize: '1.8rem' }}>
                ₹{pendingInr.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                All-time ₹{totalInr.toLocaleString('en-IN')}
              </Typography>
            </GlassPanel>

            <GlassPanel>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Completed reviews</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.8rem' }}>{reviewed}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {rating > 0 ? `Average rating ${rating.toFixed(1)} / 5` : 'No ratings yet'}
              </Typography>
            </GlassPanel>

            <GlassPanel>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Open requests</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.8rem' }}>{openRequests.length}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {activeBids.length} active {activeBids.length === 1 ? 'review' : 'reviews'} in progress
              </Typography>
            </GlassPanel>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <GlassPanel>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Open bid requests</Typography>
              {openRequests.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>No open requests right now.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {openRequests.map((r) => (
                    <Stack key={r.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{r.title}</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                          <RoomIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption">{r.cityState?.city}</Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={`₹${Math.floor((r.maxBudgetInr || 0) / 100).toLocaleString('en-IN')}`}
                        variant="outlined"
                        size="small"
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </GlassPanel>

            <GlassPanel>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Active reviews</Typography>
              {activeBids.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>No active reviews.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {activeBids.map((b) => {
                    const days = dueDays(b);
                    return (
                      <Stack key={b.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{b.title}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Review in progress</Typography>
                        </Box>
                        {days !== null && (
                          <Chip
                            label={days >= 0 ? `Due in ${days}d` : `${Math.abs(days)}d overdue`}
                            size="small"
                            color={days <= 2 ? 'error' : 'default'}
                            sx={{ fontWeight: 700 }}
                          />
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </GlassPanel>
          </Box>
        </>
      )}
    </Container>
  );
}

function AdminDashboard({ user }) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>ADMIN</Typography>
      <GradientHeading>Platform overview</GradientHeading>
      <Typography sx={{ color: 'text.secondary', mt: 1, mb: 4 }}>
        The admin dashboard (users, revenue, AI usage, marketplace moderation) lands in a later step.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {[
          { k: 'Active users', v: '—' },
          { k: 'Plans generated', v: '—' },
          { k: 'MRR (₹)', v: '—' },
        ].map((s) => (
          <GlassPanel key={s.k}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.k}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '2rem' }}>{s.v}</Typography>
          </GlassPanel>
        ))}
      </Box>
    </Container>
  );
}

/* ── Main export ──────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || 'homeowner';

  if (role === 'admin') return <AdminDashboard user={user} />;
  if (role === 'developer') return <DeveloperDashboard user={user} />;
  if (role === 'architect') return <ArchitectDashboard user={user} />;
  return <HomeownerDashboard user={user} />;
}
