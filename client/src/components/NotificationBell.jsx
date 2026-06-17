import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton, Badge, Popover, Box, Stack, Typography, Button, Divider,
  List, ListItemButton, ListItemAvatar, ListItemText, Tooltip,
  CircularProgress, Avatar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import GavelIcon from '@mui/icons-material/Gavel';
import HandshakeIcon from '@mui/icons-material/Handshake';
import RateReviewIcon from '@mui/icons-material/RateReview';
import VerifiedIcon from '@mui/icons-material/Verified';
import PaidIcon from '@mui/icons-material/Paid';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import CancelIcon from '@mui/icons-material/Cancel';
import BlockIcon from '@mui/icons-material/Block';

import { api } from '../utils/axiosInstance';
import { getSocket } from '../utils/socketClient';

const EVENT_ICON = {
  generation_complete:  { Icon: AutoAwesomeIcon,        color: '#00BCD4' },
  collaborator_invited: { Icon: GroupAddIcon,           color: '#7B1FA2' },
  bid_placed:           { Icon: GavelIcon,              color: '#FF8F00' },
  bid_accepted:         { Icon: HandshakeIcon,          color: '#2E7D32' },
  review_submitted:     { Icon: RateReviewIcon,         color: '#0277BD' },
  review_accepted:      { Icon: VerifiedIcon,           color: '#2E7D32' },
  payment_captured:     { Icon: PaidIcon,               color: '#2E7D32' },
  plan_status_changed:  { Icon: HomeWorkIcon,           color: '#FF6F00' },
  comment_added:        { Icon: ChatBubbleOutlineIcon,  color: '#616161' },
  subscription_changed: { Icon: WorkspacePremiumIcon,   color: '#7B1FA2' },
  role_changed:         { Icon: ManageAccountsIcon,     color: '#5C6BC0' },
  architect_approved:   { Icon: VerifiedIcon,           color: '#2E7D32' },
  architect_rejected:   { Icon: CancelIcon,             color: '#C62828' },
  architect_suspended:  { Icon: BlockIcon,              color: '#E65100' },
};

function timeAgo(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN');
}

export default function NotificationBell() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Used to drive the badge "pop" animation on new arrivals
  const [popKey, setPopKey] = useState(0);
  const popTimerRef = useRef(null);

  const open = Boolean(anchorEl);

  /* ─── Initial unread-count fetch (cheap; runs once) ─── */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch { /* silent */ }
  }, []);

  /* ─── Lazy-load notifications when popover opens ─── */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 25 } });
      setList(data.notifications || []);
    } catch { /* surface inline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  /* ─── Real-time: socket 'notification' event ─── */
  useEffect(() => {
    const socket = getSocket();
    const handler = (payload) => {
      // Prepend to list (only if popover already populated)
      setList((prev) => prev.length > 0 ? [{ ...payload, read: false }, ...prev].slice(0, 25) : prev);
      setUnreadCount((c) => c + 1);

      // Trigger badge pop
      setPopKey((k) => k + 1);
      clearTimeout(popTimerRef.current);

      // Browser notification (if permission granted)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(payload.title || t('notifications.newNotification'), {
            body: payload.body || '',
            icon: '/logo192.png',
            tag: String(payload.id || Math.random()),
          });
          n.onclick = () => {
            window.focus();
            if (payload.actionUrl) navigate(payload.actionUrl);
          };
        } catch { /* some browsers block constructor invocations */ }
      }
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [navigate, t]);

  /* ─── Popover open ─── */
  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    if (list.length === 0) loadList();
  };

  /* ─── Click a notification ─── */
  const handleClick = async (n) => {
    if (!n.read) {
      // Optimistic
      setList((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.put(`/notifications/${n.id}/read`);
      } catch { /* revert silently */ }
    }
    setAnchorEl(null);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  /* ─── Mark all read ─── */
  const handleMarkAllRead = async () => {
    setList((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    try { await api.put('/notifications/read-all'); } catch { /* silent */ }
  };

  return (
    <>
      <Tooltip title={t('nav.notifications')}>
        <IconButton onClick={handleOpen} sx={{ color: 'text.primary' }}>
          <motion.div
            key={popKey}
            initial={popKey === 0 ? false : { scale: 1 }}
            animate={popKey === 0 ? {} : { scale: [1, 1.35, 1] }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'inline-flex' }}
          >
            <Badge
              badgeContent={unreadCount}
              color="error"
              max={99}
              overlap="circular"
              sx={{
                '& .MuiBadge-badge': {
                  fontWeight: 800, fontSize: '0.65rem',
                  boxShadow: unreadCount > 0 ? `0 0 8px ${theme.palette.error.main}` : 'none',
                  border: '2px solid',
                  borderColor: 'background.paper',
                },
              }}
            >
              {unreadCount > 0 ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
            </Badge>
          </motion.div>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: { xs: 'calc(100vw - 32px)', sm: 400 },
              maxWidth: 420,
              maxHeight: 540,
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              boxShadow: theme.vastu.cardShadow,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            px: 2, py: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>{t('notifications.title')}</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={handleMarkAllRead}
              sx={{ fontWeight: 700 }}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </Stack>

        {/* Body */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : list.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 6, px: 3, textAlign: 'center' }} spacing={1}>
              <NotificationsNoneIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              <Typography sx={{ fontWeight: 700 }}>{t('notifications.empty')}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('notifications.emptySub')}
              </Typography>
            </Stack>
          ) : (
            <List disablePadding>
              <AnimatePresence initial={false}>
                {list.map((n, i) => {
                  const meta = EVENT_ICON[n.event] || { Icon: NotificationsNoneIcon, color: theme.palette.primary.main };
                  const Icon = meta.Icon;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={i < 3 ? { opacity: 0, x: -20 } : false}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ListItemButton
                        onClick={() => handleClick(n)}
                        sx={{
                          py: 1.4, px: 2,
                          borderLeft: n.read ? '3px solid transparent' : `3px solid ${meta.color}`,
                          background: n.read ? 'transparent' : `${meta.color}0F`,
                          transition: 'background .2s',
                          '&:hover': { background: n.read ? theme.palette.action.hover : `${meta.color}1A` },
                        }}
                      >
                        <ListItemAvatar sx={{ minWidth: 44 }}>
                          <Avatar
                            sx={{
                              width: 32, height: 32,
                              background: `${meta.color}22`,
                              color: meta.color,
                            }}
                          >
                            <Icon sx={{ fontSize: 18 }} />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: n.read ? 500 : 700, fontSize: '0.88rem' }}
                            >
                              {n.title}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'text.secondary',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  fontSize: '0.76rem',
                                  lineHeight: 1.4,
                                  mb: 0.3,
                                }}
                              >
                                {n.body}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                                {timeAgo(n.createdAt)}
                              </Typography>
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                        {!n.read && (
                          <Box
                            sx={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: meta.color,
                              boxShadow: `0 0 6px ${meta.color}`,
                              flexShrink: 0, ml: 1,
                            }}
                          />
                        )}
                      </ListItemButton>
                      {i < list.length - 1 && <Divider />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}
