import { useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip, Divider, Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CelebrationIcon from '@mui/icons-material/Celebration';
import LockIcon from '@mui/icons-material/Lock';

import { useAuth } from '../context/AuthContext';
import { api } from '../utils/axiosInstance';
import { openCheckout } from '../utils/razorpayClient';

const TIER_ORDER = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 };

const PLANS = [
  {
    tier: 'FREE',
    label: 'Free',
    price: 0,
    period: null,
    type: null,
    accent: '#757575',
    features: [
      { text: '3 AI generations / day' },
      { text: '5 active plans' },
      { text: 'Full plan wizard' },
      { text: 'PDF export', no: true },
      { text: '3D walkthrough', addon: '₹499 add-on' },
      { text: 'Priority AI queue', no: true },
      { text: 'Priority support', no: true },
    ],
  },
  {
    tier: 'BASIC',
    label: 'Basic',
    price: 499,
    period: '/mo',
    type: 'subscription_basic',
    accent: '#0288D1',
    features: [
      { text: '10 AI generations / day' },
      { text: '20 active plans' },
      { text: 'Full plan wizard' },
      { text: 'PDF export' },
      { text: '3D walkthrough', addon: '₹499 add-on' },
      { text: 'Priority AI queue', no: true },
      { text: 'Priority support', no: true },
    ],
  },
  {
    tier: 'PRO',
    label: 'Pro',
    price: 999,
    period: '/mo',
    type: 'subscription_pro',
    accent: '#2E7D32',
    badge: 'Most Popular',
    features: [
      { text: '50 AI generations / day' },
      { text: 'Unlimited active plans' },
      { text: 'Full plan wizard' },
      { text: 'PDF export' },
      { text: '3D walkthrough included' },
      { text: 'Priority AI queue' },
      { text: 'Priority support', no: true },
    ],
  },
  {
    tier: 'ENTERPRISE',
    label: 'Enterprise',
    price: 2999,
    period: '/mo',
    type: 'subscription_enterprise',
    accent: '#7B1FA2',
    features: [
      { text: 'Unlimited AI generations' },
      { text: 'Unlimited active plans' },
      { text: 'Full plan wizard' },
      { text: 'PDF export' },
      { text: '3D walkthrough included' },
      { text: 'Priority AI queue' },
      { text: 'Dedicated support + SLA' },
    ],
  },
];

