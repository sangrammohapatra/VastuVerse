import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Container, Stack, Typography, Card, Alert, CircularProgress,
  Chip, Divider, Button, Grid, Skeleton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import VerifiedIcon from '@mui/icons-material/Verified';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StraightenIcon from '@mui/icons-material/Straighten';
import ExploreIcon from '@mui/icons-material/Explore';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import Logo from '../common/Logo';
import { formatRupees } from '../i18n/i18n';

/* ─── Standalone axios (no auth, no /api/v1 prefix from app config) ─── */
const PUBLIC_API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: false,
});

function daysUntil(iso) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/**
 * Public, no-auth contractor view.
 *
 *   /contractor/:token → sanitized plan snapshot (no userId / personal data)
 *
 * Renders: branded header, read-only banner, overview cards, floor plan, room
 * dimensions table, utilities summary, cost estimate (if included), step
 * images, PDF download button, "Powered by VastuVerse" footer.
 */
export default function ContractorViewPage() {
  const { token } = useParams();
  const theme = useTheme();
  const { t } = useTranslation();

  const [plan, setPlan] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    setPhase('loading');
    PUBLIC_API.get(`/contractor/${token}`)
      .then(({ data }) => { setPlan(data.plan); setPhase('ready'); })
      .catch((e) => {
        const code = e.response?.data?.error;
        setError(code || 'link_unavailable');
        setPhase('error');
      });
  }, [token]);

  /* ─── Loading skeleton ─── */
  if (phase === 'loading') {
    return (
      <PageShell t={t}>
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
        </Stack>
      </PageShell>
    );
  }

  /* ─── Error states ─── */
  if (phase === 'error') {
    return (
      <PageShell t={t}>
        <Card
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 }, textAlign: 'center',
            background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
          }}
        >
          <LinkOffIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 0.5 }}>
            {error === 'link_expired' ? t('contractor.expired')
             : error === 'link_not_found_or_revoked' ? t('contractor.revoked')
             : t('errors.notFound')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420, mx: 'auto' }}>
            Please request a fresh link from the homeowner. Contractor links are time-limited for security.
          </Typography>
        </Card>
      </PageShell>
    );
  }

  /* ─── Success ─── */
  const linkDays = daysUntil(plan?.linkInfo?.expiresAt);
  const isPermanent = plan?.linkInfo?.isPermanent;

  return (
    <PageShell t={t} expiryHint={isPermanent ? t('contractor.expiresNever') : (linkDays != null ? t('contractor.expiresIn', { days: linkDays }) : null)}>
      {/* Read-only banner */}
      <Alert
        severity="info"
        icon={<VerifiedIcon />}
        sx={{
          mb: 3,
          background: 'rgba(2,119,189,0.08)',
          border: '1px solid rgba(2,119,189,0.25)',
          fontWeight: 600,
        }}
      >
        {t('contractor.readOnlyBanner')}
      </Alert>

      {/* Plan title + status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            mb: 3,
            background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute', top: -80, right: -80,
              width: 240, height: 240, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(46,125,50,0.15), transparent 70%)',
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
            <Box>
              <Typography
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: 700,
                  fontSize: { xs: '1.6rem', md: '2rem' },
                  background: theme.vastu.gradientText,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  mb: 0.5,
                }}
              >
                {plan.title || 'Plan'}
              </Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                {plan.cityState?.city && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {plan.cityState.city}{plan.cityState.state && `, ${plan.cityState.state}`}
                    </Typography>
                  </Stack>
                )}
                {plan.landDetails?.area && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <StraightenIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {plan.landDetails.area.toLocaleString('en-IN')} {plan.landDetails.unit || 'sq.ft'}
                    </Typography>
                  </Stack>
                )}
                {plan.landDetails?.facing && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <ExploreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                      {plan.landDetails.facing}-facing
                    </Typography>
                  </Stack>
                )}
                <Chip
                  label={plan.status}
                  size="small"
                  sx={{ fontWeight: 800, letterSpacing: 0.5 }}
                  color={plan.status === 'COMPLETED' ? 'success' : 'default'}
                />
              </Stack>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              component="a"
              href={`${PUBLIC_API.defaults.baseURL}/contractor/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                boxShadow: theme.vastu.glowPrimary,
                '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
              }}
            >
              {t('contractor.downloadPdf')}
            </Button>
          </Stack>
        </Card>
      </motion.div>

      {/* Floor plan SVG (if selected) */}
      <FloorPlanSection plan={plan} t={t} />

      {/* Rooms + dimensions */}
      <RoomsSection plan={plan} t={t} />

      {/* Utilities */}
      <UtilitiesSection plan={plan} t={t} />

      {/* Cost estimate (only if included) */}
      <CostSection plan={plan} t={t} />

      {/* Step renderings */}
      <RenderingsSection plan={plan} t={t} />
    </PageShell>
  );
}

