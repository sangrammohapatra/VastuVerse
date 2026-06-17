import {
  Accordion, AccordionSummary, AccordionDetails, Box, Typography, Stack, Chip, Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

/**
 * Accordion list of per-room style overrides.
 *
 *   rooms              [{ id, label, kind }]
 *   globalStyle        currently-selected global style id (string)
 *   styles             [{ id, label, gradient, … }] — the same set as the global picker
 *   perRoomStyles      { [roomId]: styleId }   — override map
 *   onChange(map)      called with full updated map
 */
export default function PerRoomStyleAccordion({
  rooms = [],
  globalStyle,
  styles = [],
  perRoomStyles = {},
  onChange,
}) {
  const theme = useTheme();

  const setRoom = (roomId, styleId) => {
    const next = { ...perRoomStyles };
    if (!styleId || styleId === globalStyle) {
      delete next[roomId];
    } else {
      next[roomId] = styleId;
    }
    onChange?.(next);
  };

  const resetAll = () => onChange?.({});

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Override the global style for individual rooms. Collapsed rooms inherit{' '}
          <strong>{stylize(styles, globalStyle)}</strong>.
        </Typography>
        {Object.keys(perRoomStyles).length > 0 && (
          <Button
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={resetAll}
            sx={{ flexShrink: 0 }}
          >
            Reset overrides
          </Button>
        )}
      </Stack>

      {rooms.map((room) => {
        const override = perRoomStyles[room.id];
        const isOverridden = !!override;
        return (
          <Accordion
            key={room.id}
            disableGutters
            elevation={0}
            sx={{
              mb: 1,
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              borderRadius: 2,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{room.label}</Typography>
                <Chip
                  size="small"
                  label={
                    isOverridden
                      ? `Override: ${stylize(styles, override)}`
                      : 'Using global style'
                  }
                  color={isOverridden ? 'primary' : 'default'}
                  variant={isOverridden ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)' },
                  gap: 1,
                }}
              >
                {styles.map((s, i) => {
                  const selected = (override || globalStyle) === s.id;
                  return (
                    <motion.div
                      key={s.id}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Box
                        onClick={() => setRoom(room.id, s.id)}
                        sx={{
                          p: 1.2,
                          cursor: 'pointer',
                          borderRadius: 2,
                          border: selected
                            ? `2px solid ${theme.palette.primary.main}`
                            : `1px solid ${theme.palette.divider}`,
                          background: selected
                            ? theme.palette.mode === 'dark'
                              ? 'rgba(76,175,80,0.06)'
                              : 'rgba(46,125,50,0.04)'
                            : 'transparent',
                          transition: 'border-color .2s, background .2s',
                        }}
                      >
                        <Box
                          sx={{
                            height: 18,
                            mb: 0.6,
                            borderRadius: 1,
                            background: s.gradient,
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {s.label}
                        </Typography>
                      </Box>
                    </motion.div>
                  );
                })}
              </Box>

              {isOverridden && (
                <Button
                  size="small"
                  onClick={() => setRoom(room.id, null)}
                  sx={{ mt: 1.5 }}
                  startIcon={<RestartAltIcon />}
                >
                  Use global style
                </Button>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

function stylize(styles, id) {
  return styles.find((s) => s.id === id)?.label || 'global style';
}
