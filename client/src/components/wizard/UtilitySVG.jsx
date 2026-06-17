import { useMemo, useState } from 'react';
import { Box, Stack, ButtonGroup, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Utility floor-plan renderer.
 *
 *   option         the selected floor-plan option (from value.floorPlan.options)
 *   utilities      from value.utilities
 *   active         Set of active layer ids
 *   height         px (default 360)
 *   vastuEnabled   draws the N-arrow + compass dots
 */
export default function UtilitySVG({
  option,
  utilities,
  active,
  height = 380,
  vastuEnabled = false,
}) {
  const theme = useTheme();

  const totalFloors = option?.floors?.length || 1;
  const [floor, setFloor] = useState(1);
  const f = Math.min(floor, totalFloors);

  const floorMeta = option?.floors?.[f - 1] || option?.plotDimensions || { w: 30, h: 30 };
  const plotW = floorMeta.w || option?.plotDimensions?.plotW || 30;
  const plotH = floorMeta.h || option?.plotDimensions?.plotH || 30;

  const rooms = useMemo(
    () => (option?.rooms || []).filter((r) => r.floor === f),
    [option, f]
  );

  const aspect = plotW / plotH;
  const svgW = Math.round(height * aspect);
  const svgH = height;
  const sx = svgW / plotW;
  const sy = svgH / plotH;

  const activeSet = active instanceof Set ? active : new Set(active || []);

  return (
    <Box>
      {/* Floor switcher */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {plotW} × {plotH} ft
        </Typography>
        {totalFloors > 1 && (
          <ButtonGroup size="small">
            {Array.from({ length: totalFloors }).map((_, i) => (
              <Button
                key={i}
                variant={f === i + 1 ? 'contained' : 'outlined'}
                onClick={() => setFloor(i + 1)}
              >
                Floor {i + 1}
              </Button>
            ))}
          </ButtonGroup>
        )}
      </Stack>

      <Box
        sx={{
          width: '100%',
          maxWidth: svgW,
          mx: 'auto',
          p:1,
          borderRadius: 1,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.mode === 'dark' ? '#0A0E1A' : '#F4F7F2',
        }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          height={svgH}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid (every 5 ft, very faint) */}
          <g opacity="0.1" stroke={theme.palette.divider} strokeWidth="1">
            {Array.from({ length: Math.floor(plotW / 5) + 1 }, (_, i) => (
              <line key={`gx-${i}`} x1={i * 5 * sx} y1={0} x2={i * 5 * sx} y2={svgH} />
            ))}
            {Array.from({ length: Math.floor(plotH / 5) + 1 }, (_, i) => (
              <line key={`gy-${i}`} x1={0} y1={i * 5 * sy} x2={svgW} y2={i * 5 * sy} />
            ))}
          </g>

          {/* Rooms (faded) */}
          {rooms.map((r) => {
            const x = r.x * sx;
            const y = r.y * sy;
            const w = r.w * sx;
            const h = r.h * sy;
            return (
              <g key={r.id} opacity={0.65}>
                <rect
                  x={x + 1.5} y={y + 1.5}
                  width={Math.max(0, w - 3)} height={Math.max(0, h - 3)}
                  rx={4} ry={4}
                  fill={r.color || '#9E9E9E'}
                  fillOpacity={0.16}
                  stroke={r.color || '#9E9E9E'}
                  strokeWidth={1}
                  strokeOpacity={0.55}
                />
                {w > 60 && h > 40 && (
                  <text
                    x={x + w / 2} y={y + h / 2}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill={theme.palette.text.secondary}
                  >
                    {r.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Plot outline */}
          <rect
            x={1} y={1}
            width={svgW - 2} height={svgH - 2}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeWidth={1.5}
            rx={6} ry={6}
          />

          {/* North arrow if vastu */}
          {vastuEnabled && (
            <g transform={`translate(${svgW - 30}, 14)`}>
              <polygon points="0,0 -6,12 6,12" fill={theme.palette.error.main} />
              <text x={0} y={24} textAnchor="middle" fontSize="9" fontWeight="700" fill={theme.palette.text.secondary}>N</text>
            </g>
          )}

          {/* Layer overlays */}
          <AnimatePresence>
            {Object.entries(utilities?.layers || {}).map(([layerId, perFloor]) => {
              if (!activeSet.has(layerId)) return null;
              const layer = perFloor?.find((p) => p.floor === f);
              if (!layer) return null;

              return (
                <motion.g
                  key={layerId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Paths — animated stroke draw */}
                  {(layer.paths || []).map((p, i) => {
                    const d = pointsToPath(p.points, sx, sy);
                    if (!d) return null;
                    return (
                      <motion.path
                        key={`${layerId}-p-${i}`}
                        d={d}
                        fill="none"
                        stroke={p.color || layer.color}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={p.dashed ? '6 4' : undefined}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeInOut' }}
                      />
                    );
                  })}

                  {/* Markers */}
                  {(layer.markers || []).map((m, i) => (
                    <Marker
                      key={`${layerId}-m-${i}`}
                      marker={m}
                      sx={sx}
                      sy={sy}
                      index={i}
                      defaultColor={layer.color}
                    />
                  ))}
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>
      </Box>
    </Box>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function pointsToPath(points, sx, sy) {
  if (!Array.isArray(points) || points.length === 0) return '';
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x * sx} ${y * sy}`)
    .join(' ');
}

/** Single utility marker (light/AC/tank/etc) — type-driven shape. */
function Marker({ marker, sx, sy, index, defaultColor }) {
  const color = marker.color || defaultColor || '#666';
  const x = marker.x * sx;
  const y = marker.y * sy;

  // Solar array — rectangle covering a band of the plot
  if (marker.type === 'solar-array') {
    return (
      <motion.g
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 + index * 0.05, duration: 0.4, ease: 'easeOut' }}
      >
        <rect
          x={x}
          y={y}
          width={marker.w * sx}
          height={marker.h * sy}
          fill={color}
          fillOpacity={0.22}
          stroke={color}
          strokeWidth={1.5}
          rx={3}
          ry={3}
        />
        <text
          x={x + (marker.w * sx) / 2}
          y={y + (marker.h * sy) / 2 + 4}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={color}
        >
          {marker.label}
        </text>
      </motion.g>
    );
  }

  // Light points (small dot)
  if (marker.type === 'light' || marker.type === 'fixture') {
    return (
      <motion.g
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4 + index * 0.05, type: 'spring', stiffness: 320, damping: 16 }}
      >
        <circle cx={x} cy={y} r={3.5} fill={color} />
        <circle cx={x} cy={y} r={6} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
      </motion.g>
    );
  }

  // Tanks / meter / septic / outdoor units — labelled square chip
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3 + index * 0.05, type: 'spring', stiffness: 280, damping: 16 }}
    >
      <rect
        x={x - 14} y={y - 8}
        width={28} height={16}
        rx={3} ry={3}
        fill={color} fillOpacity={0.85}
        stroke={color} strokeWidth={1}
      />
      <text
        x={x} y={y + 4}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#fff"
      >
        {abbreviate(marker.label)}
      </text>
    </motion.g>
  );
}

function abbreviate(s = '') {
  if (s.length <= 8) return s;
  return s.replace(/[aeiou]/gi, '').slice(0, 8);
}
