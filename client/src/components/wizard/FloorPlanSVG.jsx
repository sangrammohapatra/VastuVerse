import { useMemo, useState } from 'react';
import { Box, Stack, ButtonGroup, Button, Chip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

/** Truncate label to fit inside `availPx` wide room. */
function truncLabel(label, availPx, fontSize = 11) {
  const maxChars = Math.floor((availPx - 8) / (fontSize * 0.62));
  return maxChars >= label.length ? label : label.slice(0, Math.max(3, maxChars - 1)) + '…';
}

/** Top-view SVG icon for each room kind, centred at (cx, cy). */
function RoomIcon({ kind, cx, cy, rw, rh, fillColor }) {
  const s = Math.min(rw * 0.28, rh * 0.28, 22);
  if (s < 7) return null;
  const f = fillColor || '#9E9E9E';

  switch (kind) {
    case 'bedroom':
    case 'servant': {
      const bw = s * 1.5, bh = s;
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-bw/2} y={-bh/2} width={bw} height={bh} rx={2.5} fill={f} fillOpacity={0.12} stroke={f} strokeWidth={1} strokeOpacity={0.5} />
          <rect x={-bw/2} y={-bh/2} width={bw} height={bh*0.3} rx={2} fill={f} fillOpacity={0.38} />
          <rect x={-bw/2+2} y={-bh/2+2} width={bw*0.38} height={bh*0.23} rx={1.5} fill="#fff" fillOpacity={0.45} />
          <rect x={bw*0.1} y={-bh/2+2} width={bw*0.38} height={bh*0.23} rx={1.5} fill="#fff" fillOpacity={0.45} />
        </g>
      );
    }
    case 'garage': {
      const cw = s * 1.4, ch = s;
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-cw/2} y={-ch/2} width={cw} height={ch} rx={s*0.18} fill={f} fillOpacity={0.18} stroke={f} strokeWidth={1} strokeOpacity={0.55} />
          <rect x={-cw*0.28} y={-ch/2+ch*0.12} width={cw*0.56} height={ch*0.45} rx={s*0.1} fill={f} fillOpacity={0.3} />
          {[[-cw*0.3,ch*0.25],[cw*0.3,ch*0.25],[-cw*0.3,-ch*0.25],[cw*0.3,-ch*0.25]].map(([wx,wy],i) => (
            <circle key={i} cx={wx} cy={wy} r={s*0.13} fill={f} fillOpacity={0.6} />
          ))}
        </g>
      );
    }
    case 'kitchen': {
      const sp = s * 0.28, r = s * 0.15;
      return (
        <g transform={`translate(${cx},${cy})`}>
          {[[-sp,-sp],[sp,-sp],[-sp,sp],[sp,sp]].map(([bx,by],i) => (
            <g key={i}>
              <circle cx={bx} cy={by} r={r*1.4} fill="none" stroke={f} strokeWidth={1.2} strokeOpacity={0.6} />
              <circle cx={bx} cy={by} r={r*0.4} fill={f} fillOpacity={0.6} />
            </g>
          ))}
        </g>
      );
    }
    case 'living': {
      const sw = s * 1.4, sh = s;
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-sw/2} y={-sh/2} width={sw} height={sh*0.32} rx={3} fill={f} fillOpacity={0.45} />
          <rect x={-sw/2} y={-sh/2+sh*0.32} width={sw} height={sh*0.5} rx={2} fill={f} fillOpacity={0.18} stroke={f} strokeWidth={0.8} strokeOpacity={0.4} />
          <rect x={-sw/2} y={-sh/2+sh*0.32} width={sw*0.12} height={sh*0.5} rx={2} fill={f} fillOpacity={0.45} />
          <rect x={sw/2-sw*0.12} y={-sh/2+sh*0.32} width={sw*0.12} height={sh*0.5} rx={2} fill={f} fillOpacity={0.45} />
        </g>
      );
    }
    case 'dining': {
      const tr = s * 0.38, cr = s * 0.13;
      return (
        <g transform={`translate(${cx},${cy})`}>
          <ellipse cx={0} cy={0} rx={tr} ry={tr*0.7} fill={f} fillOpacity={0.18} stroke={f} strokeWidth={1} strokeOpacity={0.5} />
          {[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy],i) => (
            <rect key={i} x={dx*(tr+1)-cr} y={dy*(tr*0.7+1)-cr} width={cr*2} height={cr*2} rx={1} fill={f} fillOpacity={0.5} />
          ))}
        </g>
      );
    }
    case 'bathroomAttached':
    case 'bathroomCommon': {
      const tw = s * 0.8;
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-tw*0.5} y={-s*0.45} width={tw} height={s*0.26} rx={2} fill={f} fillOpacity={0.35} stroke={f} strokeWidth={0.8} strokeOpacity={0.5} />
          <ellipse cx={0} cy={s*0.1} rx={tw*0.5} ry={s*0.33} fill={f} fillOpacity={0.15} stroke={f} strokeWidth={0.8} strokeOpacity={0.5} />
          <ellipse cx={0} cy={s*0.1} rx={tw*0.37} ry={s*0.24} fill="none" stroke={f} strokeWidth={0.7} strokeOpacity={0.35} />
        </g>
      );
    }
    case 'staircase': {
      const steps = 4, sw = s * 1.1, sh = s;
      const stepW = sw / steps, stepH = sh / steps;
      return (
        <g transform={`translate(${cx-sw/2},${cy-sh/2})`}>
          {Array.from({length: steps}, (_,i) => (
            <rect key={i} x={i*stepW} y={i*stepH} width={sw-i*stepW} height={stepH}
              rx={1} fill={f} fillOpacity={0.12+i*0.07} stroke={f} strokeWidth={0.7} strokeOpacity={0.45} />
          ))}
        </g>
      );
    }
    case 'pooja':
      return (
        <g transform={`translate(${cx},${cy})`}>
          <ellipse cx={0} cy={s*0.3} rx={s*0.38} ry={s*0.13} fill={f} fillOpacity={0.4} />
          <path d={`M0,${-s*0.32} C${s*0.22},${-s*0.1} ${s*0.18},${s*0.2} 0,${s*0.26} C${-s*0.18},${s*0.2} ${-s*0.22},${-s*0.1} 0,${-s*0.32}`} fill="#FFA000" fillOpacity={0.65} />
        </g>
      );
    case 'study':
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-s*0.5} y={-s*0.4} width={s} height={s*0.8} rx={2} fill={f} fillOpacity={0.18} stroke={f} strokeWidth={1} strokeOpacity={0.5} />
          <line x1={-s*0.16} y1={-s*0.4} x2={-s*0.16} y2={s*0.4} stroke={f} strokeWidth={0.9} strokeOpacity={0.35} />
          {[-0.22,-0.06,0.1,0.26].map((yo,i) => (
            <line key={i} x1={-s*0.06} y1={s*yo} x2={s*0.4} y2={s*yo} stroke={f} strokeWidth={0.7} strokeOpacity={0.35} />
          ))}
        </g>
      );
    case 'storage':
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-s*0.5} y={-s*0.42} width={s} height={s*0.84} rx={2} fill={f} fillOpacity={0.18} stroke={f} strokeWidth={1} strokeOpacity={0.5} />
          <line x1={-s*0.5} y1={0} x2={s*0.5} y2={0} stroke={f} strokeWidth={0.8} strokeOpacity={0.35} />
          <line x1={0} y1={-s*0.42} x2={0} y2={s*0.42} stroke={f} strokeWidth={0.8} strokeOpacity={0.35} />
        </g>
      );
    case 'balcony':
    case 'terrace':
      return (
        <g transform={`translate(${cx},${cy})`}>
          <rect x={-s*0.6} y={-s*0.1} width={s*1.2} height={s*0.22} rx={1.5} fill={f} fillOpacity={0.3} />
          {[-0.4,-0.2,0,0.2,0.4].map((xo,i) => (
            <rect key={i} x={s*xo-1.5} y={-s*0.42} width={3} height={s*0.32} rx={1} fill={f} fillOpacity={0.4} />
          ))}
        </g>
      );
    default: return null;
  }
}

