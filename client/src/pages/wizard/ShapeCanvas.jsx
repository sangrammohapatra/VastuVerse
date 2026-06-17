import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, Button, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';

const CANVAS_W = 480;
const CANVAS_H = 320;

/**
 * ShapeCanvas — two modes:
 *
 *   detected (read-only): renders the AI polygon over a dark canvas.
 *   manual    (editable): user clicks to add vertices, double-click / button to close.
 *
 * The parent decides mode based on AI confidence (< 0.70 → manual fallback).
 * On confirm, the parent receives the final polygon via onConfirm.
 */
export default function ShapeCanvas({
  detectedPolygon,
  confidence,
  mode = 'detected', // 'detected' | 'manual'
  onConfirm,
  onSwitchToManual,
}) {
  const theme = useTheme();
  const canvasRef = useRef(null);
  const [manualPoints, setManualPoints] = useState([]);
  const [closed, setClosed] = useState(false);

  /* ---- draw ---------------------------------------------------------- */
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    // High-DPI clear
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // Background (dark canvas regardless of theme so green lines pop)
    ctx.fillStyle = '#0A0E1A';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= cvs.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke();
    }
    for (let y = 0; y <= cvs.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke();
    }

    const pts = mode === 'manual' ? manualPoints : (detectedPolygon || []);
    if (pts.length === 0) return;

    // Normalise: if any coord is in 0..1 range (Vision normalised) we scale.
    const normalised = pts.every((p) => p.x <= 1 && p.y <= 1);
    const scale = normalised
      ? (p) => ({ x: p.x * cvs.width, y: p.y * cvs.height })
      : (p) => ({ x: p.x, y: p.y });
    const sPts = pts.map(scale);

    // Polygon stroke
    ctx.beginPath();
    ctx.moveTo(sPts[0].x, sPts[0].y);
    for (let i = 1; i < sPts.length; i++) ctx.lineTo(sPts[i].x, sPts[i].y);
    if (mode === 'detected' || closed) ctx.closePath();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Fill (subtle)
    if (mode === 'detected' || closed) {
      ctx.fillStyle = 'rgba(76,175,80,0.15)';
      ctx.fill();
    }

    // Vertices
    sPts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00E5FF';
      ctx.fill();
      ctx.fillStyle = '#0A0E1A';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(String(i + 1), p.x + 7, p.y - 5);
    });
  }, [detectedPolygon, manualPoints, mode, closed]);

  /* ---- click handlers (manual mode) ---------------------------------- */
  const handleClick = (e) => {
    if (mode !== 'manual') return;
    if (closed) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvasRef.current.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvasRef.current.height) / rect.height;
    setManualPoints((curr) => [...curr, { x, y }]);
  };
  const resetManual = () => { setManualPoints([]); setClosed(false); };
  const closeManual = () => { if (manualPoints.length >= 3) setClosed(true); };

  const confirmedPoints = mode === 'manual' ? manualPoints : (detectedPolygon || []);
  const canConfirm =
    confirmedPoints.length >= 3 && (mode === 'detected' || closed);

  return (
    <Stack spacing={1.5}>
      {/* Header strip with confidence + mode badge */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          {mode === 'detected' && (
            <Chip
              label={`AI confidence ${Math.round((confidence || 0) * 100)}%`}
              size="small"
              color={confidence >= 0.7 ? 'primary' : 'warning'}
              variant="outlined"
            />
          )}
          {mode === 'manual' && (
            <Chip label="Manual drawing" size="small" color="secondary" variant="outlined" />
          )}
          {confidence > 0 && confidence < 0.7 && mode === 'detected' && (
            <Typography variant="body2" sx={{ color: 'warning.main' }}>
              Low confidence — switching to manual is recommended.
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          {mode === 'detected' && onSwitchToManual && (
            <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onSwitchToManual}>
              Draw manually
            </Button>
          )}
          {mode === 'manual' && (
            <>
              <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={resetManual}>
                Reset
              </Button>
              <Button size="small" variant="outlined" disabled={manualPoints.length < 3 || closed} onClick={closeManual}>
                Close polygon
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* Canvas */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Box
          component="canvas"
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleClick}
          sx={{
            width: '100%',
            maxWidth: CANVAS_W,
            display: 'block',
            borderRadius: 2,
            cursor: mode === 'manual' && !closed ? 'crosshair' : 'default',
            border: `1px solid ${theme.palette.divider}`,
            background: '#0A0E1A',
          }}
        />
      </motion.div>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {mode === 'manual'
            ? closed
              ? `Polygon closed with ${manualPoints.length} vertices.`
              : `Click on the canvas to add vertices (${manualPoints.length} so far). At least 3 needed.`
            : `${(detectedPolygon || []).length} vertices detected.`}
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<CheckIcon />}
          disabled={!canConfirm}
          onClick={() => onConfirm?.(confirmedPoints)}
        >
          Use polygon
        </Button>
      </Stack>
    </Stack>
  );
}
