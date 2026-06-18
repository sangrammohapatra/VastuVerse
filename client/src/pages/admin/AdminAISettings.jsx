import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Card, Alert, Skeleton, Button, Divider,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip,
  CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { api } from '../../utils/axiosInstance';

/* ── static metadata ──────────────────────────────────────────────────── */

const PLAN_PROVIDERS = {
  ollama: { label: 'Ollama (self-hosted)', color: '#7C3AED', description: 'Run an open-source LLM (e.g. llama3) locally or in Docker. No per-request cost.' },
  gpt4o:  { label: 'GPT-4o (OpenAI)',     color: '#10A37F', description: 'Uses the OpenAI Chat Completions API to enrich floor plan labels and Vastu advice.' },
};

const FLOOR_PLAN_MODES = {
  solver: { label: 'Constraint Solver (Recommended)', color: '#0284C7', description: 'Deterministic zone-aware placement — fast, reliable, always valid. AI is used only for labels and advice.' },
  ai:     { label: 'AI-Generated Layout',             color: '#7C3AED', description: 'The LLM places rooms on the plot using Vastu zones and NBC rules. Falls back to solver if geometry is invalid.' },
};

const IMAGE_PROVIDERS = {
  pollinations: { label: 'Pollinations (free)',  color: '#059669', description: 'Stateless URL-based rendering — no API key, no cost. Images are generated on demand.' },
  dalle:        { label: 'DALL-E 3 (OpenAI)',    color: '#10A37F', description: 'High-quality image generation via OpenAI Images API. Requires an OpenAI API key.' },
};

const SHAPE_PROVIDERS = {
  huggingface:    { label: 'HuggingFace',    color: '#F59E0B', description: 'Call a HuggingFace Inference API model for plot shape segmentation.' },
  'google-vision': { label: 'Google Vision', color: '#4285F4', description: 'Use Google Cloud Vision object localisation to extract the plot boundary polygon.' },
};

/* ── helpers ──────────────────────────────────────────────────────────── */

