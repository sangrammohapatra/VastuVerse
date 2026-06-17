import { createTheme } from "@mui/material/styles";

/**
 * VastuVerse theme.
 *
 * The current spec asks for `info` (cyan) on the MUI palette; earlier code
 * (HomePage, RoleSelectStep, OnboardingPage, Logo) also references a custom
 * `accent` key with the same color. We keep BOTH in lockstep so old code
 * keeps working and new code can use the standard MUI `info` slot.
 *
 * Typography: spec literally lists "Inter, Playfair Display, sans-serif" as
 * the base family, but the design intent is the dual-family system from the
 * homepage — Playfair Display for headings, Inter for body. The base family
 * leads with Inter (so body renders in Inter), and h1-h4 explicitly opt in
 * to Playfair Display.
 *
 * Component overrides:
 *   - MuiCard:   borderRadius 16
 *   - MuiButton: textTransform none, pill radius
 */

const PALETTES = {
  light: {
    mode: "light",
    primary:   { main: "#2E7D32", contrastText: "#FFFFFF" },
    secondary: { main: "#FF6F00", contrastText: "#FFFFFF" },
    info:      { main: "#00BCD4", contrastText: "#FFFFFF" },
    accent:    { main: "#00BCD4", contrastText: "#FFFFFF" }, // legacy mirror of info
    background:{ default: "#F8F9FA", paper: "#FFFFFF" },
    text:      { primary: "#1A1A2E", secondary: "rgba(26,26,46,0.66)" },
    divider:   "rgba(26,26,46,0.10)",
  },
  dark: {
    mode: "dark",
    primary:   { main: "#4CAF50", contrastText: "#06210A" },
    secondary: { main: "#FFB300", contrastText: "#241500" },
    info:      { main: "#00E5FF", contrastText: "#001417" },
    accent:    { main: "#00E5FF", contrastText: "#001417" }, // legacy mirror
    background:{ default: "#0A0E1A", paper: "#111827" },
    text:      { primary: "#E8EAF6", secondary: "rgba(232,234,246,0.62)" },
    divider:   "rgba(232,234,246,0.12)",
  },
};

const vastuTokens = (mode) => ({
  gradientText: "linear-gradient(135deg, #2E7D32 0%, #00BCD4 100%)",
  gradientBrand:
    mode === "dark"
      ? "linear-gradient(135deg, #4CAF50 0%, #00E5FF 100%)"
      : "linear-gradient(135deg, #2E7D32 0%, #00BCD4 100%)",
  glowPrimary:
    mode === "dark"
      ? "0 0 30px rgba(76,175,80,0.55)"
      : "0 0 30px rgba(46,125,50,0.5)",
  glowAccent:
    mode === "dark"
      ? "0 0 30px rgba(0,229,255,0.45)"
      : "0 0 30px rgba(0,188,212,0.4)",
  cardBg:     mode === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF",
  cardBorder: mode === "dark" ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(26,26,46,0.06)",
  cardBlur:   mode === "dark" ? "blur(20px)" : "none",
  cardShadow: mode === "dark" ? "0 8px 32px rgba(0,0,0,0.35)" : "0 8px 30px rgba(26,26,46,0.08)",
  darkStrip: "#1A1A2E",
});

export const getTheme = (mode = "light") => {
  const palette = PALETTES[mode] || PALETTES.light;

  const theme = createTheme({
    palette,
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: "\"Inter\", \"Playfair Display\", system-ui, -apple-system, sans-serif",
      h1: { fontFamily: "\"Playfair Display\", Georgia, serif", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.5px" },
      h2: { fontFamily: "\"Playfair Display\", Georgia, serif", fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.4px" },
      h3: { fontFamily: "\"Playfair Display\", Georgia, serif", fontWeight: 700, lineHeight: 1.2 },
      h4: { fontFamily: "\"Playfair Display\", Georgia, serif", fontWeight: 600 },
      h5: { fontFamily: "\"Inter\", sans-serif", fontWeight: 700 },
      h6: { fontFamily: "\"Inter\", sans-serif", fontWeight: 700 },
      subtitle1: { fontFamily: "\"Inter\", sans-serif", fontWeight: 500 },
      body1: { fontFamily: "\"Inter\", sans-serif", lineHeight: 1.7 },
      body2: { fontFamily: "\"Inter\", sans-serif", lineHeight: 1.65 },
      button: { textTransform: "none", fontWeight: 600, letterSpacing: "0.2px" },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 999,
            paddingInline: 22,
            paddingBlock: 10,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderRadius: 16,
            "&:before": { display: "none" },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 13, padding: "8px 12px", borderRadius: 10 },
        },
      },
    },
  });

  // Custom tokens not in the typed palette — accessed via theme.vastu.*
  theme.vastu = vastuTokens(mode);
  return theme;
};

export default getTheme;
