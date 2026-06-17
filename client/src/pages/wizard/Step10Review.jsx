import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Button, Alert, CircularProgress, Snackbar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ShareIcon from '@mui/icons-material/Share';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import VerifiedIcon from '@mui/icons-material/Verified';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CelebrationIcon from '@mui/icons-material/Celebration';

import { api } from '../../utils/axiosInstance';
import { useAuth } from '../../context/AuthContext';

import StepSummaryCard from '../../components/wizard/StepSummaryCard';
import VersionTimeline from '../../components/wizard/VersionTimeline';
import CollaboratorPanel from '../../components/wizard/CollaboratorPanel';
import ConfettiBurst from '../../components/wizard/ConfettiBurst';

/* ─── Step summaries derived from plan state ──────────────────────── */

function buildStepSummaries(plan) {
  const sp = plan.stepProgress || {};
  const isDone = (k) => !!sp[k]?.completed;

  // Step 1: Land
  const ld = plan.landDetails || {};
  const step1 = {
    number: 1, label: 'Land details',
    status: isDone('step1') ? 'complete' : (ld.area ? 'inProgress' : 'empty'),
    highlights: [
      ld.area ? { k: 'area', v: `${ld.area} ${ld.unit || 'sqft'}` } : null,
      ld.shape ? { k: 'shape', v: ld.shape } : null,
      ld.floors ? { k: 'floors', v: String(ld.floors) } : null,
      plan.vastuEnabled ? { k: 'vastu', v: 'enabled' } : null,
    ].filter(Boolean),
  };

  // Step 2: Rooms
  const rc = plan.roomConfig || {};
  const additional = rc.additionalSpaces || [];
  const step2 = {
    number: 2, label: 'Rooms',
    status: isDone('step2') ? 'complete' : (rc.bedrooms ? 'inProgress' : 'empty'),
    highlights: [
      rc.bedrooms ? { k: 'bedrooms', v: String(rc.bedrooms) } : null,
      rc.attachedBathrooms ? { k: 'attached baths', v: String(rc.attachedBathrooms) } : null,
      additional.length ? { k: 'extras', v: `${additional.length} space${additional.length > 1 ? 's' : ''}` } : null,
    ].filter(Boolean),
  };

  // Step 3: Floor plan
  const fp = plan.floorPlan || {};
  const sel = fp.options?.find((o) => o.id === fp.selectedOptionId);
  const step3 = {
    number: 3, label: 'Floor plan',
    status: sel ? 'complete' : (fp.options?.length ? 'inProgress' : 'empty'),
    highlights: [
      sel ? { k: 'variant', v: sel.variant || sel.label || 'selected' } : null,
      sel?.totalArea ? { k: 'BUA', v: `${sel.totalArea} sqft` } : null,
      sel?.plotDimensions ? { k: 'plot', v: `${sel.plotDimensions.plotW}×${sel.plotDimensions.plotH}ft` } : null,
    ].filter(Boolean),
  };

  // Step 4: Interior
  const interior = plan.interior || {};
  const palette = interior.palettes?.find((p) => p.id === interior.selectedPaletteId);
  const step4 = {
    number: 4, label: 'Interior',
    status: isDone('step4') ? 'complete' : (interior.globalStyle ? 'inProgress' : 'empty'),
    highlights: [
      interior.globalStyle ? { k: 'style', v: interior.globalStyle } : null,
      palette ? { k: 'palette', v: palette.name } : null,
      Object.keys(interior.rooms || {}).length ? { k: 'rendered', v: `${Object.keys(interior.rooms).length} rooms` } : null,
    ].filter(Boolean),
  };

  // Step 5: Exterior
  const ext = plan.exterior || {};
  const renderedSides = Object.keys(ext.sides || {}).filter((k) => ext.sides[k]?.imageUrl);
  const step5 = {
    number: 5, label: 'Exterior',
    status: isDone('step5') ? 'complete' : (ext.facadeStyle ? 'inProgress' : 'empty'),
    highlights: [
      ext.facadeStyle ? { k: 'facade', v: ext.facadeStyle } : null,
      ext.roofType ? { k: 'roof', v: ext.roofType } : null,
      renderedSides.length ? { k: 'rendered', v: renderedSides.join(', ') } : null,
    ].filter(Boolean),
  };

  // Step 6: Utilities
  const u = plan.utilities || {};
  const hasUtil = u.layers && Object.keys(u.layers).length > 0;
  const step6 = {
    number: 6, label: 'Utilities',
    status: hasUtil ? 'complete' : 'empty',
    highlights: hasUtil ? [
      u.summary?.electrical?.sanctionedLoadKw ? { k: 'load', v: `${u.summary.electrical.sanctionedLoadKw} kW` } : null,
      u.summary?.waterTanks?.overheadLitres ? { k: 'OH tank', v: `${u.summary.waterTanks.overheadLitres}L` } : null,
      u.summary?.solar?.recommendedKwp ? { k: 'solar', v: `${u.summary.solar.recommendedKwp} kWp` } : null,
    ].filter(Boolean) : [],
  };

  // Step 7: Cost
  const ce = plan.costEstimate || {};
  const step7 = {
    number: 7, label: 'Cost estimate',
    status: ce.totalInr ? 'complete' : 'empty',
    highlights: ce.totalInr ? [
      { k: 'tier', v: ce.finishTier || 'standard' },
      { k: 'total', v: `₹${Number(ce.totalInr).toLocaleString('en-IN')}` },
    ] : [],
  };

  // Step 8: 3D
  const step8 = {
    number: 8, label: '3D view',
    status: plan.is3DUnlocked ? 'complete' : 'empty',
    highlights: [
      plan.is3DUnlocked ? { k: 'unlock', v: 'yes' } : null,
      plan.birdEyeView?.imageUrl ? { k: 'bird-eye', v: 'rendered' } : null,
    ].filter(Boolean),
  };

  // Step 9: Municipal
  const m = plan.municipalReport || {};
  const step9 = {
    number: 9, label: 'Municipal compliance',
    status: m.items?.length ? 'complete' : 'empty',
    highlights: m.summary ? [
      { k: 'status', v: (m.summary.overallStatus || '—').replace('-', ' ') },
      { k: 'passed', v: `${m.summary.passed || 0}/${m.summary.totalChecks || 0}` },
    ] : [],
  };

  return [step1, step2, step3, step4, step5, step6, step7, step8, step9];
}

