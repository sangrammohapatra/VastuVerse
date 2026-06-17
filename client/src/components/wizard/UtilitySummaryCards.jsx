import { Box, Card, Stack, Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import PlumbingIcon from '@mui/icons-material/Plumbing';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import OpacityIcon from '@mui/icons-material/Opacity';
import RecyclingIcon from '@mui/icons-material/Recycling';
import SolarPowerIcon from '@mui/icons-material/SolarPower';

const MotionCard = motion(Card);

const CARDS = [
  {
    id: 'plumbing',
    label: 'Plumbing',
    color: '#42A5F5',
    Icon: PlumbingIcon,
    stats: (s) => [
      [`${s.fixtures ?? 0}`, 'wet fixtures'],
      [`${s.pipeRunFt ?? 0} ft`, 'total pipe run'],
      [`${s.hotWaterLines ?? 0}`, 'hot-water lines'],
    ],
  },
  {
    id: 'electrical',
    label: 'Electrical',
    color: '#FFB300',
    Icon: ElectricBoltIcon,
    stats: (s) => [
      [`${s.sanctionedLoadKw ?? 0} kW`, 'sanctioned load'],
      [`${s.lightingPoints ?? 0}`, 'lighting points'],
      [`${s.powerPoints ?? 0}`, 'power points'],
    ],
  },
  {
    id: 'hvac',
    label: 'HVAC',
    color: '#9E9E9E',
    Icon: AcUnitIcon,
    stats: (s) => [
      [`${s.units ?? 0}`, 'indoor units'],
      [`${s.totalTonnage ?? 0} t`, 'total tonnage'],
      [`${s.coolingArea ?? 0} sqft`, 'cooled area'],
    ],
  },
  {
    id: 'waterTanks',
    label: 'Water tanks',
    color: '#00BCD4',
    Icon: OpacityIcon,
    stats: (s) => [
      [`${(s.overheadLitres ?? 0).toLocaleString('en-IN')} L`, 'overhead'],
      [`${(s.undergroundLitres ?? 0).toLocaleString('en-IN')} L`, 'underground'],
      [`${s.persons ?? 0}`, 'persons (assumed)'],
    ],
  },
  {
    id: 'sewage',
    label: 'Sewage',
    color: '#8D6E63',
    Icon: RecyclingIcon,
    stats: (s) => [
      [`${(s.septicCapacityLitres ?? 0).toLocaleString('en-IN')} L`, 'septic capacity'],
      [`${s.bathroomCount ?? 0}`, 'bathrooms'],
      [`${s.soakPit ? 'Yes' : 'No'}`, 'soak pit'],
    ],
  },
  {
    id: 'solar',
    label: 'Solar',
    color: '#FF6F00',
    Icon: SolarPowerIcon,
    stats: (s) => [
      [`${s.recommendedKwp ?? 0} kWp`, 'recommended'],
      [`${s.panelCount ?? 0}`, 'panels'],
      [`₹${(s.estimatedMonthlySavingsInr ?? 0).toLocaleString('en-IN')}`, 'monthly savings'],
    ],
  },
];

/**
 * 3-up grid of summary cards. Each card shows 3 key stats for its utility.
 *
 *   summary    utilities.summary object from the server
 *   onToggle   optional — click a card to toggle its layer in the SVG
 *   active     Set of active layers
 */
export default function UtilitySummaryCards({ summary = {}, onToggle, active }) {
  const theme = useTheme();
  const set = active instanceof Set ? active : new Set(active || []);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 2,
      }}
    >
      {CARDS.map((c, i) => {
        const s = summary[c.id] || {};
        const stats = c.stats(s);
        const isActive = set.has(c.id);
        const Icon = c.Icon;
        return (
          <MotionCard
            key={c.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: 'easeOut' }}
            whileHover={{ y: -3 }}
            elevation={0}
            onClick={() => onToggle?.(c.id)}
            sx={{
              p: 2.2,
              cursor: onToggle ? 'pointer' : 'default',
              background: theme.vastu.cardBg,
              border: isActive
                ? `2px solid ${c.color}`
                : theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              WebkitBackdropFilter: theme.vastu.cardBlur,
              boxShadow: isActive ? `0 0 28px ${c.color}40` : theme.vastu.cardShadow,
              transition: 'border-color .25s, box-shadow .25s',
            }}
          >
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 38, height: 38, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: `${c.color}22`,
                  border: `1px solid ${c.color}66`,
                }}
              >
                <Icon sx={{ color: c.color, fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{c.label}</Typography>
                {isActive && (
                  <Typography
                    variant="caption"
                    sx={{ color: c.color, fontWeight: 700, letterSpacing: 0.5 }}
                  >
                    LAYER VISIBLE
                  </Typography>
                )}
              </Box>
            </Stack>

            {/* Stat rows */}
            <Stack spacing={1}>
              {stats.map(([value, label], k) => (
                <Stack
                  key={k}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  sx={{
                    borderBottom: k < stats.length - 1
                      ? `1px dashed ${theme.palette.divider}`
                      : 'none',
                    pb: 0.6,
                  }}
                >
                  <Typography
                    sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'text.primary' }}
                  >
                    {value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', textAlign: 'right' }}
                  >
                    {label}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            {/* Water tank formula footer */}
            {c.id === 'waterTanks' && s.formula && (
              <Chip
                size="small"
                label={`Recommended: ${(s.overheadLitres || 0).toLocaleString('en-IN')}L overhead tank`}
                sx={{
                  mt: 1.5,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: `${c.color}1A`,
                  border: `1px solid ${c.color}66`,
                  color: c.color,
                }}
                variant="outlined"
              />
            )}
          </MotionCard>
        );
      })}
    </Box>
  );
}
