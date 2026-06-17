import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Avatar, AvatarGroup, IconButton, Tooltip,
  Tabs, Tab, TextField, MenuItem, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Skeleton, Alert, Divider, InputAdornment, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplyIcon from '@mui/icons-material/Reply';

import { api } from '../../utils/axiosInstance';
import { getSocket, setAuthToken } from '../../utils/socketClient';
import { useAuth } from '../../context/AuthContext';

const STEP_OPTIONS = [
  { id: 'all',   label: 'All' },
  { id: 'step1', label: 'Land' },
  { id: 'step2', label: 'Rooms' },
  { id: 'step3', label: 'Plan' },
  { id: 'step4', label: 'Interior' },
  { id: 'step5', label: 'Exterior' },
  { id: 'step6', label: 'Utility' },
  { id: 'step7', label: 'Cost' },
  { id: 'step8', label: '3D' },
  { id: 'step9', label: 'Municipal' },
  { id: 'step10',label: 'Review' },
];

const PERMISSION_META = {
  view:    { Icon: VisibilityIcon,         label: 'Viewer',   color: '#0277BD' },
  comment: { Icon: ChatBubbleOutlineIcon,  label: 'Commenter',color: '#7B1FA2' },
  edit:    { Icon: EditIcon,               label: 'Editor',   color: '#2E7D32' },
};

