import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function PadlockIllustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 240 240"
      sx={{ width: { xs: 160, md: 200 }, height: { xs: 160, md: 200 } }}
      aria-hidden
    >
      <defs>
        <linearGradient id="lockGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E7D32" />
          <stop offset="100%" stopColor="#00BCD4" />
        </linearGradient>
        <radialGradient id="lockGlow">
          <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2E7D32" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="118" fill="url(#lockGlow)" />
      {/* shackle */}
      <path
        d="M75 110 V80 a45 45 0 0 1 90 0 V110"
        fill="none"
        stroke="url(#lockGrad)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* body */}
      <rect x="55" y="105" width="130" height="105" rx="14" fill="url(#lockGrad)" />
      {/* keyhole */}
      <circle cx="120" cy="148" r="11" fill="#ffffff" />
      <rect x="115" y="156" width="10" height="26" rx="3" fill="#ffffff" />
      {/* tiny stars to suggest "pending" / sparkle */}
      <circle cx="40" cy="50" r="3" fill="#FFB300" opacity="0.7" />
      <circle cx="205" cy="80" r="2.5" fill="#00BCD4" opacity="0.8" />
      <circle cx="200" cy="180" r="3" fill="#FFB300" opacity="0.6" />
      <circle cx="30" cy="170" r="2.5" fill="#00BCD4" opacity="0.7" />
    </Box>
  );
}

export default function ArchitectUnderReview() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ width: '100%' }}
      >
        <Stack alignItems="center" spacing={3} sx={{ textAlign: 'center', py: { xs: 6, md: 8 } }}>
          <PadlockIllustration />

          <Typography
            component="h1"
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2.4rem' },
              background: 'linear-gradient(135deg, #2E7D32 0%, #00BCD4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Profile Under Review
          </Typography>

          <Typography sx={{ color: 'text.secondary', maxWidth: 480, fontSize: '1.05rem', lineHeight: 1.7 }}>
            Thanks for your submission. Our team manually reviews every architect's CoA
            registration and portfolio — usually within 24&ndash;48 hours. You'll receive
            an email the moment you're verified, and the marketplace will unlock
            automatically.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
            <Button variant="outlined" size="large" onClick={() => navigate('/')}>
              Back to home
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={async () => {
                await logout();
                navigate('/', { replace: true });
              }}
              sx={{ px: 4, fontWeight: 700 }}
            >
              Log out
            </Button>
          </Stack>
        </Stack>
      </motion.div>
    </Container>
  );
}
