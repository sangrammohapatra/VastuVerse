import { Box, Stack, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@mui/material/styles';

import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

/**
 * Auto-save status pill.
 *   status: "idle" | "dirty" | "saving" | "saved" | "error"
 */
export default function AutoSaveIndicator({ status = 'idle' }) {
  const theme = useTheme();

  const cfg = {
    idle:   { label: '',                  icon: null,                              color: 'text.secondary' },
    dirty:  { label: 'Unsaved changes',   icon: <EditOutlinedIcon fontSize="small" />,         color: 'text.secondary' },
    saving: { label: 'Saving…',           icon: <SaveOutlinedIcon fontSize="small" />,         color: 'info.main',     spin: true },
    saved:  { label: 'Saved',             icon: <CloudDoneOutlinedIcon fontSize="small" />,    color: 'primary.main' },
    error:  { label: 'Save failed',       icon: <ErrorOutlineIcon fontSize="small" />,         color: 'error.main' },
  }[status] || { label: '', icon: null };

  if (!cfg.label) return <Box sx={{ height: 32 }} />;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            border: `1px solid ${theme.palette.divider}`,
            background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: cfg.color,
          }}
        >
          <motion.span
            animate={cfg.spin ? { rotate: 360 } : { rotate: 0 }}
            transition={cfg.spin ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { duration: 0 }}
            style={{ display: 'inline-flex' }}
          >
            {cfg.icon}
          </motion.span>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {cfg.label}
          </Typography>
        </Stack>
      </motion.div>
    </AnimatePresence>
  );
}
