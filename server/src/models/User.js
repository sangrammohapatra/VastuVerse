const mongoose = require('mongoose');

const { Schema } = mongoose;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

const CityStateSchema = new Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  { _id: false }
);

const AddressSchema = new Schema(
  {
    line1:   { type: String, trim: true, maxlength: 200 },
    line2:   { type: String, trim: true, maxlength: 200 },
    city:    { type: String, trim: true, maxlength: 100 },
    state:   { type: String, trim: true, maxlength: 100 },
    pincode: { type: String, trim: true, maxlength: 10 },
    country: { type: String, trim: true, maxlength: 100, default: 'India' },
  },
  { _id: false }
);

const OnboardingDataSchema = new Schema(
  {
    // Homeowner
    plotOwnershipStatus: { type: String, enum: ['owned', 'buying', 'inherited', 'not_yet', null], default: null },

    // Developer
    companyName: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true, match: [GSTIN_RE, 'Invalid GSTIN format'] },
    designation: { type: String, trim: true },
    teamSize: { type: Number, min: 1 },
    projectTypes: { type: [String], default: undefined },
    primaryRegions: { type: [String], default: undefined },

    // Architect
    coaRegistrationNo: { type: String, trim: true },
    yearsExperience: { type: Number, min: 0 },
    portfolioUrls: { type: [String], default: undefined },
    certifications: { type: [String], default: undefined },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_RE, 'Invalid email address'],
    },
    phone: { type: String, trim: true, match: [PHONE_RE, 'Invalid phone number'] },
    passwordHash: { type: String, select: false }, // null for social login

    authProvider: { type: String, enum: ['email', 'google', 'facebook'], default: 'email', required: true },
    socialId: { type: String, trim: true },

    fullName: { type: String, trim: true, maxlength: 120 },
    avatarUrl: { type: String, trim: true, maxlength: 500 },

    onboardingComplete: { type: Boolean, default: false },

    notificationPreferences: {
      type: new Schema(
        {
          emailActivity:  { type: Boolean, default: true },
          emailMarketing: { type: Boolean, default: false },
          pushActivity:   { type: Boolean, default: true },
        },
        { _id: false }
      ),
      default: () => ({ emailActivity: true, emailMarketing: false, pushActivity: true }),
    },

    role: {
      type: String,
      enum: ['homeowner', 'developer', 'architect', 'admin'],
      required: true,
      default: 'homeowner',
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false }, // email verified

    preferredLanguage: {
      type: String,
      enum: ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn'],
      default: 'en',
    },

    subscriptionTier: {
      type: String,
      enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
      default: 'FREE',
      index: true,
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say', null],
      default: null,
    },
    dateOfBirth: { type: Date, default: null },
    address: { type: AddressSchema, default: () => ({}) },

    onboardingData: { type: OnboardingDataSchema, default: () => ({}) },
    cityState: { type: CityStateSchema, default: () => ({}) },

    refreshTokenHash: { type: String, select: false },

    // Fallback usage counter if Redis is unavailable (date stored as YYYY-MM-DD).
    aiGenerationsToday: {
      type: new Schema({ count: { type: Number, default: 0 }, date: String }, { _id: false }),
      default: () => ({ count: 0, date: null }),
    },
  },
  { timestamps: true }
);

// Compound + supporting indexes
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ authProvider: 1, socialId: 1 });
UserSchema.index({ subscriptionTier: 1, isActive: 1 });

// Never leak sensitive fields if they were explicitly selected.
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