function SecretField({ label, value, onChange, helperText, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      fullWidth
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={show ? 'text' : 'password'}
      helperText={helperText}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={() => setShow((v) => !v)} edge="end">
              {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

function ProviderSelector({ label, value, onChange, options }) {
  return (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([key, m]) => (
          <MenuItem key={key} value={key}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
              <span>{m.label}</span>
            </Stack>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/* ── main component ───────────────────────────────────────────────────── */

export default function AdminAISettings() {
  const theme = useTheme();

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveAlert, setSaveAlert] = useState(null);
  const [testAlerts, setTestAlerts] = useState({});   // { service: { severity, message } }
  const [testing, setTesting]     = useState({});     // { service: bool }
  const [updatedAt, setUpdatedAt] = useState(null);

  const [form, setForm] = useState({
    planProvider: 'ollama',
    floorPlanMode: 'solver',
    imageProvider: 'pollinations',
    shapeProvider: 'huggingface',
    openaiApiKey: '',
    openaiPlanModel: 'gpt-4o',
    openaiImageModel: 'dall-e-3',
    ollamaUrl: '',
    ollamaModel: 'llama3',
    huggingfaceApiKey: '',
    huggingfaceShapeModel: 'facebook/detr-resnet-50-panoptic',
    googleVisionApiKey: '',
    pollinationsUrl: '',
  });

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));
  const setField = (field) => (e) => set(field)(e.target.value);

  const cardSx = {
    p: 3, mb: 2,
    background: theme.vastu?.cardBg,
    border: theme.vastu?.cardBorder,
    backdropFilter: theme.vastu?.cardBlur,
  };

  /* ── load ─────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get('/admin/ai-settings');
      setForm({
        planProvider:          data.planProvider          || 'ollama',
        floorPlanMode:         data.floorPlanMode         || 'solver',
        imageProvider:         data.imageProvider         || 'pollinations',
        shapeProvider:         data.shapeProvider         || 'huggingface',
        openaiApiKey:          data.openaiApiKey          || '',
        openaiPlanModel:       data.openaiPlanModel       || 'gpt-4o',
        openaiImageModel:      data.openaiImageModel      || 'dall-e-3',
        ollamaUrl:             data.ollamaUrl             || '',
        ollamaModel:           data.ollamaModel           || 'llama3',
        huggingfaceApiKey:     data.huggingfaceApiKey     || '',
        huggingfaceShapeModel: data.huggingfaceShapeModel || 'facebook/detr-resnet-50-panoptic',
        googleVisionApiKey:    data.googleVisionApiKey    || '',
        pollinationsUrl:       data.pollinationsUrl       || '',
      });
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setLoadError(e.response?.data?.error || 'Failed to load AI settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── save ─────────────────────────────────────────────────────────── */

  const handleSave = async () => {
    setSaving(true);
    setSaveAlert(null);
    try {
      await api.put('/admin/ai-settings', form);
      setSaveAlert({ severity: 'success', message: 'AI settings saved. New jobs will use the updated providers within 60 seconds.' });
      load();
    } catch (e) {
      setSaveAlert({ severity: 'error', message: e.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  /* ── test ─────────────────────────────────────────────────────────── */

  const handleTest = async (service) => {
    setTesting((t) => ({ ...t, [service]: true }));
    setTestAlerts((a) => ({ ...a, [service]: null }));
    try {
      const { data } = await api.post('/admin/ai-settings/test', { service, ...form });
      setTestAlerts((a) => ({ ...a, [service]: { severity: data.ok ? 'success' : 'error', message: data.message } }));
    } catch (e) {
      setTestAlerts((a) => ({ ...a, [service]: { severity: 'error', message: e.response?.data?.message || 'Test failed.' } }));
    } finally {
      setTesting((t) => ({ ...t, [service]: false }));
    }
  };

  /* ── sub-components ───────────────────────────────────────────────── */

  const SectionHeader = ({ title, description, chip }) => (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
      <Box>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        {description && <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{description}</Typography>}
      </Box>
      {chip && <Chip label={chip.label} size="small" sx={{ background: `${chip.color}22`, color: chip.color, fontWeight: 700 }} />}
    </Stack>
  );

  const TestRow = ({ service, label }) => (
    <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
      {testAlerts[service] && (
        <Alert
          severity={testAlerts[service].severity}
          icon={testAlerts[service].severity === 'success' ? <CheckCircleIcon fontSize="small" /> : undefined}
          sx={{ flex: 1, py: 0.5 }}
          onClose={() => setTestAlerts((a) => ({ ...a, [service]: null }))}
        >
          {testAlerts[service].message}
        </Alert>
      )}
      <Button
        variant="outlined"
        size="small"
        startIcon={testing[service] ? <CircularProgress size={14} /> : <NetworkCheckIcon />}
        onClick={() => handleTest(service)}
        disabled={!!testing[service] || loading}
      >
        Test {label}
      </Button>
    </Stack>
  );

  const planMeta      = PLAN_PROVIDERS[form.planProvider]        || PLAN_PROVIDERS.ollama;
  const floorModeMeta = FLOOR_PLAN_MODES[form.floorPlanMode]     || FLOOR_PLAN_MODES.solver;
  const imgMeta       = IMAGE_PROVIDERS[form.imageProvider]      || IMAGE_PROVIDERS.pollinations;
  const shapeMeta     = SHAPE_PROVIDERS[form.shapeProvider]      || SHAPE_PROVIDERS.huggingface;
  const needsOpenAI   = form.planProvider === 'gpt4o' || form.imageProvider === 'dalle';
  const aiModeActive  = form.floorPlanMode === 'ai';

  /* ── render ───────────────────────────────────────────────────────── */

  return (
    <Box>
      {/* Page header */}
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
            AI Provider Settings
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Select providers and enter credentials. Changes take effect within 60 seconds — no restart required.
          </Typography>
        </Box>
        {updatedAt && !loading && (
          <Typography variant="caption" sx={{ color: 'text.secondary', pt: 0.5 }}>
            Last saved {new Date(updatedAt).toLocaleString('en-IN')}
          </Typography>
        )}
      </Stack>

      {loadError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>{loadError}</Alert>}

      {/* ── Provider selectors ──────────────────────────────────────── */}
      <Card elevation={0} sx={cardSx}>
        <Typography sx={{ fontWeight: 700, mb: 2 }}>Provider Selection</Typography>
        {loading ? (
          <Stack spacing={2}>
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />)}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <ProviderSelector label="LLM Provider" value={form.planProvider} onChange={set('planProvider')} options={PLAN_PROVIDERS} />
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>{planMeta.description}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <ProviderSelector label="Floor Plan Generation" value={form.floorPlanMode} onChange={set('floorPlanMode')} options={FLOOR_PLAN_MODES} />
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>{floorModeMeta.description}</Typography>
              </Box>
            </Stack>
            {aiModeActive && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                AI-Generated Layout uses the LLM to place rooms spatially. Results are validated and fall back
                to the constraint solver automatically if the AI produces invalid geometry.
                Recommended only with GPT-4o or a capable local model.
              </Alert>
            )}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <ProviderSelector label="Image Render" value={form.imageProvider} onChange={set('imageProvider')} options={IMAGE_PROVIDERS} />
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>{imgMeta.description}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <ProviderSelector label="Shape Recognition" value={form.shapeProvider} onChange={set('shapeProvider')} options={SHAPE_PROVIDERS} />
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>{shapeMeta.description}</Typography>
              </Box>
            </Stack>
          </Stack>
        )}
      </Card>

      {/* ── OpenAI (shared for gpt4o + dalle) ─────────────────────── */}
      {needsOpenAI && (
        <Card elevation={0} sx={cardSx}>
          <SectionHeader
            title="OpenAI Credentials"
            description="Shared by GPT-4o (floor plan labels) and DALL-E 3 (image render)."
            chip={{ label: 'OpenAI', color: '#10A37F' }}
          />
          {loading ? <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} /> : (
            <Stack spacing={2}>
              <SecretField
                label="API Key"
                value={form.openaiApiKey}
                onChange={set('openaiApiKey')}
                placeholder="sk-…"
                helperText="Found at platform.openai.com → API Keys. Leave blank to keep the stored value."
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Plan model"
                  value={form.openaiPlanModel}
                  onChange={setField('openaiPlanModel')}
                  helperText="e.g. gpt-4o or gpt-4-turbo"
                />
                <TextField
                  fullWidth
                  label="Image model"
                  value={form.openaiImageModel}
                  onChange={setField('openaiImageModel')}
                  helperText="e.g. dall-e-3 or dall-e-2"
                />
              </Stack>
              <TestRow service="openai" label="OpenAI" />
            </Stack>
          )}
        </Card>
      )}

      {/* ── Ollama ─────────────────────────────────────────────────── */}
      {form.planProvider === 'ollama' && (
        <Card elevation={0} sx={cardSx}>
          <SectionHeader
            title="Ollama Configuration"
            description="Self-hosted LLM endpoint. Run 'ollama serve' locally or use Docker Compose."
            chip={{ label: 'Ollama', color: '#7C3AED' }}
          />
          {loading ? <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} /> : (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Ollama URL"
                  placeholder="http://localhost:11434"
                  value={form.ollamaUrl}
                  onChange={setField('ollamaUrl')}
                  helperText="Include scheme and port. Leave blank to use the OLLAMA_URL env variable."
                />
                <TextField
                  fullWidth
                  label="Model"
                  placeholder="llama3"
                  value={form.ollamaModel}
                  onChange={setField('ollamaModel')}
                  helperText="Must be pulled: 'ollama pull llama3'"
                />
              </Stack>
              <TestRow service="ollama" label="Ollama" />
            </Stack>
          )}
        </Card>
      )}

      {/* ── HuggingFace ────────────────────────────────────────────── */}
      {form.shapeProvider === 'huggingface' && (
        <Card elevation={0} sx={cardSx}>
          <SectionHeader
            title="HuggingFace Configuration"
            description="Used for plot shape segmentation in Step 1."
            chip={{ label: 'HuggingFace', color: '#F59E0B' }}
          />
          {loading ? <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} /> : (
            <Stack spacing={2}>
              <SecretField
                label="API Key"
                value={form.huggingfaceApiKey}
                onChange={set('huggingfaceApiKey')}
                placeholder="hf_…"
                helperText="Found at huggingface.co/settings/tokens."
              />
              <TextField
                fullWidth
                label="Shape model"
                value={form.huggingfaceShapeModel}
                onChange={setField('huggingfaceShapeModel')}
                helperText="Inference API model ID, e.g. facebook/detr-resnet-50-panoptic"
              />
              <TestRow service="huggingface" label="HuggingFace" />
            </Stack>
          )}
        </Card>
      )}

      {/* ── Google Vision ───────────────────────────────────────────── */}
      {form.shapeProvider === 'google-vision' && (
        <Card elevation={0} sx={cardSx}>
          <SectionHeader
            title="Google Vision Configuration"
            description="Used for plot shape detection in Step 1."
            chip={{ label: 'Google Vision', color: '#4285F4' }}
          />
          {loading ? <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} /> : (
            <Stack spacing={2}>
              <SecretField
                label="API Key"
                value={form.googleVisionApiKey}
                onChange={set('googleVisionApiKey')}
                placeholder="AIza…"
                helperText="Enable Cloud Vision API in Google Cloud Console and create an API key."
              />
              <TestRow service="google-vision" label="Google Vision" />
            </Stack>
          )}
        </Card>
      )}

      {/* ── Pollinations (optional URL override) ───────────────────── */}
      <Card elevation={0} sx={cardSx}>
        <SectionHeader
          title="Pollinations"
          description="No API key required. Override the base URL only if you're self-hosting."
          chip={{ label: 'Free', color: '#059669' }}
        />
        {loading ? <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} /> : (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Base URL (optional)"
              placeholder="https://image.pollinations.ai/prompt"
              value={form.pollinationsUrl}
              onChange={setField('pollinationsUrl')}
              helperText="Leave blank to use the default public endpoint."
            />
            <TestRow service="pollinations" label="Pollinations" />
          </Stack>
        )}
      </Card>

      {/* ── Alerts + actions ────────────────────────────────────────── */}
      {saveAlert && (
        <Alert severity={saveAlert.severity} onClose={() => setSaveAlert(null)} sx={{ mb: 2 }}>
          {saveAlert.message}
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />
      <Stack direction="row" justifyContent="flex-end">
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
