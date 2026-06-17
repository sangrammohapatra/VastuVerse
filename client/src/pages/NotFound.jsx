import { Box, Stack, Typography, Button, Container } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Stack spacing={2} alignItems="center" sx={{ textAlign: "center", width: "100%" }}>
        <Typography sx={{ fontFamily: "\"Playfair Display\", serif", fontWeight: 700, fontSize: "5rem", lineHeight: 1, background: "linear-gradient(135deg,#2E7D32,#00BCD4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          404
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Page not found</Typography>
        <Typography sx={{ color: "text.secondary" }}>
          The page you were looking for doesn't exist.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Button component={RouterLink} to="/" variant="outlined">Home</Button>
          <Button component={RouterLink} to="/dashboard" variant="contained">Dashboard</Button>
        </Stack>
      </Stack>
    </Container>
  );
}
