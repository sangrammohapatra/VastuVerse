import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, Card, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Avatar, Chip, Alert,
} from '@mui/material';
import {
  Timeline, TimelineItem, TimelineSeparator, TimelineConnector,
  TimelineContent, TimelineDot, TimelineOppositeContent,
} from '@mui/lab';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import RestoreIcon from '@mui/icons-material/Restore';
import HistoryIcon from '@mui/icons-material/History';

import { api } from '../../utils/axiosInstance';

const STEP_LABELS = {
  step1: 'Land', step2: 'Rooms', step3: 'Floor Plan', step4: 'Interior',
  step5: 'Exterior', step6: 'Utilities', step7: 'Cost', step8: '3D View',
  step9: 'Municipal', step10: 'Review', manual: 'Manual snapshot',
};

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN');
}

export default function VersionTimeline({ planId, onRollback }) {
  const theme = useTheme();
  const [phase, setPhase] = useState('loading'); // loading|ready|error|empty
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState(null);

  const [confirm, setConfirm] = useState({ open: false, version: null, rolling: false });

  const refetch = useCallback(async () => {
    if (!planId) return;
    try {
      const { data } = await api.get(`/plans/${planId}/versions`);
      const v = data.versions || [];
      setVersions(v);
      setPhase(v.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      setPhase('error');
      setError(e.response?.data?.error || 'Could not load versions');
    }
  }, [planId]);

  useEffect(() => { refetch(); }, [refetch]);

  const handleRollback = async () => {
    const v = confirm.version;
    if (!v || !planId) return;
    setConfirm((c) => ({ ...c, rolling: true }));
    try {
      await api.put(`/plans/${planId}/versions/${v.id}/rollback`);
      setConfirm({ open: false, version: null, rolling: false });
      await refetch();
      onRollback?.(v);
    } catch (e) {
      setConfirm((c) => ({ ...c, rolling: false }));
      setError(e.response?.data?.error || 'Rollback failed');
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <HistoryIcon sx={{ color: 'info.main' }} />
        <Typography sx={{ fontWeight: 700 }}>Version history</Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {phase === 'loading' && (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={64} sx={{ borderRadius: 2 }} />)}
        </Stack>
      )}

      {phase === 'empty' && (
        <Card
          elevation={0}
          sx={{
            p: 2.5, textAlign: 'center',
            background: theme.vastu.cardBg, border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No snapshots saved yet. Versions are created automatically when major steps complete.
          </Typography>
        </Card>
      )}

      {phase === 'ready' && (
        <Timeline
          position="right"
          sx={{
            m: 0, p: 0,
            '& .MuiTimelineItem-root::before': { flex: 0, padding: 0 }, // suppress left gutter
          }}
        >
          <AnimatePresence>
            {versions.map((v, i) => (
              <TimelineItem key={v.id}>
                <TimelineOppositeContent sx={{ display: 'none' }} />
                <TimelineSeparator>
                  <TimelineDot
                    sx={{
                      bgcolor: v.isRollbackPoint ? 'warning.main' : 'primary.main',
                      boxShadow: theme.vastu.glowPrimary,
                    }}
                  />
                  {i < versions.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 2 }}>
                  <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.35 }}
                  >
                    <Card
                      elevation={0}
                      sx={{
                        p: 1.5,
                        background: theme.vastu.cardBg,
                        border: theme.vastu.cardBorder,
                        backdropFilter: theme.vastu.cardBlur,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                              v{v.versionNumber}
                            </Typography>
                            <Chip
                              label={STEP_LABELS[v.stepName] || v.stepName}
                              size="small"
                              sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                            />
                            {v.isRollbackPoint && (
                              <Chip
                                label="ROLLBACK"
                                size="small"
                                color="warning"
                                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800 }}
                              />
                            )}
                          </Stack>
                          {v.label && (
                            <Typography
                              variant="body2"
                              sx={{ color: 'text.primary', mb: 0.3, fontWeight: 600 }}
                            >
                              {v.label}
                            </Typography>
                          )}
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            {v.createdBy && (
                              <Avatar
                                src={v.createdBy.avatarUrl}
                                sx={{ width: 18, height: 18, fontSize: '0.65rem' }}
                              >
                                {(v.createdBy.fullName || v.createdBy.email || 'U').charAt(0).toUpperCase()}
                              </Avatar>
                            )}
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {v.createdBy?.fullName || v.createdBy?.email || 'system'} · {timeAgo(v.createdAt)}
                            </Typography>
                          </Stack>
                        </Box>

                        <Button
                          size="small"
                          startIcon={<RestoreIcon fontSize="small" />}
                          onClick={() => setConfirm({ open: true, version: v, rolling: false })}
                          disabled={i === 0}
                          sx={{ flexShrink: 0, fontWeight: 700 }}
                        >
                          {i === 0 ? 'Current' : 'Rollback'}
                        </Button>
                      </Stack>
                    </Card>
                  </motion.div>
                </TimelineContent>
              </TimelineItem>
            ))}
          </AnimatePresence>
        </Timeline>
      )}

      {/* Confirm rollback dialog */}
      <Dialog
        open={confirm.open}
        onClose={() => !confirm.rolling && setConfirm({ open: false, version: null, rolling: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Roll back to version {confirm.version?.versionNumber}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will restore the plan to the state captured in v{confirm.version?.versionNumber} ·{' '}
            <strong>{confirm.version?.label || STEP_LABELS[confirm.version?.stepName] || 'snapshot'}</strong>.
            A pre-rollback snapshot of the current state will be saved automatically — you can undo this.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirm({ open: false, version: null, rolling: false })}
            disabled={confirm.rolling}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRollback}
            disabled={confirm.rolling}
            startIcon={<RestoreIcon />}
            sx={{ fontWeight: 700 }}
          >
            {confirm.rolling ? 'Rolling back…' : 'Roll back'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
