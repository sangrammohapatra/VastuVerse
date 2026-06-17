import { Box, Stepper, Step, StepLabel, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import { motion } from 'framer-motion';
import CheckIcon from '@mui/icons-material/Check';

import { WIZARD_STEPS } from '../../constants/wizardSteps';

/** CSS pulse for the active step badge (mirrors design-system glow). */
const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(46,125,50,0.55); }
  50%      { box-shadow: 0 0 0 10px rgba(46,125,50,0); }
`;

/** Custom step icon: completed = animated green check; active = pulsing primary; otherwise = number. */
function WizardStepIcon({ active, completed, icon, label }) {
  const theme = useTheme();

  if (completed) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={label}
      >
        <CheckIcon sx={{ fontSize: 18 }} />
      </motion.div>
    );
  }

  if (active) {
    return (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: theme.palette.background.paper,
          color: theme.palette.primary.main,
          border: `2px solid ${theme.palette.primary.main}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          animation: `${pulse} 1.6s ease-out infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
        title={label}
      >
        {icon}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        color: 'text.secondary',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: 13,
      }}
      title={label}
    >
      {icon}
    </Box>
  );
}

/**
 * Stepper header.
 *
 *   currentStep   — 1-based index of the active step
 *   stepProgress  — Plan.stepProgress object { step1: { completed }, ... }
 *   onStepClick   — optional, navigates when a completed step is clicked
 */
export default function StepperHeader({ currentStep, stepProgress = {}, onStepClick }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const activeIndex = Math.max(0, Math.min(WIZARD_STEPS.length - 1, currentStep - 1));

  return (
    <Box sx={{ width: '100%', py: { xs: 2, md: 3 } }}>
      <Stepper
        activeStep={activeIndex}
        alternativeLabel={!isMobile}
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{
          '& .MuiStepConnector-line': {
            borderColor: theme.palette.divider,
            borderTopWidth: 2,
          },
          '& .MuiStepConnector-active .MuiStepConnector-line': {
            borderColor: theme.palette.primary.main,
          },
          '& .MuiStepConnector-completed .MuiStepConnector-line': {
            borderColor: theme.palette.primary.main,
          },
        }}
      >
        {WIZARD_STEPS.map((s, idx) => {
          const completed = !!stepProgress?.[s.key]?.completed;
          const active = idx === activeIndex;
          const clickable = completed && typeof onStepClick === 'function';
          return (
            <Step key={s.key} completed={completed}>
              <StepLabel
                onClick={clickable ? () => onStepClick(s.id) : undefined}
                StepIconComponent={(p) => (
                  <WizardStepIcon
                    {...p}
                    completed={completed}
                    active={active}
                    icon={s.icon}
                    label={s.label}
                  />
                )}
                sx={{
                  cursor: clickable ? 'pointer' : 'default',
                  '& .MuiStepLabel-label': {
                    fontSize: { xs: '0.85rem', md: '0.78rem' },
                    fontWeight: active ? 700 : 500,
                    color: active ? 'text.primary' : 'text.secondary',
                    mt: { md: 0.5 },
                  },
                }}
              >
                {s.label}
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
