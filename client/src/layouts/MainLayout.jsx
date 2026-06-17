import { useState } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  Link as RouterLink,
} from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Stack,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Tooltip,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

import NotificationBell from "../components/NotificationBell";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LayersIcon from "@mui/icons-material/Layers";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import GroupsIcon from "@mui/icons-material/Groups";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import PaymentsIcon from "@mui/icons-material/Payments";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";

import Logo from "../common/Logo";
import { useThemeMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

/* ----- Nav configuration ------------------------------------------------ */

const NAV_BY_ROLE = {
  homeowner: [
    { label: "Dashboard", to: "/dashboard", icon: <DashboardIcon /> },
    { label: "My Plans", to: "/plans", icon: <LayersIcon /> },
    { label: "New Plan", to: "/plans/new", icon: <AddCircleOutlineIcon /> },
    { label: "Marketplace", to: "/marketplace", icon: <StorefrontIcon /> },
    { label: "Profile", to: "/profile", icon: <PersonOutlineIcon /> },
  ],
  developer: [
    { label: "Dashboard", to: "/dashboard", icon: <DashboardIcon /> },
    { label: "Projects", to: "/plans", icon: <LayersIcon /> },
    { label: "Team", to: "/profile", icon: <GroupsIcon /> },
    { label: "Marketplace", to: "/marketplace", icon: <StorefrontIcon /> },
    { label: "Profile", to: "/profile", icon: <PersonOutlineIcon /> },
  ],
  architect: [
    { label: "Dashboard", to: "/dashboard", icon: <DashboardIcon /> },
    {
      label: "Bid Requests",
      to: "/architect",
      icon: <AssignmentTurnedInIcon />,
    },
    { label: "Earnings", to: "/architect", icon: <PaymentsIcon /> },
    { label: "Profile", to: "/profile", icon: <PersonOutlineIcon /> },
  ],
  admin: [
    { label: "Admin Home", to: "/admin", icon: <AdminPanelSettingsIcon /> },
    { label: "Users", to: "/admin/users", icon: <GroupsIcon /> },
    { label: "Profile", to: "/profile", icon: <PersonOutlineIcon /> },
  ],
};

const TOP_NAV_BY_ROLE = {
  homeowner: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Plans", to: "/plans" },
    { label: "Marketplace", to: "/marketplace" },
  ],
  developer: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Projects", to: "/plans" },
    { label: "Marketplace", to: "/marketplace" },
  ],
  architect: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Marketplace", to: "/architect" },
  ],
  admin: [{ label: "Admin", to: "/admin" }],
};

const BOTTOM_NAV = [
  { label: "Dashboard", to: "/dashboard", icon: <DashboardIcon /> },
  { label: "Plans", to: "/plans", icon: <LayersIcon /> },
  { label: "Marketplace", to: "/marketplace", icon: <StorefrontIcon /> },
  { label: "Profile", to: "/profile", icon: <PersonOutlineIcon /> },
];

/* ----- Small chrome components ----------------------------------------- */

function ThemeToggle() {
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
            initial={reduce ? false : { rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={reduce ? undefined : { rotate: 180, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ display: "inline-flex" }}
          >
            {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
          </motion.span>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
}

function AvatarMenu() {
  const [anchor, setAnchor] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const seed = user?.fullName || user?.userId || "User";
  const initials = seed.slice(0, 2).toUpperCase();

  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Account">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label="account"
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              background: theme.vastu.gradientBrand,
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {initials}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
          <Typography sx={{ fontWeight: 600 }}>
            {user?.fullName || "USER"}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.70rem" }}>
            Signed in as
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>
            {user?.role?.toUpperCase() || "USER"}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            close();
            navigate("/profile");
          }}
        >
          <PersonOutlineIcon fontSize="small" sx={{ mr: 1.2 }} /> Profile
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            close();
            await logout();
            navigate("/", { replace: true });
          }}
        >
          <LogoutIcon fontSize="small" sx={{ mr: 1.2 }} /> Log out
        </MenuItem>
      </Menu>
    </>
  );
}

/* ----- Layout ---------------------------------------------------------- */

