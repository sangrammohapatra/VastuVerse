import { Box, Stack, Chip, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const LAYER_DEFS = [
  { id: 'plumbing',   label: 'Plumbing',    color: '#42A5F5' },
  { id: 'electrical', label: 'Electrical',  color: '#FFB300' },
  { id: 'hvac',       label: 'HVAC',        color: '#9E9E9E' },
  { id: 'waterTanks', label: 'Water Tanks', color: '#00BCD4' },
  { id: 'sewage',     label: 'Sewage',      color: '#8D6E63' },
  { id: 'solar',      label: 'Solar',       color: '#FF6F00' },
];

const MotionChip = motion(Chip);

/**
 * Pill row of layer toggles.
 *
 *   active            Set | array of layer ids that are visible
 *   onToggle(layerId) flips the layer
 *   onAll()           set all visible
 *   onNone()          set none visible
 */
export default function UtilityLayerToggles({ active, onToggle, onAll, onNone }) {
  const theme = useTheme();
  const set = active instanceof Set ? active : new Set(active || []);

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      sx={{ gap: 1.2, mb: 2 }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
        {LAYER_DEFS.map((L, i) => {
          const isOn = set.has(L.id);
          return (
            <MotionChip
              key={L.id}
              clickable
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 20 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              {...{
                // motion + chip animation conflict — feed the entry via custom prop
                custom: i,
              }}
              icon={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: L.color,
                    border: isOn ? `2px solid ${L.color}` : `2px solid transparent`,
                    boxShadow: isOn ? `0 0 8px ${L.color}` : 'none',
                  }}
                />
              }
              label={L.label}
              onClick={() => onToggle?.(L.id)}
              variant={isOn ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 700,
                borderColor: isOn ? L.color : theme.palette.divider,
                background: isOn ? `${L.color}22` : 'transparent',
                color: isOn ? 'text.primary' : 'text.secondary',
                transition: 'background-color .2s, border-color .2s, color .2s',
                '& .MuiChip-icon': { ml: 0.8 },
              }}
            />
          );
        })}
      </Box>

      <Stack direction="row" spacing={1}>
        <Button size="small" startIcon={<VisibilityIcon />}    onClick={onAll}>All</Button>
        <Button size="small" startIcon={<VisibilityOffIcon />} onClick={onNone}>None</Button>
      </Stack>
    </Stack>
  );
}

export { LAYER_DEFS };