export default function UpgradePage() {
  const theme = useTheme();
  const { user } = useAuth();
  const currentTier = user?.subscriptionTier || 'FREE';

  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const [succeededTier, setSucceededTier] = useState(null);

  const handleUpgrade = async (plan) => {
    setError('');
    setPaying(plan.tier);
    try {
      const { data: order } = await api.post('/payments/create-order', { type: plan.type });
      const result = await openCheckout({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        orderId: order.orderId,
        name: 'VastuVerse',
        description: order.description,
        prefill: { name: user?.fullName || '', email: user?.email || '' },
        themeColor: plan.accent,
      });
      const { data } = await api.post('/payments/verify', result);
      if (data.ok) {
        setSucceededTier(plan.tier);
        // Hard reload so auth context re-hydrates with fresh subscriptionTier
        setTimeout(() => { window.location.href = '/dashboard'; }, 3000);
      }
    } catch (e) {
      if (e?.code !== 'dismissed') {
        setError(e?.message || 'Payment failed. Please try again.');
      }
    } finally {
      setPaying(null);
    }
  };

  const activeTier = succeededTier || currentTier;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 5 } }}>
      {/* Header */}
      <Stack alignItems="center" sx={{ mb: { xs: 4, md: 6 }, textAlign: 'center' }}>
        <Typography
          sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 800,
            fontSize: { xs: '2rem', md: '2.8rem' },
            background: theme.vastu.gradientText,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            mb: 1.5,
          }}
        >
          Choose your plan
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 480 }}>
          Simple, transparent pricing. Your current plan is{' '}
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {activeTier}
          </Box>
          .
        </Typography>
      </Stack>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success overlay */}
      <AnimatePresence>
        {succeededTier && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <Stack
              alignItems="center"
              spacing={2}
              sx={{
                py: 8,
                px: 3,
                mb: 4,
                borderRadius: 3,
                background: `linear-gradient(135deg, ${theme.palette.success.main}18, ${theme.palette.primary.main}18)`,
                border: `1px solid ${theme.palette.success.main}40`,
                textAlign: 'center',
              }}
            >
              <CelebrationIcon sx={{ fontSize: 56, color: 'success.main' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1.6rem' }}>
                You&apos;re now on {succeededTier}!
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                Taking you to your dashboard…
              </Typography>
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            lg: 'repeat(4, 1fr)',
          },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        {PLANS.map((plan, i) => {
          const rank = TIER_ORDER[plan.tier];
          const activeRank = TIER_ORDER[activeTier];
          const isCurrent = plan.tier === activeTier;
          const isUpgrade = rank > activeRank;
          const isPro = plan.tier === 'PRO';
          const isPaying = paying === plan.tier;

          let ctaLabel, ctaDisabled;
          if (isCurrent) {
            ctaLabel = 'Current plan';
            ctaDisabled = true;
          } else if (!isUpgrade || plan.tier === 'FREE') {
            ctaLabel = plan.tier === 'FREE' ? 'Included' : 'Lower tier';
            ctaDisabled = true;
          } else {
            ctaLabel = isPaying
              ? 'Processing…'
              : `Upgrade to ${plan.label} — ₹${plan.price.toLocaleString('en-IN')}/mo`;
            ctaDisabled = !!paying;
          }

          return (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex' }}
            >
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  border: `1.5px solid ${isCurrent ? plan.accent + '90' : isPro ? plan.accent + '60' : theme.palette.divider}`,
                  background: theme.vastu.cardBg,
                  backdropFilter: theme.vastu.cardBlur,
                  boxShadow: isPro
                    ? `0 0 32px ${plan.accent}30, ${theme.vastu.cardShadow}`
                    : isCurrent
                    ? `0 0 20px ${plan.accent}25`
                    : theme.vastu.cardShadow,
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'box-shadow .25s',
                  '&:hover': isUpgrade
                    ? { boxShadow: `0 0 32px ${plan.accent}40, ${theme.vastu.cardShadow}` }
                    : undefined,
                }}
              >
                {/* Popular badge */}
                {plan.badge && (
                  <Box
                    sx={{
                      background: `linear-gradient(90deg, ${plan.accent}, ${plan.accent}cc)`,
                      py: 0.6,
                      textAlign: 'center',
                    }}
                  >
                    <Typography
                      sx={{ fontWeight: 800, fontSize: '0.72rem', color: '#fff', letterSpacing: 1.2 }}
                    >
                      {plan.badge.toUpperCase()}
                    </Typography>
                  </Box>
                )}

                {/* Current plan stripe */}
                {isCurrent && !plan.badge && (
                  <Box
                    sx={{
                      background: `linear-gradient(90deg, ${plan.accent}cc, ${plan.accent}88)`,
                      py: 0.6,
                      textAlign: 'center',
                    }}
                  >
                    <Typography
                      sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#fff', letterSpacing: 1 }}
                    >
                      YOUR CURRENT PLAN
                    </Typography>
                  </Box>
                )}

                <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Plan name */}
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      color: isCurrent || isPro ? plan.accent : 'text.primary',
                      mb: 1,
                    }}
                  >
                    {plan.label}
                  </Typography>

                  {/* Price */}
                  <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 3 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '2.2rem', lineHeight: 1 }}>
                      {plan.price === 0 ? '₹0' : `₹${plan.price.toLocaleString('en-IN')}`}
                    </Typography>
                    {plan.period && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                        {plan.period}
                      </Typography>
                    )}
                  </Stack>

                  {/* Features */}
                  <Box sx={{ flex: 1 }}>
                    {plan.features.map((f) => (
                      <Stack
                        key={f.text}
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                        sx={{ mb: 1 }}
                      >
                        {f.no ? (
                          <RemoveCircleOutlineIcon
                            sx={{ fontSize: 18, color: 'text.disabled', mt: '1px', flexShrink: 0 }}
                          />
                        ) : f.addon ? (
                          <AddCircleOutlineIcon
                            sx={{ fontSize: 18, color: '#FF8F00', mt: '1px', flexShrink: 0 }}
                          />
                        ) : (
                          <CheckCircleIcon
                            sx={{ fontSize: 18, color: plan.accent, mt: '1px', flexShrink: 0 }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            color: f.no ? 'text.disabled' : 'text.primary',
                            fontSize: '0.85rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {f.text}
                          {f.addon && (
                            <Box
                              component="span"
                              sx={{ color: '#FF8F00', fontWeight: 600, ml: 0.5, fontSize: '0.78rem' }}
                            >
                              ({f.addon})
                            </Box>
                          )}
                        </Typography>
                      </Stack>
                    ))}
                  </Box>

                  <Divider sx={{ my: 2.5 }} />

                  {/* CTA */}
                  <Button
                    fullWidth
                    variant={isUpgrade ? 'contained' : 'outlined'}
                    disabled={ctaDisabled || isPaying}
                    onClick={isUpgrade && !ctaDisabled ? () => handleUpgrade(plan) : undefined}
                    startIcon={isPaying ? null : isCurrent ? null : isUpgrade ? null : <LockIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      fontWeight: 700,
                      borderRadius: 2,
                      py: 1.2,
                      fontSize: '0.85rem',
                      ...(isUpgrade && !ctaDisabled && {
                        background: `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${plan.accent}dd, ${plan.accent}aa)`,
                          boxShadow: `0 4px 20px ${plan.accent}50`,
                        },
                      }),
                    }}
                  >
                    {ctaLabel}
                  </Button>
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </Box>

      {/* Footer note */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems="center"
        justifyContent="center"
        sx={{ mt: 5, color: 'text.disabled' }}
      >
        <LockIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption" sx={{ textAlign: 'center' }}>
          Payments are secured by Razorpay · SSL encrypted · Billed monthly · Cancel anytime
        </Typography>
      </Stack>
    </Box>
  );
}