export default function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = user?.role || "homeowner";
  const topNav = TOP_NAV_BY_ROLE[role] || [];
  const drawerNav = NAV_BY_ROLE[role] || [];

  // Active-section detection — uses startsWith so /plans/new highlights "Plans".
  const isActive = (to) => {
    if (to === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname === to || location.pathname.startsWith(to + "/");
  };

  const bottomIdx = BOTTOM_NAV.findIndex((n) => isActive(n.to));

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background:
            theme.palette.mode === "dark"
              ? "rgba(10,14,26,0.72)"
              : "rgba(255,255,255,0.72)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => setDrawerOpen(true)}
            aria-label="open menu"
          >
            <MenuIcon />
          </IconButton>

          <Stack
            direction="row"
            alignItems="center"
            spacing={1.2}
            component={RouterLink}
            to="/"
            sx={{ textDecoration: "none", color: "inherit" }}
          >
            <Logo size={32} />
            {!isMobile && (
              <Typography
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: 700,
                  fontSize: "1.2rem",
                }}
              >
                Vastu
                <Box component="span" sx={{ color: "info.main" }}>
                  Verse
                </Box>
              </Typography>
            )}
          </Stack>

          {!isMobile && (
            <Stack direction="row" spacing={0.5} sx={{ ml: 3, flex: 1 }}>
              {topNav.map((n) => {
                const active = isActive(n.to);
                return (
                  <Button
                    key={n.label + n.to}
                    component={RouterLink}
                    to={n.to}
                    color="inherit"
                    sx={{
                      position: "relative",
                      fontWeight: 600,
                      color: active ? "info.main" : "text.primary",
                      "&::after": {
                        content: '""',
                        display: "block",
                        position: "absolute",
                        bottom: 6,
                        left: 12,
                        right: 12,
                        height: 2,
                        borderRadius: 2,
                        background: theme.palette.info.main,
                        transform: active ? "scaleX(1)" : "scaleX(0)",
                        transformOrigin: "left",
                        transition: "transform .22s ease",
                      },
                      "&:hover::after": { transform: "scaleX(1)" },
                    }}
                  >
                    {n.label}
                  </Button>
                );
              })}
            </Stack>
          )}
          {isMobile && <Box sx={{ flex: 1 }} />}

          <Stack direction="row" spacing={0.25} alignItems="center">
            <NotificationBell />
            <ThemeToggle />
            <AvatarMenu />
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Drawer (collapsible role-filtered nav) */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            background: theme.palette.background.paper,
            backgroundImage: "none",
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Logo size={32} />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: "1.2rem",
              }}
            >
              VastuVerse
            </Typography>
          </Stack>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            aria-label="close menu"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            {role}
          </Typography>
        </Box>
        <Divider />
        <List>
          {drawerNav.map((n) => {
            const active = isActive(n.to);
            return (
              <ListItem key={n.label + n.to} disablePadding>
                <ListItemButton
                  selected={active}
                  onClick={() => {
                    navigate(n.to);
                    setDrawerOpen(false);
                  }}
                  sx={{
                    "&.Mui-selected": {
                      background:
                        theme.palette.mode === "dark"
                          ? "rgba(0,229,255,0.12)"
                          : "rgba(0,188,212,0.10)",
                      borderRight: `3px solid ${theme.palette.info.main}`,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: active ? "info.main" : "text.primary",
                      minWidth: 40,
                    }}
                  >
                    {n.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={n.label}
                    primaryTypographyProps={{ fontWeight: active ? 700 : 500 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      {/* Main content — animated page transitions */}
      <Box component="main" sx={{ flex: 1, pb: isMobile ? 9 : 4 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <BottomNavigation
          showLabels
          value={bottomIdx === -1 ? false : bottomIdx}
          onChange={(_e, val) => {
            const dest = BOTTOM_NAV[val];
            if (dest) navigate(dest.to);
          }}
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            borderTop: `1px solid ${theme.palette.divider}`,
            background: theme.palette.background.paper,
          }}
        >
          {BOTTOM_NAV.map((n) => (
            <BottomNavigationAction key={n.to} label={n.label} icon={n.icon} />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
