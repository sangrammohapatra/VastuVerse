import { Box, Card, CardActionArea, Stack, Typography, Checkbox, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import KitchenIcon from '@mui/icons-material/Kitchen';
import MicrowaveIcon from '@mui/icons-material/Microwave';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import OutdoorGrillIcon from '@mui/icons-material/OutdoorGrill';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import BlenderIcon from '@mui/icons-material/Blender';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AirIcon from '@mui/icons-material/Air';

/* ─── Layout cards (with inline SVG diagrams) ──────────────────────── */

const LAYOUTS = [
  {
    id: 'L',
    label: 'L-shape',
    desc: 'Counters along two adjacent walls',
    svg: (
      <svg viewBox="0 0 60 60">
        <rect x="6" y="6" width="48" height="48" rx="3" fill="none" stroke="currentColor" opacity="0.25" />
        <rect x="8" y="8" width="44" height="8" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="8" y="8" width="8" height="44" rx="2" fill="currentColor" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'U',
    label: 'U-shape',
    desc: 'Three walls, most counter space',
    svg: (
      <svg viewBox="0 0 60 60">
        <rect x="6" y="6" width="48" height="48" rx="3" fill="none" stroke="currentColor" opacity="0.25" />
        <rect x="8" y="8" width="44" height="8" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="8" y="8" width="8" height="44" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="44" y="8" width="8" height="44" rx="2" fill="currentColor" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'island',
    label: 'Island',
    desc: 'Free-standing counter in the centre',
    svg: (
      <svg viewBox="0 0 60 60">
        <rect x="6" y="6" width="48" height="48" rx="3" fill="none" stroke="currentColor" opacity="0.25" />
        <rect x="8" y="8" width="44" height="7" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="20" y="26" width="20" height="14" rx="2" fill="currentColor" opacity="0.85" />
      </svg>
    ),
  },
  {
    id: 'parallel',
    label: 'Parallel',
    desc: 'Counters on opposite walls',
    svg: (
      <svg viewBox="0 0 60 60">
        <rect x="6" y="6" width="48" height="48" rx="3" fill="none" stroke="currentColor" opacity="0.25" />
        <rect x="8" y="10" width="44" height="7" rx="2" fill="currentColor" opacity="0.7" />
        <rect x="8" y="43" width="44" height="7" rx="2" fill="currentColor" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'straight',
    label: 'Straight',
    desc: 'Single line counter',
    svg: (
      <svg viewBox="0 0 60 60">
        <rect x="6" y="6" width="48" height="48" rx="3" fill="none" stroke="currentColor" opacity="0.25" />
        <rect x="8" y="26" width="44" height="9" rx="2" fill="currentColor" opacity="0.75" />
      </svg>
    ),
  },
];

/* ─── Appliance options ─────────────────────────────────────────────── */

const APPLIANCES = [
  { id: 'fridge',     label: 'Fridge',           Icon: KitchenIcon },
  { id: 'chimney',    label: 'Chimney',          Icon: AirIcon },
  { id: 'microwave',  label: 'Microwave',        Icon: MicrowaveIcon },
  { id: 'oven',       label: 'Oven',             Icon: OutdoorGrillIcon },
  { id: 'dishwasher', label: 'Dishwasher',       Icon: LocalDrinkIcon },
  { id: 'purifier',   label: 'Water purifier',   Icon: LocalDrinkIcon },
  { id: 'mixer',      label: 'Mixer-grinder',    Icon: BlenderIcon },
  { id: 'induction',  label: 'Induction hob',    Icon: RestaurantIcon },
  { id: 'coffee',     label: 'Coffee machine',   Icon: LocalCafeIcon },
];

const MotionCard = motion(Card);

/**
 * Kitchen configurator.
 *
 *   value          { layout, appliances: [id, …] }
 *   onChange(patch) merge-style update
 */
export default function KitchenConfigurator({
  value = { layout: 'L', appliances: ['fridge', 'chimney'] },
  onChange,
}) {
  const theme = useTheme();
  const layout = value.layout || 'L';
  const appliances = new Set(value.appliances || []);

  const setLayout = (id) => onChange?.({ layout: id });
  const toggleApp = (id) => {
    const next = new Set(appliances);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange?.({ appliances: Array.from(next) });
  };

  return (
    <Box>
      {/* Layout picker */}
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Counter layout
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 1.5,
          mb: 3,
        }}
      >
        {LAYOUTS.map((L, i) => {
          const selected = L.id === layout;
          return (
            <MotionCard
              key={L.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              elevation={0}
              sx={{
                background: theme.vastu.cardBg,
                border: selected
                  ? `2px solid ${theme.palette.primary.main}`
                  : theme.vastu.cardBorder,
                boxShadow: selected ? theme.vastu.glowPrimary : 'none',
                transition: 'border-color .2s, box-shadow .2s',
              }}
            >
              <CardActionArea onClick={() => setLayout(L.id)} sx={{ p: 1.5 }}>
                <Box
                  sx={{
                    height: 64,
                    mb: 1,
                    color: selected ? theme.palette.primary.main : theme.palette.info.main,
                  }}
                >
                  {L.svg}
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{L.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {L.desc}
                </Typography>
              </CardActionArea>
            </MotionCard>
          );
        })}
      </Box>

      {/* Appliances */}
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Appliances
        </Typography>
        {appliances.size > 0 && (
          <Chip
            size="small"
            label={`${appliances.size} selected`}
            color="primary"
            sx={{ fontWeight: 700 }}
          />
        )}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          gap: 1.2,
        }}
      >
        {APPLIANCES.map((a) => {
          const selected = appliances.has(a.id);
          const Icon = a.Icon;
          return (
            <Card
              key={a.id}
              elevation={0}
              sx={{
                background: theme.vastu.cardBg,
                border: selected
                  ? `2px solid ${theme.palette.primary.main}`
                  : theme.vastu.cardBorder,
                transition: 'border-color .2s',
              }}
            >
              <CardActionArea onClick={() => toggleApp(a.id)} sx={{ p: 1.2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Checkbox checked={selected} sx={{ p: 0.5 }} onClick={(e) => e.stopPropagation()} onChange={() => toggleApp(a.id)} />
                  <Icon sx={{ color: selected ? 'primary.main' : 'info.main', fontSize: 22 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.label}</Typography>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
