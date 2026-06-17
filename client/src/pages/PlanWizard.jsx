import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Container, Stack, Button, Typography, CircularProgress, Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ListIcon from '@mui/icons-material/List';

import { api } from '../utils/axiosInstance';
import { WIZARD_STEPS, TOTAL_STEPS } from '../constants/wizardSteps';
import StepperHeader from './wizard/StepperHeader';
import AutoSaveIndicator from './wizard/AutoSaveIndicator';
import Step1Land from './wizard/Step1Land';
import Step2Rooms from './wizard/Step2Rooms';
import Step3FloorPlan from './wizard/Step3FloorPlan';
import Step4Interior from './wizard/Step4Interior';
import Step5Exterior from './wizard/Step5Exterior';
import Step6Utilities from './wizard/Step6Utilities';
import Step7Cost from './wizard/Step7Cost';
import Step8ThreeDView from './wizard/Step8ThreeDView';
import Step9Municipal from './wizard/Step9Municipal';
import Step10Review from './wizard/Step10Review';

const EMPTY_PLAN = {
  title: '',
  vastuEnabled: false,
  cityState: { city: '', state: '' },
  landDetails: {
    area: '',
    unit: 'sqft',
    shape: '',
    floors: 1,
    facingDirection: '',
    plotCoordinates: [],
  },
  roomConfig: {
    bedrooms: 2,
    attachedBathrooms: 1,
    commonBathrooms: 1,
    kitchenType: 'modular',
    additionalSpaces: ['living'],
    balconies: 0,
    staircases: 1,
    floorAssignments: {},
  },
  floorPlan: {
    options: [],
    selectedOptionId: null,
    jobId: null,
    generatedAt: null,
  },
  interior: {
    globalStyle: null,
    perRoomStyles: {},
    kitchenConfig: { layout: 'L', appliances: ['fridge', 'chimney'] },
    selectedPaletteId: null,
    palettes: [],
    rooms: {},
  },
  exterior: {
    facadeStyle: null,
    roofType: '',
    boundaryWall: '',
    mainGate: '',
    driveway: { enabled: false, material: 'pavers' },
    landscaping: [],
    sides: {},
  },
  utilities: {
    jobId: null,
    generatedAt: null,
    layers: {},
    summary: {},
    activeLayers: [],
  },
  costEstimate: {
    finishTier: 'standard',
    totalInr: null,
    asOf: null,
    generatedAt: null,
  },
  municipalReport: {
    generatedAt: null,
    items: [],
    summary: null,
    draft: {},
    userFields: { plotNumber: '', surveyNumber: '', localAuthority: '', ownerName: '' },
  },
  is3DUnlocked: false,
  birdEyeView: {
    imageUrl: null,
    jobId: null,
    generatedAt: null,
  },
  shareTokens: {},
  stepProgress: {},
  status: 'DRAFT',
  completedAt: null,
};

/* ---- step renderer ------------------------------------------------------ */

