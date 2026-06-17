import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Box, Typography, Stack, Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CountUp from 'react-countup';

/**
 * Cost breakdown table.
 *
 * Animated INR amounts via react-countup. When `finishTier` changes upstream
 * the parent passes a fresh `estimate`, and CountUp's default behaviour is
 * to tween from the previous value — exactly the "count up/down" the brief
 * asks for.
 *
 *   estimate          full server response (categories + total + variance + asOf)
 *   prevEstimate      previous response (for the count-up start value); optional
 */
export default function CostBreakdownTable({ estimate, prevEstimate }) {
  const theme = useTheme();
  if (!estimate?.categories) return null;

  const cats = Object.entries(estimate.categories);

  return (
    <Box
      sx={{
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <TableContainer>
        <Table size="medium">
          <TableHead>
            <TableRow
              sx={{
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)',
              }}
            >
              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5, fontSize: '0.78rem' }}>
                CATEGORY
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5, fontSize: '0.78rem' }}>
                UNIT RATE
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5, fontSize: '0.78rem' }}>
                AMOUNT (₹)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cats.map(([key, c]) => {
              const prev = prevEstimate?.categories?.[key]?.totalInr;
              return (
                <TableRow
                  key={key}
                  hover
                  sx={{ '&:last-of-type td': { borderBottom: 'none' } }}
                >
                  <TableCell>
                    <Typography sx={{ fontWeight: 700 }}>{c.label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {c.description}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      ₹ <CountUp start={prev ? prev / estimate.buaSqft : 0} end={c.unitRateInrPerSqft} duration={0.7} separator="," />
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      / sqft
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    ₹{' '}
                    <CountUp
                      start={prev || 0}
                      end={c.totalInr}
                      duration={0.9}
                      separator=","
                    />
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Total row */}
            <TableRow
              sx={{
                background: theme.palette.mode === 'dark'
                  ? 'rgba(76,175,80,0.08)'
                  : 'rgba(46,125,50,0.06)',
              }}
            >
              <TableCell>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  TOTAL
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Built-up area: {estimate.buaSqft?.toLocaleString('en-IN')} sqft
                </Typography>
              </TableCell>
              <TableCell />
              <TableCell align="right">
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.4rem',
                    color: 'primary.main',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ₹{' '}
                  <CountUp
                    start={prevEstimate?.totalInr || 0}
                    end={estimate.totalInr}
                    duration={1.2}
                    separator=","
                  />
                </Typography>
                <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 0.4 }}>
                  <Chip
                    size="small"
                    label={
                      <>
                        ±15% &middot; ₹{(estimate.minInr || 0).toLocaleString('en-IN')} – ₹
                        {(estimate.maxInr || 0).toLocaleString('en-IN')}
                      </>
                    }
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                  />
                </Stack>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
