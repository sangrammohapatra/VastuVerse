import { Card, Stack, Typography, Chip, Button, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

const MotionCard = motion(Card);

const STATUS_META = {
  complete:    { color: 'success.main', bg: 'rgba(46,125,50,0.10)', Icon: CheckCircleIcon,         label: 'COMPLETE' },
  inProgress:  { color: 'warning.main', bg: 'rgba(255,143,0,0.10)', Icon: RadioButtonUncheckedIcon, label: 'IN PROGRESS' },
  empty:       { color: 'text.disabled',bg: 'rgba(128,128,128,0.06)',Icon: RadioButtonUncheckedIcon, label: 'NOT STARTED' },
};

/**
 * Compact summary card for one wizard step.
 *
 *   step       { number, label, status, highlights: [{ k, v }] }
 *   index      stagger position
 *   onEdit()   jumps the wizard to that step
 */
export default function StepSummaryCard({ step, index = 0, onEdit }) {
  const theme = useTheme();
  const meta = STATUS_META[step.status] || STATUS_META.empty;
  const Icon = meta.Icon;

  return (
    <MotionCard
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index, 12) * 0.05,
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      elevation={0}
      sx={{
        p: 2,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        borderLeft: `4px solid ${
          step.status === 'complete' ? theme.palette.success.main
          : step.status === 'inProgress' ? theme.palette.warning.main
          : theme.palette.divider
        }`,
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Icon sx={{ color: meta.color, fontSize: 18 }} />
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.7 }}
            >
              STEP {step.number}
            </Typography>
            <Chip
              label={meta.label}
              size="small"
              sx={{
                fontWeight: 800, letterSpacing: 0.6, height: 18, fontSize: '0.62rem',
                background: meta.bg, color: meta.color,
                border: `1px solid ${meta.color}`,
              }}
            />
          </Stack>

          <Typography sx={{ fontWeight: 700, mb: 0.6, fontSize: '1rem' }}>
            {step.label}
          </Typography>

          {/* Highlights */}
          {step.highlights?.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: '4px 16px',
                mt: 0.8,
              }}
            >
              {step.highlights.slice(0, 4).map((h, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="baseline">
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', textTransform: 'lowercase' }}
                  >
                    {h.k}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '0.85rem',
                    }}
                  >
                    {h.v}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Box>

        <Button
          size="small"
          startIcon={<EditOutlinedIcon fontSize="small" />}
          onClick={onEdit}
          sx={{ flexShrink: 0, fontWeight: 700 }}
        >
          Edit
        </Button>
      </Stack>
    </MotionCard>
  );
}