const VASTU_ZONES = [
  { dir: 'N',  angle: 0,   tone: 'N' },
  { dir: 'NE', angle: 45,  tone: 'Pooja' },
  { dir: 'E',  angle: 90,  tone: 'E' },
  { dir: 'SE', angle: 135, tone: 'Kitchen' },
  { dir: 'S',  angle: 180, tone: 'S' },
  { dir: 'SW', angle: 225, tone: 'Master BR' },
  { dir: 'W',  angle: 270, tone: 'W' },
  { dir: 'NW', angle: 315, tone: 'Septic' },
];

/**
 * Render a single floor of a floor-plan option as SVG.
 *
 *   option            { rooms, floors, plotDimensions }
 *   vastuEnabled      shows the vastu compass overlay if true
 *   onFloorChange     called when the user switches floors (multi-storey)
 */
export default function FloorPlanSVG({
  option,
  vastuEnabled,
  height = 360,
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

  // SVG sizing — use actual room bounds so nothing is clipped off-screen.
  const effectiveW = rooms.length
    ? Math.max(plotW, ...rooms.map((r) => r.x + r.w))
    : plotW;
  const effectiveH = rooms.length
    ? Math.max(plotH, ...rooms.map((r) => r.y + r.h))
    : plotH;
  const aspect = effectiveW / effectiveH;
  const svgW = Math.round(height * aspect);
  const svgH = height;
  const sx = svgW / effectiveW; // scale-x (ft → px)
  const sy = svgH / effectiveH;

  return (
    <Box>
      {/* Floor switcher (multi-storey) */}
      {totalFloors > 1 && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {plotW} × {plotH} ft
          </Typography>
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
        </Stack>
      )}

      {/* SVG */}
      <Box
        sx={{
          width: '100%',
          maxWidth: svgW,
          mx: 'auto',
          borderRadius: 1,
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.mode === 'dark' ? '#0A0E1A' : '#F4F7F2',
          p: 1
        }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          height={svgH}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle grid (every 5 ft) */}
          <g opacity="0.15" stroke={theme.palette.divider} strokeWidth="1">
            {Array.from({ length: Math.floor(effectiveW / 5) + 1 }, (_, i) => (
              <line key={`gx-${i}`} x1={i * 5 * sx} y1={0} x2={i * 5 * sx} y2={svgH} />
            ))}
            {Array.from({ length: Math.floor(effectiveH / 5) + 1 }, (_, i) => (
              <line key={`gy-${i}`} x1={0} y1={i * 5 * sy} x2={svgW} y2={i * 5 * sy} />
            ))}
          </g>

          {/* Rooms — staircase rendered last so it always sits on top */}
          {[...rooms]
            .sort((a, b) => (a.kind === 'staircase' ? 1 : b.kind === 'staircase' ? -1 : 0))
            .map((r, i) => {
              const x = r.x * sx;
              const y = r.y * sy;
              const w = r.w * sx;
              const h = r.h * sy;
              const cx = x + w / 2;
              const cy = y + h / 2;

              const showLabel = w * h > 2800;
              const showIcon = w > 28 && h > 22;
              const iconCy = showLabel ? cy - h * 0.14 : cy;
              const labelY = showIcon ? cy + h * 0.1 : cy - 4;

              // Door symbol — skip staircase; use directional heuristic
              const stairRoom = rooms.find((r2) => r2.kind === 'staircase');
              const stairHft = stairRoom?.h ?? 0;
              const inZoneA = r.y < stairHft && stairHft > 0; // beside staircase row
              const isBathAttached = r.kind === 'bathroomAttached';
              const dw = Math.min(w * 0.28, h * 0.38, 20);
              const showDoor = r.kind !== 'staircase' && dw > 7 && w > 30;
              const dc = (r.color || '#9E9E9E') + 'BB';

              let doorEl = null;
              if (showDoor) {
                if (isBathAttached) {
                  // Left wall — opens into the adjacent bedroom
                  const dy = y + h * 0.22;
                  doorEl = (
                    <g>
                      <line x1={x+2} y1={dy} x2={x+2} y2={dy+dw} stroke={dc} strokeWidth={1.3} />
                      <path d={`M ${x+2},${dy} A ${dw},${dw} 0 0,0 ${x+2+dw},${dy+dw}`} fill="none" stroke={dc} strokeWidth={1} />
                    </g>
                  );
                } else if (inZoneA) {
                  // Bottom wall — opens toward the lower zone / corridor
                  const dx = x + w * 0.18;
                  doorEl = (
                    <g>
                      <line x1={dx} y1={y+h-3} x2={dx} y2={y+h-3-dw} stroke={dc} strokeWidth={1.3} />
                      <path d={`M ${dx},${y+h-3-dw} A ${dw},${dw} 0 0,1 ${dx+dw},${y+h-3}`} fill="none" stroke={dc} strokeWidth={1} />
                    </g>
                  );
                } else {
                  // Top wall — opens toward the staircase / corridor above
                  const dx = x + w * 0.18;
                  doorEl = (
                    <g>
                      <line x1={dx} y1={y+3+dw} x2={dx} y2={y+3} stroke={dc} strokeWidth={1.3} />
                      <path d={`M ${dx},${y+3+dw} A ${dw},${dw} 0 0,0 ${dx+dw},${y+3}`} fill="none" stroke={dc} strokeWidth={1} />
                    </g>
                  );
                }
              }

              return (
                <motion.g
                  key={r.id + '-' + i}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: Math.min(i, 12) * 0.04, ease: 'easeOut' }}
                >
                  <rect
                    x={x + 1.5} y={y + 1.5}
                    width={Math.max(0, w - 3)} height={Math.max(0, h - 3)}
                    rx={4} ry={4}
                    fill={r.color || '#9E9E9E'}
                    fillOpacity={0.32}
                    stroke={r.color || '#9E9E9E'}
                    strokeWidth={1.5}
                  />
                  {showIcon && (
                    <RoomIcon kind={r.kind} cx={cx} cy={iconCy} rw={w} rh={h} fillColor={r.color} />
                  )}
                  {showLabel && (
                    <>
                      <text
                        x={cx} y={labelY}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={theme.palette.text.primary}
                      >
                        {truncLabel(r.label, w)}
                      </text>
                      <text
                        x={cx} y={labelY + 13}
                        textAnchor="middle"
                        fontSize="10"
                        fill={theme.palette.text.secondary}
                      >
                        {r.w}′ × {r.h}′
                      </text>
                    </>
                  )}
                  {doorEl}
                </motion.g>
              );
            })}

          {/* Plot outline (actual plot boundary, not extended room bounds) */}
          <rect
            x={1} y={1}
            width={plotW * sx - 2} height={plotH * sy - 2}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            rx={6} ry={6}
          />

          {/* Vastu compass overlay (top-right) */}
          {vastuEnabled && (
            <g transform={`translate(${svgW - 56}, 12)`}>
              <circle cx={22} cy={22} r={22} fill={theme.palette.background.paper} stroke={theme.palette.divider} />
              {VASTU_ZONES.map((z) => {
                const angle = (z.angle - 90) * (Math.PI / 180);
                const x2 = 22 + 18 * Math.cos(angle);
                const y2 = 22 + 18 * Math.sin(angle);
                return (
                  <text
                    key={z.dir}
                    x={x2} y={y2 + 3}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="700"
                    fill={
                      ['Pooja', 'Kitchen', 'Master BR'].includes(z.tone)
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary
                    }
                  >
                    {z.dir}
                  </text>
                );
              })}
              {/* North arrow */}
              <polygon points="22,4 19,12 25,12" fill={theme.palette.error.main} />
            </g>
          )}
        </svg>
      </Box>

      {/* Legend chips for room types on this floor */}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1.5, gap: 0.75 }}>
        {Array.from(new Set(rooms.map((r) => r.kind))).map((kind) => {
          const sample = rooms.find((r) => r.kind === kind);
          return (
            <Chip
              key={kind}
              size="small"
              label={kind.replace(/([A-Z])/g, ' $1').trim()}
              sx={{
                background: sample.color + '33',
                borderColor: sample.color,
                color: 'text.primary',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
              variant="outlined"
            />
          );
        })}
      </Stack>
    </Box>
  );
}
