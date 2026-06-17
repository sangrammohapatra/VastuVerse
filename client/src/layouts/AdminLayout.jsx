import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Drawer,
  useMediaQuery,
  Avatar,
  Tooltip,
  Button,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";

import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import StorefrontIcon from "@mui/icons-material/Storefront";
import MemoryIcon from "@mui/icons-material/Memory";
import ArticleIcon from "@mui/icons-material/Article";
import FlagIcon from "@mui/icons-material/Flag";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import MenuIcon from "@mui/icons-material/Menu";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "", Icon: DashboardIcon, label: "Dashboard" },
  { path: "users", Icon: PeopleIcon, label: "Users" },
  { path: "plans", Icon: HomeWorkIcon, label: "Plans" },
  { path: "subscriptions", Icon: CreditCardIcon, label: "Subscriptions" },
  { path: "marketplace", Icon: StorefrontIcon, label: "Marketplace" },
  { path: "ai-monitoring", Icon: MemoryIcon, label: "AI Monitoring" },
  { path: "content", Icon: ArticleIcon, label: "Content" },
  { path: "feature-flags", Icon: FlagIcon, label: "Feature Flags" },
  { path: "audit-logs",      Icon: ManageHistoryIcon, label: "Audit Logs" },
  { path: "storage-settings", Icon: CloudUploadIcon,   label: "Storage" },
];

const DRAWER_WIDTH = 240;

export default function AdminLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const activePath = useMemo(() => {
    const m = location.pathname.match(/^\/admin\/?(.*)$/);
    return m ? (m[1] || "").split("/")[0] : "";
  }, [location.pathname]);

  const displayName =
    user?.fullName || user?.name || user?.email?.split("@")[0] || "Admin";
  const avatarLetter = displayName[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const sidebarContent = (
    <Stack
      sx={{
        width: DRAWER_WIDTH,
        height: "100%",
        background: theme.palette.mode === "dark" ? "#0A0E1A" : "#0F1B14",
        color: "#E0E0E0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Brand row */}
      <Stack
        direction="row"
        spacing={1.2}
        alignItems="center"
        sx={{ p: 2.4, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
            boxShadow: theme.vastu.glowPrimary,
          }}
        >
          <AdminPanelSettingsIcon sx={{ color: "#fff" }} />
        </Box>
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "0.95rem",
              letterSpacing: 0.4,
              color: "#fff",
            }}
          >
            VastuVerse
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.6)", letterSpacing: 0.7 }}
          >
            ADMIN CONSOLE
          </Typography>
        </Box>
      </Stack>

      {/* Nav items */}
      <Box sx={{ flex: 1, position: "relative", py: 1.5, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const active = activePath === item.path;
          return (
            <NavLink
              key={item.path || "dashboard"}
              to={item.path}
              end={item.path === ""}
              onClick={() => setMobileOpen(false)}
              style={{ textDecoration: "none", display: "block" }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.4}
                sx={{
                  position: "relative",
                  px: 2.4,
                  py: 1.3,
                  cursor: "pointer",
                  color: active ? "#fff" : "rgba(255,255,255,0.65)",
                  transition: "color .2s, background .2s",
                  "&:hover": {
                    color: "#fff",
                    background: "rgba(255,255,255,0.04)",
                  },
                }}
              >
                {active && (
                  <motion.div
                    layoutId="admin-active-indicator"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 3,
                      background: `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                      borderRadius: "0 4px 4px 0",
                      boxShadow: `0 0 12px ${theme.palette.primary.main}`,
                    }}
                  />
                )}
                {active && (
                  <motion.div
                    layoutId="admin-active-bg"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}24, transparent)`,
                      pointerEvents: "none",
                    }}
                  />
                )}
                <item.Icon
                  sx={{ fontSize: 20, position: "relative", zIndex: 1 }}
                />
                <Typography
                  sx={{
                    fontSize: "0.88rem",
                    fontWeight: active ? 700 : 500,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {item.label}
                </Typography>
              </Stack>
            </NavLink>
          );
        })}
      </Box>

      {/* Footer: profile + actions */}
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.08)", p: 2 }}>
        {/* My Profile button */}
        <Button
          fullWidth
          size="small"
          startIcon={<AccountCircleIcon fontSize="small" />}
          onClick={() => {
            navigate("/profile");
            setMobileOpen(false);
          }}
          sx={{
            justifyContent: "flex-start",
            color: "rgba(255,255,255,0.55)",
            textTransform: "none",
            fontSize: "0.82rem",
            px: 1,
            "&:hover": { color: "#fff", background: "rgba(255,255,255,0.06)" },
          }}
        >
          My Profile
        </Button>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 1 }} />
        {/* User row */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <Avatar
            src={user?.avatarUrl}
            sx={{
              width: 34,
              height: 34,
              bgcolor: theme.palette.primary.main,
              fontSize: "0.82rem",
              flexShrink: 0,
            }}
          >
            {avatarLetter}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "0.82rem",
                color: "#fff",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "0.7rem",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email || ""}
            </Typography>
          </Box>
          <Tooltip title="Logout" placement="top">
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                color: "rgba(255,255,255,0.5)",
                flexShrink: 0,
                "&:hover": {
                  color: "#fff",
                  background: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Typography
          variant="caption"
          sx={{
            color: "rgba(255,255,255,0.3)",
            display: "block",
            mt: 1,
            pl: 0.5,
          }}
        >
          v1.0 · {new Date().getFullYear()}
        </Typography>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop: persistent sidebar */}
      {isDesktop ? (
        <Box
          component="aside"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            height: "100vh",
            borderRight: `1px solid ${theme.palette.divider}`,
          }}
        >
          {sidebarContent}
        </Box>
      ) : (
        <>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{
              position: "fixed",
              top: 12,
              left: 12,
              zIndex: 1200,
              background: theme.palette.background.paper,
              boxShadow: 1,
              "&:hover": { background: theme.palette.background.paper },
            }}
          >
            <MenuIcon />
          </IconButton>
          <Drawer
            anchor="left"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            PaperProps={{ sx: { width: DRAWER_WIDTH, border: "none" } }}
          >
            {sidebarContent}
          </Drawer>
        </>
      )}

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
