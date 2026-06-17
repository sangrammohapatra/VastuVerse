/**
 * POST /api/v1/users/onboarding
 *
 * Accepts JSON (homeowner / developer) or multipart/form-data (architect
 * with portfolio files). Sets role, profile fields, and marks the user's
 * onboarding as complete. For architects, creates an ArchitectProfile with
 * verificationStatus = 'pending'.
 *
 * Multipart shape (architect):
 *   field  "role"      — string
 *   field  "data"      — JSON string (fullName, phone, cityState, onboardingData)
 *   files  "portfolio" — up to 5 PDFs / images (10 MB each)
 */

const fs   = require('fs');
const path = require('path');
const multer = require('multer');

const User             = require('../models/User');
const ArchitectProfile = require('../models/ArchitectProfile');

/* ── File upload (architect portfolio) ──────────────────────────────── */

const UPLOAD_ROOT  = path.join(__dirname, '../../uploads/portfolios');
const MAX_FILE_MB  = 10;
const MAX_FILES    = 5;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(UPLOAD_ROOT, String(req.user.userId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { status: 400 }));
  },
});

// Exported so the router can wire it before the main handler.
exports.uploadMiddleware = upload.array('portfolio', MAX_FILES);

/* ── Handler ─────────────────────────────────────────────────────────── */

const VALID_ROLES = ['homeowner', 'developer', 'architect'];

exports.completeOnboarding = async (req, res, next) => {
  try {
    const userId = String(req.user.userId);

    // Parse payload — multipart sends JSON in the "data" field; JSON sends plain body.
    let payload;
    if (req.files?.length || req.is('multipart/form-data')) {
      const role = String(req.body.role || '');
      const data = JSON.parse(req.body.data || '{}');
      payload = { role, ...data };
    } else {
      payload = req.body || {};
    }

    const { role, fullName, phone, cityState, preferredLanguage, onboardingData } = payload;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }

    const set = {
      role,
      onboardingComplete: true,
    };

    if (typeof fullName === 'string' && fullName.trim()) {
      set.fullName = fullName.trim().slice(0, 120);
    }
    if (typeof phone === 'string' && phone.trim()) {
      set.phone = phone.trim().slice(0, 20);
    }
    if (cityState?.city) {
      set.cityState = {
        city:  String(cityState.city).trim().slice(0, 100),
        state: String(cityState.state || '').trim().slice(0, 100),
      };
    }
    const ALLOWED_LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn'];
    if (typeof preferredLanguage === 'string' && ALLOWED_LANGS.includes(preferredLanguage)) {
      set.preferredLanguage = preferredLanguage;
    }
    if (onboardingData && typeof onboardingData === 'object') {
      set.onboardingData = onboardingData;
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: set },
      { new: true, runValidators: true }
    ).select('email fullName role subscriptionTier preferredLanguage cityState onboardingComplete isVerified');

    if (!updated) return res.status(404).json({ error: 'user_not_found' });

    // Architect: create / update ArchitectProfile for admin verification queue.
    if (role === 'architect') {
      const od = (onboardingData && typeof onboardingData === 'object') ? onboardingData : {};
      const portfolioUrls = (req.files || []).map(
        (f) => `/uploads/portfolios/${userId}/${f.filename}`
      );

      await ArchitectProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            coaRegistrationNo: String(od.coaRegistrationNo || '').trim(),
            yearsExperience:   Number(od.yearsExperience) || 0,
            certifications:    Array.isArray(od.certifications) ? od.certifications : [],
            cityState:         set.cityState || {},
            verificationStatus: 'pending',
          },
          ...(portfolioUrls.length ? { $push: { portfolioUrls: { $each: portfolioUrls } } } : {}),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    res.json({
      ok: true,
      user: {
        id:                 String(updated._id),
        email:              updated.email,
        fullName:           updated.fullName || null,
        role:               updated.role,
        subscriptionTier:   updated.subscriptionTier,
        preferredLanguage:  updated.preferredLanguage,
        isVerified:         updated.isVerified,
        cityState:          updated.cityState || null,
        onboardingComplete: true,
      },
    });
  } catch (e) { next(e); }
};
