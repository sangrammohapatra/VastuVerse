import { useMemo } from 'react';
import { Box } from '@mui/material';

const COLORS = [
  '#2E7D32', '#FF6F00', '#00BCD4', '#FFC107', '#E91E63', '#9C27B0',
  '#03A9F4', '#FFB300', '#43A047',
];

const PARTICLES = 36;

/**
 * Pure-CSS confetti burst.
 *
 *   show       boolean — mount/unmount triggers the burst
 *   duration   ms (default 1800)
 *   spread     px radius (default 240)
 *
 * Each particle is a small div with randomised end coordinates fed via CSS
 * vars; they translate + rotate + fade out using a single global keyframe.
 */
export default function ConfettiBurst({ show = false, duration = 1800, spread = 240 }) {
  // Memoise particle params so re-renders during the burst don't reshuffle.
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLES }, (_, i) => {
      const angle = (Math.PI * 2 * i) / PARTICLES + (Math.random() - 0.5) * 0.6;
      const dist = spread * (0.55 + Math.random() * 0.45);
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - spread * 0.15, // lift slightly
        rot: (Math.random() - 0.5) * 720,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 7,
        delay: Math.random() * 0.12,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes vv-confetti {
          0%   { transform: translate(-50%, -50%) translate(0, 0) rotate(0deg); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 30,
        }}
      >
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: p.size,
              height: p.size * 0.5,
              background: p.color,
              borderRadius: 2,
              boxShadow: `0 0 6px ${p.color}66`,
              animation: `vv-confetti ${duration}ms cubic-bezier(0.1, 0.7, 0.35, 1) ${p.delay}s forwards`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
            }}
          />
        ))}
      </Box>
    </>
  );
}
