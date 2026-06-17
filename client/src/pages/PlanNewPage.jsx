import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, CircularProgress, Container, Alert, Button, Typography, Stack } from "@mui/material";
import { motion } from "framer-motion";

import { api } from "../utils/axiosInstance";
import Logo from "../common/Logo";

/**
 * /plans/new is a transient page: it creates a DRAFT plan and bounces the
 * user into the wizard at step 1. If creation fails, we show a retry.
 *
 * StrictMode runs effects twice in dev — the ref guard prevents a duplicate
 * Plan being created on the second invocation.
 */
export default function PlanNewPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("creating"); // creating | error
  const [errMsg, setErrMsg] = useState(null);
  const fired = useRef(false);

  const create = async () => {
    setStatus("creating");
    setErrMsg(null);
    try {
      const { data } = await api.post("/plans", { title: "Untitled Plan" });
      const planId = data?.plan?._id || data?.plan?.id;
      if (!planId) throw new Error("plan_id_missing");
      navigate(`/plans/${planId}/step/1`, { replace: true });
    } catch (e) {
      setStatus("error");
      setErrMsg(e.response?.data?.error || "Could not start a new plan.");
    }
  };

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <Container maxWidth="sm" sx={{ minHeight: "60vh", display: "flex", alignItems: "center" }}>
        <Stack spacing={2} alignItems="center" sx={{ width: "100%", textAlign: "center" }}>
          <Alert severity="error" sx={{ width: "100%" }}>{errMsg}</Alert>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
            <Button variant="contained" onClick={create}>Try again</Button>
          </Stack>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ minHeight: "60vh", display: "flex", alignItems: "center" }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%" }}>
        <Stack spacing={3} alignItems="center" sx={{ textAlign: "center" }}>
          <Logo size={48} />
          <CircularProgress />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Starting your plan…</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 360 }}>
            We are creating a draft and taking you to step 1.
          </Typography>
        </Stack>
      </motion.div>
    </Container>
  );
}
