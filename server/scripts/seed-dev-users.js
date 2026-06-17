#!/usr/bin/env node
/**
 * VastuVerse dev seed script.
 *
 *   npm run seed                  # seed everything (idempotent)
 *   npm run seed -- --clear       # wipe seeded users first, then re-create
 *   npm run seed -- --only=admin  # seed only the admin persona
 *
 * What it creates:
 *
 *   4 user personas (admin / homeowner / architect / developer):
 *     admin@vastuverse.dev      role=admin           tier=ENTERPRISE
 *     owner@vastuverse.dev      role=homeowner       tier=PRO
 *     architect@vastuverse.dev  role=architect       tier=PRO   (+ verified ArchitectProfile)
 *     dev@vastuverse.dev        role=developer       tier=BASIC
 *
 *   Each with:
 *     - isVerified: true              (skip email verification)
 *     - onboardingData populated      (skip the onboarding wizard)
 *     - Subscription doc              (so the admin panel shows them properly)
 *     - Pre-signed JWT access token   (for direct API testing)
 *
 *   Sample data:
 *     - 3 plans for the homeowner (1 DRAFT, 1 IN_PROGRESS, 1 COMPLETED)
 *     - 5 feature flags (one for each tier-gated capability)
 *     - 1 marketplace review request from the homeowner
 *
 * Safety:
 *   - Refuses to run if NODE_ENV === 'production' (set FORCE=1 to override,
 *     but seriously, do not).
 *   - All seeded users have email addresses ending in @vastuverse.dev so
 *     --clear can target them specifically without touching real users.
 *
 * After running, log in via the normal flow:
 *
 *   1. Open http://localhost:3000/login
 *   2. Enter admin@vastuverse.dev → click Send OTP
 *   3. Look at the server terminal — the OTP is logged to console because
 *      EMAIL_HOST isn't set in dev
 *   4. Paste the OTP, click Verify — you're in
 *
 * Or for direct API testing, copy a JWT from the script output:
 *
 *   curl -H "Authorization: Bearer <jwt>" http://localhost:5000/api/v1/admin/analytics
 */

require("dotenv").config();

const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// We use the existing connectDB helper for pool sizing + reconnect logic
const { connectDB } = require(path.resolve(__dirname, "../src/config/db"));

const User = require(path.resolve(__dirname, "../src/models/User"));
const Subscription = require(
  path.resolve(__dirname, "../src/models/Subscription"),
);
const Plan = require(path.resolve(__dirname, "../src/models/Plan"));
const FeatureFlag = require(
  path.resolve(__dirname, "../src/models/FeatureFlag"),
);
const ArchitectProfile = require(
  path.resolve(__dirname, "../src/models/ArchitectProfile"),
);
const ReviewRequest = require(
  path.resolve(__dirname, "../src/models/ReviewRequest"),
);

/* ─── ANSI colors (terminal output, no extra dep) ─────────────────── */

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};
const log = {
  info: (m) => console.log(`${c.cyan}→${c.reset} ${m}`),
  success: (m) => console.log(`${c.green}✓${c.reset} ${m}`),
  warn: (m) => console.log(`${c.yellow}!${c.reset} ${m}`),
  error: (m) => console.log(`${c.red}✗${c.reset} ${m}`),
  section: (m) => console.log(`\n${c.bold}${c.blue}── ${m} ──${c.reset}`),
  divider: () => console.log(`${c.gray}${"─".repeat(72)}${c.reset}`),
};

/* ─── CLI args ────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const shouldClear = args.includes("--clear");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : null; // 'admin' | 'owner' | etc.

/* ─── Personas ────────────────────────────────────────────────────── */

const SEED_DOMAIN = "@vastuverse.dev";

