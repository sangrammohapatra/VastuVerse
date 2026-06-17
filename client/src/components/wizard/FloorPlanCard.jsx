import { useState } from 'react';
import {
  Card, Box, Stack, Typography, Chip, Button, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GridViewIcon from '@mui/icons-material/GridView';
import ImageIcon from '@mui/icons-material/Image';

import FloorPlanSVG from './FloorPlanSVG';

const MotionCard = motion(Card);

/**
 * One of the three generated floor-plan options.
 *
 *   option         { id, variant, summary, rooms, floors, plotDimensions, totalArea, complianceNotes, imageUrl? }
 *   index          stagger delay
 *   selected       whether this option is the currently selected one
 *   vastuEnabled   forwarded to SVG renderer for compass overlay
 *   onSelect()
 */
export default function FloorPlanCard({
  option,
  index = 0,
  selected = false,
  vastuEnabled = false,
  onSelect,
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [view, setView] = useState('svg'); // 'svg' | 'image'

  const totalRooms = option?.rooms?.length || 0;

  return (
    <MotionCard
      initial={reduce ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.12, ease: [0.22, 1, 0.36, 1] }}
      whileHover={selected || reduce ? undefined : { y: -4 }}
      elevation={0}
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.vastu.cardBg,
        border: selected ? `2px solid ${theme.palette.primary.main}` : theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: selected ? theme.vastu.glowPrimary : theme.vastu.cardShadow,
        transition: 'border-color .3s, box-shadow .3s',
        position: 'relative',
      }}
    >
      {/* "Selected" floating badge */}
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          style={{
            position: 'absolute', top: 12, right: 12,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: theme.palette.primary.main, color: '#fff',
            fontWeight: 700, fontSize: 12, zIndex: 2,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 14 }} /> Selected
        </motion.div>
      )}

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box sx={{ flex: 1, pr: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
            {option.variant}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.3 }}>
            {option.summary}
          </Typography>
        </Box>
      </Stack>

      {/* View toggle */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ my: 1.5 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_e, v) => v && setView(v)}
        >
          <ToggleButton value="svg" sx={{ px: 1.5 }}>
            <GridViewIcon fontSize="small" sx={{ mr: 0.5 }} /> 2D
          </ToggleButton>
          <ToggleButton value="image" sx={{ px: 1.5 }} disabled={!option.imageUrl}>
            <ImageIcon fontSize="small" sx={{ mr: 0.5 }} /> Image
          </ToggleButton>
        </ToggleButtonGroup>
        <Chip
          label={`${totalRooms} rooms · ${option.totalArea} sqft`}
          size="small"
          variant="outlined"
        />
      </Stack>

      {/* Viewer body */}
      <Box sx={{ flex: 1 }}>
        {view === 'svg' || !option.imageUrl ? (
          <FloorPlanSVG option={option} vastuEnabled={vastuEnabled} height={280} />
        ) : (
          <Box
            sx={{
              borderRadius: 1,
              overflow: 'hidden',
              border: `1px solid ${theme.palette.divider}`,
              aspectRatio: '1 / 1',
              background: '#0A0E1A',
            }}
          >
            <Box
              component="img"
              src={option.imageUrl}
              alt={option.variant}
              loading="lazy"
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </Box>
        )}
      </Box>

      {/* Compliance notes */}
      {option.complianceNotes?.length > 0 && (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1.5, gap: 0.5 }}>
          {option.complianceNotes.slice(0, 3).map((n) => (
            <Chip key={n} size="small" label={n} variant="outlined" sx={{ fontSize: '0.7rem' }} />
          ))}
        </Stack>
      )}

      {/* Select button */}
      <Button
        variant={selected ? 'outlined' : 'contained'}
        fullWidth
        onClick={() => onSelect?.(option)}
        sx={{
          mt: 2,
          fontWeight: 700,
          boxShadow: selected ? 'none' : theme.vastu.glowPrimary,
          '&:hover': selected ? undefined : { boxShadow: `0 0 44px ${theme.palette.primary.main}` },
        }}
        startIcon={selected ? <CheckCircleIcon /> : null}
      >
        {selected ? 'Selected' : 'Select this plan'}
      </Button>
    </MotionCard>
  );
}
