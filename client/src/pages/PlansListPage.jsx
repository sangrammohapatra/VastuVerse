import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { api } from "../utils/axiosInstance";
import PlanCard from "../components/PlanCard";
import EmptyState from "../components/EmptyState";

const STATUS_TABS = [
  { label: "All",         value: ""            },
  { label: "Draft",       value: "DRAFT"       },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Completed",   value: "COMPLETED"   },
  { label: "Archived",    value: "ARCHIVED"    },
];

export default function PlansListPage() {
  const navigate = useNavigate();
  const [plans, setPlans]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get("/plans", { params });
      setPlans(data.plans || []);
    } catch {
      setError("Could not load plans. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleArchive = async (plan) => {
    try {
      await api.put(`/plans/${plan._id}/status`, { status: "ARCHIVED" });
      setPlans((prev) =>
        prev.map((p) => (p._id === plan._id ? { ...p, status: "ARCHIVED" } : p))
      );
    } catch { /* silent — card remains unchanged */ }
  };

  const visibleCount = plans.length;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {/* ── Header ── */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: "1.8rem", md: "2.2rem" },
            }}
          >
            My Plans
          </Typography>
          {!loading && (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              {visibleCount} plan{visibleCount !== 1 ? "s" : ""}
              {statusFilter ? ` · ${STATUS_TABS.find((t) => t.value === statusFilter)?.label}` : ""}
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/plans/new")}
          sx={{ fontWeight: 700, flexShrink: 0 }}
        >
          New plan
        </Button>
      </Stack>

      {/* ── Status filter tabs ── */}
      <Tabs
        value={statusFilter}
        onChange={(_, v) => setStatusFilter(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        {STATUS_TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} sx={{ fontWeight: 600 }} />
        ))}
      </Tabs>

      {/* ── Content ── */}
      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchPlans}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : plans.length === 0 ? (
        <EmptyState
          illustration="plans"
          title={statusFilter ? "No matching plans" : "No plans yet"}
          description={
            statusFilter
              ? "Try a different filter, or create a new plan."
              : "Start designing your home — create your first plan."
          }
          primaryAction={{ label: "New plan", onClick: () => navigate("/plans/new") }}
        />
      ) : (
        <Grid container spacing={2.5}>
          {plans.map((plan, i) => (
            <Grid item xs={12} sm={6} md={4} key={plan._id}>
              <PlanCard plan={plan} index={i} onArchive={handleArchive} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
