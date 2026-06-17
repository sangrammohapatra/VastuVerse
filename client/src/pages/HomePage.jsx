/**
 * VastuVerse — Public Homepage  (route "/")
 * ------------------------------------------------------------------
 * Single-file landing page. Every section is a named component defined
 * below and composed in <HomePage/> at the very bottom.
 *
 * Required deps:
 *   framer-motion @mui/material @emotion/react @emotion/styled
 *   @mui/icons-material react-router-dom react-intersection-observer
 *   react-countup react-type-animation react-tsparticles tsparticles-slim
 *
 * No images — all visuals are SVG / CSS / MUI.
 * Theme (light/dark) comes from ThemeContext + themeConfig.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Container,
  Stack,
  Typography,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  DialogContentText,
  Drawer,
  Menu,
  MenuItem,
  Avatar,
  Switch,
  FormControlLabel,
  Divider,
  Link as MuiLink,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import CountUp from "react-countup";
import { TypeAnimation } from "react-type-animation";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

// ── Icons ──────────────────────────────────────────────────────────
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LanguageIcon from "@mui/icons-material/Language";
import StarIcon from "@mui/icons-material/Star";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import SecurityIcon from "@mui/icons-material/Security";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import GavelIcon from "@mui/icons-material/Gavel";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import HttpsIcon from "@mui/icons-material/Https";
import VerifiedIcon from "@mui/icons-material/Verified";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ImageIcon from "@mui/icons-material/Image";
import VisibilityIcon from "@mui/icons-material/Visibility";
import XIcon from "@mui/icons-material/X";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import InstagramIcon from "@mui/icons-material/Instagram";
import YouTubeIcon from "@mui/icons-material/YouTube";

import { useThemeMode } from "../context/ThemeContext";

/* ==================================================================
   KEYFRAMES (CSS animations)
   ================================================================== */
const scanSweep = keyframes`
  0%   { transform: translateY(-10%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(360%); opacity: 0; }
`;
const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
`;
const pulseRing = keyframes`
  0%   { transform: scale(0.6); opacity: 0.9; }
  70%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
`;
const marquee = keyframes`
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;
const spinSlow = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;
const conicSpin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;
const drawLine = keyframes`
  to { stroke-dashoffset: 0; }
`;

/* ==================================================================
   STATIC DATA
   ================================================================== */
