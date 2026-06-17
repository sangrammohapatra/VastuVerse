import { Box, Tooltip, Typography, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';

import { FACING_DIRECTIONS } from '../../constants/wizardSteps';

const DIR_TO_ANGLE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const DIR_LABEL = {
  N: 'North', NE: 'North-East', E: 'East', SE: 'South-East',
  S: 'South', SW: 'South-West', W: 'West', NW: 'North-West',
};

const CX = 100;
const CY = 100;
const R_OUTER = 90;
const R_INNER = 36;

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const slicePath = (start, end) => {
  const [x1, y1] = polar(CX, CY, R_OUTER, start);
  const [x2, y2] = polar(CX, CY, R_OUTER, end);
  const [x3, y3] = polar(CX, CY, R_INNER, end);
  const [x4, y4] = polar(CX, CY, R_INNER, start);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R_OUTER} ${R_OUTER} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${R_INNER} ${R_INNER} 0 0 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
};

export default function CompassSelector({ value, onChange }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const angle = value ? DIR_TO_ANGLE[value] : 0;

  return (
    <Stack alignItems="center" spacing={1.5}>
      <Box
        component="svg"
        viewBox="0 0 200 200"
        sx={{
          width: { xs: 200, md: 220 },
          height: { xs: 200, md: 220 },
        }}
        aria-label="facing direction selector"
      >
        {/* slices */}
        {FACING_DIRECTIONS.map((d, i) => {
          const center = i * 45;
          const start = center - 22.5;
          const end = center + 22.5;
          const selected = value === d;
          const [lx, ly] = polar(CX, CY, (R_OUTER + R_INNER) / 2, center);
          return (
            <Tooltip key={d} title={DIR_LABEL[d]} arrow>
              <g style={{ cursor: 'pointer' }} onClick={() => onChange(d)}>
                <path
                  d={slicePath(start, end)}
                  fill={
                    selected
                      ? theme.palette.primary.main
                      : theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(26,26,46,0.05)'
                  }
                  stroke={theme.palette.background.paper}
                  strokeWidth="2"
                  style={{ transition: 'fill .2s ease' }}
                />
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={selected ? '#fff' : theme.palette.text.primary}
                  style={{ pointerEvents: 'none' }}
                >
                  {d}
                </text>
              </g>
            </Tooltip>
          );
        })}

        {/* center hub */}
        <circle cx={CX} cy={CY} r={R_INNER - 6} fill={theme.palette.background.paper} stroke={theme.palette.divider} />

        {/* rotating needle */}
        <motion.g
          initial={false}
          animate={{ rotate: angle }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 200, damping: 18 }
          }
          style={{ transformOrigin: `${CX}px ${CY}px`, transformBox: 'fill-box' }}
        >
          <polygon
            points={`${CX},${CY - R_INNER + 8} ${CX - 6},${CY + 4} ${CX + 6},${CY + 4}`}
            fill={theme.palette.primary.main}
          />
          <circle cx={CX} cy={CY} r={5} fill={theme.palette.secondary.main} />
        </motion.g>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {value ? `Facing ${DIR_LABEL[value]}` : 'Click a direction to set facing'}
      </Typography>
    </Stack>
  );
}