const PERSONAS = [
  {
    key: "admin",
    email: "admin" + SEED_DOMAIN,
    fullName: "Aanya Sharma",
    phone: "+919876543210",
    role: "admin",
    tier: "ENTERPRISE",
    preferredLanguage: "en",
    cityState: { city: "Bengaluru", state: "Karnataka" },
    onboardingData: { goals: ["platform_admin"], completedAt: new Date() },
  },
  {
    key: "owner",
    email: "owner" + SEED_DOMAIN,
    fullName: "Rohan Mehta",
    phone: "+919876500001",
    role: "homeowner",
    tier: "PRO",
    preferredLanguage: "hi",
    cityState: { city: "Pune", state: "Maharashtra" },
    onboardingData: { goals: ["design_new_home"], completedAt: new Date() },
  },
  {
    key: "architect",
    email: "architect" + SEED_DOMAIN,
    fullName: "Priya Iyer",
    phone: "+919876500002",
    role: "architect",
    tier: "PRO",
    preferredLanguage: "en",
    cityState: { city: "Chennai", state: "Tamil Nadu" },
    onboardingData: { goals: ["offer_reviews"], completedAt: new Date() },
    // ArchitectProfile is created separately below
    architectProfile: {
      coaRegistrationNo: "CA/2018/115421",
      yearsExperience: 9,
      specializations: ["residential", "sustainable", "vastu"],
      portfolioUrls: [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      ],
      certifications: ["LEED AP", "IGBC Green Associate"],
      verificationStatus: "approved",
    },
  },
  {
    key: "developer",
    email: "dev" + SEED_DOMAIN,
    fullName: "Karthik Reddy",
    phone: "+919876500003",
    role: "developer",
    tier: "BASIC",
    preferredLanguage: "te",
    cityState: { city: "Hyderabad", state: "Telangana" },
    onboardingData: { goals: ["investment_property"], completedAt: new Date() },
  },
];

/* ─── Sample plans (for owner persona) ────────────────────────────── */

function plansFor(ownerId) {
  return [
    {
      userId: ownerId,
      title: "Mehta family villa — Pune",
      status: "COMPLETED",
      currentStep: 10,
      cityState: { city: "Pune", state: "Maharashtra" },
      landDetails: {
        area: 2400,
        unit: "sqft",
        facing: "east",
        shape: "rectangular",
      },
      rooms: [
        { type: "bedroom", floor: 0, width: 12, length: 14, area: 168 },
        { type: "bedroom", floor: 0, width: 11, length: 12, area: 132 },
        { type: "livingRoom", floor: 0, width: 18, length: 16, area: 288 },
        { type: "kitchen", floor: 0, width: 10, length: 12, area: 120 },
        { type: "bathroom", floor: 0, width: 6, length: 8, area: 48 },
        { type: "puja", floor: 0, width: 5, length: 5, area: 25 },
      ],
      completedAt: new Date(Date.now() - 3 * 86400000),
      createdAt: new Date(Date.now() - 30 * 86400000),
    },
    {
      userId: ownerId,
      title: "Weekend home in Lonavala",
      status: "IN_PROGRESS",
      currentStep: 5,
      cityState: { city: "Lonavala", state: "Maharashtra" },
      landDetails: {
        area: 3600,
        unit: "sqft",
        facing: "north",
        shape: "rectangular",
      },
      createdAt: new Date(Date.now() - 8 * 86400000),
    },
    {
      userId: ownerId,
      title: "In-laws apartment",
      status: "DRAFT",
      currentStep: 1,
      cityState: { city: "Mumbai", state: "Maharashtra" },
      landDetails: { area: 1200, unit: "sqft", facing: "west" },
      createdAt: new Date(Date.now() - 1 * 86400000),
    },
  ];
}

/* ─── Feature flags (so the admin matrix isn't empty) ─────────────── */

const FEATURE_FLAGS = [
  {
    featureName: "ai_video_walkthrough",
    description: "Generate a 30-second video flythrough of the 3D model",
    enabledForTiers: ["PRO", "ENTERPRISE"],
    globalOverride: false,
  },
  {
    featureName: "municipal_compliance_check",
    description: "NBC 2016 + state-bylaw compliance with annotated PDF draft",
    enabledForTiers: ["BASIC", "PRO", "ENTERPRISE"],
    globalOverride: false,
  },
  {
    featureName: "bulk_export_pdf",
    description: "Export plans, BOQ, and compliance as a single PDF bundle",
    enabledForTiers: ["PRO", "ENTERPRISE"],
    globalOverride: false,
  },
  {
    featureName: "collaborator_seats_unlimited",
    description: "Remove the 3-collaborator cap",
    enabledForTiers: ["ENTERPRISE"],
    globalOverride: false,
  },
  {
    featureName: "developer_multiunit_dashboard",
    description: "Multi-unit project tooling for real-estate developers",
    enabledForTiers: ["ENTERPRISE"],
    globalOverride: false,
  },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */

function signAccessToken(userId, role) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not set. Did you copy server/.env from .env.example?",
    );
  }
  return jwt.sign({ userId: String(userId), role }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "7d",
  });
}

