import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Card, Alert, Skeleton, IconButton, Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';

import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PaidIcon from '@mui/icons-material/Paid';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import RefreshIcon from '@mui/icons-material/Refresh';

import { api } from '../../utils/axiosInstance';
import KPICard from '../../components/admin/KPICard';

const TIER_COLORS = {
  FREE:       '#9E9E9E',
  BASIC:      '#0277BD',
  PRO:        '#2E7D32',
  ENTERPRISE: '#FF6F00',
};

export default function AdminDashboard() {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setPhase('loading'); setError(null);
    try {
      const { data } = await api.get('/admin/analytics');
      setData(data);
      setPhase('ready');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load analytics');
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPlans = (data?.plansByStatus || []).reduce((acc, x) => acc + x.value, 0);
  const completedPlans = data?.plansByStatus?.find((s) => s.name === 'COMPLETED')?.value || 0;
  const revenueRupees = (data?.revenueThisMonthPaise || 0) / 100;

  return (
    <Box>
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '1.7rem', md: '2.1rem' },
              background: theme.vastu.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Admin dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Platform-wide health, growth, and revenue at a glance.
            {data?.generatedAt && (
              <> · Updated {new Date(data.generatedAt).toLocaleTimeString('en-IN')}{data.cached && ' (cached)'}</>
            )}
          </Typography>
        </Box>
        <IconButton onClick={load} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <KPICard
          icon={PeopleIcon}      label="Active users"     value={data?.activeUsers || 0}
          accent={theme.palette.primary.main} loading={phase === 'loading'} index={0}
          sub={data ? `${data.totalUsers} total registered` : null}
        />
        <KPICard
          icon={PersonAddIcon}   label="New this week"    value={data?.newUsersThisWeek || 0}
          accent={theme.palette.info.main} loading={phase === 'loading'} index={1}
        />
        <KPICard
          icon={HomeWorkIcon}    label="Plans completed"  value={completedPlans}
          accent="#7B1FA2" loading={phase === 'loading'} index={2}
          sub={totalPlans ? `of ${totalPlans} total plans` : null}
        />
        <KPICard
          icon={PaidIcon}        label="Revenue (month)"  value={revenueRupees}
          prefix="₹" accent="#2E7D32" loading={phase === 'loading'} index={3}
        />
        <KPICard
          icon={AutoAwesomeIcon} label="AI gens today"    value={data?.aiGenerationsToday || 0}
          accent="#00BCD4" loading={phase === 'loading'} index={4}
        />
        <KPICard
          icon={PeopleIcon}      label="Paid subscribers"
          value={(data?.subsByTier || [])
            .filter((s) => s.tier !== 'FREE')
            .reduce((a, b) => a + b.count, 0)}
          accent={theme.palette.warning.main} loading={phase === 'loading'} index={5}
        />
      </Box>

      {/* Charts row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        {/* Plans by status (PieChart) */}
        <ChartCard title="Plans by status" loading={phase === 'loading'}>
          {data?.plansByStatus?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.plansByStatus}
                  dataKey="value" nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={90} innerRadius={55}
                  paddingAngle={2}
                  label={({ name, value, percent }) =>
                    `${name} · ${value} (${Math.round(percent * 100)}%)`}
                  labelLine={false}
                >
                  {data.plansByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8, fontSize: '0.85rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No plan data yet." />
          )}
        </ChartCard>

        {/* Subscriptions per tier (BarChart) */}
        <ChartCard title="Subscriptions per tier" loading={phase === 'loading'}>
          {data?.subsByTier?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.subsByTier} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="tier" stroke={theme.palette.text.secondary} fontSize={12} />
                <YAxis stroke={theme.palette.text.secondary} fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8, fontSize: '0.85rem',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.subsByTier.map((entry, i) => (
                    <Cell key={i} fill={TIER_COLORS[entry.tier] || theme.palette.primary.main} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No subscription data yet." />
          )}
        </ChartCard>
      </Box>

      {/* AI generations 24h line */}
      <ChartCard title="AI generations · last 24 hours" loading={phase === 'loading'}>
        {data?.generationsByHour?.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.generationsByHour} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="hour" stroke={theme.palette.text.secondary} fontSize={11} interval={2} />
              <YAxis stroke={theme.palette.text.secondary} fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8, fontSize: '0.85rem',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={theme.palette.primary.main}
                strokeWidth={2.5}
                dot={{ r: 3, fill: theme.palette.primary.main }}
                activeDot={{ r: 6, stroke: theme.palette.primary.main, strokeWidth: 2, fill: theme.palette.background.paper }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No AI activity in the last 24 hours." />
        )}
      </ChartCard>
    </Box>
  );
}

/* ─── Helper components ───────────────────────────────────────────── */

function ChartCard({ title, children, loading }) {
  const theme = useTheme();
  return (
    <Card
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
      }}
    >
      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>{title}</Typography>
      {loading ? <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} /> : children}
    </Card>
  );
}

function EmptyChart({ message }) {
  return (
    <Box
      sx={{
        height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'text.secondary', fontSize: '0.88rem',
      }}
    >
      {message}
    </Box>
  );
}
