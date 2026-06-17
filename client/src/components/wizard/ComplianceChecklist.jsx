import { useState } from 'react';
import {
  Box, Card, Stack, Typography, Collapse, IconButton, Chip, Skeleton, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const STATUS_META = {
  pass:    { color: '#2E7D32', Icon: CheckCircleIcon,   label: 'PASS' },
  fail:    { color: '#C62828', Icon: CancelIcon,        label: 'FAIL' },
  warning: { color: '#F57F17', Icon: WarningAmberIcon,  label: 'REVIEW' },
  info:    { color: '#0277BD', Icon: InfoOutlinedIcon,  label: 'INFO' },
};

/**
 * Animated compliance checklist.
 *
 *   items       array of { id, label, status, summary, actual, required, reference }
 *   loading     show skeleton instead of items
 */
export default function ComplianceChecklist({ items = [], loading = false }) {
  const theme = useTheme();

  if (loading) {
    return (
      <Stack spacing={1.2}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.08 }}
          >
            <Card
              elevation={0}
              sx={{
                p: 1.5,
                background: theme.vastu.cardBg,
                border: theme.vastu.cardBorder,
                backdropFilter: theme.vastu.cardBlur,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Skeleton variant="circular" width={28} height={28} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="55%" height={20} />
                  <Skeleton variant="text" width="80%" height={16} />
                </Box>
              </Stack>
            </Card>
          </motion.div>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={1.2}>
      <AnimatePresence>
        {items.map((item, i) => (
          <Item key={item.id} item={item} index={i} />
        ))}
      </AnimatePresence>
    </Stack>
  );
}

function Item({ item, index }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[item.status] || STATUS_META.info;
  const Icon = meta.Icon;
  const expandable = !!item.reference?.text;

  return (
    <motion.div
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{
        delay: Math.min(index, 9) * 0.07,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          WebkitBackdropFilter: theme.vastu.cardBlur,
          borderLeft: `4px solid ${meta.color}`,
          transition: 'background .2s',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          spacing={1.5}
          sx={{ p: 1.6, cursor: expandable ? 'pointer' : 'default' }}
          onClick={() => expandable && setOpen((v) => !v)}
        >
          <Icon sx={{ color: meta.color, mt: 0.2 }} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={{ xs: 0.5, sm: 1.2 }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.98rem' }}>
                {item.label}
              </Typography>
              <Chip
                size="small"
                label={meta.label}
                sx={{
                  fontWeight: 800, letterSpacing: 0.6,
                  background: `${meta.color}1A`,
                  color: meta.color,
                  border: `1px solid ${meta.color}55`,
                  height: 20,
                  fontSize: '0.66rem',
                }}
              />
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.4, lineHeight: 1.45 }}
            >
              {item.summary}
            </Typography>
          </Box>

          {expandable && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
              sx={{
                transition: 'transform .25s',
                transform: open ? 'rotate(180deg)' : 'rotate(0)',
                color: 'text.secondary',
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        <Collapse in={open} unmountOnExit>
          <Divider />
          <Box sx={{ p: 1.6, background: theme.palette.action.hover }}>
            {item.reference?.code && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: meta.color,
                  letterSpacing: 0.6,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {item.reference.code}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'text.primary', mb: item.actual ? 1.5 : 0 }}>
              {item.reference?.text}
            </Typography>

            {(item.actual || item.required) && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ mt: 1 }}
              >
                {item.actual && (
                  <DataBlock title="Actual" data={item.actual} accent={meta.color} />
                )}
                {item.required && (
                  <DataBlock title="Required" data={item.required} accent={theme.palette.text.secondary} />
                )}
              </Stack>
            )}
          </Box>
        </Collapse>
      </Card>
    </motion.div>
  );
}

function DataBlock({ title, data, accent }) {
  const entries = Object.entries(data).filter(([k]) => k !== 'sourceMetres');
  if (entries.length === 0) return null;
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: accent, fontWeight: 700, letterSpacing: 0.6, display: 'block', mb: 0.5 }}
      >
        {title.toUpperCase()}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '4px 12px',
          fontSize: '0.82rem',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}
      >
        {entries.map(([k, v]) => (
          <Box key={k} sx={{ display: 'contents' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{k}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
