import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Button, Alert, CircularProgress, Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import LockIcon from '@mui/icons-material/Lock';
import GavelIcon from '@mui/icons-material/Gavel';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ReplayIcon from '@mui/icons-material/Replay';
import VerifiedIcon from '@mui/icons-material/Verified';

import { api } from '../../utils/axiosInstance';
import { useAuth } from '../../context/AuthContext';

import ComplianceChecklist from '../../components/wizard/ComplianceChecklist';
import MunicipalDraftDocument from '../../components/wizard/MunicipalDraftDocument';

const SAVE_DEBOUNCE_MS = 1500;

export default function Step9Municipal({ value, onChange }) {
  const theme = useTheme();
  const { user } = useAuth();

  const planId = useMemo(() => {
    const m = window.location.pathname.match(/\/plans\/([^/]+)\/step\//);
    return m ? m[1] : null;
  }, []);

  // Tier gate: FREE blocked, BASIC+ allowed
  const isLocked = user?.tier === 'FREE' || !user?.tier;

  /* ─── Locked state (FREE user) ──────────────────────────────────── */
  if (isLocked) {
    return <FreeUserGate />;
  }

  return <Step9Body planId={planId} value={value} onChange={onChange} />;
}

/* ─── FREE-tier upgrade card ─────────────────────────────────────── */

function FreeUserGate() {
  const theme = useTheme();

  const perks = [
    'AI-driven compliance checklist against NBC + state bye-laws',
    'Setback, FSI, parking, fire egress + 3 more checks',
    'Draft application document with expandable references',
    'PDF export with on-every-page disclaimer band',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14, mass: 0.9 }}
    >
      <Card
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          position: 'relative',
          overflow: 'hidden',
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          WebkitBackdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -100, right: -100,
            width: 300, height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46,125,50,0.18), transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 3, md: 5 }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ position: 'relative' }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Box
              sx={{
                width: 110, height: 110, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                boxShadow: theme.vastu.glowPrimary,
                flexShrink: 0,
              }}
            >
              <GavelIcon sx={{ fontSize: 50, color: '#fff' }} />
            </Box>
          </motion.div>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip
              label="BASIC+ FEATURE"
              size="small"
              sx={{
                mb: 1.5,
                fontWeight: 800,
                letterSpacing: 1.2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                color: '#fff',
                boxShadow: theme.vastu.glowPrimary,
              }}
            />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: { xs: '1.6rem', md: '2rem' },
                mb: 1,
                background: theme.vastu.gradientText,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Municipal compliance — unlock with Basic
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, maxWidth: 540 }}>
              Get an AI-checked compliance report against National Building Code + your local bye-laws,
              plus a draft application document ready to take to your architect.
            </Typography>

            <Stack spacing={1} sx={{ mb: 3 }}>
              {perks.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <VerifiedIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    <Typography variant="body2">{p}</Typography>
                  </Stack>
                </motion.div>
              ))}
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              spacing={2}
            >
              <Button
                size="large"
                variant="contained"
                onClick={() => { window.location.href = '/profile?upgrade=BASIC'; }}
                startIcon={<LockIcon />}
                sx={{
                  px: 4, py: 1.5,
                  fontWeight: 800,
                  fontSize: '1rem',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                  boxShadow: theme.vastu.glowPrimary,
                  '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                }}
              >
                Upgrade to Basic — ₹99/mo
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Cancel anytime · Includes 10 AI generations / day
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Card>
    </motion.div>
  );
}

/* ─── Unlocked body ──────────────────────────────────────────────── */