/* ─────────────────────────────────────────────────────────────────── */

export default function Step10Review({ value, onChange }) {
  const theme = useTheme();
  const { user } = useAuth();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  const summaries = useMemo(() => buildStepSummaries(value), [value]);

  // Floor-plan rooms for the comment composer's room selector
  const planRooms = useMemo(() => {
    const fp = value.floorPlan || {};
    const sel = fp.options?.find((o) => o.id === fp.selectedOptionId);
    if (!sel?.rooms) return [];
    const seen = new Set();
    return sel.rooms.reduce((acc, r) => {
      const key = r.id.split('__')[0];
      if (seen.has(key)) return acc;
      seen.add(key);
      acc.push({ id: key, label: r.label });
      return acc;
    }, []);
  }, [value.floorPlan]);

  const status = value.status || 'IN_PROGRESS';
  const isCompleted = status === 'COMPLETED';

  /* ─── Action state ──────────────────────────────────────────────── */
  const [pdfPhase, setPdfPhase] = useState('idle');         // idle|downloading|error
  const [sharePhase, setSharePhase] = useState('idle');     // idle|creating
  const [shareToast, setShareToast] = useState(null);
  const [completePhase, setCompletePhase] = useState(isCompleted ? 'done' : 'idle'); // idle|finalizing|celebrating|done|error
  const [completeError, setCompleteError] = useState(null);

  /* ─── Full plan PDF ─────────────────────────────────────────────── */
  const exportFullPdf = async () => {
    if (!planId) return;
    setPdfPhase('downloading');
    try {
      const res = await api.get(`/plans/${planId}/export/full-pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const safeTitle = (value.title || 'plan').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const isFree = (user?.tier || 'FREE').toUpperCase() === 'FREE';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-full-plan${isFree ? '-preview' : ''}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfPhase('idle');
    } catch {
      setPdfPhase('error');
      setTimeout(() => setPdfPhase('idle'), 3000);
    }
  };

  /* ─── Contractor share link ─────────────────────────────────────── */
  const createContractorLink = async () => {
    if (!planId) return;
    setSharePhase('creating');
    try {
      const { data } = await api.post(`/plans/${planId}/contractor-links`, { expiryType: '7d' });
      try { await navigator.clipboard.writeText(data.url); } catch { /* clipboard blocked */ }
      setShareToast({ kind: 'success', message: 'Contractor link copied — valid 7 days' });
    } catch (e) {
      setShareToast({ kind: 'error', message: e.response?.data?.error || 'Could not create link' });
    } finally {
      setSharePhase('idle');
    }
  };

  /* ─── Mark completed → celebration ──────────────────────────────── */
  const finalize = async () => {
    if (!planId) return;
    setCompletePhase('finalizing');
    setCompleteError(null);
    try {
      await api.put(`/plans/${planId}/status`, { status: 'COMPLETED' });
      setCompletePhase('celebrating');
      onChange({ status: 'COMPLETED' });
      setTimeout(() => setCompletePhase('done'), 2400);
    } catch (e) {
      setCompletePhase('idle');
      setCompleteError(e.response?.data?.error || 'Could not finalize');
    }
  };

  const jumpToStep = (n) => {
    if (planId) window.location.href = `/plans/${planId}/step/${n}`;
  };

  return (
    <Stack spacing={3}>
      {/* Marketplace banner (after COMPLETED) */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            key="marketplace"
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          >
            <Card
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                color: '#fff',
                boxShadow: theme.vastu.glowPrimary,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute', top: -60, right: -60,
                  width: 220, height: 220, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', filter: 'blur(30px)',
                }}
              />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={2}
                sx={{ position: 'relative' }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <StorefrontIcon sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                      Architect marketplace unlocked
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.92 }}>
                      Your plan is complete — invite licensed architects to bid on bringing it to life.
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  variant="contained"
                  sx={{
                    background: '#fff', color: 'primary.main',
                    fontWeight: 800, '&:hover': { background: '#F5F5F5' },
                  }}
                  onClick={() => { window.location.href = '/marketplace'; }}
                >
                  Browse architects
                </Button>
              </Stack>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2-column layout */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(0, 1fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* ─── LEFT: summary + versions + actions ─── */}
        <Stack spacing={3}>
          {/* Step summaries */}
          <Card
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              boxShadow: theme.vastu.cardShadow,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>Plan summary</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nine wizard sections. Click <strong>Edit</strong> on any card to jump back.
                </Typography>
              </Box>
            </Stack>

            <Stack spacing={1.2}>
              {summaries.map((s, i) => (
                <StepSummaryCard
                  key={s.number}
                  step={s}
                  index={i}
                  onEdit={() => jumpToStep(s.number)}
                />
              ))}
            </Stack>
          </Card>

          {/* Versions */}
          <Card
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              boxShadow: theme.vastu.cardShadow,
            }}
          >
            <VersionTimeline planId={planId} onRollback={() => window.location.reload()} />
          </Card>

          {/* Export actions */}
          <Card
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              boxShadow: theme.vastu.cardShadow,
            }}
          >
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Export & share</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Bundle everything into a single PDF, or share a contractor-only view.
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ '& > *': { flex: 1 } }}
            >
              <Button
                size="large"
                variant="contained"
                startIcon={pdfPhase === 'downloading'
                  ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                  : <PictureAsPdfIcon />}
                onClick={exportFullPdf}
                disabled={pdfPhase === 'downloading'}
                sx={{
                  fontWeight: 700,
                  boxShadow: theme.vastu.glowPrimary,
                  '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                }}
              >
                {pdfPhase === 'error' ? 'Failed — retry'
                  : pdfPhase === 'downloading' ? 'Preparing…'
                  : 'Full Plan PDF'}
              </Button>
              <Button
                size="large"
                variant="outlined"
                startIcon={sharePhase === 'creating'
                  ? <CircularProgress size={18} />
                  : <ShareIcon />}
                onClick={createContractorLink}
                disabled={sharePhase === 'creating'}
                sx={{ fontWeight: 700 }}
              >
                Share contractor view
              </Button>
            </Stack>
            {(user?.tier || 'FREE').toUpperCase() === 'FREE' && (
              <Alert severity="info" sx={{ mt: 2 }} icon={<VerifiedIcon fontSize="small" />}>
                On the FREE tier the PDF carries a watermark. Upgrade to Basic+ for a clean export.
              </Alert>
            )}
          </Card>

          {/* Mark as completed */}
          <Card
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              textAlign: 'center',
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              boxShadow: theme.vastu.cardShadow,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <ConfettiBurst show={completePhase === 'celebrating'} duration={2200} spread={320} />

            <AnimatePresence mode="wait">
              {completePhase === 'celebrating' || completePhase === 'done' ? (
                <motion.div
                  key="done"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
                  transition={{ duration: 0.7, times: [0, 0.6, 1], ease: [0.22, 1, 0.36, 1] }}
                >
                  <CelebrationIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
                  <Typography
                    sx={{
                      fontFamily: '"Playfair Display", serif',
                      fontWeight: 700,
                      fontSize: { xs: '1.7rem', md: '2.2rem' },
                      background: theme.vastu.gradientText,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Plan finalised!
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                    {completePhase === 'celebrating'
                      ? 'Unlocking the architect marketplace…'
                      : `Marked as COMPLETED${value.completedAt ? ' on ' + new Date(value.completedAt).toLocaleDateString('en-IN') : ''}.`}
                  </Typography>
                </motion.div>
              ) : (
                <motion.div
                  key="cta"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Playfair Display", serif',
                      fontWeight: 700,
                      fontSize: { xs: '1.4rem', md: '1.7rem' },
                      mb: 0.5,
                    }}
                  >
                    Ready to finalise?
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 460, mx: 'auto' }}>
                    Marking the plan as completed locks future edits behind a rollback,
                    and unlocks the architect marketplace for contractor bidding.
                  </Typography>

                  {completeError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCompleteError(null)}>
                      {completeError}
                    </Alert>
                  )}

                  <Button
                    size="large"
                    variant="contained"
                    startIcon={completePhase === 'finalizing'
                      ? <CircularProgress size={20} sx={{ color: '#fff' }} />
                      : <VerifiedIcon />}
                    onClick={finalize}
                    disabled={completePhase === 'finalizing'}
                    sx={{
                      px: 5, py: 1.6,
                      fontWeight: 800, fontSize: '1rem',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                      boxShadow: `0 0 28px ${theme.palette.primary.main}, 0 0 56px ${theme.palette.primary.main}40`,
                      '&:hover': {
                        boxShadow: `0 0 36px ${theme.palette.primary.main}, 0 0 72px ${theme.palette.primary.main}60`,
                      },
                    }}
                  >
                    {completePhase === 'finalizing' ? 'Finalising…' : 'Mark as Completed'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Stack>

        {/* ─── RIGHT: collaboration ─── */}
        <Box
          sx={{
            position: { lg: 'sticky' },
            top: { lg: 20 },
            alignSelf: 'start',
          }}
        >
          <CollaboratorPanel planId={planId} planRooms={planRooms} />
        </Box>
      </Box>

      {/* Share-link toast */}
      <Snackbar
        open={!!shareToast}
        autoHideDuration={shareToast?.kind === 'error' ? 4000 : 6000}
        onClose={() => setShareToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {shareToast?.kind === 'error' ? (
          <Alert severity="error" onClose={() => setShareToast(null)}>
            {shareToast.message}
          </Alert>
        ) : (
          <Alert
            severity="success"
            icon={<ContentCopyIcon fontSize="small" />}
            onClose={() => setShareToast(null)}
            sx={{ minWidth: 280 }}
          >
            {shareToast?.message}
          </Alert>
        )}
      </Snackbar>
    </Stack>
  );
}
