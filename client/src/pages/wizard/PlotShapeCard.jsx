import { Card, CardActionArea, Stack, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import GestureIcon from '@mui/icons-material/Gesture';

const SHAPE_ICON = {
  rectangular: <RectangleOutlinedIcon sx={{ fontSize: 36 }} />,
  'L-shaped':  <LayersOutlinedIcon sx={{ fontSize: 36 }} />,
  corner:      <CallSplitIcon sx={{ fontSize: 36 }} />,
  irregular:   <GestureIcon sx={{ fontSize: 36 }} />,
};

const MotionCard = motion(Card);

export default function PlotShapeCard({ shape, selected, onSelect }) {
  const theme = useTheme();
  return (
    <MotionCard
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
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
      }}
    >
      <CardActionArea onClick={() => onSelect(shape.id)} sx={{ p: 2.5, height: '100%' }}>
        <Stack spacing={1.2} alignItems="flex-start">
          <Box sx={{ color: selected ? 'primary.main' : 'info.main' }}>
            {SHAPE_ICON[shape.id]}
          </Box>
          <Typography sx={{ fontWeight: 700 }}>{shape.label}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {shape.desc}
          </Typography>
        </Stack>
      </CardActionArea>
    </MotionCard>
  );
}