function Step9Body({ planId, value, onChange }) {
  const theme = useTheme();

  const report = value.municipalReport || {};
  const hasReport = Array.isArray(report.items) && report.items.length > 0;

  const [phase, setPhase] = useState(hasReport ? 'ready' : 'idle'); // idle|generating|ready|error
  const [error, setError] = useState(null);
  const [pdfPhase, setPdfPhase] = useState('idle'); // idle|downloading|error

  /* ─── User-fill fields with debounced save ─────────────────────── */
  const [userFields, setUserFields] = useState(report.userFields || {
    plotNumber: '', surveyNumber: '', localAuthority: '', ownerName: '',
  });

  const lastSavedRef = useRef(JSON.stringify(userFields));
  useEffect(() => {
    const stringified = JSON.stringify(userFields);
    if (stringified === lastSavedRef.current) return undefined;

    const t = setTimeout(() => {
      lastSavedRef.current = stringified;
      onChange({
        municipalReport: {
          ...(value.municipalReport || {}),
          userFields,
        },
      });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFields]);

  /* ─── Generate report ──────────────────────────────────────────── */
  const generate = useCallback(async () => {
    if (!planId) return;
    setPhase('generating');
    setError(null);
    try {
      const { data } = await api.post(
        `/plans/${planId}/generate/municipal-checklist`,
        { userFields }
      );
      onChange({ municipalReport: { ...data, userFields } });
      setPhase('ready');
    } catch (e) {
      setPhase('error');
      setError(e.response?.data?.error || 'Could not generate report');
    }
  }, [planId, userFields, onChange]);

  /* ─── PDF export ───────────────────────────────────────────────── */
  const exportPdf = useCallback(async () => {
    if (!planId) return;
    setPdfPhase('downloading');
    try {
      const res = await api.get(`/plans/${planId}/export/municipal-pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const safeTitle = (value.title || 'municipal').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-municipal-draft.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfPhase('idle');
    } catch (e) {
      setPdfPhase('error');
      setTimeout(() => setPdfPhase('idle'), 3000);
    }
  }, [planId, value.title]);

  /* ─── Compliance summary chip ──────────────────────────────────── */
  const summaryChip = useMemo(() => {
    const s = report.summary;
    if (!s) return null;
    const colorMap = {
      compliant:        { bg: '#E8F5E9', fg: '#2E7D32', label: 'COMPLIANT' },
      'needs-attention':{ bg: '#FFF8E1', fg: '#F57F17', label: 'NEEDS ATTENTION' },
      'non-compliant':  { bg: '#FFEBEE', fg: '#C62828', label: 'NON-COMPLIANT' },
    };
    return colorMap[s.overallStatus] || colorMap['needs-attention'];
  }, [report.summary]);

  return (
    <Stack spacing={3}>
      {/* Persistent amber disclaimer — cannot be dismissed */}
      <Alert
        severity="warning"
        icon={<LockIcon fontSize="inherit" />}
        sx={{
          borderRadius: 2,
          background: theme.palette.mode === 'dark'
            ? 'rgba(255,143,0,0.10)'
            : 'rgba(255,143,0,0.08)',
          border: `1px solid ${theme.palette.warning.main}50`,
          fontWeight: 500,
          '& .MuiAlert-icon': { color: theme.palette.warning.main },
        }}
      >
        <strong>Guidance only — not for submission.</strong>{' '}
        Final approval must be obtained from your local ULB / Municipal Corporation. VastuVerse
        does not guarantee compliance. Plans must be signed by a licensed architect / structural engineer.
      </Alert>

      {/* Header card */}
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
              Municipal compliance report
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 560 }}>
              Checks your plan against National Building Code defaults and (when available) your local
              ULB bye-laws. Each line item expands to show the source rule.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.2} alignItems="center">
            {summaryChip && phase === 'ready' && (
              <Chip
                label={summaryChip.label}
                sx={{
                  fontWeight: 800, letterSpacing: 1.2,
                  background: summaryChip.bg, color: summaryChip.fg,
                  border: `1px solid ${summaryChip.fg}55`,
                }}
              />
            )}
            {phase === 'ready' ? (
              <Button
                variant="outlined"
                startIcon={<ReplayIcon />}
                onClick={generate}
              >
                Regenerate
              </Button>
            ) : (
              <Button
                size="large"
                variant="contained"
                startIcon={
                  phase === 'generating'
                    ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                    : <AutoAwesomeIcon />
                }
                onClick={generate}
                disabled={phase === 'generating'}
                sx={{
                  fontWeight: 700,
                  boxShadow: theme.vastu.glowPrimary,
                  '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                }}
              >
                {phase === 'generating' ? 'Generating…' : 'Generate compliance report'}
              </Button>
            )}
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Card>

      {/* Compliance checklist */}
      <AnimatePresence mode="wait">
        {phase === 'generating' ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ComplianceChecklist loading />
          </motion.div>
        ) : phase === 'ready' && hasReport ? (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ComplianceChecklist items={report.items || []} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Draft document (always editable for user-fill fields) */}
      {(phase === 'ready' && hasReport) || hasReport ? (
        <>
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.2 }}>
              Draft document
            </Typography>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: '1.4rem',
                mb: 1.5,
              }}
            >
              Application preview
            </Typography>
          </Box>

          <MunicipalDraftDocument
            userFields={userFields}
            onChange={setUserFields}
            draft={report.draft || {}}
            plan={value}
            editable
          />

          {/* Export footer */}
          <Card
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.5 },
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', sm: 'center' }}
              spacing={2}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>Export as PDF</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Includes the application draft, checklist, and an amber disclaimer band on every page.
                </Typography>
              </Box>
              <Button
                size="large"
                variant="contained"
                startIcon={
                  pdfPhase === 'downloading'
                    ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                    : <PictureAsPdfIcon />
                }
                onClick={exportPdf}
                disabled={pdfPhase === 'downloading'}
                sx={{
                  fontWeight: 700,
                  boxShadow: theme.vastu.glowPrimary,
                  '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
                }}
              >
                {pdfPhase === 'error'
                  ? 'Export failed — retry'
                  : pdfPhase === 'downloading'
                    ? 'Preparing PDF…'
                    : 'Export application as PDF'}
              </Button>
            </Stack>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
