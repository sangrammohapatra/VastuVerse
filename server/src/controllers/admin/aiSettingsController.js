/**
 * Admin: AI Provider Settings
 *
 * GET  /admin/ai-settings        — current config (secrets masked)
 * PUT  /admin/ai-settings        — save provider selection + credentials
 * POST /admin/ai-settings/test   — ping a specific provider without saving
 *
 * Secret fields are stored in full in the DB but returned masked.
 * A client that submits a masked value (containing '***') is telling us to
 * keep the stored value — same pattern as storageSettingsController.
 */

const axios  = require('axios');
const SystemSettings  = require('../../models/SystemSettings');
const AIServiceFactory = require('../../services/ai');

const SETTINGS_KEY = 'ai';

/* ── secret masking ───────────────────────────────────────────────────── */

function maskSecret(s) {
  if (!s) return null;
  if (s.length <= 8) return '***';
  return s.slice(0, 8) + '***';
}

function isMasked(s) { return typeof s === 'string' && s.includes('***'); }

/* ── GET /admin/ai-settings ───────────────────────────────────────────── */

async function getSettings(req, res) {
  try {
    const doc = await SystemSettings.findOne({ key: SETTINGS_KEY }).lean();
    const v = doc?.value || {};

    res.json({
      planProvider:          v.planProvider          || 'ollama',
      imageProvider:         v.imageProvider         || 'pollinations',
      shapeProvider:         v.shapeProvider         || 'huggingface',
      openaiApiKey:          maskSecret(v.openaiApiKey),
      openaiPlanModel:       v.openaiPlanModel       || 'gpt-4o',
      openaiImageModel:      v.openaiImageModel      || 'dall-e-3',
      ollamaUrl:             v.ollamaUrl             || '',
      ollamaModel:           v.ollamaModel           || 'llama3',
      huggingfaceApiKey:     maskSecret(v.huggingfaceApiKey),
      huggingfaceShapeModel: v.huggingfaceShapeModel || 'facebook/detr-resnet-50-panoptic',
      googleVisionApiKey:    maskSecret(v.googleVisionApiKey),
      pollinationsUrl:       v.pollinationsUrl       || '',
      updatedAt:             doc?.updatedAt          || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── PUT /admin/ai-settings ───────────────────────────────────────────── */

async function saveSettings(req, res) {
  try {
    const body = req.body || {};
    const existing = await SystemSettings.findOne({ key: SETTINGS_KEY }).lean();
    const prev = existing?.value || {};

    const next = {
      planProvider:          body.planProvider          || prev.planProvider          || 'ollama',
      imageProvider:         body.imageProvider         || prev.imageProvider         || 'pollinations',
      shapeProvider:         body.shapeProvider         || prev.shapeProvider         || 'huggingface',
      openaiApiKey:          isMasked(body.openaiApiKey)
        ? (prev.openaiApiKey || '')
        : (body.openaiApiKey ?? prev.openaiApiKey ?? ''),
      openaiPlanModel:       body.openaiPlanModel       || prev.openaiPlanModel       || 'gpt-4o',
      openaiImageModel:      body.openaiImageModel      || prev.openaiImageModel      || 'dall-e-3',
      ollamaUrl:             body.ollamaUrl             ?? prev.ollamaUrl             ?? '',
      ollamaModel:           body.ollamaModel           || prev.ollamaModel           || 'llama3',
      huggingfaceApiKey:     isMasked(body.huggingfaceApiKey)
        ? (prev.huggingfaceApiKey || '')
        : (body.huggingfaceApiKey ?? prev.huggingfaceApiKey ?? ''),
      huggingfaceShapeModel: body.huggingfaceShapeModel || prev.huggingfaceShapeModel || 'facebook/detr-resnet-50-panoptic',
      googleVisionApiKey:    isMasked(body.googleVisionApiKey)
        ? (prev.googleVisionApiKey || '')
        : (body.googleVisionApiKey ?? prev.googleVisionApiKey ?? ''),
      pollinationsUrl:       body.pollinationsUrl       ?? prev.pollinationsUrl       ?? '',
    };

    await SystemSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { value: next, updatedBy: req.user.userId } },
      { upsert: true, new: true }
    );

    // Bust the 60 s config cache immediately
    AIServiceFactory.invalidateAiConfig();

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── POST /admin/ai-settings/test ─────────────────────────────────────── */

/**
 * Body: { service: 'openai' | 'ollama' | 'huggingface' | 'google-vision' | 'pollinations',
 *         <relevant credential fields> }
 * Credentials fall back to DB if the client sends a masked/empty value.
 */
async function testConnection(req, res) {
  const { service } = req.body || {};

  // Helper: resolve a secret — use submitted value unless it's masked/empty
  async function resolveSecret(submitted, dbField) {
    if (submitted && !isMasked(submitted)) return submitted;
    const doc = await SystemSettings.findOne({ key: SETTINGS_KEY }).lean();
    return doc?.value?.[dbField] || '';
  }

  try {
    /* ── OpenAI (shared key for gpt4o + dall-e) ─────────────────────── */
    if (service === 'openai') {
      const key = await resolveSecret(req.body.openaiApiKey, 'openaiApiKey');
      if (!key) return res.json({ ok: false, message: 'No OpenAI API key configured.' });

      await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10_000,
      });
      return res.json({ ok: true, message: 'OpenAI API key is valid.' });
    }

    /* ── Ollama ──────────────────────────────────────────────────────── */
    if (service === 'ollama') {
      const url = req.body.ollamaUrl
        || (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.ollamaUrl
        || process.env.OLLAMA_URL || '';
      if (!url) return res.json({ ok: false, message: 'No Ollama URL configured.' });

      await axios.get(`${url}/api/tags`, { timeout: 8_000 });
      return res.json({ ok: true, message: `Ollama is reachable at ${url}.` });
    }

    /* ── HuggingFace ─────────────────────────────────────────────────── */
    if (service === 'huggingface') {
      const key   = await resolveSecret(req.body.huggingfaceApiKey, 'huggingfaceApiKey');
      const model = req.body.huggingfaceShapeModel
        || (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.huggingfaceShapeModel
        || 'facebook/detr-resnet-50-panoptic';
      if (!key) return res.json({ ok: false, message: 'No HuggingFace API key configured.' });

      await axios.get(`https://huggingface.co/api/models/${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10_000,
      });
      return res.json({ ok: true, message: `HuggingFace key valid; model "${model}" found.` });
    }

    /* ── Google Vision ───────────────────────────────────────────────── */
    if (service === 'google-vision') {
      const key = await resolveSecret(req.body.googleVisionApiKey, 'googleVisionApiKey');
      if (!key) return res.json({ ok: false, message: 'No Google Vision API key configured.' });

      // Annotate with an empty image to verify the key (returns a 400, but auth errors are 403)
      try {
        await axios.post(
          `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
          { requests: [] },
          { timeout: 10_000 }
        );
      } catch (e) {
        // 400 Bad Request means key is valid (empty request), 403 means bad key
        if (e.response?.status === 403) {
          return res.json({ ok: false, message: 'Google Vision API key is invalid or lacks Vision API access.' });
        }
      }
      return res.json({ ok: true, message: 'Google Vision API key is valid.' });
    }

    /* ── Pollinations (no auth — just reachability) ──────────────────── */
    if (service === 'pollinations') {
      const url = req.body.pollinationsUrl || 'https://image.pollinations.ai/prompt';
      await axios.get('https://image.pollinations.ai/', { timeout: 8_000 });
      return res.json({ ok: true, message: `Pollinations is reachable (no auth required).` });
    }

    res.status(400).json({ ok: false, message: `Unknown service: ${service}` });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.response?.data?.error || e.message || 'Connection failed';
    res.status(200).json({ ok: false, message: String(msg) });
  }
}

module.exports = { getSettings, saveSettings, testConnection };
