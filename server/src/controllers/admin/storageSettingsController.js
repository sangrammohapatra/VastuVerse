/**
 * Admin: Storage Provider Settings
 *
 * GET  /admin/storage-settings        — current config (secrets masked)
 * PUT  /admin/storage-settings        — save provider + credentials
 * POST /admin/storage-settings/test   — validate credentials without saving
 */

const axios = require('axios');
const crypto = require('crypto');
const SystemSettings = require('../../models/SystemSettings');
const StorageFactory = require('../../services/storage');

const SETTINGS_KEY = 'storage';

/* ── helpers ──────────────────────────────────────────────────────────── */

function maskCloudinaryUrl(url) {
  if (!url) return null;
  // cloudinary://api_key:api_secret@cloud_name  →  cloudinary://api_key:***@cloud_name
  return url.replace(/^(cloudinary:\/\/[^:]+):([^@]+)(@.+)$/, '$1:***$3');
}

function parseCloudinaryUrl(url) {
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error('CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name');
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

/* ── GET /admin/storage-settings ──────────────────────────────────────── */

async function getSettings(req, res) {
  try {
    const doc = await SystemSettings.findOne({ key: SETTINGS_KEY }).lean();
    const v = doc?.value || {};

    res.json({
      provider:          v.provider      || 'none',
      // Cloudinary: return masked URL and extracted cloud name
      cloudinaryUrl:     v.cloudinaryUrl ? maskCloudinaryUrl(v.cloudinaryUrl) : null,
      cloudinaryCloudName: v.cloudinaryUrl
        ? (() => { try { return parseCloudinaryUrl(v.cloudinaryUrl).cloudName; } catch { return null; } })()
        : null,
      // S3: return non-secret fields; mask secret access key
      s3Bucket:          v.s3Bucket          || null,
      s3Region:          v.s3Region          || null,
      s3AccessKeyId:     v.s3AccessKeyId     || null,
      s3SecretAccessKey: v.s3SecretAccessKey ? '***' : null,
      updatedAt:         doc?.updatedAt      || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── PUT /admin/storage-settings ──────────────────────────────────────── */

async function saveSettings(req, res) {
  try {
    const { provider, cloudinaryUrl, s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey } = req.body;

    const allowed = ['none', 'cloudinary', 's3'];
    if (!allowed.includes(provider)) {
      return res.status(400).json({ error: `provider must be one of: ${allowed.join(', ')}` });
    }

    // Load existing doc so we can keep secrets that weren't re-submitted
    const existing = await SystemSettings.findOne({ key: SETTINGS_KEY }).lean();
    const prev = existing?.value || {};

    const next = {
      provider,
      // Keep previous secret if client sent the placeholder or nothing
      cloudinaryUrl:
        cloudinaryUrl && cloudinaryUrl !== maskCloudinaryUrl(prev.cloudinaryUrl)
          ? cloudinaryUrl
          : prev.cloudinaryUrl || null,
      s3Bucket:      s3Bucket      || prev.s3Bucket      || null,
      s3Region:      s3Region      || prev.s3Region      || null,
      s3AccessKeyId: s3AccessKeyId || prev.s3AccessKeyId || null,
      s3SecretAccessKey:
        s3SecretAccessKey && s3SecretAccessKey !== '***'
          ? s3SecretAccessKey
          : prev.s3SecretAccessKey || null,
    };

    await SystemSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { value: next, updatedBy: req.user.userId } },
      { upsert: true, new: true }
    );

    // Invalidate the in-memory cache so the next image job picks up new settings
    StorageFactory.invalidateCache();

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── POST /admin/storage-settings/test ───────────────────────────────── */

async function testConnection(req, res) {
  const { provider, cloudinaryUrl, s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey } = req.body;

  try {
    if (provider === 'cloudinary') {
      const url = cloudinaryUrl && !cloudinaryUrl.includes(':***@')
        ? cloudinaryUrl
        : (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.cloudinaryUrl;

      if (!url) return res.status(400).json({ ok: false, message: 'No Cloudinary URL configured.' });

      const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(url);

      // Signed request to list resources (0 results is fine — we just need a 200)
      const timestamp = Math.floor(Date.now() / 1000);
      const sigStr = `max_results=1&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

      await axios.get(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image`, {
        params: { max_results: 1, timestamp, api_key: apiKey, signature },
        timeout: 10_000,
      });

      return res.json({ ok: true, message: 'Cloudinary credentials are valid.' });
    }

    if (provider === 's3') {
      let { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

      const bucket    = s3Bucket    || (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.s3Bucket;
      const region    = s3Region    || (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.s3Region || 'us-east-1';
      const accessKey = s3AccessKeyId || (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.s3AccessKeyId;
      const secretKey =
        s3SecretAccessKey && s3SecretAccessKey !== '***'
          ? s3SecretAccessKey
          : (await SystemSettings.findOne({ key: SETTINGS_KEY }).lean())?.value?.s3SecretAccessKey;

      if (!bucket) return res.status(400).json({ ok: false, message: 'No S3 bucket configured.' });

      const cfg = { region };
      if (accessKey && secretKey) cfg.credentials = { accessKeyId: accessKey, secretAccessKey: secretKey };

      const client = new S3Client(cfg);
      await client.send(new HeadBucketCommand({ Bucket: bucket }));

      return res.json({ ok: true, message: `S3 bucket "${bucket}" is accessible.` });
    }

    res.status(400).json({ ok: false, message: `Unknown provider: ${provider}` });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message || 'Connection failed';
    res.status(200).json({ ok: false, message: msg });
  }
}

module.exports = { getSettings, saveSettings, testConnection };