/* ─── Page shell with branded header + footer ─────────────────────── */

function PageShell({ children, t, expiryHint }) {
  const theme = useTheme();
  return (
    <Box sx={{ minHeight: '100vh', background: theme.palette.background.default }}>
      {/* Branded header */}
      <Box
        sx={{
          py: 2.5,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
          color: '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Logo size={36} />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: 0.4 }}>
                  VastuVerse
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85, letterSpacing: 0.6 }}>
                  CONTRACTOR VIEW
                </Typography>
              </Box>
            </Stack>
            {expiryHint && (
              <Chip
                label={expiryHint}
                size="small"
                sx={{
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff', fontWeight: 700, letterSpacing: 0.4,
                  backdropFilter: 'blur(10px)',
                }}
              />
            )}
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        {children}
      </Container>

      {/* Footer */}
      <Box
        sx={{
          mt: 6, py: 3, textAlign: 'center',
          borderTop: `1px solid ${theme.palette.divider}`,
          background: theme.palette.background.paper,
        }}
      >
        <Stack alignItems="center" spacing={0.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Logo size={20} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
              {t('contractor.poweredBy').toUpperCase()}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            <a href="https://vastuverse.app" target="_blank" rel="noopener noreferrer"
               style={{ color: 'inherit', textDecoration: 'none' }}>
              vastuverse.app <OpenInNewIcon sx={{ fontSize: 10, ml: 0.3, verticalAlign: 'middle' }} />
            </a>
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

/* ─── Section components ──────────────────────────────────────────── */

function SectionCard({ title, children, sx, ...rest }) {
  const theme = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        elevation={0}
        sx={{
          mb: 3, p: { xs: 2, md: 3 },
          background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          ...sx,
        }}
        {...rest}
      >
        {title && (
          <>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700, fontSize: '1.25rem',
                mb: 2,
              }}
            >
              {title}
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </>
        )}
        {children}
      </Card>
    </motion.div>
  );
}

function FloorPlanSection({ plan, t }) {
  const selected = plan.selectedFloorPlanIndex != null
    ? plan.floorPlans?.[plan.selectedFloorPlanIndex]
    : plan.floorPlans?.[0];
  if (!selected?.svgString && !selected?.imageUrl) return null;

  return (
    <SectionCard title={t('contractor.sections.floorPlan')}>
      <Box
        sx={{
          width: '100%',
          background: '#fff',
          borderRadius: 2,
          border: '1px solid rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex', justifyContent: 'center',
        }}
      >
        {selected.svgString ? (
          <Box
            sx={{ width: '100%', maxWidth: 900, '& svg': { width: '100%', height: 'auto', display: 'block' } }}
            dangerouslySetInnerHTML={{ __html: selected.svgString }}
          />
        ) : (
          <Box component="img" src={selected.imageUrl} alt="Floor plan"
            sx={{ maxWidth: '100%', height: 'auto' }} />
        )}
      </Box>
    </SectionCard>
  );
}

