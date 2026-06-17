import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * VastuVerse mandala "V" mark — same shape used in the homepage navbar.
 * Extracted here for reuse on auth and onboarding screens.
 */
export default function Logo({ size = 36 }) {
  const theme = useTheme();
  const a = theme.palette.primary.main;
  const b = theme.palette.accent.main;
  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      aria-hidden
      sx={{ width: size, height: size, flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="vvLogoShared" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <circle
        cx="24" cy="24" r="22"
        fill="none" stroke="url(#vvLogoShared)" strokeWidth="1.5" opacity="0.5"
      />
      {[...Array(8)].map((_, i) => (
        <line
          key={i}
          x1="24" y1="24"
          x2={24 + 21 * Math.cos((i * Math.PI) / 4)}
          y2={24 + 21 * Math.sin((i * Math.PI) / 4)}
          stroke="url(#vvLogoShared)" strokeWidth="0.8" opacity="0.35"
        />
      ))}
      <path
        d="M13 14 L24 36 L35 14"
        fill="none" stroke="url(#vvLogoShared)" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="3" fill="url(#vvLogoShared)" />
    </Box>
  );
}
