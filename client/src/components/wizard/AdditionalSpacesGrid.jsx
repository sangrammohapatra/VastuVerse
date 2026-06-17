import { Box, Card, CardActionArea, Stack, Typography, Checkbox, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import LivingIcon from '@mui/icons-material/Weekend';
import DiningIcon from '@mui/icons-material/Restaurant';
import PoojaIcon from '@mui/icons-material/SelfImprovement';
import StudyIcon from '@mui/icons-material/MenuBook';
import GarageIcon from '@mui/icons-material/DirectionsCar';
import ServantIcon from '@mui/icons-material/Bed';
import BalconyIcon from '@mui/icons-material/Balcony';
import StairsIcon from '@mui/icons-material/Stairs';
import TerraceIcon from '@mui/icons-material/Deck';
import StorageIcon from '@mui/icons-material/Inventory2';

import RoomCountStepper from './RoomCountStepper';

export const ADDITIONAL_SPACES = [
  { id: 'living',    label: 'Living Room',      Icon: LivingIcon },
  { id: 'dining',    label: 'Dining Room',      Icon: DiningIcon },
  { id: 'pooja',     label: 'Pooja Room',       Icon: PoojaIcon },
  { id: 'study',     label: 'Study / Office',   Icon: StudyIcon },
  { id: 'garage',    label: 'Garage',           Icon: GarageIcon },
  { id: 'servant',   label: 'Servant Quarters', Icon: ServantIcon },
  { id: 'balcony',   label: 'Balconies',        Icon: BalconyIcon,  withCount: 'balconies' },
  { id: 'staircase', label: 'Staircases',       Icon: StairsIcon,   withCount: 'staircases' },
  { id: 'terrace',   label: 'Terrace',          Icon: TerraceIcon },
  { id: 'storage',   label: 'Storage Rooms',    Icon: StorageIcon },
];

const MotionCard = motion(Card);

function SpaceCard({ space, selected, locked, counts, onToggle, onCountChange, floors = 1 }) {
  const theme = useTheme();
  const { Icon, withCount, label } = space;
  const countValue = withCount ? counts?.[withCount] ?? 0 : null;
  // Minimum staircase count = one per floor so every floor can be covered
  const minCount = withCount === 'staircases' && locked ? floors : 0;

  return (
    <MotionCard
      whileHover={selected ? undefined : { y: -2 }}
      transition={{ duration: 0.2 }}
      elevation={0}
      sx={{
        background: theme.vastu.cardBg,
        border: selected
          ? `2px solid ${theme.palette.primary.main}`
          : theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: selected ? theme.vastu.glowPrimary : theme.vastu.cardShadow,
        transition: 'border-color .2s, box-shadow .2s',
        opacity: locked && !selected ? 1 : 1,
      }}
    >
      <CardActionArea
        onClick={() => (locked ? null : onToggle(space.id))}
        sx={{ p: 1.8, cursor: locked ? 'default' : 'pointer' }}
        disabled={locked}
      >
        <Stack direction="row" alignItems="center" spacing={1.3}>
          <Checkbox
            checked={selected}
            disabled={locked}
            sx={{ p: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggle(space.id)}
          />
          <Icon sx={{ color: selected ? 'primary.main' : 'info.main', fontSize: 26 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{label}</Typography>
            {locked && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Required (multi-storey)
              </Typography>
            )}
          </Box>
          {withCount && selected && (
            <Box onClick={(e) => e.stopPropagation()}>
              <RoomCountStepper
                value={countValue}
                onChange={(v) => onCountChange(withCount, Math.max(minCount, v))}
                min={minCount}
                max={withCount === 'staircases' ? Math.max(5, floors) : 10}
                compact
              />
            </Box>
          )}
        </Stack>
      </CardActionArea>
    </MotionCard>
  );
}

/**
 * 3-column grid of additional-space cards.
 *
 *   selected        Set or array of space ids
 *   onSelectionChange(nextArray)
 *   counts          { balconies: number, staircases: number }
 *   onCountChange(key, value)
 *   floors          used to enforce min-1 staircase on multi-storey
 */
export default function AdditionalSpacesGrid({
  selected = [],
  onSelectionChange,
  counts = { balconies: 0, staircases: 0 },
  onCountChange,
  floors = 1,
}) {
  const selectedSet = new Set(selected);
  const requireStaircase = floors > 1;

  // Enforce staircase selection on multi-storey
  if (requireStaircase && !selectedSet.has('staircase')) {
    selectedSet.add('staircase');
  }

  const toggle = (id) => {
    if (id === 'staircase' && requireStaircase) return; // locked
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(Array.from(next));
  };

  return (
    <Box>
      {requireStaircase && (
        <Chip
          label="Staircase is required for multi-storey homes"
          size="small"
          variant="outlined"
          color="info"
          sx={{ mb: 1.5, fontWeight: 600 }}
        />
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        {ADDITIONAL_SPACES.map((s) => (
          <SpaceCard
            key={s.id}
            space={s}
            selected={selectedSet.has(s.id)}
            locked={s.id === 'staircase' && requireStaircase}
            counts={counts}
            onToggle={toggle}
            onCountChange={onCountChange}
            floors={floors}
          />
        ))}
      </Box>
    </Box>
  );
}
