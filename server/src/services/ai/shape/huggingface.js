/**
 * HuggingFace shape-recognition provider.
 *
 * Real implementation would call a segmentation model on HF Inference API
 * (e.g. facebook/mask2former-swin-large-cityscapes-semantic) and extract a
 * polygon from the largest detected region.
 *
 * For now: returns a deterministic mock polygon with high confidence so the
 * client-side flow (canvas render, no fallback) is testable without a key.
 */

const axios = require('axios');

const HF_API_BASE = 'https://api-inference.huggingface.co/models';
const HF_MODEL = process.env.HUGGINGFACE_SHAPE_MODEL || 'facebook/detr-resnet-50-panoptic';

async function recognizeShape(imageBuffer, mimeType) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    // Dev fallback — deterministic so screenshots are stable.
    return {
      polygon: [
        { x: 60,  y: 60 },
        { x: 340, y: 60 },
        { x: 340, y: 240 },
        { x: 60,  y: 240 },
      ],
      confidence: 0.86,
      provider: 'huggingface',
      mock: true,
    };
  }

  // Live call (best-effort scaffold — refine with the model's actual response shape).
  try {
    const response = await axios.post(
      `${HF_API_BASE}/${encodeURIComponent(HF_MODEL)}`,
      imageBuffer,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': mimeType || 'application/octet-stream',
        },
        timeout: 30000,
      }
    );
    // TODO: convert response → polygon. The shape varies by model.
    // For now, surface the raw provider response so the route's contract
    // remains stable even before parsing is fully wired.
    return {
      polygon: response.data?.polygon || [],
      confidence: response.data?.score ?? 0,
      provider: 'huggingface',
      raw: response.data,
    };
  } catch (err) {
    const e = new Error('huggingface_shape_failed: ' + (err.response?.data?.error || err.message));
    e.status = err.response?.status || 502;
    throw e;
  }
}

module.exports = { recognizeShape };
