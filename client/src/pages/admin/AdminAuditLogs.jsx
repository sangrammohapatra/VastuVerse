import { useCallback, useEffect, useState } from "react";
import {
  Box, Stack, Typography, Chip, TextField, MenuItem,
  IconButton, Avatar,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useTheme } from "@mui/material/styles";

import RefreshIcon from "@mui/icons-material/Refresh";

import { api } from "../../utils/axiosInstance";
import { timeAgo } from "../../utils/timeAgo";

const ACTION_COLOR = {
  plan_created:               "primary",
  step_completed:             "primary",
  plan_status_changed:        "primary",
  version_created:            "primary",
  version_rolled_back:        "warning",
  collaborator_invited:       "info",
  collaborator_joined:        "info",
  comment_added:              "info",
  comment_resolved:           "info",
  contractor_link_created:    "default",
  contractor_link_accessed:   "default",
  pdf_exported:               "default",
  "3d_unlocked":              "secondary",
  marketplace_request_posted: "warning",
  bid_placed:                 "warning",
  bid_accepted:               "success",
  review_submitted:           "success",
  review_accepted:            "success",
  payment_captured:           "success",
  subscription_changed:       "error",
};

const ALL_ACTIONS = Object.keys(ACTION_COLOR);

const PAGE_SIZE = 50;

export default function AdminAuditLogs() {
  const theme = useTheme();

  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [action, setAction]   = useState("");
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (action) params.action = action;
      if (from)   params.from   = from;
      if (to)     params.to     = to;
      const res = await api.get("/admin/audit-logs", { params });
      setRows(res.data.rows);
      setTotal(res.data.total);
    } catch (_) {}
    finally { setLoading(false); }
  }, [page, action, from, to]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      field: "createdAt",
      headerName: "Time",
      width: 155,
      renderCell: ({ value }) => (
        <Stack justifyContent="center" sx={{ height: "100%" }}>
          <Typography sx={{ fontSize: "0.78rem", lineHeight: 1.3 }}>
            {new Date(value).toLocaleString("en-IN", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
            {timeAgo(new Date(value))}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "user",
      headerName: "User",
      width: 210,
      sortable: false,
      renderCell: ({ value }) =>
        value ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ height: "100%" }}>
            <Avatar
              src={value.avatarUrl}
              sx={{ width: 28, height: 28, fontSize: "0.72rem", bgcolor: theme.palette.primary.main }}
            >
              {(value.fullName || value.email || "?")[0].toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", lineHeight: 1.2 }}>
                {value.fullName || "—"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
                {value.email}
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            System
          </Typography>
        ),
    },
    {
      field: "action",
      headerName: "Action",
      width: 210,
      renderCell: ({ value }) => (
        <Chip
          label={value.replace(/_/g, " ")}
          size="small"
          color={ACTION_COLOR[value] || "default"}
          sx={{ fontWeight: 600, fontSize: "0.72rem", textTransform: "capitalize" }}
        />
      ),
    },
    {
      field: "plan",
      headerName: "Plan",
      width: 180,
      sortable: false,
      renderCell: ({ value }) =>
        value ? (
          <Typography sx={{ fontSize: "0.8rem" }}>{value.title}</Typography>
        ) : (
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            —
          </Typography>
        ),
    },
    {
      field: "metadata",
      headerName: "Details",
      flex: 1,
      sortable: false,
      renderCell: ({ value }) => {
        const str = value && Object.keys(value).length
          ? JSON.stringify(value)
          : "—";
        return (
          <Typography
            title={str}
            sx={{
              color: "text.secondary",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {str}
          </Typography>
        );
      },
    },
    {
      field: "ipAddress",
      headerName: "IP",
      width: 130,
      sortable: false,
      renderCell: ({ value }) => (
        <Typography
          sx={{ color: "text.secondary", fontSize: "0.75rem", fontFamily: "monospace" }}
        >
          {value || "—"}
        </Typography>
      ),
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ mb: 0.5 }}
      >
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
            }}
          >
            Audit Logs
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {total.toLocaleString("en-IN")} entries · auto-expires after 365 days
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={loading} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {/* Filters */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        <TextField
          select
          label="Action"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(0); }}
          size="small"
          sx={{ minWidth: 210 }}
        >
          <MenuItem value="">All actions</MenuItem>
          {ALL_ACTIONS.map((a) => (
            <MenuItem key={a} value={a} sx={{ textTransform: "capitalize" }}>
              {a.replace(/_/g, " ")}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          type="date"
          label="From"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 155 }}
        />
        <TextField
          type="date"
          label="To"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(0); }}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 155 }}
        />
      </Stack>

      {/* Table */}
      <DataGrid
        rows={rows}
        columns={columns}
        rowCount={total}
        paginationMode="server"
        paginationModel={{ page, pageSize: PAGE_SIZE }}
        onPaginationModelChange={(m) => setPage(m.page)}
        pageSizeOptions={[PAGE_SIZE]}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        rowHeight={62}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          "& .MuiDataGrid-columnHeaders": {
            background: theme.palette.background.paper,
          },
        }}
      />
    </Box>
  );
}
