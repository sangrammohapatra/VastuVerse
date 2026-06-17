/**
 * Cloudinary storage provider.
 *
 * Credentials come from the explicit `cloudinaryUrl` parameter (set by
 * StorageFactory from DB settings) with CLOUDINARY_URL env var as fallback.
 * Format: cloudinary://api_key:api_secret@cloud_name
 *
 * Uses Cloudinary's signed REST upload API — no SDK required, only axios.
 */

const crypto = require('crypto');
const axios = require('axios');

function parseCloudinaryUrl(url) {
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error('CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name');
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

function buildSignature(params, apiSecret) {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(str + apiSecret).digest('hex');
}

/**
 * @param {Buffer} buffer
 * @param {{ key: string, contentType?: string, cloudinaryUrl?: string }} opts
 *   cloudinaryUrl overrides the CLOUDINARY_URL env var.
 * @returns {Promise<{ url: string }>}
 */
async function uploadImage(buffer, { key, contentType = 'image/jpeg', cloudinaryUrl }) {
  const url = cloudinaryUrl || process.env.CLOUDINARY_URL;
  if (!url) throw new Error('Cloudinary URL not configured');

  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(url);

  const timestamp = Math.floor(Date.now() / 1000);
  const sigParams = { public_id: key, timestamp };
  const signature = buildSignature(sigParams, apiSecret);

  const base64File = `data:${contentType};base64,${buffer.toString('base64')}`;

  const body = new URLSearchParams({
    file: base64File,
    public_id: key,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  });

  const { data } = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    body.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60_000,
      maxBodyLength: 20 * 1024 * 1024,
    }
  );

  return { url: data.secure_url };
}

module.exports = { uploadImage, isPassthrough: false };
