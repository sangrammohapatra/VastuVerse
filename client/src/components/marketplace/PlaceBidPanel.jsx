import { useEffect, useState } from 'react';
import {
  Drawer, Box, Stack, Typography, TextField, Button, Alert, IconButton,
  InputAdornment, CircularProgress, Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaidIcon from '@mui/icons-material/Paid';

import { api } from '../../utils/axiosInstance';

function inr(paise) { return '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN'); }

/**
 * Architect's bid placement panel.
 *
 *   open
 *   onClose()
 *   request        the open ReviewRequest the architect is bidding on
 *   onPlaced(bid)  callback after successful POST
 */
export default function PlaceBidPanel({ open, onClose, request, onPlaced }) {
  const theme = useTheme();

  const [feeInr, setFeeInr]   = useState('');
  const [timeline, setTimeline] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      // Pre-seed timeline with the homeowner's preference + 0
      setTimeline(String(request?.preferredTimelineDays || ''));
      setFeeInr(''); setCoverNote(''); setError(null);
    }
  }, [open, request]);

  const maxBudgetPaise = request?.maxBudgetInr || 0;
  const feePaise = Math.round(Number(feeInr) * 100);
  const overBudget = feePaise > maxBudgetPaise && feePaise > 0;

  const submit = async () => {
    if (!request) return;
    if (!(Number(feeInr) > 0)) { setError('Enter a fee.'); return; }
    if (overBudget)            { setError(`Fee exceeds the homeowner's maximum (${inr(maxBudgetPaise)}).`); return; }

    setSending(true); setError(null);
    try {
      const { data } = await api.post('/marketplace/bids', {
        reviewRequestId: request.id,
        proposedFee: feePaise,
        proposedTimeline: Number(timeline) || undefined,
        coverNote: coverNote.trim(),
      });
      onPlaced?.(data.bid);
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not place bid');
    } finally {
      setSending(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => !sending && onClose?.()}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          background: theme.vastu.cardBg,
          backdropFilter: theme.vastu.cardBlur,
          borderLeft: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <motion.div
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: '100%' }}
      >
        <Stack sx={{ height: '100%' }}>
          {/* Header */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              p: 2.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
              color: '#fff',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <HandshakeIcon />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Place a bid</Typography>
            </Stack>
            <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }} disabled={sending}>
              <CloseIcon />
            </IconButton>
          </Stack>

          {/* Body */}
          <Stack spacing={2.4} sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
            {/* Request context summary */}
            {request && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  background: theme.palette.action.hover,
                }}
              >
                <Typography sx={{ fontWeight: 700, mb: 0.4, fontSize: '0.95rem' }}>
                  {request.title}
                </Typography>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                  <Stack direction="row" alignItems="center" spacing={0.4}>
                    <PaidIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      up to {inr(request.maxBudgetInr)}
                    </Typography>
                  </Stack>
                  {request.preferredTimelineDays && (
                    <Stack direction="row" alignItems="center" spacing={0.4}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {request.preferredTimelineDays}d preferred
                      </Typography>
                    </Stack>
                  )}
                  {request.cityState?.city && (
                    <Stack direction="row" alignItems="center" spacing={0.4}>
                      <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {request.cityState.city}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
                {request.description && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      mt: 1, fontSize: '0.82rem', lineHeight: 1.5,
                      maxHeight: 80, overflow: 'auto',
                    }}
                  >
                    {request.description}
                  </Typography>
                )}
              </Box>
            )}

            {/* Form fields */}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Your fee"
                value={feeInr}
                onChange={(e) => setFeeInr(e.target.value.replace(/[^\d]/g, ''))}
                size="small"
                sx={{ flex: 1.4 }}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                error={overBudget}
                helperText={overBudget ? `Exceeds ${inr(maxBudgetPaise)}` : 'You receive 85% after homeowner accepts the review'}
              />
              <TextField
                label="Timeline"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value.replace(/\D/g, ''))}
                size="small"
                sx={{ flex: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">days</InputAdornment> }}
              />
            </Stack>

            {feePaise > 0 && !overBudget && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`You earn ${inr(Math.round(feePaise * 0.85))}`}
                  size="small"
                  color="success"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {inr(Math.round(feePaise * 0.15))} platform commission (15%)
                </Typography>
              </Stack>
            )}

            <TextField
              fullWidth
              multiline
              minRows={4}
              maxRows={8}
              label="Cover note"
              placeholder="Briefly explain your approach: what you'll check, your relevant experience, anything specific to this plan…"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              size="small"
              inputProps={{ maxLength: 2000 }}
              helperText={`${coverNote.length}/2000`}
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>

          {/* Footer */}
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1.2}
            sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}
          >
            <Button onClick={onClose} disabled={sending}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon />}
              onClick={submit}
              disabled={sending || overBudget || !(Number(feeInr) > 0)}
              sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
            >
              {sending ? 'Sending…' : 'Submit bid'}
            </Button>
          </Stack>
        </Stack>
      </motion.div>
    </Drawer>
  );
}
