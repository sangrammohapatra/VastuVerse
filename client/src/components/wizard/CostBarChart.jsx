import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LabelList,
} from 'recharts';

const COLORS = [
  '#2E7D32', // civil — primary green
  '#FFB300', // electrical — yellow
  '#42A5F5', // plumbing — blue
  '#8E24AA', // flooring — purple
  '#FB8C00', // painting — orange
  '#5C6BC0', // fixtures — indigo
];

function inrShort(n) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${n}`;
}

/**
 * Visual breakdown for the cost table.
 *
 *   estimate    full server response — { categories: { ... }, totalInr }
 */
export default function CostBarChart({ estimate }) {
  const theme = useTheme();

  const data = useMemo(() => {
    if (!estimate?.categories) return [];
    return Object.entries(estimate.categories).map(([key, c]) => ({
      key,
      name: c.label.split(' ')[0], // short axis label
      fullName: c.label,
      amount: c.totalInr,
    }));
  }, [estimate]);

  if (data.length === 0) return null;

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        borderRadius: 3,
      }}
    >
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Cost by category</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        Hover or tap a bar for the exact figure.
      </Typography>

      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 600 }}
              axisLine={{ stroke: theme.palette.divider }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
              tickFormatter={inrShort}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: theme.palette.action.hover }}
              contentStyle={{
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 8,
                fontWeight: 600,
              }}
              formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
            />
            <Bar
              dataKey="amount"
              radius={[6, 6, 0, 0]}
              isAnimationActive
              animationBegin={120}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList
                dataKey="amount"
                position="top"
                formatter={inrShort}
                style={{ fontSize: 11, fontWeight: 700, fill: theme.palette.text.primary }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