function RoomsSection({ plan, t }) {
  if (!plan.rooms?.length) return null;

  const byFloor = plan.rooms.reduce((acc, r) => {
    const k = r.floor ?? 'Ground floor';
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  return (
    <SectionCard title={t('contractor.sections.rooms')}>
      <Stack spacing={2.5}>
        {Object.entries(byFloor).map(([floor, rooms]) => (
          <Box key={floor}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1, mb: 1, display: 'block' }}>
              Floor {floor}
            </Typography>
            <Grid container spacing={1.2}>
              {rooms.map((r, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Box
                    sx={{
                      p: 1.4, borderRadius: 1.5,
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                      {r.type || r.name || 'Room'}
                    </Typography>
                    {(r.width || r.length || r.area) && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {r.width && r.length ? `${r.width} × ${r.length}` : null}
                        {r.area ? ` · ${r.area} sq.ft` : null}
                      </Typography>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Stack>
    </SectionCard>
  );
}

function UtilitiesSection({ plan, t }) {
  const u = plan.utilities;
  if (!u) return null;

  const LAYER_LABELS = {
    plumbing: 'Plumbing', electrical: 'Electrical', hvac: 'HVAC',
    waterTanks: 'Water tanks', sewage: 'Sewage', solar: 'Solar',
  };
  const LAYER_COLORS = {
    plumbing: '#42A5F5', electrical: '#FFB300', hvac: '#9E9E9E',
    waterTanks: '#00BCD4', sewage: '#8D6E63', solar: '#FF6F00',
  };
  const layers = Object.keys(LAYER_LABELS).filter((k) => u[k] && (Array.isArray(u[k]) ? u[k].length > 0 : true));
  if (layers.length === 0) return null;

  return (
    <SectionCard title={t('contractor.sections.utilities')}>
      <Grid container spacing={1.4}>
        {layers.map((k) => {
          const items = Array.isArray(u[k]) ? u[k] : (u[k] ? [u[k]] : []);
          return (
            <Grid item xs={12} sm={6} md={4} key={k}>
              <Stack
                direction="row" alignItems="center" spacing={1.4}
                sx={{
                  p: 1.4, borderRadius: 1.5,
                  border: `1px solid ${LAYER_COLORS[k]}44`,
                  background: `${LAYER_COLORS[k]}0A`,
                }}
              >
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: LAYER_COLORS[k], flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{LAYER_LABELS[k]}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {items.length} item{items.length === 1 ? '' : 's'} routed
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          );
        })}
      </Grid>
    </SectionCard>
  );
}

function CostSection({ plan, t }) {
  const c = plan.costEstimate;
  if (!c?.totalCost) return null;

  return (
    <SectionCard title={t('contractor.sections.cost')}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: c.breakdown?.length ? 2 : 0 }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.8 }}>
            ESTIMATED TOTAL ({c.tier || 'standard'})
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '2rem', color: 'primary.main' }}>
            {formatRupees(c.totalCost)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('wizard.step7.variance')}
          </Typography>
        </Box>
      </Stack>

      {c.breakdown?.length > 0 && (
        <Stack spacing={0.8}>
          {c.breakdown.map((row, i) => (
            <Stack
              key={i}
              direction="row" justifyContent="space-between"
              sx={{
                py: 0.8, borderBottom: i < c.breakdown.length - 1 ? '1px dashed rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                {row.category || row.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatRupees(row.amount)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

function RenderingsSection({ plan, t }) {
  const interior = plan.interior?.renderings || [];
  const exterior = plan.exterior?.facades || [];
  const exteriorSelected = plan.exterior?.selectedFacadeIndex != null
    ? exterior[plan.exterior.selectedFacadeIndex] : null;

  const images = [
    ...interior.map((r) => ({ url: r.imageUrl || r.url, label: r.room || 'Interior' })),
    ...(exteriorSelected ? [{ url: exteriorSelected.imageUrl || exteriorSelected.url, label: 'Exterior' }] : []),
  ].filter((x) => x.url);

  if (!images.length) return null;

  return (
    <SectionCard title={`${t('contractor.sections.interior')} & ${t('contractor.sections.exterior')}`}>
      <Grid container spacing={1.5}>
        {images.map((img, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.4 }}
            >
              <Box
                component="a"
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'block',
                  aspectRatio: '4 / 3',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,0.08)',
                  position: 'relative',
                  transition: 'transform .25s',
                  '&:hover': { transform: 'scale(1.02)' },
                }}
              >
                <Box
                  component="img"
                  src={img.url} alt={img.label}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <Box
                  sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    p: 1, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
                    color: '#fff', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5,
                    textTransform: 'capitalize',
                  }}
                >
                  {img.label}
                </Box>
              </Box>
            </motion.div>
          </Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}
