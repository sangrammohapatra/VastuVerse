import { Box, Card, CardActionArea, Stack, Typography, Chip, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const ROLES = [
  {
    id: 'homeowner',
    title: 'Homeowner',
    desc: 'Plan your dream home with AI — Vastu-compliant, budget-aware, ready to export.',
    Icon: HomeIcon,
  },
  {
    id: 'developer',
    title: 'Real Estate Developer',
    desc: 'Bulk projects, team RBAC, client portal and branded PDF exports.',
    Icon: BusinessIcon,
  },
  {
    id: 'architect',
    title: 'Verified Architect',
    desc: 'Review AI plans, build your portfolio, receive Razorpay payouts.',
    Icon: ArchitectureIcon,
  },
  {
    id: 'admin',
    title: 'Admin',
    desc: 'Platform administration and moderation tools.',
    Icon: AdminPanelSettingsIcon,
    disabled: true,
    disabledNote: 'By invitation only',
  },
];

const MotionCard = motion(Card);

export default function RoleSelectStep({ value, onSelect, onNext }) {
  const theme = useTheme();

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 3,
          maxWidth: 760,
          mx: 'auto',
        }}
      >
        {ROLES.map((r) => {
          const selected = value === r.id;
          const { Icon } = r;
          return (
            <MotionCard
              key={r.id}
              whileHover={r.disabled ? undefined : { scale: 1.03 }}
              whileTap={r.disabled ? undefined : { scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              elevation={0}
              sx={{
                background: theme.vastu.cardBg,
                border: selected
                  ? `2px solid ${theme.palette.primary.main}`
                  : theme.vastu.cardBorder,
                backdropFilter: theme.vastu.cardBlur,
                WebkitBackdropFilter: theme.vastu.cardBlur,
                borderRadius: 4,
                boxShadow: selected ? theme.vastu.glowPrimary : theme.vastu.cardShadow,
                opacity: r.disabled ? 0.55 : 1,
                transition:
                  'border-color .2s ease, box-shadow .2s ease, transform .2s ease',
              }}
            >
              <CardActionArea
                onClick={() => !r.disabled && onSelect(r.id)}
                disabled={r.disabled}
                sx={{ p: 3.5, height: '100%', alignItems: 'flex-start' }}
              >
                <Stack spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: selected ? 'primary.main' : 'accent.main',
                      background:
                        theme.palette.mode === 'dark'
                          ? 'linear-gradient(135deg, rgba(76,175,80,0.18), rgba(0,229,255,0.14))'
                          : 'linear-gradient(135deg, rgba(46,125,50,0.12), rgba(0,188,212,0.12))',
                    }}
                  >
                    <Icon sx={{ fontSize: 36 }} />
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.18rem' }}>
                      {r.title}
                    </Typography>
                    {r.disabled && r.disabledNote && (
                      <Chip
                        label={r.disabledNote}
                        size="small"
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {r.desc}
                  </Typography>
                </Stack>
              </CardActionArea>
            </MotionCard>
          );
        })}
      </Box>

      <Stack direction="row" justifyContent="center" sx={{ mt: 5 }}>
        <Button
          variant="contained"
          size="large"
          disabled={!value}
          onClick={onNext}
          sx={{
            px: 4.5,
            py: 1.3,
            fontWeight: 700,
            boxShadow: value ? theme.vastu.glowPrimary : 'none',
          }}
        >
          Continue
        </Button>
      </Stack>
    </Box>
  );
}
