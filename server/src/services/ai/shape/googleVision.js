/**
 * Google Vision shape-recognition provider.
 *
 * Real implementation would call Vision's `objectLocalization` or
 * `documentTextDetection` (depending on input style) and reconstruct a
 * polygon from the returned bounding poly vertices.
 *
 * Dev mock intentionally returns a confidence BELOW 0.70 so the client's
 * "manual fallback canvas" code path is exercisable without a real key.
 */

const axios = require('axios');

async function recognizeShape(imageBuffer, mimeType) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  if (!apiKey) {
    return {
      polygon: [
        { x: 40,  y: 90  },
        { x: 360, y: 50  },
        { x: 380, y: 220 },
        { x: 90,  y: 280 },
      ],
      confidence: 0.62, // < 0.70 → client switches to manual canvas
      provider: 'google-vision',
      mock: true,
    };
  }

  try {
    const body = {
      requests: [
        {
          image: { content: imageBuffer.toString('base64') },
          features: [{ type: 'OBJECT_LOCALIZATION', maxResults: 3 }],
        },
      ],
    };
    const { data } = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      body,
      { timeout: 30000 }
    );
    const obj = data?.responses?.[0]?.localizedObjectAnnotations?.[0];
    const vertices = obj?.boundingPoly?.normalizedVertices || [];
    return {
      polygon: vertices.map((v) => ({ x: v.x, y: v.y })),
      confidence: obj?.score ?? 0,
      provider: 'google-vision',
      raw: data,
    };
  } catch (err) {
    const e = new Error('google_vision_failed: ' + (err.response?.data?.error?.message || err.message));
    e.status = err.response?.status || 502;
    throw e;
  }
}

module.exports = { recognizeShape };
