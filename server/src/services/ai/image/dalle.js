/**
 * DALL-E 3 image provider (prod).
 *
 * Calls the OpenAI Images endpoint via axios (so we avoid the heavy SDK).
 * Falls back to Pollinations when OPENAI_API_KEY is unset or the API call
 * fails — the response shape is identical from the caller's point of view.
 */

const axios = require('axios');
const { generateImage: pollinationsImage } = require('./pollinations');

const DEFAULT_API_KEY = process.env.OPENAI_API_KEY    || '';
const DEFAULT_MODEL   = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';

async function generateImage({ prompt, seed }, cfg = {}) {
  const apiKey = cfg.openaiApiKey    || DEFAULT_API_KEY;
  const model  = cfg.openaiImageModel || DEFAULT_MODEL;

  if (!apiKey) return pollinationsImage({ prompt, seed }, cfg);

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model,
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
      },
      {
        timeout: 110000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const imageUrl = data?.data?.[0]?.url || null;
    if (!imageUrl) return pollinationsImage({ prompt, seed }, cfg);
    return { imageUrl, provider: 'dall-e-3', seed };
  } catch (e) {
    return pollinationsImage({ prompt, seed }, cfg);
  }
}

module.exports = { generateImage };
