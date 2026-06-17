import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Alert, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import { api } from '../../utils/axiosInstance';
import { openCheckout } from '../../utils/razorpayClient';
import { useAuth } from '../../context/AuthContext';

import Unlock3DCard from '../../components/wizard/Unlock3DCard';
import ConfettiBurst from '../../components/wizard/ConfettiBurst';
import BirdEyeRender from '../../components/wizard/BirdEyeRender';
import ThreeJSViewer from '../../components/wizard/ThreeJSViewer';

const UNLOCK_PRICE_INR = 499;

export default function Step8ThreeDView({ value, onChange }) {
  const theme = useTheme();
  const { user } = useAuth();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  // Tier-based bypass: PRO + ENTERPRISE get 3D included
  const tierUnlocks3D = user?.tier === 'PRO' || user?.tier === 'ENTERPRISE';
  const planUnlocked = !!value.is3DUnlocked;
  const isUnlocked = planUnlocked || tierUnlocks3D;

  const [unlockState, setUnlockState] = useState({
    loading: false,
    error: null,
    celebrating: false,
  });

  // Selected option for the viewer
  const selectedOption = useMemo(() => {
    const fp = value.floorPlan || {};
    return fp.options?.find((o) => o.id === fp.selectedOptionId);
  }, [value.floorPlan]);

  // Active interior palette
  const palette = useMemo(() => {
    const interior = value.interior || {};
    return interior.palettes?.find((p) => p.id === interior.selectedPaletteId);
  }, [value.interior]);

  /* ─── Unlock flow ────────────────────────────────────────────────── */
  const handleUnlock = async () => {
    if (!planId) {
      setUnlockState({ loading: false, error: 'Plan not loaded yet', celebrating: false });
      return;
    }
    setUnlockState({ loading: true, error: null, celebrating: false });

    try {
      // 1. Create order on our server
      const { data: order } = await api.post('/payments/create-order', {
        planId,
        type: '3d_unlock',
      });

      // 2. Open Razorpay checkout (resolves with payment details, rejects on dismiss/failure)
      const result = await openCheckout({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        orderId: order.orderId,
        name: 'VastuVerse',
        description: order.description || '3D View Unlock',
        prefill: {
          name: user?.fullName || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
      });

      // 3. Verify the signature server-side
      await api.post('/payments/verify', {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      // 4. Celebrate, then flip local state
      setUnlockState({ loading: false, error: null, celebrating: true });
      // Auto-end the celebration after 2.4s
      setTimeout(() => {
        onChange({ is3DUnlocked: true });
        setUnlockState({ loading: false, error: null, celebrating: false });
      }, 2400);
    } catch (e) {
      if (e?.code === 'dismissed') {
        setUnlockState({ loading: false, error: null, celebrating: false });
        return;
      }
      const msg = e?.message
        || e?.response?.data?.error
        || 'Could not complete payment. If you were charged, please contact support.';
      setUnlockState({ loading: false, error: msg, celebrating: false });
    }
  };

  /* ─── Render: locked ────────────────────────────────────────────── */
  if (!isUnlocked && !unlockState.celebrating) {
    return (
      <Stack spacing={3}>
        <Box sx={{ position: 'relative' }}>
          <Unlock3DCard
            onUnlock={handleUnlock}
            priceInr={UNLOCK_PRICE_INR}
            loading={unlockState.loading}
            error={unlockState.error}
          />
        </Box>
      </Stack>
    );
  }

  /* ─── Render: celebrating ───────────────────────────────────────── */
  if (unlockState.celebrating) {
    return (
      <Box
        sx={{
          position: 'relative',
          minHeight: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 1.5,
          overflow: 'hidden',
        }}
      >
        <ConfettiBurst show duration={2200} spread={300} />
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
          transition={{ duration: 0.7, times: [0, 0.6, 1], ease: [0.22, 1, 0.36, 1] }}
        >
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2.8rem' },
              background: theme.vastu.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            3D unlocked!
          </Typography>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Loading your interactive walkthrough…
          </Typography>
          <CircularProgress size={28} sx={{ mt: 2 }} />
        </motion.div>
      </Box>
    );
  }

  /* ─── Render: unlocked ──────────────────────────────────────────── */
  if (!selectedOption) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        Pick a floor plan in Step 3 to enable the 3D view.
      </Alert>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="unlocked"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Stack spacing={3}>
          {tierUnlocks3D && !planUnlocked && (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              <strong>{user?.tier}</strong> tier includes 3D view on all plans — no extra unlock needed.
            </Alert>
          )}

          {/* Section: bird's-eye render */}
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.2 }}>
              AI Render
            </Typography>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: '1.4rem',
                mb: 1.5,
              }}
            >
              Bird's-eye view
            </Typography>
            <BirdEyeRender
              planId={planId}
              plan={value}
              birdEyeView={value.birdEyeView}
              onUpdated={() => {
                // bump a noop change so PlanWizard re-fetches on next save cycle
                onChange({ birdEyeView: { ...(value.birdEyeView || {}), refreshedAt: Date.now() } });
              }}
            />
          </Box>

          {/* Section: interactive Three.js walkthrough */}
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.2 }}>
              Interactive
            </Typography>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: '1.4rem',
                mb: 1.5,
              }}
            >
              3D walkthrough
            </Typography>
            <ThreeJSViewer
              planId={planId}
              plan={value}
              option={selectedOption}
              palette={palette}
            />
          </Box>
        </Stack>
      </motion.div>
    </AnimatePresence>
  );
}
