import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import GoogleIcon from "@mui/icons-material/Google";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import Logo from "../common/Logo";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/axiosInstance";
import { API_BASE_URL } from "../utils/axiosInstance";

const OTP_TICK_FALLBACK = 600;

function buildPostAuthPath(user, fromLocation) {
  const pathname = fromLocation?.pathname;
  const search = fromLocation?.search || "";
  const requestedPath =
    pathname && pathname !== "/login" ? `${pathname}${search}` : null;

  if (!user?.onboardingComplete) {
    return "/onboarding";
  }

  if (requestedPath && requestedPath !== "/onboarding") {
    return requestedPath;
  }

  return user?.role === "admin" ? "/admin" : "/dashboard";
}

function getGoogleAuthUrl() {
  return new URL(
    "auth/google",
    API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`
  ).toString();
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { isAuthenticated, loading, login, user, sessionExpired: authSessionExpired } = useAuth();

  const oauthError = params.get("error") === "oauth_failed";
  const redirectedFromOnboarding =
    location.state?.from?.pathname === "/onboarding";
  const sessionExpiredMessage =
    location.state?.sessionExpired || authSessionExpired;

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const googleAuthUrl = useMemo(() => getGoogleAuthUrl(), []);

  const handleEmailChange = (event) => {
    const nextEmail = event.target.value;
    setEmail(nextEmail);
    if (otpSent) {
      setOtpSent(false);
      setOtp("");
      setSecondsLeft(0);
      setInfo("");
      setError("");
    }
  };

  useEffect(() => {
    if (!otpSent || secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSent, secondsLeft]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    navigate(buildPostAuthPath(user, location.state?.from), { replace: true });
  }, [isAuthenticated, loading, location.state, navigate, user]);

  const handleSendOtp = async () => {
    setSubmittingOtp(true);
    setError("");
    setInfo("");

    try {
      const { data } = await api.post(
        "/auth/send-otp",
        { email: email.trim() },
        { _skipAuthRetry: true }
      );
      setOtp("");
      setOtpSent(true);
      setSecondsLeft(data?.ttlSeconds || OTP_TICK_FALLBACK);
      setInfo(`OTP sent to ${email.trim()}. Check your inbox.`);
    } catch (requestError) {
      const message =
        requestError.response?.data?.details?.[0]?.msg ||
        requestError.response?.data?.error?.details?.[0]?.message ||
        requestError.response?.data?.error ||
        "Could not send OTP. Please try again.";
      setError(message);
    } finally {
      setSubmittingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setVerifyingOtp(true);
    setError("");
    setInfo("");

    try {
      const { data } = await api.post(
        "/auth/verify-otp",
        { email: email.trim(), otp: otp.trim() },
        { _skipAuthRetry: true }
      );
      login(data.accessToken, data.user);
      navigate(buildPostAuthPath(data.user, location.state?.from), {
        replace: true,
      });
    } catch (requestError) {
      const message =
        requestError.response?.data?.details?.[0]?.msg ||
        requestError.response?.data?.error ||
        "Could not verify OTP. Please try again.";
      setError(message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{ minHeight: "100vh", display: "flex", alignItems: "center", py: 4 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: "100%" }}
      >
        <Card
          elevation={0}
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <Stack alignItems="center" spacing={1.5} sx={{ textAlign: "center" }}>
                <Stack direction="row" alignItems="center" spacing={1.2}>
                  <Logo size={42} />
                  <Typography
                    sx={{
                      fontFamily: '"Playfair Display", serif',
                      fontWeight: 700,
                      fontSize: "1.6rem",
                    }}
                  >
                    VastuVerse
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Sign in or get started
                </Typography>
                <Typography sx={{ color: "text.secondary", maxWidth: 420 }}>
                  Enter your email to receive a one-time code. New users continue
                  into onboarding after verification.
                </Typography>
              </Stack>

              {sessionExpiredMessage && (
                <Alert severity="warning">
                  Your session has expired. Please sign in again.
                </Alert>
              )}
              {oauthError && (
                <Alert severity="error">
                  Google sign-in failed. Please try again or continue with email OTP.
                </Alert>
              )}
              {redirectedFromOnboarding && (
                <Alert severity="info">
                  Complete sign-in first, then we will take you back into onboarding.
                </Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
              {info && <Alert severity="success">{info}</Alert>}

              <Stack spacing={2}>
                <TextField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  fullWidth
                  required
                />

                {otpSent && (
                  <TextField
                    label="6-digit OTP"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                    fullWidth
                    required
                  />
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant={otpSent ? "outlined" : "contained"}
                    startIcon={<MailOutlineIcon />}
                    onClick={handleSendOtp}
                    disabled={
                      !email.trim() ||
                      submittingOtp ||
                      verifyingOtp ||
                      (otpSent && secondsLeft > 0)
                    }
                    fullWidth
                  >
                    {submittingOtp
                      ? "Sending..."
                      : otpSent
                        ? secondsLeft > 0
                          ? `Resend in ${secondsLeft}s`
                          : "Resend OTP"
                        : "Send OTP"}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleVerifyOtp}
                    disabled={
                      !otpSent ||
                      otp.trim().length !== 6 ||
                      verifyingOtp ||
                      submittingOtp
                    }
                    fullWidth
                  >
                    {verifyingOtp ? "Verifying..." : "Verify & continue"}
                  </Button>
                </Stack>
              </Stack>

              <Divider>or</Divider>

              <Button
                variant="outlined"
                startIcon={<GoogleIcon />}
                onClick={() => window.location.assign(googleAuthUrl)}
                fullWidth
                size="large"
              >
                Continue with Google
              </Button>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.03)",
                }}
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Existing users go to the dashboard after sign-in. First-time users
                  are taken to onboarding to choose their role and complete profile
                  setup.
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button component={RouterLink} to="/" variant="text">
                  Back home
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </motion.div>
    </Container>
  );
}
