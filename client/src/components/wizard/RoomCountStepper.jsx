import { Stack, IconButton, Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

/**
 * Animated count stepper. Numbers slide vertically when value changes.
 *
 *   value         current count
 *   onChange(n)   called with clamped new value
 *   min / max     bounds (default 0 / 99)
 *   label         optional small caption to the left
 *   compact       smaller size for inline use inside cards
 */
export default function RoomCountStepper({
  value = 0,
  onChange,
  min = 0,
  max = 99,
  label,
  compact = false,
  disabled = false,
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();

  const dec = () => !disabled && onChange?.(Math.max(min, (Number(value) || 0) - 1));
  const inc = () => !disabled && onChange?.(Math.min(max, (Number(value) || 0) + 1));

  const size = compact ? 28 : 36;
  const valueWidth = compact ? 32 : 48;
  const fontSize = compact ? '0.95rem' : '1.15rem';

  return (
    <Stack direction="row" alignItems="center" spacing={compact ? 0.5 : 1}>
      {label && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
          {label}
        </Typography>
      )}
      <IconButton
        size="small"
        onClick={dec}
        disabled={disabled || value <= min}
        sx={{
          width: size,
          height: size,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '50%',
          '&:hover': { borderColor: theme.palette.primary.main, color: 'primary.main' },
        }}
        aria-label="decrease"
      >
        <RemoveIcon fontSize="small" />
      </IconButton>

      {/* Value with slide-in animation */}
      <Box
        sx={{
          width: valueWidth,
          height: size,
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={reduce ? false : { y: -size, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: size, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              fontWeight: 700,
              fontSize,
              fontVariantNumeric: 'tabular-nums',
              color: theme.palette.text.primary,
            }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </Box>

      <IconButton
        size="small"
        onClick={inc}
        disabled={disabled || value >= max}
        sx={{
          width: size,
          height: size,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '50%',
          '&:hover': { borderColor: theme.palette.primary.main, color: 'primary.main' },
        }}
        aria-label="increase"
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