const NAV_LINKS = [
  { label: "Features", id: "features" },
  { label: "Vastu AI", id: "vastu" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Pricing", id: "pricing" },
  { label: "Marketplace", id: "marketplace" },
];

const LANGUAGES = [
  { code: "EN", flag: "🇬🇧", label: "English" },
  { code: "HI", flag: "🇮🇳", label: "हिन्दी" },
  { code: "BN", flag: "🇮🇳", label: "বাংলা" },
  { code: "TA", flag: "🇮🇳", label: "தமிழ்" },
  { code: "TE", flag: "🇮🇳", label: "తెలుగు" },
  { code: "MR", flag: "🇮🇳", label: "मराठी" },
  { code: "GU", flag: "🇮🇳", label: "ગુજરાતી" },
  { code: "KN", flag: "🇮🇳", label: "ಕನ್ನಡ" },
];

const STEPS = [
  {
    n: 1,
    icon: "📐",
    name: "Land & Structure",
    desc: "Enter plot dimensions, shape, city, and vastu preference",
  },
  {
    n: 2,
    icon: "🛏️",
    name: "Room Planning",
    desc: "Configure rooms; AI checks NBC feasibility instantly",
  },
  {
    n: 3,
    icon: "🗺️",
    name: "Floor Plan",
    desc: "AI generates 3 layout options with 2D SVG view",
  },
  {
    n: 4,
    icon: "🛋️",
    name: "Interior Design",
    desc: "Choose style per room; AI renders interiors",
  },
  {
    n: 5,
    icon: "🏠",
    name: "Exterior Design",
    desc: "Façade, roof, gate, landscaping — AI visualizes it all",
  },
  {
    n: 6,
    icon: "🔌",
    name: "Utilities",
    desc: "Plumbing, electrical, solar — overlaid on your floor plan",
  },
  {
    n: 7,
    icon: "💰",
    name: "Cost Estimate",
    desc: "State-level material rates. Economy → Premium tiers.",
  },
  {
    n: 8,
    icon: "🎮",
    name: "3D View",
    desc: "Three.js interactive walkthrough of your home (Pro)",
  },
  {
    n: 9,
    icon: "🏛️",
    name: "Municipal Docs",
    desc: "Compliance checklist + draft submission document (Basic+)",
  },
  {
    n: 10,
    icon: "✅",
    name: "Review & Export",
    desc: "Collaborate, version, export PDF, share with contractor",
  },
];

const FEATURES = [
  {
    icon: "🧠",
    title: "AI Floor Plan Generator",
    desc: "3 layout options per generation. NBC-compliant room sizing, setback rules, and natural ventilation baked in.",
  },
  {
    icon: "🧭",
    title: "Vastu Intelligence",
    desc: "Deep Vastu rule engine: door placement, kitchen direction, bedroom orientation, pooja room location — all AI-enforced.",
  },
  {
    icon: "🎨",
    title: "Interior & Exterior AI",
    desc: "6 design styles. Per-room customisation. AI-generated renders of every space — from living rooms to façades.",
  },
  {
    icon: "📏",
    title: "NBC & FSI Compliance",
    desc: "Auto-fetched city-level FSI/FAR limits, setback rules, and parking norms. Instant compliance warnings.",
  },
  {
    icon: "💡",
    title: "Utilities Planning",
    desc: "Plumbing routes, electrical points, HVAC, solar feasibility — all layered on your floor plan as toggleable overlays.",
  },
  {
    icon: "💰",
    title: "India-Specific Cost Engine",
    desc: "State-level material rate datasets. Economy / Standard / Premium tiers. ±15% variance shown transparently.",
  },
  {
    icon: "🏛️",
    title: "Municipal Approval Docs",
    desc: "AI-generated compliance checklist and draft submission document for your local ULB/Corporation.",
  },
  {
    icon: "🎮",
    title: "3D Interactive Walkthrough",
    desc: "Three.js-powered real-time 3D view of your home. Orbit, zoom, and explore every room.",
  },
  {
    icon: "🤝",
    title: "Architect Marketplace",
    desc: "Connect with CoA-verified architects for professional plan reviews. Escrow payment via Razorpay.",
  },
];

const ROLES = [
  {
    icon: "🏠",
    title: "Individual Homeowners",
    desc: "Plan your dream home yourself — no architect fees in the design phase. Vastu-compliant, budget-aware, export-ready.",
    cta: "Start Free",
    to: "/login",
    band: "#2E7D32",
  },
  {
    icon: "🏢",
    title: "Real Estate Developers",
    desc: "Bulk project management, team RBAC, client sharing portal, template library, and branded PDF exports.",
    cta: "Explore Enterprise",
    to: "/login",
    band: "#FF6F00",
  },
  {
    icon: "📐",
    title: "Verified Architects",
    desc: "Join the marketplace. Get paid to review AI-generated plans. Build your digital portfolio. Razorpay payouts.",
    cta: "Apply as Architect",
    to: "/login",
    band: "#00BCD4",
  },
  {
    icon: "🏛️",
    title: "Municipal Consultants",
    desc: "AI-generated compliance checklists mapped to city-specific bye-laws. Draft submission documents in minutes.",
    cta: "Learn More",
    to: "/marketplace",
    band: "#7E57C2",
  },
];

const PRICING = [
  {
    tier: "FREE",
    priceM: 0,
    priceY: 0,
    blurb: "1 plan lifetime · 5 AI gen/day · 5 versions",
    points: [
      "Floor plan, interior, exterior",
      "Cost estimate",
      "Contractor view",
    ],
    cta: "Get Started",
    to: "/login",
    highlight: false,
  },
  {
    tier: "BASIC",
    priceM: 499,
    priceY: 4790,
    blurb: "3 plans/month · 20 AI gen/day · 20 versions",
    points: ["Everything in Free", "Municipal docs"],
    cta: "Start Basic",
    to: "/login",
    highlight: false,
  },
  {
    tier: "PRO",
    priceM: 1499,
    priceY: 14390,
    blurb: "Unlimited plans · Unlimited AI gen · 3D View",
    points: ["Branded PDF export", "Priority AI queue", "All features"],
    cta: "Go Pro",
    to: "/login",
    highlight: true,
  },
  {
    tier: "ENTERPRISE",
    priceM: 4999,
    priceY: 47990,
    blurb: "Everything in Pro + Team RBAC · Bulk projects",
    points: ["Client portal", "Analytics API", "Dedicated AI queue"],
    cta: "Contact Sales",
    to: "/login",
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Finally a tool that understands both Vastu and modern design. Generated my Bengaluru 30x40 plan in 10 minutes!",
    name: "Rajesh K.",
    role: "Homeowner, Bengaluru",
  },
  {
    quote:
      "The cost estimate saved me from contractor overquoting. The state-wise rates are spot on.",
    name: "Priya S.",
    role: "Homeowner, Pune",
  },
  {
    quote:
      "As a developer managing 50+ plots, the bulk project management and team RBAC is exactly what we needed.",
    name: "Amit Doshi",
    role: "Developer, Surat",
  },
  {
    quote:
      "The Vastu compliance feature is incredible. It even flagged my kitchen direction before I raised the walls!",
    name: "Lakshmi R.",
    role: "Homeowner, Chennai",
  },
  {
    quote:
      "Municipal checklist saved us weeks of back-and-forth with the BBMP office. Everything was pre-checked.",
    name: "Suresh M.",
    role: "Contractor, Bengaluru",
  },
  {
    quote:
      "The 3D walkthrough wowed my clients. They approved the plan on the first presentation.",
    name: "Neha Sharma",
    role: "Architect, Delhi",
  },
];

const FAQS = [
  {
    q: "Do I need to know anything about architecture to use VastuVerse?",
    a: "Not at all. The 10-step guided wizard walks you through every decision in plain language. You enter your plot details and preferences, and the AI handles the technical sizing, setbacks, and ventilation rules behind the scenes.",
  },
  {
    q: "Is Vastu compliance mandatory?",
    a: "No. Vastu is a per-plan toggle. Enable it and the AI enforces directional rules for doors, kitchen, bedrooms, and the pooja room. Leave it off and you get a purely modern, NBC-compliant layout.",
  },
  {
    q: "Can I use this for an apartment / flat?",
    a: "Yes. VastuVerse adapts its Vastu logic for apartment units, where you cannot control the building orientation. It focuses on internal room placement and entrance energy rather than plot facing.",
  },
  {
    q: "Is the AI-generated floor plan legally valid for submission?",
    a: "The AI output is a design and planning aid. For municipal submission you typically need a licensed architect or engineer to stamp the drawings. Our Architect Marketplace connects you with CoA-verified professionals to review and finalise your plan.",
  },
  {
    q: "How accurate is the cost estimate?",
    a: "Estimates use state-level material rate datasets updated quarterly, across Economy, Standard, and Premium tiers. We transparently show a ±15% variance band, since labour and local rates fluctuate. Treat it as a strong planning baseline, not a fixed quote.",
  },
  {
    q: "What happens after I complete my plan?",
    a: "Completing Step 10 moves your plan to COMPLETED status. This unlocks the Architect Marketplace, branded PDF export (Pro), contractor sharing links, and the option to reopen for further edits anytime.",
  },
  {
    q: "How are architects verified on the marketplace?",
    a: "Every architect submits their Council of Architecture (CoA) registration number, experience, and portfolio at signup. Our admin team manually reviews each application before granting a verified badge and marketplace access.",
  },
  {
    q: "Can I use VastuVerse in Hindi or other Indian languages?",
    a: "Yes. The interface supports 8 Indian languages — English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, and Kannada — switchable anytime from the language selector.",
  },
];

// 8-direction Vastu compass data (clockwise from North at top).
const VASTU_DIRS = [
  {
    dir: "N",
    name: "North",
    planet: "Mercury",
    color: "#2E7D32",
    use: "Wealth & Career",
    rule: "Keep open & light; ideal for water bodies and the main entrance.",
  },
  {
    dir: "NE",
    name: "North-East",
    planet: "Jupiter",
    color: "#FBC02D",
    use: "Prayer & Wisdom",
    rule: "Reserve for the pooja room and water sources; keep clutter-free.",
  },
  {
    dir: "E",
    name: "East",
    planet: "Sun",
    color: "#FB8C00",
    use: "Health & Energy",
    rule: "Best for the main door and morning-light rooms.",
  },
  {
    dir: "SE",
    name: "South-East",
    planet: "Venus",
    color: "#EC407A",
    use: "Kitchen & Fire",
    rule: "The fire zone — place the kitchen and stove here.",
  },
  {
    dir: "S",
    name: "South",
    planet: "Mars",
    color: "#E53935",
    use: "Fame & Ancestors",
    rule: "Keep heavy and built-up; avoid main entrances.",
  },
  {
    dir: "SW",
    name: "South-West",
    planet: "Earth",
    color: "#8D6E63",
    use: "Master Bedroom · Stability",
    rule: "Heaviest zone — ideal for the master bedroom and storage.",
  },
  {
    dir: "W",
    name: "West",
    planet: "Saturn",
    color: "#1E88E5",
    use: "Children & Creativity",
    rule: "Good for children's rooms, study, and dining.",
  },
  {
    dir: "NW",
    name: "North-West",
    planet: "Moon",
    color: "#90A4AE",
    use: "Guest & Air",
    rule: "Air zone — suits guest rooms, garages, and ventilation.",
  },
];

const VASTU_ACCORDIONS = [
  {
    q: "How VastuVerse applies Vastu",
    a: "Our AI prompt engineering enforces core rules automatically: main door in the north or east, kitchen in the south-east, master bedroom in the south-west, pooja room in the north-east, no beams over beds, and balanced open space in the north-east.",
  },
  {
    q: "Is Vastu optional?",
    a: "Yes — it is a toggle on every plan. VastuVerse works fully with or without Vastu, so you can choose a traditional layout, a purely modern one, or anything in between.",
  },
  {
    q: "Does Vastu conflict with NBC norms?",
    a: "Rarely, and when it does, NBC safety norms always take priority. The AI first satisfies setback, ventilation, and structural rules, then optimises room placement for Vastu within those legal limits, flagging any unavoidable trade-offs.",
  },
  {
    q: "Vastu for apartments vs. independent houses",
    a: "Independent houses allow full plot-orientation control. For apartments, where facing is fixed, VastuVerse adapts by focusing on internal zoning — entrance energy, kitchen and bedroom placement — rather than the building direction.",
  },
];

const CITIES = [
  { name: "Delhi",     state: "Delhi",           lng: 77.21,  lat: 28.67 },
  { name: "Mumbai",    state: "Maharashtra",     lng: 72.88,  lat: 19.08 },
  { name: "Bengaluru", state: "Karnataka",       lng: 77.59,  lat: 12.97 },
  { name: "Chennai",   state: "Tamil Nadu",      lng: 80.27,  lat: 13.08 },
  { name: "Hyderabad", state: "Telangana",       lng: 78.47,  lat: 17.38 },
  { name: "Kolkata",   state: "West Bengal",     lng: 88.37,  lat: 22.57 },
  { name: "Ahmedabad", state: "Gujarat",         lng: 72.59,  lat: 23.03 },
  { name: "Pune",      state: "Maharashtra",     lng: 73.85,  lat: 18.52 },
  { name: "Jaipur",    state: "Rajasthan",       lng: 75.79,  lat: 26.93 },
  { name: "Lucknow",   state: "Uttar Pradesh",   lng: 80.95,  lat: 26.85 },
];

const INDIA_GEO_URL = "/india-states.geojson";

const SOCIALS = [
  { icon: <XIcon />, label: "X", color: "#1DA1F2" },
  { icon: <LinkedInIcon />, label: "LinkedIn", color: "#0A66C2" },
  { icon: <InstagramIcon />, label: "Instagram", color: "#E1306C" },
  { icon: <YouTubeIcon />, label: "YouTube", color: "#FF0000" },
];

/* ==================================================================
   SMALL SHARED HELPERS
   ================================================================== */

// Mandala-inspired "V" logo.
function MandalaLogo({ size = 36 }) {
  const theme = useTheme();
  const a = theme.palette.primary.main;
  const b = theme.palette.accent.main;
  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      sx={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="vvLogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="22"
        fill="none"
        stroke="url(#vvLogo)"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {[...Array(8)].map((_, i) => (
        <line
          key={i}
          x1="24"
          y1="24"
          x2={24 + 21 * Math.cos((i * Math.PI) / 4)}
          y2={24 + 21 * Math.sin((i * Math.PI) / 4)}
          stroke="url(#vvLogo)"
          strokeWidth="0.8"
          opacity="0.35"
        />
      ))}
      <path
        d="M13 14 L24 36 L35 14"
        fill="none"
        stroke="url(#vvLogo)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="3" fill="url(#vvLogo)" />
    </Box>
  );
}

function GradientText({ children, sx, component = "span", ...rest }) {
  return (
    <Typography
      component={component}
      sx={{
        background: "linear-gradient(135deg, #2E7D32 0%, #00BCD4 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        display: "inline-block",
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Typography>
  );
}

const MotionBox = motion(Box);

// Glow CTA — primary green w/ glow + spring hover via Framer Motion.
function GlowButton({
  children,
  to,
  onClick,
  variant = "glow",
  size = "large",
  startIcon,
  endIcon,
  sx,
  ...rest
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const isGlow = variant === "glow";
  const routerProps = to ? { component: RouterLink, to } : {};
  return (
    <MotionBox
      whileHover={reduce ? undefined : { scale: 1.05 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      sx={{ display: "inline-flex" }}
    >
      <Button
        {...routerProps}
        onClick={onClick}
        size={size}
        startIcon={startIcon}
        endIcon={endIcon}
        variant={isGlow ? "contained" : "outlined"}
        color="primary"
        sx={{
          fontWeight: 700,
          px: 2.5,
          py: 1,
          fontSize: "0.9rem",
          whiteSpace: "nowrap",
          ...(isGlow
            ? {
                boxShadow: theme.vastu.glowPrimary,
                "&:hover": {
                  boxShadow: `0 0 44px ${theme.palette.primary.main}`,
                },
              }
            : {
                borderWidth: 2,
                "&:hover": { borderWidth: 2 },
              }),
          ...sx,
        }}
        {...rest}
      >
        {children}
      </Button>
    </MotionBox>
  );
}

// Glass / clean card surface depending on theme mode.
function GlassCard({ children, sx, hoverLift = false, ...rest }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
        borderRadius: 2,
        transition:
          "transform .25s ease, box-shadow .25s ease, border-color .25s ease",
        ...(hoverLift && {
          "&:hover": {
            transform: "translateY(-8px)",
            borderColor: theme.palette.primary.main,
            boxShadow: theme.vastu.glowPrimary,
          },
        }),
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

// Scroll-reveal wrapper: fades up when entering the viewport, respects reduced motion.
function Reveal({ children, delay = 0, y = 40, once = true, sx, style }) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView({ triggerOnce: once, threshold: 0.15 });
  if (reduce)
    return (
      <Box sx={sx} style={style}>
        {children}
      </Box>
    );
  return (
    <MotionBox
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      sx={sx}
      style={style}
    >
      {children}
    </MotionBox>
  );
}

// Staggered container + item helpers.
function StaggerGroup({ children, sx, stagger = 0.1 }) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  if (reduce) return <Box sx={sx}>{children}</Box>;
  return (
    <MotionBox
      ref={ref}
      sx={sx}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </MotionBox>
  );
}
function StaggerItem({ children, sx, from = "up" }) {
  const reduce = useReducedMotion();
  const offset =
    from === "left" ? { x: -40 } : from === "right" ? { x: 40 } : { y: 40 };
  if (reduce) return <Box sx={sx}>{children}</Box>;
  return (
    <MotionBox
      sx={sx}
      variants={{
        hidden: { opacity: 0, ...offset },
        show: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </MotionBox>
  );
}

function SectionHeading({ overline, title, subtitle, align = "center", sx }) {
  return (
    <Reveal sx={{ textAlign: align, mb: 6, ...sx }}>
      {overline && (
        <Typography
          variant="overline"
          sx={{ letterSpacing: 2, color: "accent.main", fontWeight: 700 }}
        >
          {overline}
        </Typography>
      )}
      <GradientText
        component="h2"
        sx={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
          fontSize: { xs: "2rem", md: "2.8rem" },
          lineHeight: 1.15,
          mt: overline ? 1 : 0,
        }}
      >
        {title}
      </GradientText>
      {subtitle && (
        <Typography
          sx={{
            mt: 1.5,
            color: "text.secondary",
            maxWidth: 720,
            mx: align === "center" ? "auto" : 0,
            fontSize: "1.05rem",
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Reveal>
  );
}

const smoothScrollTo = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ==================================================================
   SECTION 1 — NAVBAR
   ================================================================== */
function ThemeToggleButton() {
  const { mode, toggleTheme } = useThemeMode();
  const reduce = useReducedMotion();
  return (
    <Tooltip title={mode === "dark" ? "Switch to light" : "Switch to dark"}>
      <IconButton
        onClick={toggleTheme}
        color="inherit"
        aria-label="toggle theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={reduce ? false : { rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.3 }}
            style={{ display: "inline-flex" }}
          >
            {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </motion.span>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
}

function LanguageSelector() {
  const [anchor, setAnchor] = useState(null);
  const [lang, setLang] = useState(LANGUAGES[0]);
  return (
    <>
      <Button
        color="inherit"
        size="small"
        startIcon={<LanguageIcon fontSize="small" />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ minWidth: 0, fontWeight: 600, whiteSpace: "nowrap", px: 1 }}
      >
        {lang.flag}&nbsp;{lang.code}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {LANGUAGES.map((l) => (
          <MenuItem
            key={l.code}
            selected={l.code === lang.code}
            onClick={() => {
              setLang(l);
              setAnchor(null);
            }}
          >
            <Box component="span" sx={{ mr: 1 }}>
              {l.flag}
            </Box>
            {l.label}{" "}
            <Box component="span" sx={{ ml: 1, opacity: 0.6 }}>
              ({l.code})
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function Navbar({ onOpenDemo }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy for active link underline.
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const go = (id) => {
    smoothScrollTo(id);
    setDrawer(false);
  };

  return (
    <>
    <MotionBox
      component="header"
      initial={reduce ? false : { y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 1200,
        transition:
          "background .3s ease, box-shadow .3s ease, backdrop-filter .3s",
        backdropFilter: "blur(18px)",
        background: scrolled
          ? theme.palette.mode === "dark"
            ? "rgba(10, 14, 26, 0.45)"
            : "rgba(255,255,255,0.45)"
          : theme.palette.mode === "dark"
            ? "rgba(10,14,26,0.45)"
            : "rgba(255,255,255,0.55)",
        borderBottom: `1px solid ${scrolled ? theme.palette.divider : "transparent"}`,
        boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.08)" : "none",
      }}
    >
      <Container maxWidth="xl">
        <Box
          sx={{
            height: 64,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr auto" : "auto 1fr auto",
            alignItems: "center",
            gap: 2,
          }}
        >
          {/* ── Logo ── */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.2}
            sx={{ cursor: "pointer", flexShrink: 0 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <MandalaLogo size={32} />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: "1.25rem",
                whiteSpace: "nowrap",
              }}
            >
              Vastu
              <Box component="span" sx={{ color: "accent.main" }}>
                Verse
              </Box>
            </Typography>
          </Stack>

          {/* ── Center nav (desktop only) ── */}
          {!isMobile && (
            <Stack
              direction="row"
              justifyContent="center"
              alignItems="center"
              spacing={0}
            >
              {NAV_LINKS.map((l) => (
                <Button
                  key={l.id}
                  color="inherit"
                  onClick={() => go(l.id)}
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    px: 1.75,
                    py: 0.75,
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    position: "relative",
                    color: active === l.id ? "accent.main" : "text.primary",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      left: 12,
                      right: 12,
                      bottom: 4,
                      height: 2,
                      borderRadius: 2,
                      background: theme.palette.accent.main,
                      transform: active === l.id ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                      transition: "transform .25s ease",
                    },
                    "&:hover::after": { transform: "scaleX(1)" },
                  }}
                >
                  {l.label}
                </Button>
              ))}
            </Stack>
          )}

          {/* ── Right actions ── */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ flexShrink: 0, justifyContent: "flex-end" }}
          >
            <ThemeToggleButton />
            {!isMobile && <LanguageSelector />}
            {!isMobile && (
              <Button
                component={RouterLink}
                to="/login"
                color="inherit"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  whiteSpace: "nowrap",
                  px: 1.5,
                  minWidth: 0,
                }}
              >
                Login
              </Button>
            )}
            {!isMobile && (
              <GlowButton to="/login" size="small">
                Get&nbsp;Started&nbsp;Free
              </GlowButton>
            )}
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={() => setDrawer(true)}
                aria-label="open menu"
              >
                <MenuIcon />
              </IconButton>
            )}
          </Stack>
        </Box>
      </Container>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawer}
        onClose={() => setDrawer(false)}
        PaperProps={{
          sx: {
            width: "100%",
            background: theme.palette.background.default,
            backgroundImage: "none",
          },
        }}
      >
        <Stack sx={{ p: 3, height: "100%" }} spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <MandalaLogo size={30} />
              <Typography
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: 700,
                }}
              >
                VastuVerse
              </Typography>
            </Stack>
            <IconButton
              onClick={() => setDrawer(false)}
              aria-label="close menu"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider />
          <Stack spacing={1} sx={{ mt: 1 }}>
            {NAV_LINKS.map((l) => (
              <Button
                key={l.id}
                size="large"
                onClick={() => go(l.id)}
                sx={{
                  justifyContent: "flex-start",
                  fontSize: "1.15rem",
                  fontWeight: 600,
                }}
              >
                {l.label}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <LanguageSelector />
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            size="large"
            fullWidth
          >
            Login
          </Button>
          <GlowButton to="/login" sx={{ width: "100%" }}>
            Get Started Free
          </GlowButton>
        </Stack>
      </Drawer>
    </MotionBox>
    <Box sx={{ height: 64, flexShrink: 0 }} />
    </>
  );
}

/* ==================================================================
   SECTION 2 — HERO
   ================================================================== */
function ParticleField() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const init = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  const options = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: 60, density: { enable: true, area: 900 } },
        color: { value: dark ? "#FFB300" : "#2E7D32" },
        opacity: { value: dark ? 0.6 : 0.45 },
        size: { value: { min: 2, max: 4 } },
        links: {
          enable: true,
          distance: 130,
          color: dark ? "#FFB300" : "#2E7D32",
          opacity: dark ? 0.25 : 0.18,
          width: 1,
        },
        move: { enable: true, speed: 0.9, outModes: { default: "bounce" } },
      },
      interactivity: {
        events: { onHover: { enable: true, mode: "repulse" } },
        modes: { repulse: { distance: 90, duration: 0.4 } },
      },
    }),
    [dark],
  );

  return (
    <Particles
      id="vv-hero-particles"
      init={init}
      options={options}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    />
  );
}

function FloatingChip({ label, sx, delay = 0 }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: "absolute",
        px: 1.6,
        py: 0.8,
        borderRadius: 999,
        fontSize: "0.82rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: "text.primary",
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
        animation: `${floatY} 4s ease-in-out ${delay}s infinite`,
        zIndex: 3,
        ...sx,
      }}
    >
      {label}
    </Box>
  );
}

