import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Card, Alert, Skeleton, Button,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Divider, Chip, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';

import { api } from '../../utils/axiosInstance';

const PROVIDER_META = {
  none: {
    label: 'None (passthrough)',
    color: '#616161',
    description: 'Images are stored as ephemeral provider URLs. Pollinations URLs are stateless; DALL-E URLs expire after ~1 hour.',
  },
  cloudinary: {
    label: 'Cloudinary',
    color: '#3448C5',
    description: 'Upload to Cloudinary CDN. Enter the full URL from your Cloudinary dashboard in the format cloudinary://api_key:api_secret@cloud_name.',
  },
  s3: {
    label: 'AWS S3',
    color: '#FF9900',
    description: 'Upload to a public-read S3 bucket. The bucket must have s3:PutObject permission granted to the credentials below.',
  },
};

export default function AdminStorageSettings() {
  const theme = useTheme();

  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [loadError, setLoadError]   = useState(null);
  const [saveAlert, setSaveAlert]   = useState(null); // { severity, message }
  const [testAlert, setTestAlert]   = useState(null);

  const [provider, setProvider]                   = useState('none');
  const [cloudinaryUrl, setCloudinaryUrl]         = useState('');
  const [s3Bucket, setS3Bucket]                   = useState('');
  const [s3Region, setS3Region]                   = useState('');
  const [s3AccessKeyId, setS3AccessKeyId]         = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [showSecret, setShowSecret]               = useState(false);
  const [showCloudinaryUrl, setShowCloudinaryUrl] = useState(false);
  const [updatedAt, setUpdatedAt]                 = useState(null);

  /* ── load ───────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get('/admin/storage-settings');
      setProvider(data.provider || 'none');
      setCloudinaryUrl(data.cloudinaryUrl || '');
      setS3Bucket(data.s3Bucket || '');
      setS3Region(data.s3Region || '');
      setS3AccessKeyId(data.s3AccessKeyId || '');
      setS3SecretAccessKey(data.s3SecretAccessKey || '');
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setLoadError(e.response?.data?.error || 'Failed to load storage settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── save ───────────────────────────────────────────────────────── */

  const handleSave = async () => {
    setSaving(true);
    setSaveAlert(null);
    try {
      await api.put('/admin/storage-settings', {
        provider,
        cloudinaryUrl,
        s3Bucket,
        s3Region,
        s3AccessKeyId,
        s3SecretAccessKey,
      });
      setSaveAlert({ severity: 'success', message: 'Storage settings saved.' });
      load();
    } catch (e) {
      setSaveAlert({ severity: 'error', message: e.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  /* ── test ───────────────────────────────────────────────────────── */

  const handleTest = async () => {
    setTesting(true);
    setTestAlert(null);
    try {
      const { data } = await api.post('/admin/storage-settings/test', {
        provider,
        cloudinaryUrl,
        s3Bucket,
        s3Region,
        s3AccessKeyId,
        s3SecretAccessKey,
      });
      setTestAlert({ severity: data.ok ? 'success' : 'error', message: data.message });
    } catch (e) {
      setTestAlert({ severity: 'error', message: e.response?.data?.message || 'Test request failed.' });
    } finally {
      setTesting(false);
    }
  };

  /* ── helpers ────────────────────────────────────────────────────── */

  const handleProviderChange = (e) => {
    setProvider(e.target.value);
    setTestAlert(null);
    setSaveAlert(null);
  };

  const cardSx = {
    p: 3,
    background: theme.vastu?.cardBg,
    border: theme.vastu?.cardBorder,
    backdropFilter: theme.vastu?.cardBlur,
  };

  const meta = PROVIDER_META[provider] ?? PROVIDER_META.none;

  /* ── render ─────────────────────────────────────────────────────── */

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: { xs: '1.7rem', md: '2.1rem' },
              background: theme.vastu?.gradientText,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Storage Settings
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Configure where AI-generated images are persisted. Changes take effect within 60 seconds.
          </Typography>
        </Box>
        {updatedAt && !loading && (
          <Typography variant="caption" sx={{ color: 'text.secondary', pt: 0.5 }}>
            Last saved {new Date(updatedAt).toLocaleString('en-IN')}
          </Typography>
        )}
      </Stack>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      {/* Provider selector */}
      <Card elevation={0} sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 2 }}>Storage Provider</Typography>

        {loading ? (
          <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
        ) : (
          <>
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select value={provider} label="Provider" onChange={handleProviderChange}>
                {Object.entries(PROVIDER_META).map(([key, m]) => (
                  <MenuItem key={key} value={key}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: m.color,
                          flexShrink: 0,
                        }}
                      />
                      <span>{m.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
              {meta.description}
            </Typography>
            <Chip
              label={`Active: ${meta.label}`}
              size="small"
              sx={{
                mt: 1.5,
                background: `${meta.color}22`,
                color: meta.color,
                fontWeight: 700,
              }}
            />
          </>
        )}
      </Card>

      {/* Cloudinary config */}
      {provider === 'cloudinary' && (
        <Card elevation={0} sx={{ ...cardSx, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Cloudinary Configuration</Typography>

          {loading ? (
            <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
          ) : (
            <TextField
              fullWidth
              label="Cloudinary URL"
              placeholder="cloudinary://api_key:api_secret@cloud_name"
              value={cloudinaryUrl}
              onChange={(e) => setCloudinaryUrl(e.target.value)}
              type={showCloudinaryUrl ? 'text' : 'password'}
              helperText="Found in your Cloudinary dashboard under Settings → Access Keys."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowCloudinaryUrl((v) => !v)} edge="end">
                      {showCloudinaryUrl ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Card>
      )}

      {/* S3 config */}
      {provider === 's3' && (
        <Card elevation={0} sx={{ ...cardSx, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>AWS S3 Configuration</Typography>

          {loading ? (
            <Stack spacing={2}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Bucket Name"
                  placeholder="my-vastuverse-images"
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Region"
                  placeholder="ap-south-1"
                  value={s3Region}
                  onChange={(e) => setS3Region(e.target.value)}
                />
              </Stack>
              <TextField
                fullWidth
                label="Access Key ID"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                value={s3AccessKeyId}
                onChange={(e) => setS3AccessKeyId(e.target.value)}
              />
              <TextField
                fullWidth
                label="Secret Access Key"
                placeholder={s3SecretAccessKey === '***' ? 'Stored — leave blank to keep' : ''}
                value={s3SecretAccessKey === '***' ? '' : s3SecretAccessKey}
                onChange={(e) => setS3SecretAccessKey(e.target.value)}
                type={showSecret ? 'text' : 'password'}
                helperText="Leave blank to keep the currently stored value."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowSecret((v) => !v)} edge="end">
                        {showSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Alert severity="info" sx={{ borderRadius: 1 }}>
                The bucket must allow public-read access (or use CloudFront). The IAM user needs{' '}
                <code>s3:PutObject</code> and <code>s3:HeadBucket</code> permissions.
              </Alert>
            </Stack>
          )}
        </Card>
      )}

      {/* Warning when no storage is configured */}
      {provider === 'none' && !loading && (
        <Card elevation={0} sx={{ ...cardSx, mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <CancelIcon sx={{ color: '#FF8F00', fontSize: 26, mt: 0.2, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>No persistent storage configured</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Pollinations URLs are stateless and won&apos;t expire, but DALL-E URLs expire after ~1 hour.
                Plan version history thumbnails will break for DALL-E users unless a storage provider is configured.
              </Typography>
            </Box>
          </Stack>
        </Card>
      )}

      {/* Test / save alerts */}
      {testAlert && (
        <Alert
          severity={testAlert.severity}
          icon={testAlert.severity === 'success' ? <CheckCircleIcon /> : undefined}
          onClose={() => setTestAlert(null)}
          sx={{ mb: 2 }}
        >
          {testAlert.message}
        </Alert>
      )}
      {saveAlert && (
        <Alert severity={saveAlert.severity} onClose={() => setSaveAlert(null)} sx={{ mb: 2 }}>
          {saveAlert.message}
        </Alert>
      )}

      {/* Action row */}
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        {provider !== 'none' && (
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={16} /> : <NetworkCheckIcon />}
            onClick={handleTest}
            disabled={testing || loading}
          >
            Test Connection
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          Save Settings
        </Button>
      </Stack>
    </Box>
  );
}
