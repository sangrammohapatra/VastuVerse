import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";

import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TuneIcon from "@mui/icons-material/Tune";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import SaveIcon from "@mui/icons-material/Save";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { api } from "../utils/axiosInstance";
import { useAuth } from "../context/AuthContext";
import { LANGUAGES } from "../i18n/i18n";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/* ── Tier meta ─────────────────────────────────────────────────────── */
const TIER_META = {
  FREE: { label: "Free", color: "default" },
  BASIC: { label: "Basic", color: "primary" },
  PRO: { label: "Pro", color: "info" },
  ENTERPRISE: { label: "Enterprise", color: "warning" },
};

const ROLE_LABEL = {
  homeowner: "Homeowner",
  developer: "Developer",
  architect: "Architect",
  admin: "Admin",
};

/* ── Avatar with initials fallback ─────────────────────────────────── */
function UserAvatar({ user, size = 80 }) {
  const theme = useTheme();
  const initials = (user?.fullName || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Avatar
      src={user?.avatarUrl || undefined}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        fontWeight: 700,
        background: theme.vastu.gradientBrand,
        color: "#fff",
      }}
    >
      {initials}
    </Avatar>
  );
}

/* ── Tab panel wrapper ─────────────────────────────────────────────── */
function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

/* ── Section heading ───────────────────────────────────────────────── */
function SectionTitle({ children }) {
  return (
    <Typography
      variant="caption"
      sx={{
        color: "text.secondary",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontWeight: 700,
        display: "block",
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  /* ── editable fields ── */
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPincode, setAddrPincode] = useState("");
  const [addrCountry, setAddrCountry] = useState("India");
  const [language, setLanguage] = useState("en");
  const [notifEmailActivity, setNotifEmailActivity] = useState(true);
  const [notifEmailMarketing, setNotifEmailMarketing] = useState(false);
  const [notifPushActivity, setNotifPushActivity] = useState(true);

  /* ── fetch profile ── */
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data } = await api.get("/users/me");
      const u = data.user;
      setProfile(u);
      setFullName(u.fullName || "");
      setPhone(u.phone || "");
      setGender(u.gender || "");
      setDateOfBirth(u.dateOfBirth ? u.dateOfBirth.slice(0, 10) : "");
      setAddrLine1(u.address?.line1 || "");
      setAddrLine2(u.address?.line2 || "");
      setAddrCity(u.address?.city || "");
      setAddrState(u.address?.state || "");
      setAddrPincode(u.address?.pincode || "");
      setAddrCountry(u.address?.country || "India");
      setLanguage(u.preferredLanguage || "en");
      setNotifEmailActivity(u.notificationPreferences?.emailActivity ?? true);
      setNotifEmailMarketing(
        u.notificationPreferences?.emailMarketing ?? false,
      );
      setNotifPushActivity(u.notificationPreferences?.pushActivity ?? true);
    } catch {
      setFetchError("Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /* ── save ── */
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const { data } = await api.put("/users/me", {
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        address: {
          line1: addrLine1.trim(),
          line2: addrLine2.trim(),
          city: addrCity.trim(),
          state: addrState,
          pincode: addrPincode.trim(),
          country: addrCountry.trim() || "India",
        },
        preferredLanguage: language,
        notificationPreferences: {
          emailActivity: notifEmailActivity,
          emailMarketing: notifEmailMarketing,
          pushActivity: notifPushActivity,
        },
      });
      setProfile(data.user);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(
        e.response?.data?.error === "nothing_to_update"
          ? "Nothing changed."
          : "Save failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete("/users/me", { data: { email: deleteEmail.trim() } });
      await logout();
      navigate("/", { replace: true });
    } catch (e) {
      const code = e.response?.data?.error;
      if (code === "email_mismatch") {
        setDeleteError("Email does not match your account. Please try again.");
      } else if (code === "cannot_delete_last_admin") {
        setDeleteError(
          "You are the only admin. Promote another admin before deleting this account.",
        );
      } else {
        setDeleteError("Failed to delete account. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  /* ── render states ── */
  if (loading) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fetchError) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert
          severity="error"
          action={
            <Button size="small" onClick={fetchProfile}>
              Retry
            </Button>
          }
        >
          {fetchError}
        </Alert>
      </Container>
    );
  }

  const tier = profile?.subscriptionTier || "FREE";
  const tierMeta = TIER_META[tier] || TIER_META.FREE;
  const role = profile?.role || authUser?.role || "homeowner";
  const joinedYear = profile?.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : null;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      {/* ── Profile header ── */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          p: { xs: 3, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          alignItems={{ xs: "center", sm: "flex-start" }}
        >
          <UserAvatar user={profile} size={80} />
          <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: "1.5rem",
              }}
            >
              {profile?.fullName || profile?.email || "Your Profile"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
              {profile?.email}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              justifyContent={{ xs: "center", sm: "flex-start" }}
            >
              <Chip
                label={ROLE_LABEL[role] || role}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                icon={
                  <WorkspacePremiumIcon
                    sx={{ fontSize: "0.9rem !important" }}
                  />
                }
                label={tierMeta.label}
                size="small"
                color={tierMeta.color}
                sx={{ fontWeight: 700 }}
              />
              {joinedYear && (
                <Chip
                  label={`Joined ${joinedYear}`}
                  size="small"
                  variant="outlined"
                  sx={{ color: "text.secondary" }}
                />
              )}
            </Stack>
          </Box>
        </Stack>
      </Card>

      {/* ── Save feedback ── */}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Changes saved.
        </Alert>
      )}
      {saveError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSaveError(null)}
        >
          {saveError}
        </Alert>
      )}

      {/* ── Tabs ── */}
      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          <Tab
            icon={<PersonOutlineIcon />}
            iconPosition="start"
            label="Profile"
            sx={{ fontWeight: 600, minHeight: 52 }}
          />
          <Tab
            icon={<HomeOutlinedIcon />}
            iconPosition="start"
            label="Address"
            sx={{ fontWeight: 600, minHeight: 52 }}
          />
          <Tab
            icon={<TuneIcon />}
            iconPosition="start"
            label="Preferences"
            sx={{ fontWeight: 600, minHeight: 52 }}
          />
          <Tab
            icon={<WorkspacePremiumIcon />}
            iconPosition="start"
            label="Account"
            sx={{ fontWeight: 600, minHeight: 52 }}
          />
        </Tabs>

        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          {/* ══ Tab 0: Profile ══ */}
          <TabPanel value={tab} index={0}>
            <SectionTitle>Personal information</SectionTitle>
            <Stack spacing={2.5}>
              <TextField
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                inputProps={{ maxLength: 120 }}
                fullWidth
                placeholder="Your display name"
              />
              <TextField
                label="Email address"
                value={profile?.email || ""}
                fullWidth
                disabled
                helperText="Email cannot be changed — it's your login identifier."
              />
              <TextField
                label="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputProps={{ maxLength: 20 }}
                fullWidth
                placeholder="+91 98765 43210"
                helperText="Used for WhatsApp OTP fallback (optional)."
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  displayEmpty
                  fullWidth
                  renderValue={(v) =>
                    v ? (
                      GENDER_OPTIONS.find((g) => g.value === v)?.label
                    ) : (
                      <Typography sx={{ color: "text.disabled" }}>
                        Gender (optional)
                      </Typography>
                    )
                  }
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {GENDER_OPTIONS.map((g) => (
                    <MenuItem key={g.value} value={g.value}>
                      {g.label}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  label="Date of birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: new Date().toISOString().slice(0, 10) }}
                />
              </Stack>
            </Stack>
          </TabPanel>

          {/* ══ Tab 1: Address ══ */}
          <TabPanel value={tab} index={1}>
            <SectionTitle>Postal address</SectionTitle>
            <Stack spacing={2.5}>
              <TextField
                label="Address line 1"
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
                inputProps={{ maxLength: 200 }}
                fullWidth
                placeholder="House / flat no., street name"
              />
              <TextField
                label="Address line 2"
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
                inputProps={{ maxLength: 200 }}
                fullWidth
                placeholder="Locality, landmark (optional)"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="City"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  inputProps={{ maxLength: 100 }}
                  fullWidth
                />
                <Select
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  displayEmpty
                  fullWidth
                  renderValue={(v) =>
                    v || (
                      <Typography sx={{ color: "text.disabled" }}>
                        State
                      </Typography>
                    )
                  }
                >
                  <MenuItem value="">
                    <em>Select state</em>
                  </MenuItem>
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="PIN code"
                  value={addrPincode}
                  onChange={(e) =>
                    setAddrPincode(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  inputProps={{ maxLength: 6, inputMode: "numeric" }}
                  fullWidth
                  placeholder="6-digit PIN"
                />
                <TextField
                  label="Country"
                  value={addrCountry}
                  onChange={(e) => setAddrCountry(e.target.value)}
                  inputProps={{ maxLength: 100 }}
                  fullWidth
                />
              </Stack>
            </Stack>
          </TabPanel>

          {/* ══ Tab 2: Preferences ══ */}
          <TabPanel value={tab} index={2}>
            <SectionTitle>Language</SectionTitle>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              fullWidth
              sx={{ mb: 3 }}
            >
              {LANGUAGES.map((l) => (
                <MenuItem key={l.code} value={l.code}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <span style={{ fontSize: "1.2rem" }}>{l.flag}</span>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {l.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {l.nativeName}
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              ))}
            </Select>

            <Divider sx={{ my: 2 }} />
            <SectionTitle>Notifications</SectionTitle>
            <Stack spacing={0.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifEmailActivity}
                    onChange={(e) => setNotifEmailActivity(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Activity emails
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      Plan updates, collaborator activity, job completions.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", py: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notifEmailMarketing}
                    onChange={(e) => setNotifEmailMarketing(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Product & tips emails
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      New features, Vastu guides, and occasional offers.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", py: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notifPushActivity}
                    onChange={(e) => setNotifPushActivity(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Browser notifications
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      Real-time alerts for AI generation results and bids.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", py: 1 }}
              />
            </Stack>
          </TabPanel>

          {/* ══ Tab 3: Account ══ */}
          <TabPanel value={tab} index={3}>
            <SectionTitle>Subscription</SectionTitle>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={2}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: (t) => `1px solid ${t.palette.divider}`,
                mb: 3,
              }}
            >
              <Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 0.5 }}
                >
                  <WorkspacePremiumIcon
                    color={
                      tierMeta.color === "default" ? "disabled" : tierMeta.color
                    }
                  />
                  <Typography sx={{ fontWeight: 700 }}>
                    {tierMeta.label} plan
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {tier === "FREE" && "3 AI generations/day. Upgrade for more."}
                  {tier === "BASIC" && "10 AI generations/day."}
                  {tier === "PRO" && "50 AI generations/day. Priority queue."}
                  {tier === "ENTERPRISE" &&
                    "Unlimited generations. Dedicated support."}
                </Typography>
              </Box>
              {tier !== "ENTERPRISE" && (
                <Button
                  variant="contained"
                  size="small"
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                  onClick={() => {
                    navigate("/upgrade");
                  }}
                >
                  Upgrade
                </Button>
              )}
            </Stack>

            <SectionTitle>Account details</SectionTitle>
            <Stack spacing={1.5} sx={{ mb: 4 }}>
              {[
                { label: "Role", value: ROLE_LABEL[role] || role },
                {
                  label: "Auth method",
                  value:
                    profile?.authProvider === "google"
                      ? "Google OAuth"
                      : profile?.authProvider === "facebook"
                        ? "Facebook OAuth"
                        : "Email OTP",
                },
                {
                  label: "Member since",
                  value: profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—",
                },
              ].map(({ label, value }) => (
                <Stack
                  key={label}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ py: 0.75 }}
                >
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {value}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ mb: 3 }} />
            <SectionTitle>Danger zone</SectionTitle>
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: (t) => `1px solid ${t.palette.error.main}`,
                background: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(211,47,47,0.06)"
                    : "rgba(211,47,47,0.04)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ sm: "center" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: "error.main", mb: 0.5 }}
                  >
                    Delete account
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Permanently deletes your account, all plans, and all
                    associated data. This action is irreversible.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteForeverIcon />}
                  onClick={() => {
                    setDeleteOpen(true);
                    setDeleteEmail("");
                    setDeleteError(null);
                  }}
                  sx={{ flexShrink: 0, fontWeight: 700 }}
                >
                  Delete account
                </Button>
              </Stack>
            </Box>
          </TabPanel>

          {/* ══ Delete-account dialog ══ */}
          <Dialog
            open={deleteOpen}
            onClose={() => {
              if (!deleting) {
                setDeleteOpen(false);
                setDeleteEmail("");
                setDeleteError(null);
              }
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "error.main",
              }}
            >
              <WarningAmberIcon />
              Delete your account?
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                This will <strong>permanently delete</strong> your account, all
                plans, subscription, notifications, and every other piece of
                data associated with it. <strong>This cannot be undone.</strong>
              </DialogContentText>
              <DialogContentText sx={{ mb: 2.5 }}>
                To confirm, type your email address:&nbsp;
                <Box
                  component="span"
                  sx={{ fontWeight: 700, color: "text.primary" }}
                >
                  {profile?.email}
                </Box>
              </DialogContentText>
              <TextField
                label="Your email address"
                value={deleteEmail}
                onChange={(e) => {
                  setDeleteEmail(e.target.value);
                  setDeleteError(null);
                }}
                fullWidth
                autoComplete="off"
                disabled={deleting}
                error={!!deleteError}
              />
              {deleteError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {deleteError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteEmail("");
                  setDeleteError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteEmail.trim() !== profile?.email}
                startIcon={
                  deleting ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <DeleteForeverIcon />
                  )
                }
              >
                {deleting ? "Deleting…" : "Delete account permanently"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ── Save button (hidden on Account tab — nothing to save there) ── */}
          {tab !== 3 && (
            <>
              <Divider sx={{ mt: 4, mb: 3 }} />
              <Stack direction="row" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={
                    saving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ fontWeight: 700, minWidth: 130 }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