function StepBody({ stepNumber, value, onChange }) {
  switch (stepNumber) {
    case 1:
      return <Step1Land value={value} onChange={onChange} />;
    case 2:
      return <Step2Rooms value={value} onChange={onChange} />;
    case 3:
      return <Step3FloorPlan value={value} onChange={onChange} />;
    case 4:
      return <Step4Interior value={value} onChange={onChange} />;
    case 5:
      return <Step5Exterior value={value} onChange={onChange} />;
    case 6:
      return <Step6Utilities value={value} onChange={onChange} />;
    case 7:
      return <Step7Cost value={value} onChange={onChange} />;
    case 8:
      return <Step8ThreeDView value={value} onChange={onChange} />;
    case 9:
      return <Step9Municipal value={value} onChange={onChange} />;
    case 10:
      return <Step10Review value={value} onChange={onChange} />;
    default:
      return (
        <Box sx={{ p: 6, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 3 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>
            Step {stepNumber} — {WIZARD_STEPS[stepNumber - 1]?.label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This step's UI lands in an upcoming build.
          </Typography>
        </Box>
      );
  }
}

/* ---- main wizard -------------------------------------------------------- */

export default function PlanWizard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { planId, stepNumber: stepParam } = useParams();

  const stepNumber = Math.max(1, Math.min(TOTAL_STEPS, Number(stepParam) || 1));
  const stepMeta = WIZARD_STEPS[stepNumber - 1];

  const [planData, setPlanData] = useState(EMPTY_PLAN);
  const [bootStatus, setBootStatus] = useState('loading'); // loading | ready | error
  const [bootError, setBootError] = useState(null);
  const [autosave, setAutosave] = useState('idle'); // idle | dirty | saving | saved | error
  const [submitError, setSubmitError] = useState(null);
  const isInitial = useRef(true);
  const savedTimeoutRef = useRef(null);

  /* ---- load plan on mount --------------------------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/plans/${planId}`);
        if (!alive) return;
        const plan = data.plan || {};
        setPlanData((prev) => ({
          ...prev,
          title: plan.title || '',
          vastuEnabled: !!plan.vastuEnabled,
          cityState: plan.cityState || prev.cityState,
          landDetails: { ...prev.landDetails, ...(plan.landDetails || {}) },
          roomConfig: { ...prev.roomConfig, ...(plan.roomConfig || {}) },
          floorPlan: { ...prev.floorPlan, ...(plan.floorPlan || {}) },
          interior: { ...prev.interior, ...(plan.interior || {}) },
          exterior: { ...prev.exterior, ...(plan.exterior || {}) },
          utilities: { ...prev.utilities, ...(plan.utilities || {}) },
          costEstimate: { ...prev.costEstimate, ...(plan.costEstimate || {}) },
          municipalReport: { ...prev.municipalReport, ...(plan.municipalReport || {}) },
          is3DUnlocked: !!plan.is3DUnlocked,
          birdEyeView: { ...prev.birdEyeView, ...(plan.birdEyeView || {}) },
          shareTokens: { ...prev.shareTokens, ...(plan.shareTokens || {}) },
          stepProgress: plan.stepProgress || {},
          status: plan.status || 'DRAFT',
          completedAt: plan.completedAt || null,
        }));
        setBootStatus('ready');
      } catch (e) {
        if (!alive) return;
        if (e.response?.status === 404) {
          // Plan doesn't exist (or doesn't belong to user) — bounce to new-plan flow
          navigate('/plans/new', { replace: true });
          return;
        }
        setBootError(e.response?.data?.error || 'Could not load plan');
        setBootStatus('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [planId, navigate]);

  /* ---- updater that flips status to "dirty" --------------------------- */
  const updatePlanData = useCallback((patch) => {
    setPlanData((prev) => ({
      ...prev,
      ...patch,
      cityState: { ...prev.cityState, ...(patch.cityState || {}) },
      landDetails: { ...prev.landDetails, ...(patch.landDetails || {}) },
      roomConfig: { ...prev.roomConfig, ...(patch.roomConfig || {}) },
      floorPlan: { ...prev.floorPlan, ...(patch.floorPlan || {}) },
      interior: { ...prev.interior, ...(patch.interior || {}) },
      exterior: { ...prev.exterior, ...(patch.exterior || {}) },
      utilities: { ...prev.utilities, ...(patch.utilities || {}) },
      costEstimate: { ...prev.costEstimate, ...(patch.costEstimate || {}) },
      municipalReport: { ...prev.municipalReport, ...(patch.municipalReport || {}) },
      // is3DUnlocked: scalar flag — accept direct assignment (only flipped after Razorpay verify)
      ...(patch.is3DUnlocked !== undefined ? { is3DUnlocked: !!patch.is3DUnlocked } : {}),
      birdEyeView: { ...prev.birdEyeView, ...(patch.birdEyeView || {}) },
    }));
    if (!isInitial.current) setAutosave('dirty');
  }, []);

  // Mark "initial" once boot is ready (prevents the load from triggering dirty)
  useEffect(() => {
    if (bootStatus === 'ready') {
      isInitial.current = false;
    }
  }, [bootStatus]);

  /* ---- save function -------------------------------------------------- */
  const stepKey = useMemo(() => `step${stepNumber}`, [stepNumber]);

  const saveStep = useCallback(
    async (markComplete = false) => {
      if (!planId) return false;
      setAutosave('saving');
      setSubmitError(null);
      try {
        const payload = {
          title: planData.title,
          vastuEnabled: planData.vastuEnabled,
          cityState: planData.cityState,
          landDetails: planData.landDetails,
          roomConfig: planData.roomConfig,
          // Only send the small bits the user can choose — the worker already
          // persisted the heavyweight `options` array directly on the Plan.
          floorPlan: {
            selectedOptionId: planData.floorPlan?.selectedOptionId,
            jobId: planData.floorPlan?.jobId,
            generatedAt: planData.floorPlan?.generatedAt,
          },
          // Same pattern: the worker writes `interior.rooms.{roomId}` directly,
          // so we never echo it back here — only the client-managed config.
          interior: {
            globalStyle: planData.interior?.globalStyle,
            perRoomStyles: planData.interior?.perRoomStyles,
            kitchenConfig: planData.interior?.kitchenConfig,
            selectedPaletteId: planData.interior?.selectedPaletteId,
            palettes: planData.interior?.palettes,
          },
          exterior: {
            facadeStyle: planData.exterior?.facadeStyle,
            roofType: planData.exterior?.roofType,
            boundaryWall: planData.exterior?.boundaryWall,
            mainGate: planData.exterior?.mainGate,
            driveway: planData.exterior?.driveway,
            landscaping: planData.exterior?.landscaping,
          },
          // The worker owns layers + summary; echo back only metadata + the
          // active-layer toggle preference so it persists across reloads.
          utilities: {
            jobId: planData.utilities?.jobId,
            generatedAt: planData.utilities?.generatedAt,
            activeLayers: planData.utilities?.activeLayers,
          },
          // Cost is recomputable on demand; we persist the last-viewed tier
          // so the user lands on the same view when they return to step 7.
          costEstimate: {
            finishTier: planData.costEstimate?.finishTier,
            totalInr: planData.costEstimate?.totalInr,
            asOf: planData.costEstimate?.asOf,
            generatedAt: planData.costEstimate?.generatedAt,
          },
          // Municipal: items/summary/draft are server-computed; we echo
          // only the user-fillable form fields so they survive auto-save.
          municipalReport: {
            userFields: planData.municipalReport?.userFields,
          },
        };
        const { data } = await api.put(`/plans/${planId}/steps/${stepKey}`, payload);
        if (data?.plan) {
          // Sync local stepProgress with server (server marks current step complete)
          setPlanData((prev) => ({
            ...prev,
            stepProgress: data.plan.stepProgress || prev.stepProgress,
            status: data.plan.status || prev.status,
          }));
        }
        setAutosave('saved');
        // auto-revert "saved" → "idle" after 2s so the pill doesn't linger
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setAutosave('idle'), 2000);
        return true;
      } catch (e) {
        setAutosave('error');
        setSubmitError(e.response?.data?.error || 'Save failed');
        return false;
      }
    },
    [planId, planData, stepKey]
  );

  /* ---- debounced auto-save ------------------------------------------- */
  useEffect(() => {
    if (autosave !== 'dirty') return;
    const t = setTimeout(() => {
      saveStep(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [autosave, saveStep]);

  // Clean up the "saved → idle" timer on unmount
  useEffect(() => () => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  /* ---- navigation ---------------------------------------------------- */
  const goTo = (n) => {
    const next = Math.max(1, Math.min(TOTAL_STEPS, n));
    navigate(`/plans/${planId}/step/${next}`);
  };

  const handleBack = () => {
    if (stepNumber > 1) goTo(stepNumber - 1);
  };

  const handleSaveAndContinue = async () => {
    const ok = await saveStep(true);
    if (!ok) return;
    if (stepNumber < TOTAL_STEPS) goTo(stepNumber + 1);
  };

  /* ---- render -------------------------------------------------------- */

  if (bootStatus === 'loading') {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (bootStatus === 'error') {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => navigate('/plans')}>Plans</Button>
        }>
          {bootError || 'Failed to load this plan.'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      {/* Row 1: back link + autosave */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Button
          size="small"
          startIcon={<ListIcon />}
          onClick={() => navigate('/plans')}
          sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'none', pl: 0 }}
        >
          All plans
        </Button>
        <AutoSaveIndicator status={autosave} />
      </Stack>

      {/* Row 2: plan name */}
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: { xs: '1rem', md: '1.1rem' },
          color: 'text.secondary',
          mb: 0.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '70%',
        }}
        title={planData.title || 'Untitled Plan'}
      >
        {planData.title || 'Untitled Plan'}
      </Typography>

      {/* Row 3: step label */}
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>
          Step {stepNumber} / {TOTAL_STEPS}
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            fontSize: { xs: '1.4rem', md: '1.8rem' },
            background: theme.vastu.gradientText,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {stepMeta?.label}
        </Typography>
      </Stack>

      <StepperHeader
        currentStep={stepNumber}
        stepProgress={planData.stepProgress}
        onStepClick={(id) => goTo(id)}
      />

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {/* Animated step body */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepNumber}
            initial={reduce ? false : { x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? undefined : { x: -60, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <StepBody
              stepNumber={stepNumber}
              value={planData}
              onChange={updatePlanData}
            />
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Footer: Back + Save & Continue */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mt: 4 }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          disabled={autosave === 'saving'}
          onClick={stepNumber === 1 ? () => navigate('/plans') : handleBack}
        >
          {stepNumber === 1 ? 'All plans' : 'Back'}
        </Button>
        <Button
          endIcon={<ArrowForwardIcon />}
          variant="contained"
          size="large"
          disabled={autosave === 'saving'}
          onClick={handleSaveAndContinue}
          sx={{
            px: 3.5,
            fontWeight: 700,
            boxShadow: theme.vastu.glowPrimary,
            '&:hover': { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
          }}
        >
          {stepNumber === TOTAL_STEPS ? 'Finish & export' : 'Save & continue'}
        </Button>
      </Stack>
    </Container>
  );
}
