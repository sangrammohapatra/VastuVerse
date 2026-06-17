import { Box, Stack, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import { useMotionPreferences } from '../hooks/useMotionPreferences';

/**
 * Empty-state placeholder.
 *
 *   <EmptyState
 *     title="No plans yet"
 *     description="Start your first plan to see it here."
 *     illustration="plans"
 *     primaryAction={{ label: 'Create plan', onClick: () => nav('/plans/new') }}
 *     secondaryAction={{ label: 'Browse templates', onClick: () => nav('/templates') }}
 *   />
 *
 *   illustration: 'plans' | 'marketplace' | 'inbox' | 'search' | 'error'
 *
 * The SVG illustrations are inline — no external image requests, scales
 * crisply, themable via CSS variables. Each ~3-5KB of markup.
 */

const ILLUSTRATIONS = {
  plans:        PlansIllustration,
  marketplace:  MarketplaceIllustration,
  inbox:        InboxIllustration,
  search:       SearchIllustration,
  error:        ErrorIllustration,
};

export default function EmptyState({
  title,
  description,
  illustration = 'plans',
  primaryAction,
  secondaryAction,
  size = 'medium',
}) {
  const theme = useTheme();
  const { slideUp } = useMotionPreferences();

  const Illustration = ILLUSTRATIONS[illustration] || PlansIllustration;
  const illSize = size === 'small' ? 140 : size === 'large' ? 240 : 180;

  return (
    <motion.div {...slideUp()}>
      <Stack
        alignItems="center"
        spacing={2.5}
        sx={{
          py: size === 'small' ? 3 : 6,
          px: 3,
          textAlign: 'center',
          maxWidth: 480,
          mx: 'auto',
        }}
      >
        <Box sx={{ width: illSize, height: illSize }}>
          <Illustration primary={theme.palette.primary.main} info={theme.palette.info.main} />
        </Box>

        <Stack spacing={1} alignItems="center">
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: size === 'small' ? '1.2rem' : '1.5rem',
            }}
          >
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 380 }}>
              {description}
            </Typography>
          )}
        </Stack>

        {(primaryAction || secondaryAction) && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 1 }}>
            {primaryAction && (
              <Button
                variant="contained"
                onClick={primaryAction.onClick}
                startIcon={primaryAction.icon}
                size={size === 'small' ? 'medium' : 'large'}
                sx={{
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                  boxShadow: theme.vastu?.glowPrimary,
                }}
              >
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="outlined"
                onClick={secondaryAction.onClick}
                startIcon={secondaryAction.icon}
                size={size === 'small' ? 'medium' : 'large'}
                sx={{ fontWeight: 700 }}
              >
                {secondaryAction.label}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </motion.div>
  );
}

/* ─── Inline SVG illustrations ───────────────────────────────────── */

function PlansIllustration({ primary, info }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Blueprint grid background */}
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke={primary} strokeWidth="0.3" opacity="0.2" />
        </pattern>
      </defs>
      <rect x="30" y="30" width="140" height="140" rx="6" fill="url(#grid)" stroke={primary} strokeWidth="2" />
      {/* House outline on top */}
      <path d="M 65 105 L 100 75 L 135 105 L 135 145 L 65 145 Z"
            fill="none" stroke={primary} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Door + window */}
      <rect x="90" y="120" width="14" height="25" fill={primary} opacity="0.6" />
      <rect x="110" y="115" width="14" height="14" fill={info} opacity="0.7" />
      {/* Sparkle */}
      <circle cx="160" cy="55" r="3" fill={info} />
      <circle cx="170" cy="42" r="2" fill={primary} opacity="0.6" />
      <circle cx="40" cy="170" r="2" fill={info} opacity="0.6" />
    </svg>
  );
}

function MarketplaceIllustration({ primary, info }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Storefront */}
      <path d="M 40 80 L 100 50 L 160 80 L 160 90 L 40 90 Z" fill={primary} opacity="0.85" />
      <rect x="50" y="90" width="100" height="60" fill="none" stroke={primary} strokeWidth="2" />
      {/* Door */}
      <rect x="90" y="115" width="20" height="35" fill={info} opacity="0.7" />
      {/* Windows */}
      <rect x="60" y="100" width="20" height="15" fill={info} opacity="0.4" stroke={primary} strokeWidth="1.5" />
      <rect x="120" y="100" width="20" height="15" fill={info} opacity="0.4" stroke={primary} strokeWidth="1.5" />
      {/* Awning stripes */}
      <line x1="40" y1="85" x2="160" y2="85" stroke={info} strokeWidth="1.5" />
      {/* Sign */}
      <rect x="80" y="60" width="40" height="12" rx="2" fill={info} />
      <text x="100" y="69" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">OPEN</text>
      {/* Floor */}
      <line x1="30" y1="150" x2="170" y2="150" stroke={primary} strokeWidth="2" />
    </svg>
  );
}

function InboxIllustration({ primary, info }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Inbox tray */}
      <path d="M 50 120 L 60 95 L 140 95 L 150 120 Z" fill="none" stroke={primary} strokeWidth="2" strokeLinejoin="round" />
      <rect x="50" y="120" width="100" height="35" rx="3" fill="none" stroke={primary} strokeWidth="2" />
      {/* Slot */}
      <rect x="65" y="115" width="70" height="6" rx="1" fill={primary} opacity="0.3" />
      {/* Envelope falling in */}
      <rect x="80" y="60" width="40" height="28" rx="2" fill={info} opacity="0.85" />
      <path d="M 80 64 L 100 78 L 120 64" fill="none" stroke="#fff" strokeWidth="2" />
      {/* Empty ticks */}
      <circle cx="160" cy="80" r="2" fill={primary} opacity="0.4" />
      <circle cx="40" cy="160" r="2" fill={info} opacity="0.4" />
    </svg>
  );
}

function SearchIllustration({ primary, info }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <circle cx="90" cy="90" r="40" fill="none" stroke={primary} strokeWidth="4" />
      <line x1="120" y1="120" x2="150" y2="150" stroke={primary} strokeWidth="6" strokeLinecap="round" />
      {/* Magnifying glass highlight */}
      <path d="M 70 75 A 25 25 0 0 1 88 65" fill="none" stroke={info} strokeWidth="3" strokeLinecap="round" />
      {/* Question mark inside */}
      <text x="90" y="100" textAnchor="middle" fontSize="32" fontWeight="700" fill={info} opacity="0.4">?</text>
    </svg>
  );
}

function ErrorIllustration({ primary, info }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      {/* Broken house */}
      <path d="M 60 120 L 100 80 L 140 120 L 140 160 L 60 160 Z"
            fill="none" stroke={primary} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Crack */}
      <path d="M 100 80 L 105 100 L 95 115 L 110 135 L 100 155"
            fill="none" stroke={info} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Exclamation mark */}
      <circle cx="155" cy="55" r="22" fill={info} />
      <rect x="153" y="42" width="4" height="14" fill="#fff" rx="1" />
      <circle cx="155" cy="64" r="2" fill="#fff" />
    </svg>
  );
}
