import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Card,
  Button,
  Chip,
  MenuItem,
  TextField,
  Avatar,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Menu,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VerifiedIcon from "@mui/icons-material/Verified";
import BlockIcon from "@mui/icons-material/Block";
import ArticleIcon from "@mui/icons-material/Article";
import RefreshIcon from "@mui/icons-material/Refresh";

import { api } from "../../utils/axiosInstance";

const ROLES = ["homeowner", "developer", "architect", "admin"];
const TIERS = ["FREE", "BASIC", "PRO", "ENTERPRISE"];

const TIER_COLOR = {
  FREE: "default",
  BASIC: "info",
  PRO: "success",
  ENTERPRISE: "warning",
};

export default function AdminUsers() {
  const theme = useTheme();
  const [tab, setTab] = useState("all");

  return (
    <Box>
      <Typography
        sx={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
          fontSize: { xs: "1.7rem", md: "2.1rem" },
          background: theme.vastu.gradientText,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          mb: 0.5,
        }}
      >
        Users
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Manage roles, tiers, and architect verifications.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Tab value="all" label="All users" sx={{ fontWeight: 700 }} />
        <Tab
          value="architects"
          label="Architect verification queue"
          sx={{ fontWeight: 700 }}
        />
      </Tabs>

      {tab === "all" ? <UsersGrid /> : <ArchitectQueue />}
    </Box>
  );
}

/* ─── All users grid ──────────────────────────────────────────────── */

