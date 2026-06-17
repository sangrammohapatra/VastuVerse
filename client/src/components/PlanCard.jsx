import {
  Box, Card, Stack, Typography, Chip, LinearProgress, IconButton, Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import RoomIcon from '@mui/icons-material/Room';

import { timeAgo } from '../utils/timeAgo';

/* Status → MUI color/variant + label */
const STATUS_META = {
  DRAFT:       { label: 'Draft',       color: 'default', variant: 'outlined' },
  IN_PROGRESS: { label: 'In progress', color: 'primary', variant: 'filled' },
  COMPLETED:   { label: 'Completed',   color: 'info',    variant: 'filled' },
  ARCHIVED:    { label: 'Archived',    color: 'default', variant: 'outlined' },
};

/** Step completion (0–100) computed from Plan.stepProgress. */
function computeProgress(stepProgress) {
  if (!stepProgress) return 0;
  let done = 0;
  for (let i = 1; i <= 10; i++) {
    if (stepProgress[`step${i}`]?.completed) done += 1;
  }
  return Math.round((done / 10) * 100);
}

/** Next incomplete step number; 10 if all done. */
function nextStep(stepProgress) {
  if (!stepProgress) return 1;
  for (let i = 1; i <= 10; i++) {
    if (!stepProgress[`step${i}`]?.completed) return i;
  }
  return 10;
}

const MotionDiv = motion.div;

export default function PlanCard({
  plan,
  index = 0,
  onArchive,
  onEdit,
  onView,
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();

  const pct = computeProgress(plan.stepProgress);
  const meta = STATUS_META[plan.status] || STATUS_META.DRAFT;
  const editTo = `/plans/${plan._id || plan.id}/step/${nextStep(plan.stepProgress)}`;
  const viewTo = `/plans/${plan._id || plan.id}/step/${nextStep(plan.stepProgress)}`;

  return (
    <MotionDiv
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -4 }}
      style={{ height: '100%' }}
    >
      <Card
        elevation={0}
        sx={{
          p: 2.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          WebkitBackdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
          transition: 'box-shadow .25s ease, border-color .25s ease',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            boxShadow: theme.vastu.glowPrimary,
          },
        }}
      >
        {/* Header: title + status chip */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '1.05rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={plan.title}
            >
              {plan.title || 'Untitled Plan'}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
              <RoomIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2">
                {plan.cityState?.city && plan.cityState?.state
                  ? `${plan.cityState.city}, ${plan.cityState.state}`
                  : 'Location not set'}
              </Typography>
            </Stack>
          </Box>
          <Chip label={meta.label} size="small" color={meta.color} variant={meta.variant} sx={{ fontWeight: 600 }} />
        </Stack>

        {/* Progress */}
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Progress · step {nextStep(plan.stepProgress)} / 10
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{pct}%</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: (t) =>
                t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: theme.vastu.gradientBrand,
              },
            }}
          />
        </Box>

        {/* Footer: timestamp + actions */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 'auto', pt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Updated {timeAgo(plan.updatedAt || plan.createdAt)}
          </Typography>
          <Stack direction="row" spacing={0.25}>
            <Tooltip title="View">
              <IconButton
                size="small"
                component={RouterLink}
                to={viewTo}
                onClick={onView ? () => onView(plan) : undefined}
                aria-label="view plan"
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                component={RouterLink}
                to={editTo}
                onClick={onEdit ? () => onEdit(plan) : undefined}
                aria-label="edit plan"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Archive">
              <IconButton
                size="small"
                onClick={onArchive ? () => onArchive(plan) : undefined}
                aria-label="archive plan"
                disabled={plan.status === 'ARCHIVED'}
              >
                <ArchiveOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Card>
    </MotionDiv>
  );
}
