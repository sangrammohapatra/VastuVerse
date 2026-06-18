/**
 * Pollinations.ai image provider (dev).
 *
 * Stateless — returns a deterministic URL with the prompt + seed encoded.
 * The image is rendered on demand by Pollinations when the URL is fetched.
 * No API key required.
 */

const DEFAULT_BASE = process.env.POLLINATIONS_URL || 'https://image.pollinations.ai/prompt';

async function generateImage({ prompt, seed }, cfg = {}) {
  const base = cfg.pollinationsUrl || DEFAULT_BASE;
  const safePrompt = String(prompt || 'modern Indian house floor plan top view');
  const s = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 1e6);
  const url = `${base}/${encodeURIComponent(safePrompt)}?seed=${s}&width=768&height=768&nologo=true`;
  return { imageUrl: url, provider: 'pollinations', seed: s };
}

module.exports = { generateImage };