function initials(s = '') {
  return (s || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('en-IN');
}

export default function CollaboratorPanel({ planId, planRooms = [] }) {
  const theme = useTheme();
  const { accessToken } = useAuth();

  const [collaborators, setCollaborators] = useState([]);
  const [collabPhase, setCollabPhase] = useState('loading'); // loading|ready|error

  const [comments, setComments] = useState([]);
  const [commentsPhase, setCommentsPhase] = useState('loading');
  const [activeStep, setActiveStep] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);

  const listEndRef = useRef(null);

  /* ─── Socket subscription ───────────────────────────────────────── */
  useEffect(() => { if (accessToken) setAuthToken(accessToken); }, [accessToken]);

  useEffect(() => {
    if (!planId) return undefined;
    const socket = getSocket();

    const subscribe = () => socket.emit('plan:subscribe', { planId, channels: ['comments', 'status'] });
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onNew = (payload) => {
      if (String(payload.planId) !== String(planId)) return;
      setComments((prev) => {
        if (prev.some((c) => String(c.id) === String(payload.id))) return prev;
        return [payload, ...prev];
      });
    };
    const onResolved = (payload) => {
      if (String(payload.planId) !== String(planId)) return;
      setComments((prev) => prev.map((c) =>
        String(c.id) === String(payload.id)
          ? { ...c, resolved: payload.resolved, resolvedAt: payload.resolvedAt }
          : c
      ));
    };
    const onJoined = () => loadCollaborators();

    socket.on('comment:created', onNew);
    socket.on('comment:resolved', onResolved);
    socket.on('collaborator:joined', onJoined);

    return () => {
      socket.off('connect', subscribe);
      socket.off('comment:created', onNew);
      socket.off('comment:resolved', onResolved);
      socket.off('collaborator:joined', onJoined);
      socket.emit('plan:unsubscribe', { planId, channels: ['comments', 'status'] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  /* ─── Initial loads ─────────────────────────────────────────────── */
  const loadCollaborators = useCallback(async () => {
    if (!planId) return;
    setCollabPhase('loading');
    try {
      const { data } = await api.get(`/plans/${planId}/collaborators`);
      setCollaborators(data.collaborators || []);
      setCollabPhase('ready');
    } catch {
      setCollabPhase('error');
    }
  }, [planId]);

  const loadComments = useCallback(async (stepName) => {
    if (!planId) return;
    setCommentsPhase('loading');
    try {
      const params = stepName && stepName !== 'all' ? { stepName, limit: 30 } : { limit: 30 };
      const { data } = await api.get(`/plans/${planId}/comments`, { params });
      setComments(data.comments || []);
      setCommentsPhase('ready');
    } catch {
      setCommentsPhase('error');
    }
  }, [planId]);

  useEffect(() => { loadCollaborators(); }, [loadCollaborators]);
  useEffect(() => { loadComments(activeStep); }, [loadComments, activeStep]);

  /* ─── Group comments into threads (root → replies) ──────────────── */
  const threads = useMemo(() => {
    const roots = [];
    const childrenByParent = new Map();
    comments.forEach((c) => {
      if (c.parentId) {
        const list = childrenByParent.get(String(c.parentId)) || [];
        list.push(c);
        childrenByParent.set(String(c.parentId), list);
      } else {
        roots.push(c);
      }
    });
    return roots.map((r) => ({
      ...r,
      replies: (childrenByParent.get(String(r.id)) || []).reverse(), // chronological replies
    }));
  }, [comments]);

  return (
    <Box>
      {/* ─── Collaborators header ─────────────────────────────────── */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700 }}>Collaborators</Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<PersonAddAlt1Icon fontSize="small" />}
            onClick={() => setInviteOpen(true)}
            sx={{ fontWeight: 700 }}
          >
            Invite
          </Button>
        </Stack>

        {collabPhase === 'loading' ? (
          <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
        ) : collaborators.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            No collaborators yet. Invite someone to comment on or edit this plan.
          </Typography>
        ) : (
          <Stack direction="row" alignItems="center" spacing={1.2} flexWrap="wrap">
            <AvatarGroup max={6} sx={{ '& .MuiAvatar-root': { width: 34, height: 34, fontSize: '0.85rem' } }}>
              {collaborators.map((c) => {
                const meta = PERMISSION_META[c.permission] || PERMISSION_META.view;
                const name = c.user?.fullName || c.email;
                return (
                  <Tooltip key={c.id} title={`${name} · ${meta.label}${c.inviteStatus !== 'accepted' ? ' (pending)' : ''}`}>
                    <Avatar
                      src={c.user?.avatarUrl}
                      sx={{
                        bgcolor: meta.color,
                        opacity: c.inviteStatus === 'accepted' ? 1 : 0.55,
                        border: c.inviteStatus === 'accepted' ? `2px solid ${meta.color}` : `2px dashed ${meta.color}`,
                      }}
                    >
                      {initials(name)}
                    </Avatar>
                  </Tooltip>
                );
              })}
            </AvatarGroup>
            {collaborators.filter((c) => c.inviteStatus === 'pending').length > 0 && (
              <Chip
                size="small"
                label={`${collaborators.filter((c) => c.inviteStatus === 'pending').length} pending`}
                sx={{ fontWeight: 700 }}
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
        )}
      </Card>

      {/* ─── Comments ─────────────────────────────────────────────── */}
      <Card
        elevation={0}
        sx={{
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Comments</Typography>
          <Tabs
            value={activeStep}
            onChange={(_e, v) => setActiveStep(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.75rem', fontWeight: 700 } }}
          >
            {STEP_OPTIONS.map((o) => (
              <Tab key={o.id} value={o.id} label={o.label} />
            ))}
          </Tabs>
        </Box>
        <Divider />

        {/* List */}
        <Box sx={{ maxHeight: 480, overflowY: 'auto', p: 1.5 }}>
          {commentsPhase === 'loading' ? (
            <Stack spacing={1}>
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={68} sx={{ borderRadius: 2 }} />)}
            </Stack>
          ) : threads.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
              No comments yet. Start a thread below — your collaborators will see it in real time.
            </Typography>
          ) : (
            <Stack spacing={1.2}>
              <AnimatePresence initial={false}>
                {threads.map((t) => (
                  <Thread key={t.id} thread={t} planId={planId} onChange={loadComments} activeStep={activeStep} />
                ))}
              </AnimatePresence>
            </Stack>
          )}
          <div ref={listEndRef} />
        </Box>

        <Divider />

        {/* Composer */}
        <NewCommentInput
          planId={planId}
          activeStep={activeStep}
          rooms={planRooms}
          onSent={(payload) => {
            // Optimistic add — socket will dedupe via id check
            setComments((prev) =>
              prev.some((c) => String(c.id) === String(payload.id)) ? prev : [payload, ...prev]
            );
          }}
        />
      </Card>

      <InviteDialog
        open={inviteOpen}
        planId={planId}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); loadCollaborators(); }}
      />
    </Box>
  );
}

/* ─── Thread ──────────────────────────────────────────────────────── */

function Thread({ thread, planId, onChange, activeStep }) {
  const theme = useTheme();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const toggleResolve = async () => {
    try {
      await api.put(`/comments/${thread.id}/resolve`, { resolved: !thread.resolved });
      // socket will fan out; nothing to do here
    } catch (e) { /* ignore */ }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api.post(`/plans/${planId}/comments`, {
        content: replyText,
        parentId: thread.id,
        stepName: thread.stepName,
      });
      setReplyText('');
      setReplyOpen(false);
      onChange?.(activeStep);
    } catch (e) { /* ignore */ }
    finally { setSending(false); }
  };

  const stepChip = thread.stepName ? thread.stepName.replace('step', 'Step ') : 'General';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        elevation={0}
        sx={{
          p: 1.4,
          background: thread.resolved
            ? theme.palette.mode === 'dark' ? 'rgba(76,175,80,0.05)' : 'rgba(46,125,50,0.04)'
            : theme.palette.background.paper,
          border: `1px solid ${thread.resolved ? theme.palette.success.main + '55' : theme.palette.divider}`,
          opacity: thread.resolved ? 0.85 : 1,
        }}
      >
        <CommentRow comment={thread} stepChip={stepChip} />

        {/* Replies */}
        {thread.replies?.length > 0 && (
          <Stack spacing={0.8} sx={{ mt: 1.2, pl: 4, borderLeft: `2px solid ${theme.palette.divider}` }}>
            {thread.replies.map((r) => <CommentRow key={r.id} comment={r} isReply />)}
          </Stack>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={0.6} sx={{ mt: 1 }}>
          <Button
            size="small"
            startIcon={<ReplyIcon fontSize="small" />}
            onClick={() => setReplyOpen((v) => !v)}
            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
          >
            Reply
          </Button>
          <Button
            size="small"
            startIcon={<CheckCircleIcon fontSize="small" />}
            color={thread.resolved ? 'success' : 'primary'}
            onClick={toggleResolve}
            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
          >
            {thread.resolved ? 'Reopen' : 'Resolve'}
          </Button>
        </Stack>

        <AnimatePresence>
          {replyOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  maxRows={3}
                  placeholder="Write a reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply();
                  }}
                />
                <IconButton
                  color="primary"
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  size="small"
                >
                  {sending ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                </IconButton>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function CommentRow({ comment, stepChip, isReply = false }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.2}>
      <Avatar
        src={comment.author?.avatarUrl}
        sx={{
          width: isReply ? 24 : 30,
          height: isReply ? 24 : 30,
          fontSize: isReply ? '0.7rem' : '0.85rem',
        }}
      >
        {initials(comment.author?.fullName || comment.author?.email)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            {comment.author?.fullName || comment.author?.email || 'Unknown'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {timeAgo(comment.createdAt)}
          </Typography>
          {stepChip && !isReply && (
            <Chip
              size="small"
              label={stepChip}
              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
            />
          )}
          {comment.resolved && (
            <Chip
              size="small"
              icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
              label="resolved"
              color="success"
              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
            />
          )}
        </Stack>
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.2 }}
        >
          {comment.content}
        </Typography>
      </Box>
    </Stack>
  );
}

/* ─── New comment composer ────────────────────────────────────────── */

function NewCommentInput({ planId, activeStep, rooms = [], onSent }) {
  const theme = useTheme();
  const [content, setContent] = useState('');
  const [stepName, setStepName] = useState(activeStep === 'all' ? 'step1' : activeStep);
  const [roomId, setRoomId] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (activeStep !== 'all') setStepName(activeStep);
  }, [activeStep]);

  const send = async () => {
    if (!content.trim() || !planId) return;
    setSending(true);
    try {
      const { data } = await api.post(`/plans/${planId}/comments`, {
        content,
        stepName,
        roomId: roomId || undefined,
      });
      setContent('');
      onSent?.(data.comment);
    } catch (e) { /* ignore */ }
    finally { setSending(false); }
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          size="small"
          select
          label="Step"
          value={stepName}
          onChange={(e) => setStepName(e.target.value)}
          sx={{ minWidth: 110 }}
        >
          {STEP_OPTIONS.filter((o) => o.id !== 'all').map((o) => (
            <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
          ))}
        </TextField>
        {rooms.length > 0 && (
          <TextField
            size="small"
            select
            label="Room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="">— any —</MenuItem>
            {rooms.map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
            ))}
          </TextField>
        )}
      </Stack>
      <TextField
        fullWidth
        multiline
        size="small"
        minRows={2}
        maxRows={6}
        placeholder="Add a comment… (⌘/Ctrl + Enter to send)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                color="primary"
                onClick={send}
                disabled={!content.trim() || sending}
                size="small"
              >
                {sending ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}

/* ─── Invite dialog ───────────────────────────────────────────────── */

function InviteDialog({ open, planId, onClose, onInvited }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('comment');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const send = async () => {
    if (!email.trim()) return;
    setSending(true); setError(null); setSuccess(null);
    try {
      const { data } = await api.post(`/plans/${planId}/collaborators`, {
        email: email.trim(),
        permission,
      });
      setSuccess(`Invite sent to ${data.email}`);
      setEmail('');
      setTimeout(onInvited, 800);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !sending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Invite a collaborator</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="architect@example.com"
            disabled={sending}
          />
          <TextField
            select
            label="Permission"
            fullWidth
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            disabled={sending}
          >
            <MenuItem value="view">Viewer — read-only</MenuItem>
            <MenuItem value="comment">Commenter — can comment</MenuItem>
            <MenuItem value="edit">Editor — can change the plan</MenuItem>
          </TextField>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Invite expires in 14 days. The recipient signs in with the invited email.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={sending}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <PersonAddAlt1Icon />}
          onClick={send}
          disabled={!email.trim() || sending}
          sx={{ fontWeight: 700, boxShadow: theme.vastu.glowPrimary }}
        >
          {sending ? 'Sending…' : 'Send invite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