function UsersGrid() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: "", tier: "", search: "" });

  const [actionAnchor, setActionAnchor] = useState({ el: null, row: null });
  const [editRow, setEditRow] = useState(null);
  const [grantRow, setGrantRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.pageSize };
      if (filters.role) params.role = filters.role;
      if (filters.tier) params.tier = filters.tier;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get("/admin/users", { params });
      setRows(data.rows.map((u) => ({ ...u, id: u._id })));
      setTotal(data.total);
    } catch (_) {
      /* surface inline */
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () => [
      {
        field: "fullName",
        headerName: "User",
        flex: 1,
        renderCell: (params) => (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              src={params.row.avatarUrl}
              sx={{ width: 28, height: 28, fontSize: "0.78rem" }}
            >
              {(params.row.fullName || params.row.email || "?")
                .charAt(0)
                .toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                {params.row.fullName || "—"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {params.row.email}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: "role",
        headerName: "Role",
        renderCell: (p) => (
          <Chip
            size="small"
            label={p.value}
            sx={{ fontWeight: 700, textTransform: "capitalize" }}
          />
        ),
      },
      {
        field: "subscriptionTier",
        headerName: "Tier",
        renderCell: (p) => (
          <Chip
            size="small"
            label={p.value}
            color={TIER_COLOR[p.value] || "default"}
            sx={{ fontWeight: 800, letterSpacing: 0.5 }}
          />
        ),
      },
      {
        field: "isActive",
        headerName: "Status",
        renderCell: (p) => (
          <Chip
            size="small"
            icon={p.value ? <CheckCircleIcon /> : <BlockIcon />}
            label={p.value ? "Active" : "Disabled"}
            color={p.value ? "success" : "default"}
            variant={p.value ? "filled" : "outlined"}
            sx={{ fontWeight: 700 }}
          />
        ),
      },
      {
        field: "createdAt",
        headerName: "Joined",
        valueFormatter: (params) =>
          params.value
            ? new Date(params.value).toLocaleDateString("en-IN")
            : "—",
      },
      {
        field: "actions",
        headerName: "",
        width: 60,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <IconButton
            size="small"
            onClick={(e) =>
              setActionAnchor({ el: e.currentTarget, row: p.row })
            }
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  );

  return (
    <>
      {/* Filters */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems="center"
        >
          <TextField
            select
            size="small"
            label="Role"
            value={filters.role}
            onChange={(e) =>
              setFilters((f) => ({ ...f, role: e.target.value }))
            }
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All roles</MenuItem>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r} sx={{ textTransform: "capitalize" }}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Tier"
            value={filters.tier}
            onChange={(e) =>
              setFilters((f) => ({ ...f, tier: e.target.value }))
            }
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All tiers</MenuItem>
            {TIERS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Search email or name"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            sx={{ flex: 1, minWidth: 200 }}
          />
          <IconButton size="small" onClick={load}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Card>

      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          height: "calc(100vh - 320px)",
          minHeight: 400,
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick
          density="comfortable"
          sx={{
            border: "none",
            "& .MuiDataGrid-cell": { outline: "none !important" },
          }}
        />
      </Card>

      {/* Actions menu */}
      <Menu
        anchorEl={actionAnchor.el}
        open={Boolean(actionAnchor.el)}
        onClose={() => setActionAnchor({ el: null, row: null })}
      >
        <MenuItem
          onClick={() => {
            setEditRow(actionAnchor.row);
            setActionAnchor({ el: null, row: null });
          }}
        >
          Change role / tier
        </MenuItem>
        <MenuItem
          onClick={() => {
            setGrantRow(actionAnchor.row);
            setActionAnchor({ el: null, row: null });
          }}
        >
          Grant free Pro / tier
        </MenuItem>
        <MenuItem
          onClick={async () => {
            const r = actionAnchor.row;
            setActionAnchor({ el: null, row: null });
            try {
              await api.put(`/admin/users/${r._id}`, { isActive: !r.isActive });
              load();
            } catch (_) {}
          }}
        >
          {actionAnchor.row?.isActive ? "Deactivate" : "Activate"}
        </MenuItem>
      </Menu>

      <EditUserDialog
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={() => {
          setEditRow(null);
          load();
        }}
      />
      <GrantTierDialog
        row={grantRow}
        onClose={() => setGrantRow(null)}
        onSaved={() => {
          setGrantRow(null);
          load();
        }}
      />
    </>
  );
}

/* ─── Edit user dialog ────────────────────────────────────────────── */

function EditUserDialog({ row, onClose, onSaved }) {
  const [role, setRole] = useState("");
  const [tier, setTier] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (row) {
      setRole(row.role);
      setTier(row.tier);
      setError(null);
    }
  }, [row]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/admin/users/${row._id}`, { role, tier });
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!row}
      onClose={() => !saving && onClose()}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        Edit {row?.fullName || row?.email}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            size="small"
          >
            {ROLES.map((r) => (
              <MenuItem key={r} value={r} sx={{ textTransform: "capitalize" }}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            fullWidth
            size="small"
          >
            {TIERS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving}
          startIcon={
            saving && <CircularProgress size={16} sx={{ color: "#fff" }} />
          }
          sx={{ fontWeight: 700 }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Grant tier dialog ───────────────────────────────────────────── */

function GrantTierDialog({ row, onClose, onSaved }) {
  const [tier, setTier] = useState("PRO");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (row) {
      setTier("PRO");
      setReason("");
      setError(null);
    }
  }, [row]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/users/${row._id}/grant-tier`, { tier, reason });
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.error || "Grant failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!row}
      onClose={() => !saving && onClose()}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        Grant tier · {row?.email}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Grant tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            fullWidth
            size="small"
          >
            {TIERS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reason (audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            placeholder="e.g. influencer collaboration, support escalation, beta tester comp"
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={save}
          disabled={saving}
          startIcon={
            saving ? (
              <CircularProgress size={16} sx={{ color: "#fff" }} />
            ) : (
              <VerifiedIcon />
            )
          }
          sx={{ fontWeight: 700 }}
        >
          {saving ? "Granting…" : `Grant ${tier}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Architect verification queue ────────────────────────────────── */

function ArchitectQueue() {
  const theme = useTheme();
  const [status, setStatus] = useState("pending");
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/architect-verifications", {
        params: { status },
      });
      setProfiles(data.profiles || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        {["pending", "approved", "rejected"].map((s) => (
          <Chip
            key={s}
            label={`${s.charAt(0).toUpperCase()}${s.slice(1)}${s === status ? ` · ${profiles.length}` : ""}`}
            onClick={() => setStatus(s)}
            color={s === status ? "primary" : "default"}
            variant={s === status ? "filled" : "outlined"}
            sx={{ fontWeight: 700 }}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={load}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Stack>

      {loading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Card
              key={i}
              elevation={0}
              sx={{
                p: 2,
                background: theme.vastu.cardBg,
                border: theme.vastu.cardBorder,
                height: 80,
              }}
            />
          ))}
        </Stack>
      ) : profiles.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: 4,
            textAlign: "center",
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
          }}
        >
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Queue empty</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No {status} architect profiles right now.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {profiles.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.35 }}
            >
              <Card
                elevation={0}
                sx={{
                  p: 2,
                  background: theme.vastu.cardBg,
                  border: theme.vastu.cardBorder,
                  backdropFilter: theme.vastu.cardBlur,
                  cursor: "pointer",
                  transition: "transform .2s, box-shadow .2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: theme.vastu.glowPrimary,
                  },
                }}
                onClick={() => setSelected(p)}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    src={p.user?.avatarUrl}
                    sx={{ width: 44, height: 44 }}
                  >
                    {(p.user?.fullName || p.user?.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {p.user?.fullName || p.user?.email}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      flexWrap="wrap"
                      alignItems="center"
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        COA #{p.coaRegistrationNo}
                      </Typography>
                      {p.yearsExperience > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          · {p.yearsExperience}y experience
                        </Typography>
                      )}
                      {p.cityState?.city && (
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          · {p.cityState.city}
                          {p.cityState.state && `, ${p.cityState.state}`}
                        </Typography>
                      )}
                      {p.portfolioUrls?.length > 0 && (
                        <Chip
                          size="small"
                          icon={<ArticleIcon sx={{ fontSize: 12 }} />}
                          label={`${p.portfolioUrls.length} portfolio item${p.portfolioUrls.length === 1 ? "" : "s"}`}
                          sx={{
                            height: 18,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                          }}
                        />
                      )}
                    </Stack>
                    {p.specializations?.length > 0 && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                        {p.specializations.slice(0, 4).map((s) => (
                          <Chip
                            key={s}
                            label={s}
                            size="small"
                            sx={{ height: 18, fontSize: "0.62rem" }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 700, flexShrink: 0 }}
                  >
                    Review →
                  </Button>
                </Stack>
              </Card>
            </motion.div>
          ))}
        </Stack>
      )}

      <ArchitectReviewDialog
        profile={selected}
        onClose={() => setSelected(null)}
        onDecision={() => {
          setSelected(null);
          load();
        }}
      />
    </>
  );
}

/* ─── Architect portfolio + approve/reject dialog ─────────────────── */

function ArchitectReviewDialog({ profile, onClose, onDecision }) {
  const theme = useTheme();
  const [decision, setDecision] = useState(null); // null | 'approve' | 'reject'
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (profile) {
      setDecision(null);
      setReason("");
      setError(null);
    }
  }, [profile]);

  const decide = async (d) => {
    if (!profile) return;
    if (d === "reject" && !reason.trim()) {
      setDecision("reject");
      setError("Reason required for rejection.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put(`/admin/architects/${profile.userId}/verify`, {
        decision: d,
        rejectionReason: reason,
      });
      onDecision?.();
    } catch (e) {
      setError(e.response?.data?.error || "Decision failed");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  // Heuristic: detect image vs PDF from URL
  const portfolio = profile.portfolioUrls || [];
  const pdfs = portfolio.filter((u) => /\.pdf(\?|$)/i.test(u));
  const images = portfolio.filter((u) =>
    /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u),
  );
  const others = portfolio.filter(
    (u) => !pdfs.includes(u) && !images.includes(u),
  );

  return (
    <Dialog open onClose={() => !saving && onClose()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Verify architect · {profile.user?.fullName || profile.user?.email}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Identity */}
          <Box>
            <Typography
              variant="overline"
              sx={{ color: "text.secondary", letterSpacing: 1 }}
            >
              Credentials
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Field k="Email" v={profile.user?.email || "—"} />
              <Field k="COA registration" v={profile.coaRegistrationNo} />
              <Field
                k="Experience"
                v={
                  profile.yearsExperience
                    ? `${profile.yearsExperience} years`
                    : "—"
                }
              />
              <Field
                k="City / State"
                v={
                  [profile.cityState?.city, profile.cityState?.state]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </Stack>
            {profile.certifications?.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Certifications:{" "}
                </Typography>
                {profile.certifications.map((c, i) => (
                  <Chip
                    key={i}
                    label={c}
                    size="small"
                    sx={{ ml: 0.5, height: 20 }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Image gallery */}
          {images.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", letterSpacing: 1 }}
              >
                Portfolio images
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, 1fr)",
                    sm: "repeat(3, 1fr)",
                    md: "repeat(4, 1fr)",
                  },
                  gap: 1.5,
                  mt: 1,
                }}
              >
                {images.map((url, i) => (
                  <Box
                    key={i}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "block",
                      aspectRatio: "4 / 3",
                      backgroundImage: `url(${url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      borderRadius: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      transition: "transform .2s",
                      "&:hover": { transform: "scale(1.03)" },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* PDF embed (first one) */}
          {pdfs.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", letterSpacing: 1 }}
              >
                Portfolio PDF (1 of {pdfs.length})
              </Typography>
              <Box
                component="iframe"
                src={pdfs[0]}
                title="Architect portfolio PDF"
                sx={{
                  width: "100%",
                  height: 360,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  mt: 1,
                  display: "block",
                }}
              />
              {pdfs.length > 1 && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 1 }}
                  flexWrap="wrap"
                >
                  {pdfs.slice(1).map((u, i) => (
                    <Button
                      key={i}
                      size="small"
                      component="a"
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      PDF {i + 2}
                    </Button>
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {others.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", letterSpacing: 1 }}
              >
                Other links
              </Typography>
              <Stack spacing={0.5}>
                {others.map((u, i) => (
                  <Typography
                    key={i}
                    component="a"
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                    sx={{ color: "primary.main", wordBreak: "break-all" }}
                  >
                    {u}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}

          {/* Rejection reason */}
          {decision === "reject" && (
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Rejection reason (sent to architect)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. COA registration could not be verified; please re-submit with current certification."
              inputProps={{ maxLength: 500 }}
            />
          )}

          {profile.verificationStatus !== "pending" && (
            <Alert severity="info">
              Currently <strong>{profile.verificationStatus}</strong>
              {profile.rejectionReason ? ` · "${profile.rejectionReason}"` : ""}
              . You can override the decision below.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          color="error"
          startIcon={<CancelIcon />}
          onClick={() =>
            decision === "reject" ? decide("reject") : setDecision("reject")
          }
          disabled={saving}
          sx={{ fontWeight: 700 }}
        >
          {decision === "reject" ? "Confirm rejection" : "Reject…"}
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={
            saving ? (
              <CircularProgress size={16} sx={{ color: "#fff" }} />
            ) : (
              <VerifiedIcon />
            )
          }
          onClick={() => decide("approve")}
          disabled={saving}
          sx={{ fontWeight: 700 }}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Field({ k, v }) {
  return (
    <Box sx={{ minWidth: 140 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block" }}
      >
        {k}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {v}
      </Typography>
    </Box>
  );
}
