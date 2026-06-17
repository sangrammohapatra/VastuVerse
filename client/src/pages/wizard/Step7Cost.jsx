import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Button, ToggleButton, ToggleButtonGroup,
  Alert, Skeleton, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import DescriptionIcon from '@mui/icons-material/Description';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { api } from '../../utils/axiosInstance';
import CostBreakdownTable from '../../components/wizard/CostBreakdownTable';
import CostBarChart from '../../components/wizard/CostBarChart';

const TIERS = [
  { id: 'economy',  label: 'Economy'  },
  { id: 'standard', label: 'Standard' },
  { id: 'premium',  label: 'Premium'  },
];

export default function Step7Cost({ value, onChange }) {
  const theme = useTheme();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  const costEstimate = value.costEstimate || {};
  const [tier, setTier] = useState(costEstimate.finishTier || 'standard');

  const [estimate, setEstimate] = useState(null);
  const [prevEstimate, setPrevEstimate] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [pdfPhase, setPdfPhase] = useState('idle'); // idle | downloading | error

  /* ─── Fetch estimate whenever tier changes ──────────────────────── */
  useEffect(() => {
    if (!planId) return undefined;
    let alive = true;
    setPhase((p) => (estimate ? p : 'loading')); // keep showing previous data while refetching

    (async () => {
      try {
        const { data } = await api.get(`/plans/${planId}/cost-estimate`, { params: { finishTier: tier } });
        if (!alive) return;
        setPrevEstimate(estimate);
        setEstimate(data);
        setPhase('ready');

        // Persist user's chosen tier through saveStep
        onChange({
          costEstimate: {
            finishTier: data.finishTier,
            totalInr: data.totalInr,
            asOf: data.asOf,
            generatedAt: data.generatedAt,
          },
        });
      } catch (e) {
        if (!alive) return;
        setPhase('error');
        setError(e.response?.data?.error || 'Could not load cost estimate');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, tier]);

  /* ─── PDF export ─────────────────────────────────────────────────── */
  const exportPdf = async () => {
    if (!planId) return;
    setPdfPhase('downloading');
    try {
      const res = await api.get(`/plans/${planId}/export/cost-pdf`, {
        params: { finishTier: tier },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const safeTitle = (value.title || 'cost-estimate').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-${tier}-cost.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfPhase('idle');
    } catch (e) {
      setPdfPhase('error');
      setTimeout(() => setPdfPhase('idle'), 3000);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Header card with tier toggle */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>
              Cost estimate
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 560 }}>
              Pick a finish tier — the breakdown, bar chart and totals re-compute against {estimate?.state || 'your state'} reference rates.
            </Typography>
          </Box>

          <ToggleButtonGroup
            value={tier}
            exclusive
            color="primary"
            onChange={(_e, v) => v && setTier(v)}
            sx={{
              '& .MuiToggleButton-root': {
                fontWeight: 700,
                px: 2.5,
                '&.Mui-selected': {
                  boxShadow: theme.vastu.glowPrimary,
                },
              },
            }}
          >
            {TIERS.map((t) => (
              <ToggleButton key={t.id} value={t.id}>
                {t.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {/* Source / asOf info bar */}
        <AnimatePresence>
          {estimate && (
            <motion.div
              key={`${estimate.state}-${estimate.asOf}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Alert
                icon={<InfoOutlinedIcon fontSize="small" />}
                severity="info"
                sx={{
                  mt: 2.5,
                  borderRadius: 2,
                  background: theme.palette.mode === 'dark' ? 'rgba(0,188,212,0.08)' : 'rgba(0,188,212,0.06)',
                  border: `1px solid ${theme.palette.info.main}40`,
                  fontWeight: 600,
                }}
              >
                Based on <strong>{estimate.state || 'India'}</strong> rates as of{' '}
                <strong>{estimate.asOf}</strong>.{' '}
                {estimate.source === 'default'
                  ? '(Bundled reference rates — no local dataset configured yet.)'
                  : '(Local cost database.)'}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Loading state */}
      {phase === 'loading' && !estimate && (
        <Card
          elevation={0}
          sx={{
            p: 3,
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
          }}
        >
          <Skeleton height={32} width="40%" sx={{ mb: 2 }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Stack key={i} direction="row" spacing={2} sx={{ mb: 1 }}>
              <Skeleton height={28} width="40%" />
              <Skeleton height={28} width="20%" />
              <Skeleton height={28} width="30%" sx={{ ml: 'auto' }} />
            </Stack>
          ))}
        </Card>
      )}

      {/* Error state */}
      {phase === 'error' && !estimate && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => setTier(tier)}>Retry</Button>}
        >
          {error}
        </Alert>
      )}

      {/* Breakdown table + bar chart */}
      {estimate && (
        <>
          <CostBreakdownTable estimate={estimate} prevEstimate={prevEstimate} />
          <CostBarChart estimate={estimate} />
        </>
      )}

      {/* Export + onward CTAs */}
      {estimate && (
        <Card
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            spacing={2}
          >
            <Button
              size="large"
              variant="outlined"
              startIcon={
                pdfPhase === 'downloading' ? <CircularProgress size={18} /> : <PictureAsPdfIcon />
              }
              onClick={exportPdf}
              disabled={pdfPhase === 'downloading'}
              sx={{ fontWeight: 700 }}
            >
              {pdfPhase === 'error'
                ? 'Export failed — retry'
                : pdfPhase === 'downloading'
                  ? 'Preparing PDF…'
                  : 'Export cost estimate as PDF'}
            </Button>

            <Stack direction="row" spacing={1.2}>
              <Button
                variant="outlined"
                startIcon={<DescriptionIcon />}
                onClick={() => {
                  if (planId) window.location.href = `/plans/${planId}/step/9`;
                }}
              >
                Skip to municipal docs
              </Button>
              <Button
                variant="contained"
                startIcon={<ViewInArIcon />}
                onClick={() => {
                  if (planId) window.location.href = `/plans/${planId}/step/8`;
                }}
                sx={{
                  fontWeight: 700,
                  boxShadow: theme.vastu.glowPrimary,
                  '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                }}
              >
                Proceed to 3D
              </Button>
            </Stack>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