function IsoHouse() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <Box
      sx={{ position: "relative", width: "100%", maxWidth: 460, mx: "auto" }}
    >
      {/* radial glow behind */}
      <Box
        sx={{
          position: "absolute",
          inset: "-8% -6%",
          borderRadius: "50%",
          filter: "blur(48px)",
          background: dark
            ? "radial-gradient(circle, rgba(76,175,80,0.45), transparent 70%)"
            : "radial-gradient(circle, rgba(255,179,0,0.35), transparent 70%)",
          zIndex: 0,
        }}
      />
      {/* scan line */}
      <Box
        sx={{
          position: "absolute",
          left: "6%",
          right: "6%",
          top: 0,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${theme.palette.accent.main}, transparent)`,
          boxShadow: `0 0 18px ${theme.palette.accent.main}`,
          animation: `${scanSweep} 3.4s ease-in-out infinite`,
          zIndex: 4,
        }}
      />
      {/* house svg */}
      <Box
        component="svg"
        viewBox="0 0 320 280"
        sx={{ width: "100%", position: "relative", zIndex: 1 }}
      >
        <defs>
          <linearGradient id="roofGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.palette.primary.main} />
            <stop offset="100%" stopColor={theme.palette.accent.main} />
          </linearGradient>
          <linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? "#1b2433" : "#ffffff"} />
            <stop offset="100%" stopColor={dark ? "#141c28" : "#eef1f4"} />
          </linearGradient>
          <linearGradient id="wallR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? "#151d29" : "#f2f4f7"} />
            <stop offset="100%" stopColor={dark ? "#0f1620" : "#e3e7ec"} />
          </linearGradient>
        </defs>
        {/* base shadow */}
        <ellipse
          cx="160"
          cy="250"
          rx="120"
          ry="20"
          fill={dark ? "rgba(0,0,0,0.4)" : "rgba(26,26,46,0.10)"}
        />
        {/* left wall */}
        <polygon
          points="60,130 160,170 160,250 60,210"
          fill="url(#wallL)"
          stroke={theme.palette.divider}
        />
        {/* right wall */}
        <polygon
          points="160,170 260,130 260,210 160,250"
          fill="url(#wallR)"
          stroke={theme.palette.divider}
        />
        {/* roof */}
        <polygon
          points="60,130 160,90 260,130 160,170"
          fill="url(#roofGrad)"
          opacity="0.92"
        />
        {/* door */}
        <polygon
          points="108,196 130,188 130,228 108,234"
          fill={theme.palette.secondary.main}
          opacity="0.9"
        />
        {/* windows left */}
        <polygon
          points="78,168 96,162 96,182 78,188"
          fill={theme.palette.accent.main}
          opacity="0.55"
        />
        {/* windows right */}
        <polygon
          points="186,176 212,166 212,188 186,196"
          fill={theme.palette.accent.main}
          opacity="0.55"
        />
        <polygon
          points="224,160 244,152 244,172 224,180"
          fill={theme.palette.accent.main}
          opacity="0.4"
        />
      </Box>

      {/* orbiting info chips */}
      <FloatingChip
        label="🧭 Vastu Compliant"
        sx={{ top: "4%", right: "-6%" }}
        delay={0}
      />
      <FloatingChip
        label="📐 NBC Certified"
        sx={{ top: "40%", right: "-10%" }}
        delay={0.6}
      />
      <FloatingChip
        label="💰 ₹45L Estimate"
        sx={{ bottom: "14%", right: "-2%" }}
        delay={1.2}
      />
      <FloatingChip
        label="🏛️ 3D Ready"
        sx={{ bottom: "6%", left: "-4%" }}
        delay={0.9}
      />
    </Box>
  );
}

function HeroStat({ value, prefix = "", suffix = "", label }) {
  return (
    <Box sx={{ textAlign: "center", minWidth: 120 }}>
      <GradientText
        sx={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
          fontSize: { xs: "1.5rem", md: "1.9rem" },
        }}
      >
        {prefix}
        <CountUp
          end={value}
          duration={2.4}
          separator=","
          enableScrollSpy
          scrollSpyOnce
        />
        {suffix}
      </GradientText>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
    </Box>
  );
}

function Hero({ onOpenDemo, isMobile }) {
  const theme = useTheme();
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        minHeight: { xs: "auto", md: "100vh" },
        display: "flex",
        alignItems: "center",
        pt: { xs: 6, md: 0 },
        pb: { xs: 8, md: 0 },
        overflow: "hidden",
      }}
    >
      {!isMobile && <ParticleField />}
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "55fr 45fr" },
            gap: { xs: 6, md: 4 },
            alignItems: "center",
          }}
        >
          {/* Visual first on mobile (order), text first on desktop */}
          <Box sx={{ order: { xs: 2, md: 1 } }}>
            <Reveal>
              <Chip
                label="🇮🇳 Built for Bharat · NBC 2016 Compliant"
                sx={{
                  mb: 2.5,
                  fontWeight: 600,
                  color: "accent.main",
                  border: `1px solid ${theme.palette.accent.main}`,
                  background:
                    theme.palette.mode === "dark"
                      ? "rgba(0,229,255,0.08)"
                      : "rgba(0,188,212,0.08)",
                }}
              />
            </Reveal>
            <Reveal delay={0.08}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: "2.6rem", sm: "3.2rem", md: "3.5rem" },
                  mb: 1,
                }}
              >
                Design Your Dream Home
              </Typography>
              <GradientText
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: 700,
                  fontSize: { xs: "2.6rem", sm: "3.2rem", md: "3.5rem" },
                  minHeight: { xs: "3rem", md: "3.8rem" },
                }}
              >
                <TypeAnimation
                  sequence={[
                    "with AI Precision.",
                    2000,
                    "the Vastu Way.",
                    2000,
                    "in Minutes.",
                    2000,
                  ]}
                  speed={45}
                  repeat={Infinity}
                  cursor
                />
              </GradientText>
            </Reveal>
            <Reveal delay={0.16}>
              <Typography
                sx={{
                  mt: 2.5,
                  color: "text.secondary",
                  fontSize: { xs: "1.05rem", md: "1.18rem" },
                  maxWidth: 560,
                }}
              >
                VastuVerse combines ancient Vastu Shastra wisdom with
                cutting-edge AI to generate complete house plans — floor
                layouts, interiors, cost estimates, and municipal documents —
                without needing an architect.
              </Typography>
            </Reveal>
            <Reveal delay={0.24}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ mt: 4 }}
              >
                <GlowButton to="/login">Start Planning Free</GlowButton>
                <GlowButton
                  variant="outlined"
                  onClick={onOpenDemo}
                  startIcon={<PlayCircleOutlineIcon />}
                >
                  Watch Demo
                </GlowButton>
              </Stack>
            </Reveal>
            <Reveal delay={0.32}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mt: 4, color: "text.secondary" }}
              >
                <Box sx={{ color: "secondary.main", letterSpacing: 1 }}>
                  ★★★★★
                </Box>
                <Typography variant="body2">
                  Trusted by 12,000+ homeowners across India
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={{ xs: 2, md: 4 }}
                sx={{ mt: 3, flexWrap: "wrap", rowGap: 2 }}
              >
                <HeroStat value={10} suffix="K+" label="Plans Generated" />
                <HeroStat value={28} label="States Covered" />
                <HeroStat
                  value={50}
                  prefix="₹"
                  suffix="Cr+"
                  label="Construction Planned"
                />
              </Stack>
            </Reveal>
          </Box>

          {/* Visual */}
          <Box
            sx={{
              order: { xs: 1, md: 2 },
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Reveal delay={0.1} sx={{ width: "100%" }}>
              <IsoHouse />
            </Reveal>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 3 — STATS TICKER
   ================================================================== */
function StatsTicker() {
  const theme = useTheme();
  const items = [
    "10,000+ Plans Generated 🏠",
    "28 Indian States",
    "NBC 2016 Compliant",
    "Vastu-Enabled AI",
    "₹50 Crore+ Construction Value Planned",
    "8 Indian Languages",
    "Razorpay Secured",
    "Real Architects Verified",
  ];
  const row = [...items, ...items]; // duplicate for seamless loop
  return (
    <Box
      sx={{
        background: theme.vastu.darkStrip,
        py: 2,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          whiteSpace: "nowrap",
          animation: `${marquee} 32s linear infinite`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        {row.map((t, i) => (
          <Typography
            key={i}
            component="span"
            sx={{
              color: "#E8EAF6",
              fontWeight: 600,
              fontSize: "0.98rem",
              px: 3,
              display: "inline-flex",
              alignItems: "center",
              "& b": { color: theme.palette.accent.main },
            }}
          >
            <Box
              component="span"
              sx={{ color: theme.palette.accent.main, mr: 0.5 }}
            >
              ·
            </Box>
            {t}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

/* ==================================================================
   SECTION 4 — WHAT IS VASTU SHASTRA?  (id="vastu")
   ================================================================== */
function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function slicePath(cx, cy, rIn, rOut, start, end) {
  const [x1, y1] = polar(cx, cy, rOut, start);
  const [x2, y2] = polar(cx, cy, rOut, end);
  const [x3, y3] = polar(cx, cy, rIn, end);
  const [x4, y4] = polar(cx, cy, rIn, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${rOut} ${rOut} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${rIn} ${rIn} 0 ${large} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
}

function VastuCompass() {
  const theme = useTheme();
  const cx = 150,
    cy = 150;
  return (
    <Box
      sx={{ position: "relative", width: "100%", maxWidth: 360, mx: "auto" }}
    >
      <Box component="svg" viewBox="0 0 300 300" sx={{ width: "100%" }}>
        {/* rotating outer ring */}
        <Box
          component="g"
          sx={{
            transformOrigin: "150px 150px",
            animation: `${spinSlow} 60s linear infinite`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={142}
            fill="none"
            stroke={theme.palette.divider}
            strokeWidth="6"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
        </Box>

        {/* fixed inner zones */}
        {VASTU_DIRS.map((d, i) => {
          const center = i * 45;
          const start = center - 22.5;
          const end = center + 22.5;
          const path = slicePath(cx, cy, 46, 126, start, end);
          const [lx, ly] = polar(cx, cy, 88, center);
          return (
            <Tooltip
              key={d.dir}
              title={`Vastu rule: ${d.rule}`}
              arrow
              placement="top"
            >
              <Box
                component="g"
                sx={{
                  cursor: "pointer",
                  transition: "opacity .2s",
                  "&:hover path": { opacity: 1 },
                  "&:hover": { filter: "brightness(1.1)" },
                }}
              >
                <path
                  d={path}
                  fill={d.color}
                  opacity={0.78}
                  stroke={theme.palette.background.paper}
                  strokeWidth="2"
                />
                <text
                  x={lx}
                  y={ly - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#fff"
                >
                  {d.dir}
                </text>
                <text
                  x={lx}
                  y={ly + 9}
                  textAnchor="middle"
                  fontSize="7.5"
                  fill="rgba(255,255,255,0.9)"
                >
                  {d.planet}
                </text>
              </Box>
            </Tooltip>
          );
        })}

        {/* center mandala */}
        <circle
          cx={cx}
          cy={cy}
          r={44}
          fill={theme.palette.background.paper}
          stroke={theme.palette.primary.main}
          strokeWidth="1.5"
        />
        <MandalaCenter cx={cx} cy={cy} />
      </Box>
    </Box>
  );
}
function MandalaCenter({ cx, cy }) {
  const theme = useTheme();
  return (
    <g>
      {[...Array(8)].map((_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + 36 * Math.cos((i * Math.PI) / 4)}
          y2={cy + 36 * Math.sin((i * Math.PI) / 4)}
          stroke={theme.palette.accent.main}
          strokeWidth="1"
          opacity="0.5"
        />
      ))}
      <circle cx={cx} cy={cy} r={6} fill={theme.palette.secondary.main} />
      <text
        x={cx}
        y={cy + 30}
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={theme.palette.text.primary}
      >
        BRAHMASTHAN
      </text>
    </g>
  );
}

function VastuSection() {
  return (
    <Box component="section" id="vastu" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          title="The Ancient Science Behind VastuVerse"
          subtitle="5,000 years of Vedic architectural wisdom, encoded into AI"
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: { xs: 5, md: 7 },
            alignItems: "center",
          }}
        >
          <Reveal>
            <VastuCompass />
          </Reveal>
          <Box>
            <Reveal y={20}>
              <Typography
                sx={{ color: "text.secondary", mb: 3, fontSize: "1.05rem" }}
              >
                Vastu Shastra is India's ancient system of spatial arrangement,
                balancing the five elements (Pancha Bhuta), the energy of the
                eight directions, and cosmic forces. For millennia, builders and
                architects have used it to align homes with nature for health,
                harmony, and prosperity.
              </Typography>
            </Reveal>
            <StaggerGroup>
              {VASTU_ACCORDIONS.map((item, i) => (
                <StaggerItem key={i} from="right">
                  <VastuAccordion item={item} defaultExpanded={i === 0} />
                </StaggerItem>
              ))}
            </StaggerGroup>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function VastuAccordion({ item, defaultExpanded }) {
  const theme = useTheme();
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        mb: 1.5,
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600 }}>{item.q}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {item.a}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

/* ==================================================================
   SECTION 5 — HOW IT WORKS  (id="how-it-works")
   ================================================================== */
function StepCard({ step, side }) {
  const theme = useTheme();
  return (
    <StaggerItem from={side}>
      <GlassCard hoverLift sx={{ p: 3, height: "100%" }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <GradientText
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: "3.4rem",
              lineHeight: 1,
            }}
          >
            {step.n}
          </GradientText>
          <Box sx={{ fontSize: "1.8rem" }}>{step.icon}</Box>
        </Stack>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{step.name}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {step.desc}
        </Typography>
      </GlassCard>
    </StaggerItem>
  );
}

function HowItWorks() {
  return (
    <Box
      component="section"
      id="how-it-works"
      sx={{ py: { xs: 8, md: 12 }, position: "relative" }}
    >
      <Container maxWidth="lg">
        <SectionHeading
          overline="THE JOURNEY"
          title="From Plot to Plan in 10 Steps"
        />
        <StaggerGroup
          stagger={0.08}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "repeat(5, 1fr)",
            },
            gap: 2.5,
          }}
        >
          {STEPS.map((s, i) => (
            <StepCard
              key={s.n}
              step={s}
              side={i % 2 === 0 ? "left" : "right"}
            />
          ))}
        </StaggerGroup>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 6 — FEATURE DEEP DIVE  (id="features")
   ================================================================== */
function FeatureCard({ f }) {
  const theme = useTheme();
  return (
    <StaggerItem>
      <GlassCard hoverLift sx={{ p: 3.2, height: "100%" }}>
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.8rem",
            mb: 2,
            background:
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, rgba(76,175,80,0.2), rgba(0,229,255,0.15))"
                : "linear-gradient(135deg, rgba(46,125,50,0.12), rgba(0,188,212,0.12))",
          }}
        >
          {f.icon}
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: "1.12rem", mb: 1 }}>
          {f.title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {f.desc}
        </Typography>
      </GlassCard>
    </StaggerItem>
  );
}

function Features() {
  return (
    <Box component="section" id="features" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          overline="CAPABILITIES"
          title="Everything Your Home Needs, Powered by AI"
        />
        <StaggerGroup
          stagger={0.07}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "repeat(3, 1fr)",
            },
            gap: 3,
          }}
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} />
          ))}
        </StaggerGroup>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 7 — AI PROVIDER TRANSPARENCY BANNER
   ================================================================== */
function AIProviderBanner() {
  const theme = useTheme();
  const items = [
    {
      icon: <PsychologyIcon />,
      label: "Floor Plans",
      value: "GPT-4o / Ollama",
    },
    { icon: <ImageIcon />, label: "Renders", value: "DALL-E 3 / Pollinations" },
    {
      icon: <VisibilityIcon />,
      label: "Shape Recognition",
      value: "Google Vision",
    },
  ];
  return (
    <Box
      component="section"
      sx={{
        py: { xs: 5, md: 6 },
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(135deg, rgba(76,175,80,0.08), rgba(0,229,255,0.06))"
            : "linear-gradient(135deg, rgba(46,125,50,0.06), rgba(0,188,212,0.05))",
        borderTop: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Container maxWidth="lg">
        <Reveal>
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 2,
              color: "accent.main",
              fontWeight: 700,
              display: "block",
              textAlign: "center",
              mb: 2,
            }}
          >
            AI STACK
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 2, md: 5 }}
            justifyContent="center"
            alignItems="center"
            divider={
              <Divider
                orientation="vertical"
                flexItem
                sx={{ display: { xs: "none", md: "block" } }}
              />
            }
          >
            {items.map((it) => (
              <Stack
                key={it.label}
                direction="row"
                spacing={1.5}
                alignItems="center"
              >
                <Box sx={{ color: "primary.main", display: "flex" }}>
                  {it.icon}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {it.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{it.value}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
          <Typography
            variant="body2"
            sx={{
              textAlign: "center",
              color: "text.secondary",
              mt: 3,
              maxWidth: 620,
              mx: "auto",
            }}
          >
            All AI providers are swappable via environment config. Your data
            never trains third-party models.
          </Typography>
        </Reveal>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 8 — FOR WHOM (Role Cards)
   ================================================================== */
function RoleCard({ r }) {
  const theme = useTheme();
  return (
    <StaggerItem sx={{ height: "100%" }}>
      <GlassCard
        sx={{
          height: "100%",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          transition: "transform .25s, box-shadow .25s, border-color .25s",
          "&:hover": {
            transform: "translateY(-6px)",
            borderColor: r.band,
            boxShadow: `0 0 30px ${r.band}66`,
          },
        }}
      >
        <Box sx={{ height: 6, background: r.band }} />
        <Box sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
          <Box sx={{ fontSize: "2.2rem", mb: 1.5 }}>{r.icon}</Box>
          <Typography sx={{ fontWeight: 700, fontSize: "1.12rem", mb: 1 }}>
            {r.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mb: 2.5, flex: 1 }}
          >
            {r.desc}
          </Typography>
          <Button
            component={RouterLink}
            to={r.to}
            endIcon={<ArrowForwardIcon />}
            sx={{ alignSelf: "flex-start", fontWeight: 700, color: r.band }}
          >
            {r.cta}
          </Button>
        </Box>
      </GlassCard>
    </StaggerItem>
  );
}

function RoleCards() {
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          overline="FOR EVERYONE"
          title="Built for Every Stakeholder"
        />
        <StaggerGroup
          stagger={0.08}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            gap: 3,
          }}
        >
          {ROLES.map((r) => (
            <RoleCard key={r.title} r={r} />
          ))}
        </StaggerGroup>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 9 — PRICING  (id="pricing")
   ================================================================== */
function PricingCard({ p, yearly }) {
  const theme = useTheme();
  const price = yearly ? Math.round(p.priceY / 12) : p.priceM;
  return (
    <StaggerItem sx={{ height: "100%" }}>
      <GlassCard
        sx={{
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          p: 3.4,
          ...(p.highlight && {
            border: `2px solid ${theme.palette.primary.main}`,
            boxShadow: theme.vastu.glowPrimary,
            transform: { md: "scale(1.05)" },
            zIndex: 2,
          }),
        }}
      >
        {p.highlight && (
          <Chip
            label="Most Popular"
            size="small"
            sx={{
              position: "absolute",
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              fontWeight: 700,
              color: "#fff",
              background: theme.palette.secondary.main,
              boxShadow: `0 4px 14px ${theme.palette.secondary.main}88`,
            }}
          />
        )}
        <Typography
          sx={{ fontWeight: 800, letterSpacing: 1, color: "text.secondary" }}
        >
          {p.tier}
        </Typography>
        <Stack
          direction="row"
          alignItems="baseline"
          spacing={0.5}
          sx={{ my: 1.5 }}
        >
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: "2.4rem",
            }}
          >
            ₹{price.toLocaleString("en-IN")}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            /month
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {p.blurb}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1.2} sx={{ flex: 1, mb: 3 }}>
          {p.points.map((pt) => (
            <Stack key={pt} direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ color: "primary.main", mt: "2px" }}>✓</Box>
              <Typography variant="body2">{pt}</Typography>
            </Stack>
          ))}
        </Stack>
        {p.highlight ? (
          <GlowButton to={p.to} sx={{ width: "100%" }}>
            {p.cta}
          </GlowButton>
        ) : (
          <Button
            component={RouterLink}
            to={p.to}
            variant="outlined"
            size="large"
            fullWidth
            sx={{ fontWeight: 700, borderWidth: 2 }}
          >
            {p.cta}
          </Button>
        )}
      </GlassCard>
    </StaggerItem>
  );
}

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <Box component="section" id="pricing" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          overline="PRICING"
          title="Transparent Pricing for Every Budget"
        />
        <Reveal sx={{ display: "flex", justifyContent: "center", mb: 5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: yearly ? 400 : 700 }}>
              Monthly
            </Typography>
            <Switch
              checked={yearly}
              onChange={(e) => setYearly(e.target.checked)}
              color="primary"
            />
            <Typography sx={{ fontWeight: yearly ? 700 : 400 }}>
              Yearly
            </Typography>
            <Chip
              label="20% off"
              size="small"
              sx={{
                ml: 0.5,
                fontWeight: 700,
                color: "secondary.main",
                border: (t) => `1px solid ${t.palette.secondary.main}`,
              }}
              variant="outlined"
            />
          </Stack>
        </Reveal>
        <StaggerGroup
          stagger={0.08}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              lg: "repeat(4, 1fr)",
            },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          {PRICING.map((p) => (
            <PricingCard key={p.tier} p={p} yearly={yearly} />
          ))}
        </StaggerGroup>
        <Typography
          variant="body2"
          sx={{ textAlign: "center", color: "text.secondary", mt: 4 }}
        >
          All plans include Razorpay-secured payments · Cancel anytime · Free
          plan never expires · 14-day refund policy
        </Typography>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 10 — TESTIMONIALS
   ================================================================== */
function initialsOf(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Testimonials() {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = TESTIMONIALS.length;
  const go = (n) => setIndex((n + count) % count);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [count, reduce]);

  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="md">
        <SectionHeading
          overline="LOVED ACROSS INDIA"
          title="What Homeowners Are Saying"
        />
        <Box sx={{ position: "relative", overflow: "hidden", borderRadius: 4 }}>
          <Box
            sx={{
              display: "flex",
              transition: reduce
                ? "none"
                : "transform .6s cubic-bezier(0.22,1,0.36,1)",
              transform: `translateX(-${index * 100}%)`,
            }}
          >
            {TESTIMONIALS.map((t, i) => (
              <Box key={i} sx={{ minWidth: "100%", px: { xs: 1, md: 4 } }}>
                <GlassCard
                  sx={{
                    p: { xs: 3, md: 5 },
                    textAlign: "center",
                    mx: "auto",
                    maxWidth: 620,
                  }}
                >
                  <Box
                    sx={{ color: "secondary.main", mb: 2, fontSize: "1.1rem" }}
                  >
                    ★★★★★
                  </Box>
                  <Typography
                    sx={{
                      fontSize: { xs: "1.1rem", md: "1.3rem" },
                      fontStyle: "italic",
                      mb: 3,
                      lineHeight: 1.6,
                    }}
                  >
                    “{t.quote}”
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Avatar
                      sx={{
                        background: theme.vastu.gradientBrand,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {initialsOf(t.name)}
                    </Avatar>
                    <Box sx={{ textAlign: "left" }}>
                      <Typography sx={{ fontWeight: 700 }}>{t.name}</Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {t.role}
                      </Typography>
                    </Box>
                  </Stack>
                </GlassCard>
              </Box>
            ))}
          </Box>
        </Box>

        {/* controls */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{ mt: 3 }}
        >
          <IconButton onClick={() => go(index - 1)} aria-label="previous">
            <ChevronLeftIcon />
          </IconButton>
          <Stack direction="row" spacing={1}>
            {TESTIMONIALS.map((_, i) => (
              <Box
                key={i}
                onClick={() => setIndex(i)}
                sx={{
                  width: i === index ? 22 : 9,
                  height: 9,
                  borderRadius: 9,
                  cursor: "pointer",
                  transition: "all .3s",
                  background:
                    i === index
                      ? theme.palette.primary.main
                      : theme.palette.divider,
                }}
              />
            ))}
          </Stack>
          <IconButton onClick={() => go(index + 1)} aria-label="next">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 11 — INDIA MAP COVERAGE
   ================================================================== */
function IndiaMap() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [hoveredState, setHoveredState] = useState("");

  const stats = [
    { icon: "🗺️", text: "28 States + 8 UTs covered" },
    { icon: "🏛️", text: "150+ City-level municipal rule sets" },
    { icon: "💰", text: "State-wise material cost datasets updated quarterly" },
    { icon: "☀️", text: "MNRE solar irradiance data for all zones" },
  ];

  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          overline="NATIONWIDE"
          title="Covering All of India"
          subtitle="Municipal rules, cost datasets, and FSI norms loaded for 28 states and 8 Union Territories"
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: { xs: 5, md: 8 },
            alignItems: "center",
          }}
        >
          {/* ── Map ── */}
          <Reveal>
            <Box
              sx={{
                width: "100%",
                maxWidth: 460,
                mx: "auto",
                borderRadius: 4,
                overflow: "hidden",
                background: dark
                  ? "rgba(76,175,80,0.04)"
                  : "rgba(46,125,50,0.03)",
                border: `1px solid ${theme.palette.divider}`,
                backdropFilter: "blur(8px)",
                p: 1,
              }}
            >
              {/* State name tooltip strip */}
              <Box
                sx={{
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: hoveredState ? "primary.main" : "text.disabled",
                    letterSpacing: 0.5,
                    transition: "color .2s",
                  }}
                >
                  {hoveredState || "Hover a state"}
                </Typography>
              </Box>

              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [83, 23], scale: 880 }}
                width={440}
                height={500}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <Geographies geography={INDIA_GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={() =>
                          setHoveredState(geo.properties.NAME_1 || "")
                        }
                        onMouseLeave={() => setHoveredState("")}
                        style={{
                          default: {
                            fill: dark
                              ? "rgba(76,175,80,0.22)"
                              : "rgba(46,125,50,0.14)",
                            stroke: theme.palette.primary.main,
                            strokeWidth: 0.6,
                            outline: "none",
                          },
                          hover: {
                            fill: theme.palette.primary.main,
                            fillOpacity: 0.65,
                            stroke: theme.palette.primary.main,
                            strokeWidth: 1,
                            outline: "none",
                            cursor: "pointer",
                          },
                          pressed: {
                            fill: theme.palette.primary.dark,
                            outline: "none",
                          },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {CITIES.map((city) => (
                  <Marker
                    key={city.name}
                    coordinates={[city.lng, city.lat]}
                  >
                    {/* pulse ring */}
                    <circle
                      r={9}
                      fill={theme.palette.accent.main}
                      opacity={0.18}
                    />
                    {/* dot */}
                    <circle
                      r={4}
                      fill={theme.palette.accent.main}
                      stroke={theme.palette.background.paper}
                      strokeWidth={1.5}
                    />
                    {/* city label */}
                    <text
                      textAnchor="middle"
                      y={-10}
                      style={{
                        fontSize: 7,
                        fontWeight: 700,
                        fill: dark ? "#E8EAF6" : "#1A1A2E",
                        pointerEvents: "none",
                      }}
                    >
                      {city.name}
                    </text>
                  </Marker>
                ))}
              </ComposableMap>
            </Box>
          </Reveal>

          {/* ── Stats ── */}
          <Stack spacing={2}>
            {stats.map((s, i) => (
              <Reveal key={s.text} delay={i * 0.08}>
                <GlassCard
                  sx={{
                    p: 2.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.8,
                    transition: "border-color .25s, box-shadow .25s",
                    "&:hover": {
                      borderColor: theme.palette.primary.main,
                      boxShadow: theme.vastu.glowPrimary,
                    },
                  }}
                >
                  <Box sx={{ fontSize: "1.5rem", flexShrink: 0 }}>{s.icon}</Box>
                  <Typography sx={{ fontWeight: 600 }}>{s.text}</Typography>
                </GlassCard>
              </Reveal>
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 12 — ARCHITECT MARKETPLACE PREVIEW  (id="marketplace")
   ================================================================== */
const SAMPLE_ARCHITECTS = [
  {
    name: "Ar. Meera Nair",
    city: "Kochi",
    specs: ["Residential", "Vastu"],
    rating: 4.9,
  },
  {
    name: "Ar. Vikram Rao",
    city: "Hyderabad",
    specs: ["Sustainable", "Modern"],
    rating: 4.8,
  },
  {
    name: "Ar. Sana Khan",
    city: "Mumbai",
    specs: ["Apartments", "Interiors"],
    rating: 5.0,
  },
];

function MarketplacePreview() {
  const theme = useTheme();
  return (
    <Box component="section" id="marketplace" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          overline="MARKETPLACE"
          title="Connect With Verified Architects"
          subtitle="Once your AI plan is complete, get it reviewed by a CoA-registered architect — without leaving VastuVerse"
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
            mb: 5,
          }}
        >
          <Reveal>
            <GlassCard sx={{ p: 3.4, height: "100%" }}>
              <Typography
                sx={{ fontWeight: 700, mb: 1, color: "primary.main" }}
              >
                🏠 For Homeowners
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Post a review request with your completed plan and budget.
                Receive bids from verified architects within 24 hours.
              </Typography>
            </GlassCard>
          </Reveal>
          <Reveal delay={0.1}>
            <GlassCard sx={{ p: 3.4, height: "100%" }}>
              <Typography sx={{ fontWeight: 700, mb: 1, color: "accent.main" }}>
                📐 For Architects
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Browse completed plans seeking review. Place bids, submit
                annotated reports, and receive Razorpay payouts.
              </Typography>
            </GlassCard>
          </Reveal>
        </Box>

        <StaggerGroup
          stagger={0.08}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: 3,
            mb: 5,
          }}
        >
          {SAMPLE_ARCHITECTS.map((a) => (
            <StaggerItem key={a.name}>
              <GlassCard sx={{ p: 3, position: "relative" }}>
                <Chip
                  label="Sample"
                  size="small"
                  sx={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    fontWeight: 600,
                  }}
                />
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ mb: 1.5 }}
                >
                  <Avatar
                    sx={{
                      background: theme.vastu.gradientBrand,
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {initialsOf(a.name.replace("Ar. ", ""))}
                  </Avatar>
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography sx={{ fontWeight: 700 }}>{a.name}</Typography>
                      <VerifiedIcon
                        sx={{ fontSize: 16, color: "accent.main" }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {a.city}
                    </Typography>
                  </Box>
                </Stack>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}
                >
                  {a.specs.map((s) => (
                    <Chip key={s} label={s} size="small" variant="outlined" />
                  ))}
                </Stack>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ mb: 1 }}
                >
                  <StarIcon sx={{ fontSize: 16, color: "secondary.main" }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {a.rating.toFixed(1)}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  ₹2,500–5,000 per review
                </Typography>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Box sx={{ textAlign: "center" }}>
          <GlowButton
            variant="outlined"
            to="/marketplace"
            endIcon={<ArrowForwardIcon />}
          >
            View Marketplace
          </GlowButton>
        </Box>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 13 — SECURITY & COMPLIANCE TRUST STRIP
   ================================================================== */
function SecurityStrip() {
  const theme = useTheme();
  const badges = [
    {
      icon: <VpnKeyIcon />,
      title: "JWT + Refresh Auth",
      desc: "Secure token-based sessions",
    },
    {
      icon: <SecurityIcon />,
      title: "HMAC-Verified Payments",
      desc: "Every webhook signature checked",
    },
    {
      icon: <AccountBalanceIcon />,
      title: "Razorpay Escrow",
      desc: "Funds held until review done",
    },
    {
      icon: <GavelIcon />,
      title: "NBC 2016 Compliant",
      desc: "National Building Code aligned",
    },
    {
      icon: <LockIcon />,
      title: "bcrypt Hashing",
      desc: "Passwords never stored raw",
    },
    {
      icon: <HttpsIcon />,
      title: "SSL / HTTPS Enforced",
      desc: "Encrypted end to end",
    },
  ];
  return (
    <Box
      component="section"
      sx={{ background: theme.vastu.darkStrip, py: { xs: 6, md: 8 } }}
    >
      <Container maxWidth="lg">
        <StaggerGroup
          stagger={0.06}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr 1fr",
              md: "repeat(3, 1fr)",
              lg: "repeat(6, 1fr)",
            },
            gap: 2.5,
          }}
        >
          {badges.map((b) => (
            <StaggerItem key={b.title}>
              <Stack
                spacing={1}
                sx={{ textAlign: { xs: "center", lg: "left" } }}
              >
                <Box
                  sx={{
                    color: theme.palette.accent.main,
                    display: "flex",
                    justifyContent: { xs: "center", lg: "flex-start" },
                  }}
                >
                  {b.icon}
                </Box>
                <Typography
                  sx={{
                    color: "#E8EAF6",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  {b.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(232,234,246,0.6)" }}
                >
                  {b.desc}
                </Typography>
              </Stack>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 14 — FAQ
   ================================================================== */
function FAQ() {
  const theme = useTheme();
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="md">
        <SectionHeading
          overline="QUESTIONS"
          title="Frequently Asked Questions"
        />
        <StaggerGroup stagger={0.05}>
          {FAQS.map((f, i) => (
            <StaggerItem key={i}>
              <Accordion
                disableGutters
                elevation={0}
                sx={{
                  mb: 1.5,
                  background: theme.vastu.cardBg,
                  border: theme.vastu.cardBorder,
                  backdropFilter: theme.vastu.cardBlur,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 600 }}>{f.q}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {f.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 15 — FINAL CTA
   ================================================================== */
function FinalCTA({ onOpenDemo }) {
  const theme = useTheme();
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        py: { xs: 10, md: 14 },
        overflow: "hidden",
        background: theme.vastu.darkStrip,
      }}
    >
      {/* rotating conic gradient backdrop */}
      <Box
        sx={{
          position: "absolute",
          inset: "-50%",
          background: `conic-gradient(from 0deg, ${theme.palette.primary.main}, ${theme.palette.accent.main}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
          opacity: 0.18,
          filter: "blur(60px)",
          animation: `${conicSpin} 8s linear infinite`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
      <Container
        maxWidth="md"
        sx={{ position: "relative", zIndex: 1, textAlign: "center" }}
      >
        <Reveal>
          <Typography
            variant="h2"
            sx={{
              color: "#fff",
              fontSize: { xs: "2.2rem", md: "3.2rem" },
              mb: 2,
            }}
          >
            Your Dream Home is One Plan Away
          </Typography>
          <Typography
            sx={{ color: "rgba(232,234,246,0.8)", fontSize: "1.15rem", mb: 4 }}
          >
            Join 12,000+ Indian homeowners who designed smarter with AI.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
          >
            <GlowButton
              to="/login"
              sx={{ px: 4, py: 1.4, fontSize: "1.05rem" }}
            >
              Start Planning Free
            </GlowButton>
            <Button
              onClick={onOpenDemo}
              variant="outlined"
              size="large"
              sx={{
                color: "#fff",
                borderColor: "rgba(255,255,255,0.6)",
                borderWidth: 2,
                fontWeight: 700,
                "&:hover": { borderColor: "#fff", borderWidth: 2 },
              }}
            >
              Book a Demo
            </Button>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1, sm: 3 }}
            justifyContent="center"
            sx={{ mt: 4, color: "rgba(232,234,246,0.7)" }}
          >
            <Typography variant="body2">✅ No credit card required</Typography>
            <Typography variant="body2">✅ Free plan never expires</Typography>
            <Typography variant="body2">✅ Cancel anytime</Typography>
          </Stack>
        </Reveal>
      </Container>
    </Box>
  );
}

