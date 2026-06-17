import { Box, Container, Stack, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

/**
 * Friendly placeholder for routes whose real UIs land in later steps.
 * Keeps the protected-area chrome (sidebar / bottom nav) visible.
 */
export default function PageStub({ title, description, icon = '🏗️', backTo = '/dashboard', backLabel = 'Back to dashboard' }) {
  const theme = useTheme();
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <Box
          sx={{
            p: { xs: 4, md: 6 },
            textAlign: 'center',
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            boxShadow: theme.vastu.cardShadow,
            borderRadius: 4,
          }}
        >
          <Box sx={{ fontSize: '3.5rem', mb: 1.5 }}>{icon}</Box>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', md: '2.2rem' },
              background: theme.vastu.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            {title}
          </Typography>
          {description && (
            <Typography sx={{ color: 'text.secondary', maxWidth: 540, mx: 'auto', mb: 3 }}>
              {description}
            </Typography>
          )}
          <Stack direction="row" justifyContent="center">
            <Button component={RouterLink} to={backTo} variant="outlined">
              {backLabel}
            </Button>
          </Stack>
        </Box>
      </motion.div>
    </Container>
  );
}
