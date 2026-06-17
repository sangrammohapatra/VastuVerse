import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Button, IconButton, Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import CheckIcon from '@mui/icons-material/Check';

const DEFAULT_TIERS = [
  { id: 'FREE',       label: 'Free',       daily: 3,    priceInr: 0 },
  { id: 'BASIC',      label: 'Basic',      daily: 10,   priceInr: 99 },
  { id: 'PRO',        label: 'Pro',        daily: 50,   priceInr: 499, recommended: true },
  { id: 'ENTERPRISE', label: 'Enterprise', daily: 'Unlimited', priceInr: 1999 },
];

/**
 * Upgrade dialog shown when the user hits their daily AI generation cap.
 *
 *   open
 *   onClose
 *   tiers          override the comparison data (server can pass via upgradePrompt.tiers)
 *   currentTier    highlight the user's current row
 *   title / message
 *   onUpgrade(tierId)
 */
export default function UpgradeDialog({
  open,
  onClose,
  tiers = DEFAULT_TIERS,
  currentTier = 'FREE',
  title = 'Daily AI generation limit reached',
  message = 'Upgrade your plan to keep generating today.',
  onUpgrade,
}) {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: theme.vastu.cardBg,
          backdropFilter: theme.vastu.cardBlur,
          border: theme.vastu.cardBorder,
          borderRadius: 4,
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box
            sx={{
              width: 38, height: 38, borderRadius: '50%',
              background: theme.vastu.gradientBrand,
              color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <StarIcon />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.4rem' }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {message}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
            mt: 1,
          }}
        >
          <AnimatePresence initial>
            {tiers.map((t, i) => {
              const isCurrent = t.id === currentTier;
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
                >
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: t.recommended
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${theme.palette.divider}`,
                      background: t.recommended
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(76,175,80,0.06)'
                          : 'rgba(46,125,50,0.04)'
                        : theme.palette.background.paper,
                      position: 'relative',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {t.recommended && (
                      <Chip
                        label="Recommended"
                        size="small"
                        color="primary"
                        sx={{ position: 'absolute', top: -10, right: 12, fontWeight: 700 }}
                      />
                    )}
                    {isCurrent && (
                      <Chip
                        label="Your plan"
                        size="small"
                        sx={{ position: 'absolute', top: -10, left: 12, fontWeight: 700 }}
                      />
                    )}
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{t.label}</Typography>
                    <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.9rem' }}>
                      {typeof t.priceInr === 'number'
                        ? t.priceInr === 0 ? 'Free' : `₹${t.priceInr}/mo`
                        : t.priceInr}
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 1.5, flex: 1 }}>
                      <Row>
                        <strong>{typeof t.daily === 'number' ? t.daily : t.daily}</strong>
                        &nbsp;AI generations/day
                      </Row>
                      {t.id !== 'FREE' && <Row>Floor-plan exports</Row>}
                      {(t.id === 'PRO' || t.id === 'ENTERPRISE') && <Row>3D walkthroughs</Row>}
                      {t.id === 'ENTERPRISE' && <Row>Priority support</Row>}
                    </Stack>

                    <Button
                      fullWidth
                      variant={t.recommended ? 'contained' : 'outlined'}
                      disabled={isCurrent}
                      sx={{ mt: 2, fontWeight: 700 }}
                      onClick={() => onUpgrade?.(t.id)}
                    >
                      {isCurrent ? 'Current plan' : t.priceInr === 0 ? 'Stay on Free' : `Upgrade to ${t.label}`}
                    </Button>
                  </Box>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </Box>

        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary', textAlign: 'center' }}>
          Daily limits reset at midnight IST. You can also wait until tomorrow.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Maybe later</Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <CheckIcon sx={{ fontSize: 14, color: 'primary.main' }} />
      <Typography variant="body2">{children}</Typography>
    </Stack>
  );
}