/* ==================================================================
   SECTION 16 — FOOTER
   ================================================================== */
function Footer({ onOpenCookieSettings }) {
  const theme = useTheme();
  const cols = [
    {
      head: "Product",
      links: [
        "Features",
        "Pricing",
        "How It Works",
        "3D View",
        "Marketplace",
        "Mobile App (coming soon)",
      ],
    },
    {
      head: "Company",
      links: ["About Us", "Blog", "Careers", "Press", "Contact"],
    },
    {
      head: "Legal",
      links: [
        "Privacy Policy",
        "Terms of Service",
        "Refund Policy",
        "NBC Disclaimer",
        "Cookie Settings",
      ],
    },
  ];
  return (
    <Box
      component="footer"
      sx={{ background: theme.vastu.darkStrip, color: "#E8EAF6", pt: 8, pb: 4 }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr 1fr 1fr" },
            gap: 5,
          }}
        >
          {/* brand col */}
          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <MandalaLogo size={32} />
              <Typography
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  color: "#fff",
                }}
              >
                VastuVerse
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: "rgba(232,234,246,0.6)", mb: 2.5, maxWidth: 260 }}
            >
              AI-powered house planning for Bharat — Vastu wisdom meets modern
              design.
            </Typography>
            <Stack direction="row" spacing={1}>
              {SOCIALS.map((s) => (
                <IconButton
                  key={s.label}
                  size="small"
                  aria-label={s.label}
                  sx={{
                    color: "rgba(232,234,246,0.7)",
                    transition: "color .2s, transform .2s",
                    "&:hover": {
                      color: s.color,
                      transform: "translateY(-3px)",
                    },
                  }}
                >
                  {s.icon}
                </IconButton>
              ))}
            </Stack>
          </Box>

          {cols.map((col) => (
            <Box key={col.head}>
              <Typography sx={{ fontWeight: 700, color: "#fff", mb: 2 }}>
                {col.head}
              </Typography>
              <Stack spacing={1.2}>
                {col.links.map((l) => (
                  <MuiLink
                    key={l}
                    component="button"
                    type="button"
                    onClick={
                      l === "Cookie Settings" ? onOpenCookieSettings : undefined
                    }
                    underline="none"
                    sx={{
                      color: "rgba(232,234,246,0.65)",
                      fontSize: "0.92rem",
                      textAlign: "left",
                      transition: "color .2s",
                      "&:hover": { color: theme.palette.accent.main },
                    }}
                  >
                    {l}
                  </MuiLink>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 4, borderColor: "rgba(232,234,246,0.12)" }} />

        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Typography
            variant="body2"
            sx={{
              color: "rgba(232,234,246,0.55)",
              textAlign: { xs: "center", md: "left" },
            }}
          >
            © 2025 VastuVerse Technologies Pvt. Ltd. · Made with ❤️ for Bharat ·
            CIN: UXXXXXXMH2025PTC000000 (placeholder)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <LanguageSelector />
            <ThemeToggleButton />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

/* ==================================================================
   COOKIE CONSENT BANNER
   ================================================================== */
const COOKIE_KEY = "vastuverse-cookie-consent";

function CookieConsent({ openSettings, setOpenSettings }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const decided = window.localStorage.getItem(COOKIE_KEY);
      if (!decided) setVisible(true);
    } catch (_) {
      setVisible(true);
    }
  }, []);

  const decide = (decision) => {
    try {
      window.localStorage.setItem(
        COOKIE_KEY,
        JSON.stringify({ decision, analytics, marketing, ts: Date.now() }),
      );
    } catch (_) {}
    setVisible(false);
    setOpenSettings(false);
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <MotionBox
            initial={reduce ? false : { y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 120, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            sx={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1400,
              p: { xs: 1.5, md: 2 },
            }}
          >
            <GlassCard
              sx={{
                maxWidth: 1100,
                mx: "auto",
                p: { xs: 2, md: 2.5 },
                background:
                  theme.palette.mode === "dark"
                    ? "rgba(17,24,39,0.92)"
                    : "rgba(255,255,255,0.96)",
                backdropFilter: "blur(20px)",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ md: "center" }}
                spacing={2}
                justifyContent="space-between"
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  We use cookies to improve your experience. We never sell your
                  data.
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ flexShrink: 0 }}
                >
                  <Button
                    onClick={() => setOpenSettings(true)}
                    sx={{ fontWeight: 600 }}
                  >
                    Manage
                  </Button>
                  <Button
                    onClick={() => decide("reject")}
                    sx={{ fontWeight: 600 }}
                  >
                    Reject Non-Essential
                  </Button>
                  <Button
                    onClick={() => decide("accept")}
                    variant="contained"
                    color="primary"
                    sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
                  >
                    Accept All
                  </Button>
                </Stack>
              </Stack>
            </GlassCard>
          </MotionBox>
        )}
      </AnimatePresence>

      {/* Manage dialog */}
      <Dialog
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700 }}
        >
          Cookie Settings
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Choose which cookies VastuVerse may use. Essential cookies are
            always on.
          </DialogContentText>
          <FormControlLabel
            control={<Switch checked disabled />}
            label="Essential (required)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
            }
            label="Analytics"
            sx={{ display: "block" }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
            }
            label="Marketing"
            sx={{ display: "block" }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => decide("reject")}>Reject Non-Essential</Button>
          <Button onClick={() => decide("custom")} variant="contained">
            Save Preferences
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ==================================================================
   SCROLL-TO-TOP BUTTON
   ================================================================== */
