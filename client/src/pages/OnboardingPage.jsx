import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Stack,
  LinearProgress,
  Alert,
} from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useAuth } from "../context/AuthContext";
import { api } from "../utils/axiosInstance";

import Logo from "../common/Logo";
import ProtectedRoute from "../common/ProtectedRoute";
import RoleSelectStep from "../components/onboarding/RoleSelectStep";
import HomeownerForm from "../components/onboarding/HomeownerForm";
import DeveloperForm from "../components/onboarding/DeveloperForm";
import ArchitectForm from "../components/onboarding/ArchitectForm";
import ArchitectUnderReview from "../components/onboarding/ArchitectUnderReview";

/* ── Animation: slide right→0 on enter, 0→left on exit ──────────────── */
const slideVariants = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
};
const SLIDE_TRANSITION = { duration: 0.35, ease: "easeInOut" };

function GradientHeading({ children }) {
  return (
    <Typography
      component="h1"
      sx={{
        fontFamily: '"Playfair Display", serif',
        fontWeight: 700,
        fontSize: { xs: "1.9rem", md: "2.6rem" },
        textAlign: "center",
        lineHeight: 1.15,
        background: "linear-gradient(135deg, #2E7D32 0%, #00BCD4 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

function OnboardingInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [architectSubmitted, setArchitectSubmitted] = useState(false);

  const variants = reduce ? { enter: {}, center: {}, exit: {} } : slideVariants;
  const transition = reduce ? { duration: 0 } : SLIDE_TRANSITION;

  const handleRoleNext = () => {
    if (!role) return;
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  /**
   * Forms hand the parent a "payload" object. If a `_files` array is present
   * (architect portfolio), we send multipart/form-data; otherwise JSON.
   */
  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    setError(null);
    try {
      const hasFiles =
        Array.isArray(payload._files) && payload._files.length > 0;

      if (hasFiles) {
        const fd = new FormData();
        fd.append("role", role);
        // strip _files before stringifying
        const { _files, ...jsonPart } = payload;
        fd.append("data", JSON.stringify(jsonPart));
        _files.forEach((f) => fd.append("portfolio", f, f.name));
        await api.post("/users/onboarding", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/users/onboarding", { role, ...payload });
      }

      if (role === "architect") {
        // Architect is blocked behind admin verification — show review screen.
        setArchitectSubmitted(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      const code = e.response?.data?.error;
      setError(
        code
          ? `Submission failed (${code}).`
          : "Submission failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Post-submit terminal state for architect.
  if (architectSubmitted) {
    return <ArchitectUnderReview />;
  }

  return (
    <Box
      sx={{ minHeight: "100vh", position: "relative", py: { xs: 4, md: 6 } }}
    >
      {submitting && (
        <LinearProgress
          color="primary"
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2000,
            height: 3,
          }}
        />
      )}

      <Container maxWidth="md">
        <Stack alignItems="center" sx={{ mb: { xs: 4, md: 6 } }}>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Logo size={40} />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: "1.5rem",
              }}
            >
              Vastu
              <Box component="span" sx={{ color: "accent.main" }}>
                Verse
              </Box>
            </Typography>
          </Stack>
        </Stack>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3, maxWidth: 640, mx: "auto" }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div
              key="step-1"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <GradientHeading>
                Welcome to VastuVerse — Who are you?
              </GradientHeading>
              <Typography
                sx={{
                  textAlign: "center",
                  color: "text.secondary",
                  mb: 5,
                  fontSize: "1.05rem",
                }}
              >
                Pick the role that fits you best. You can change this later from
                settings.
              </Typography>
              <RoleSelectStep
                value={role}
                onSelect={setRole}
                onNext={handleRoleNext}
              />
            </motion.div>
          )}

          {step === 2 && role && (
            <motion.div
              key={`step-2-${role}`}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <GradientHeading>
                {role === "homeowner" && "Tell us about you"}
                {role === "developer" && "Tell us about your company"}
                {role === "architect" && "Tell us about your practice"}
              </GradientHeading>
              <Typography
                sx={{
                  textAlign: "center",
                  color: "text.secondary",
                  mb: 5,
                  fontSize: "1.05rem",
                }}
              >
                {role === "homeowner" &&
                  "We use this to personalise Vastu rules and cost estimates for your region."}
                {role === "developer" &&
                  "These details unlock the developer dashboard, team RBAC and bulk projects."}
                {role === "architect" &&
                  "Every architect is manually verified before marketplace access — usually within 24–48 hours."}
              </Typography>

              <Box sx={{ maxWidth: 640, mx: "auto" }}>
                {role === "homeowner" && (
                  <HomeownerForm
                    onSubmit={handleFormSubmit}
                    onBack={handleBack}
                    submitting={submitting}
                  />
                )}
                {role === "developer" && (
                  <DeveloperForm
                    onSubmit={handleFormSubmit}
                    onBack={handleBack}
                    submitting={submitting}
                  />
                )}
                {role === "architect" && (
                  <ArchitectForm
                    onSubmit={handleFormSubmit}
                    onBack={handleBack}
                    submitting={submitting}
                  />
                )}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle context line for debugging the JWT role (only when present) */}
        {user?.role && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              color: "text.secondary",
              mt: 6,
              opacity: 0.6,
            }}
          >
            Signed in as {user.role}
          </Typography>
        )}
      </Container>
    </Box>
  );
}

/** Public export wraps the page in <ProtectedRoute>. */
export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingInner />
    </ProtectedRoute>
  );
}