async function upsertUser(persona) {
  // Idempotent: find-or-update by email
  const set = {
    fullName: persona.fullName,
    phone: persona.phone,
    role: persona.role,
    subscriptionTier: persona.tier,
    preferredLanguage: persona.preferredLanguage,
    cityState: persona.cityState,
    onboardingData: persona.onboardingData,
    authProvider: "email",
    isActive: true,
    isVerified: true,
  };

  const user = await User.findOneAndUpdate(
    { email: persona.email },
    { $set: set, $setOnInsert: { email: persona.email } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  return user;
}

async function upsertSubscription(userId, tier) {
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  return Subscription.findOneAndUpdate(
    { userId },
    {
      $set: {
        tier,
        status: tier === "FREE" ? "cancelled" : "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + oneMonth),
        plansUsedThisMonth: 0,
        adminOverride: {
          isOverride: true,
          reason: "Seeded by scripts/seed-dev-users.js",
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function upsertArchitectProfile(userId, data) {
  return ArchitectProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...data,
        verifiedAt: new Date(),
        rating: { average: 4.8, count: 23 },
        totalReviewsCompleted: 23,
        totalEarnings: 5_85_000 * 100, // ₹5.85L in paise
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/* ─── Steps ───────────────────────────────────────────────────────── */

async function clearSeeded() {
  log.section("Clearing previously seeded data");

  const seededEmails = PERSONAS.map((p) => p.email);
  const seededUsers = await User.find({ email: { $in: seededEmails } })
    .select("_id")
    .lean();
  const seededIds = seededUsers.map((u) => u._id);

  if (seededIds.length === 0) {
    log.info("Nothing to clear.");
    return;
  }

  const [users, subs, plans, profiles, requests, flags] = await Promise.all([
    User.deleteMany({ _id: { $in: seededIds } }),
    Subscription.deleteMany({ userId: { $in: seededIds } }),
    Plan.deleteMany({ userId: { $in: seededIds } }),
    ArchitectProfile.deleteMany({ userId: { $in: seededIds } }),
    ReviewRequest.deleteMany({ homeownerId: { $in: seededIds } }),
    FeatureFlag.deleteMany({
      featureName: { $in: FEATURE_FLAGS.map((f) => f.featureName) },
    }),
  ]);

  log.success(
    `Cleared: ${users.deletedCount} users, ${subs.deletedCount} subscriptions, ${plans.deletedCount} plans, ${profiles.deletedCount} architect profiles, ${requests.deletedCount} review requests, ${flags.deletedCount} feature flags`,
  );
}

async function seedUsers() {
  log.section("Seeding users");

  const created = {};
  for (const persona of PERSONAS) {
    if (only && persona.key !== only) continue;

    const user = await upsertUser(persona);
    const sub = await upsertSubscription(user._id, persona.tier);

    let profile = null;
    if (persona.architectProfile) {
      profile = await upsertArchitectProfile(
        user._id,
        persona.architectProfile,
      );
    }

    created[persona.key] = { user, sub, profile, persona };
    log.success(
      `${persona.role.padEnd(10)} ${persona.email.padEnd(28)} ${c.dim}(tier: ${persona.tier})${c.reset}`,
    );
  }
  return created;
}

async function seedPlans(created) {
  log.section("Seeding sample plans");

  if (!created.owner) {
    log.info("Skipped (owner persona not seeded)");
    return [];
  }

  const ownerId = created.owner.user._id;

  // Idempotent: delete then re-create (cleaner than try-to-upsert by title)
  await Plan.deleteMany({
    userId: ownerId,
    title: { $regex: /Mehta family|Weekend home|In-laws apartment/ },
  });
  const plans = await Plan.create(plansFor(ownerId));

  for (const p of plans) {
    log.success(`Plan: ${c.dim}${p.status.padEnd(12)}${c.reset} "${p.title}"`);
  }
  return plans;
}

async function seedFeatureFlags() {
  log.section("Seeding feature flags");

  for (const flag of FEATURE_FLAGS) {
    await FeatureFlag.findOneAndUpdate(
      { featureName: flag.featureName },
      { $set: flag },
      { upsert: true, setDefaultsOnInsert: true },
    );
    log.success(
      `${c.dim}${flag.enabledForTiers.join(",").padEnd(28)}${c.reset} ${flag.featureName}`,
    );
  }
}

async function seedMarketplaceRequest(created, plans) {
  log.section("Seeding marketplace review request");

  if (!created.owner || plans.length === 0) {
    log.info("Skipped (no owner / no plans)");
    return;
  }

  const ownerId = created.owner.user._id;
  const completedPlan = plans.find((p) => p.status === "COMPLETED");
  if (!completedPlan) {
    log.info("Skipped (no completed plan)");
    return;
  }

  // Avoid duplicates on re-runs
  await ReviewRequest.deleteMany({
    homeownerId: ownerId,
    planId: completedPlan._id,
  });

  const req = await ReviewRequest.create({
    homeownerId: ownerId,
    planId: completedPlan._id,
    title: "Need an architect to review my Pune villa plan",
    description:
      "Looking for an architect familiar with Maharashtra municipal bylaws to validate the layout and FSI calculation before I take this to the BMC.",
    preferredTimelineDays: 7,
    maxBudgetInr: 5000 * 100, // ₹5,000 in paise
    cityState: { city: "Pune", state: "Maharashtra" },
    status: "OPEN",
    bidCount: 0,
    expiresAt: new Date(Date.now() + 14 * 86400000),
  });

  log.success(
    `Review request: "${req.title.slice(0, 50)}…" (₹${req.maxBudgetInr / 100})`,
  );
}

/* ─── Pretty summary ──────────────────────────────────────────────── */

function printSummary(created) {
  log.section("Login instructions");
  console.log();
  console.log(`  Open ${c.bold}${c.cyan}http://localhost:3000/login${c.reset}`);
  console.log(`  Enter one of the emails below, click "Send OTP".`);
  console.log(
    `  Watch the ${c.bold}server terminal${c.reset} — the OTP is logged to console`,
  );
  console.log(`  because ${c.dim}EMAIL_HOST${c.reset} isn't set in dev.`);
  console.log();

  log.divider();
  console.log(
    `  ${c.bold}EMAIL                          ROLE         TIER          LANG${c.reset}`,
  );
  log.divider();
  for (const key of Object.keys(created)) {
    const { persona } = created[key];
    console.log(
      `  ${persona.email.padEnd(30)} ` +
        `${c.green}${persona.role.padEnd(12)}${c.reset} ` +
        `${c.yellow}${persona.tier.padEnd(12)}${c.reset} ` +
        `${c.dim}${persona.preferredLanguage}${c.reset}`,
    );
  }
  log.divider();

  log.section("Direct API access (pre-signed JWTs)");
  console.log();
  console.log(
    `  ${c.dim}Skip the login flow — paste these into your HTTP client:${c.reset}`,
  );
  console.log();

  for (const key of Object.keys(created)) {
    const { user, persona } = created[key];
    const token = signAccessToken(user._id, persona.role);
    console.log(
      `  ${c.bold}${persona.role.toUpperCase()}${c.reset}  ${c.dim}(${persona.email})${c.reset}`,
    );
    console.log(
      `  ${c.gray}curl -H "Authorization: Bearer ${token.slice(0, 32)}…" \\${c.reset}`,
    );
    console.log(
      `  ${c.gray}     http://localhost:5000/api/v1/health${c.reset}`,
    );
    console.log();
    console.log(`  Full token:`);
    console.log(`  ${c.cyan}${token}${c.reset}`);
    console.log();
  }

  log.divider();
  console.log();
  console.log(
    `  ${c.bold}Browser tip:${c.reset} drop a token into the auth context with`,
  );
  console.log(
    `  ${c.dim}window.__setDevToken('<jwt>')${c.reset} — but only if AuthContext`,
  );
  console.log(
    `  exposes that helper (currently it doesn't, so just use OTP login).`,
  );
  console.log();
}

/* ─── Main ────────────────────────────────────────────────────────── */

async function main() {
  // Safety net
  if (process.env.NODE_ENV === "production" && process.env.FORCE !== "1") {
    log.error(
      "Refusing to seed in NODE_ENV=production. Set FORCE=1 to override.",
    );
    process.exit(1);
  }

  log.section("VastuVerse dev seed");
  console.log(
    `  MONGO_URI:  ${c.dim}${process.env.MONGO_URI || "(not set)"}${c.reset}`,
  );
  console.log(
    `  NODE_ENV:   ${c.dim}${process.env.NODE_ENV || "development"}${c.reset}`,
  );
  console.log(`  Args:       ${c.dim}${args.join(" ") || "(none)"}${c.reset}`);

  if (!process.env.MONGO_URI) {
    log.error("MONGO_URI is not set. Did you create server/.env?");
    process.exit(1);
  }

  // Connect using the shared helper
  await connectDB();

  if (shouldClear) await clearSeeded();

  const created = await seedUsers();
  const plans = await seedPlans(created);
  await seedFeatureFlags();
  await seedMarketplaceRequest(created, plans);

  printSummary(created);

  await mongoose.connection.close();
  console.log(`${c.green}${c.bold}Done.${c.reset}\n`);
  process.exit(0);
}

main().catch(async (err) => {
  log.error(`Seed failed: ${err.message}`);
  if (err.stack) console.error(err.stack);
  try {
    await mongoose.connection.close();
  } catch (_) {}
  process.exit(1);
});