function ScrollToTop() {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <MotionBox
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduce ? undefined : { scale: 0, opacity: 0 }}
          sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 1300 }}
        >
          <IconButton
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="scroll to top"
            sx={{
              background: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              boxShadow: theme.vastu.glowPrimary,
              "&:hover": {
                background: theme.palette.primary.main,
                transform: "translateY(-2px)",
              },
            }}
          >
            <KeyboardArrowUpIcon />
          </IconButton>
        </MotionBox>
      )}
    </AnimatePresence>
  );
}

/* ==================================================================
   WATCH DEMO DIALOG
   ================================================================== */
function DemoDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
        }}
      >
        VastuVerse Demo
        <IconButton onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ position: "relative", pt: "56.25%" }}>
          {open && (
            <Box
              component="iframe"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="VastuVerse demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

/* ==================================================================
   PAGE COMPOSITION
   ================================================================== */
export default function HomePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [demoOpen, setDemoOpen] = useState(false);
  const [cookieSettings, setCookieSettings] = useState(false);

  return (
    <Box
      sx={{
        background: "background.default",
        color: "text.primary",
        overflowX: "hidden",
      }}
    >
      <Navbar onOpenDemo={() => setDemoOpen(true)} />
      <Hero onOpenDemo={() => setDemoOpen(true)} isMobile={isMobile} />
      <StatsTicker />
      <VastuSection />
      <HowItWorks />
      <Features />
      <AIProviderBanner />
      <RoleCards />
      <Pricing />
      <Testimonials />
      <IndiaMap />
      <MarketplacePreview />
      <SecurityStrip />
      <FAQ />
      <FinalCTA onOpenDemo={() => setDemoOpen(true)} />
      <Footer onOpenCookieSettings={() => setCookieSettings(true)} />

      <ScrollToTop />
      <CookieConsent
        openSettings={cookieSettings}
        setOpenSettings={setCookieSettings}
      />
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </Box>
  );
}
