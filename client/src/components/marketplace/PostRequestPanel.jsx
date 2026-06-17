import { useEffect, useMemo, useState } from 'react';
import {
  Drawer, Box, Stack, Typography, TextField, MenuItem, Button, Alert, IconButton,
  InputAdornment, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import GavelIcon from '@mui/icons-material/Gavel';

import { api } from '../../utils/axiosInstance';

/**
 * Slide-in panel to post a new review request.
 *
 *   open        boolean
 *   onClose()
 *   completedPlans  [{ _id, title, cityState }] — only plans with status === 'COMPLETED'
 *   onCreated(req)   invoked after successful POST
 */
export default function PostRequestPanel({ open, onClose, completedPlans = [], onCreated }) {
  const theme = useTheme();

  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeline, setTimeline] = useState('7');
  const [budgetInr, setBudgetInr] = useState(''); // rupees as the user enters

  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && !planId && completedPlans.length > 0) {
      setPlanId(completedPlans[0]._id);
      setTitle(`Plan review — ${completedPlans[0].title}`);
    }
  }, [open, planId, completedPlans]);

  const reset = () => {
    setPlanId(''); setTitle(''); setDescription('');
    setTimeline('7'); setBudgetInr(''); setError(null);
  };

  const submit = async () => {
    if (!planId || !title.trim() || !(Number(budgetInr) > 0)) {
      setError('Choose a plan, give it a title, and set a budget.');
      return;
    }
    setSending(true); setError(null);
    try {
      const { data } = await api.post('/marketplace/review-requests', {
        planId,
        title: title.trim(),
        description: description.trim(),
        preferredTimelineDays: Number(timeline) || undefined,
        maxBudgetInr: Math.round(Number(budgetInr) * 100), // → paise
      });
      onCreated?.(data.reviewRequest);
      reset();
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not post request');
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
              <GavelIcon />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                Post a review request
              </Typography>
            </Stack>
            <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }} disabled={sending}>
              <CloseIcon />
            </IconButton>
          </Stack>

          {/* Body */}
          <Stack spacing={2.4} sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
            {completedPlans.length === 0 ? (
              <Alert severity="info">
                You need a plan with status <strong>COMPLETED</strong> before you can post a review request.
              </Alert>
            ) : (
              <>
                <TextField
                  select
                  fullWidth
                  label="Plan"
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    const plan = completedPlans.find((p) => p._id === e.target.value);
                    if (plan && !title) setTitle(`Plan review — ${plan.title}`);
                  }}
                  size="small"
                >
                  {completedPlans.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.title} {p.cityState?.city && `· ${p.cityState.city}`}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  size="small"
                  inputProps={{ maxLength: 160 }}
                  helperText={`${title.length}/160`}
                />

                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={8}
                  label="What do you need reviewed?"
                  placeholder="E.g. cross-check setbacks, vastu alignment for the master bedroom, structural feasibility for the 2nd floor cantilever…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  size="small"
                  inputProps={{ maxLength: 4000 }}
                />

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Preferred timeline"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value.replace(/\D/g, ''))}
                    size="small"
                    sx={{ flex: 1 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">days</InputAdornment> }}
                  />
                  <TextField
                    label="Max budget"
                    value={budgetInr}
                    onChange={(e) => setBudgetInr(e.target.value.replace(/[^\d]/g, ''))}
                    size="small"
                    sx={{ flex: 1.4 }}
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  />
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}
              </>
            )}
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
              disabled={sending || completedPlans.length === 0}
              sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
            >
              {sending ? 'Posting…' : 'Post request'}
            </Button>
          </Stack>
        </Stack>
      </motion.div>
    </Drawer>
  );
}
