import { useState } from 'react';
import {
  Button, Menu, MenuItem, Stack, Typography, Box, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import LanguageIcon from '@mui/icons-material/Language';
import CheckIcon from '@mui/icons-material/Check';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import i18n, { LANGUAGES } from '../i18n/i18n';
import { api } from '../utils/axiosInstance';

/**
 * Animated language picker.
 *
 *   variant = 'button'  — outlined button with the current flag + native name
 *   variant = 'compact' — icon-only (for tight headers)
 *
 *   persist = true       — also PUT /users/me to save the choice (default true).
 *                          Pass false when user is unauthenticated (e.g. /login).
 *   onChange(code)       — optional callback (in addition to i18n.changeLanguage)
 */
export default function LanguageSelector({ variant = 'button', persist = true, onChange }) {
  const theme = useTheme();
  const { i18n: i18nHook } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [saving, setSaving] = useState(false);
  const open = Boolean(anchorEl);

  const currentCode = (i18nHook.language || 'en').split('-')[0];
  const currentLang = LANGUAGES.find((l) => l.code === currentCode) || LANGUAGES[0];

  const choose = async (code) => {
    setAnchorEl(null);
    if (code === currentCode) return;

    // 1. Switch i18n immediately for snappy UX
    await i18n.changeLanguage(code);
    onChange?.(code);

    // 2. Persist to server (best-effort)
    if (persist) {
      setSaving(true);
      try {
        await api.put('/users/me', { preferredLanguage: code });
      } catch (e) {
        // Non-fatal — local storage already has the change
        console.warn('[language] persist failed:', e?.message);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <Button
          onClick={(e) => setAnchorEl(e.currentTarget)}
          startIcon={<LanguageIcon />}
          size="small"
          sx={{ fontWeight: 700, minWidth: 0, px: 1 }}
        >
          <Box component="span" sx={{ fontSize: '1.1rem', mr: 0.5 }}>{currentLang.flag}</Box>
          {currentLang.code.toUpperCase()}
        </Button>
      ) : (
        <Button
          onClick={(e) => setAnchorEl(e.currentTarget)}
          variant="outlined"
          endIcon={
            <motion.div
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'inline-flex' }}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </motion.div>
          }
          sx={{ fontWeight: 700, justifyContent: 'space-between', minWidth: 200 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box component="span" sx={{ fontSize: '1.25rem' }}>{currentLang.flag}</Box>
            <Stack alignItems="flex-start" spacing={0} sx={{ lineHeight: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
                {currentLang.nativeName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                {currentLang.label}
              </Typography>
            </Stack>
            {saving && <CircularProgress size={12} sx={{ ml: 0.5 }} />}
          </Stack>
        </Button>
      )}

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 240,
              background: theme.vastu.cardBg,
              border: theme.vastu.cardBorder,
              backdropFilter: theme.vastu.cardBlur,
              boxShadow: theme.vastu.cardShadow,
            },
          },
        }}
        TransitionProps={{ timeout: 200 }}
      >
        {LANGUAGES.map((lng, i) => {
          const selected = lng.code === currentCode;
          return (
            <motion.div
              key={lng.code}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.025, duration: 0.2 }}
            >
              <MenuItem
                selected={selected}
                onClick={() => choose(lng.code)}
                sx={{
                  py: 1.2,
                  borderLeft: selected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                  '&.Mui-selected': {
                    background: `${theme.palette.primary.main}14`,
                    '&:hover': { background: `${theme.palette.primary.main}22` },
                  },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.4} sx={{ width: '100%' }}>
                  <Box sx={{ fontSize: '1.4rem' }}>{lng.flag}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500, lineHeight: 1.2 }}>
                      {lng.nativeName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                      {lng.label}
                    </Typography>
                  </Box>
                  {selected && <CheckIcon sx={{ color: 'primary.main', fontSize: 18 }} />}
                </Stack>
              </MenuItem>
            </motion.div>
          );
        })}
      </Menu>
    </>
  );
}
