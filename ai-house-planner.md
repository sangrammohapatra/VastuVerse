# AI House Planner — Full System Design Document

> **Stack:** MERN (MongoDB · Express.js · React.js · Node.js) + Material UI v5  
> **Target:** India · Responsive Web (Desktop + Mobile) · Online Only  
> **Version:** 1.0 — Full Architecture Blueprint

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas & Feature Matrix](#2-user-personas--feature-matrix)
3. [Plan Status Lifecycle](#3-plan-status-lifecycle)
4. [Subscription & Monetization System](#4-subscription--monetization-system)
5. [Authentication & Onboarding](#5-authentication--onboarding)
6. [Step-by-Step Plan Creation Journey](#6-step-by-step-plan-creation-journey)
7. [AI Pipeline & Abstraction Layer](#7-ai-pipeline--abstraction-layer)
8. [Database Schema](#8-database-schema)
9. [REST API Design](#9-rest-api-design)
10. [Folder Structure](#10-folder-structure)
11. [Environment Variables](#11-environment-variables)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Backend Architecture](#13-backend-architecture)
14. [Collaboration & Notifications](#14-collaboration--notifications)
15. [Plan Versioning System](#15-plan-versioning-system)
16. [Contractor View](#16-contractor-view)
17. [Municipal Approval Module](#17-municipal-approval-module)
18. [Architect Marketplace](#18-architect-marketplace)
19. [Admin Panel](#19-admin-panel)
20. [Internationalisation (i18n)](#20-internationalisation-i18n)
21. [DevOps & Deployment](#21-devops--deployment)
22. [Security Considerations](#22-security-considerations)
23. [Scalability Strategy](#23-scalability-strategy)

---

## 1. Product Overview

**AI House Planner** is a web-based, AI-powered house design platform that enables individual homeowners and real estate developers in India to create complete house plans — floor layouts, interiors, exteriors, utilities, and cost estimates — without requiring a professional architect in the early design phase.

### Core Principles

- **Step-by-step guided wizard** — no design knowledge required
- **AI-first** — every generation step uses AI (image + structured JSON)
- **India-specific** — NBC norms, vastu, FSI/FAR, state-level cost datasets, municipal bye-laws
- **Provider-agnostic** — all third-party services swappable via `.env`
- **Fully responsive** — identical feature set on desktop and mobile
- **Role-driven** — four distinct personas with strict RBAC

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│   MUI v5 · react-i18next · Three.js · Socket.io     │
└───────────────┬─────────────────────────────────────┘
                │ REST + WebSocket
┌───────────────▼─────────────────────────────────────┐
│               Express.js API Server                  │
│   RBAC Middleware · Passport.js · Bull Queue         │
├──────────┬───────────┬───────────┬───────────────────┤
│ AI Layer │ Storage   │ Notif.    │ Payment           │
│ (Abstr.) │ (Abstr.)  │ (Abstr.)  │ (Razorpay)        │
└──────────┴─────┬─────┴───────────┴───────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│           MongoDB + Redis (Cache/Queue)              │
└─────────────────────────────────────────────────────┘
```

---

## 2. User Personas & Feature Matrix

### 2.1 Individual Homeowner

**Onboarding fields:** Full name · City/State · Plot ownership status · Preferred language · Phone number (for WhatsApp)

| Feature | Free | Basic | Pro |
|---|---|---|---|
| Plans per month | 1 (lifetime) | 3 | Unlimited |
| AI generations/day | 5 | 20 | Unlimited |
| Plan versions | 5 | 20 | Unlimited |
| 3D View | ✗ | ✗ | ✓ |
| Municipal doc export | ✗ | ✓ | ✓ |
| Contractor view link | ✓ | ✓ | ✓ |
| Branded PDF export | ✗ | ✗ | ✓ |
| Architect marketplace | ✓ (post-complete) | ✓ | ✓ |
| Collaborators | 3 | 10 | Unlimited |
| WhatsApp notifications | ✓ | ✓ | ✓ |
| Priority AI queue | ✗ | ✗ | ✓ |

### 2.2 Real Estate Developer

**Onboarding fields:** Company name · GSTIN · Designation · Team size · Project types · Primary operating regions · Phone

| Feature | Pro | Enterprise |
|---|---|---|
| Projects (bulk) | Unlimited | Unlimited |
| Plans per project | Unlimited | Unlimited |
| Team members | 10 | Unlimited |
| Team RBAC roles | Admin/Editor/Reviewer/Viewer | Same + custom |
| Template library | ✓ | ✓ |
| Client sharing portal | ✓ | ✓ |
| Contractor view link | ✓ | ✓ |
| Branded PDF export | ✓ | ✓ |
| Priority AI queue | ✓ | Dedicated queue |
| Analytics dashboard | ✓ | ✓ + API |
| Municipal docs | ✓ | ✓ |
| 3D View | ✓ | ✓ |
| Architect marketplace | ✓ (post-complete) | ✓ |
| WhatsApp for team | ✓ | ✓ |

### 2.3 Admin

Full unrestricted access to all features. Additional capabilities:

- User management (activate/deactivate/role change/tier override)
- Razorpay transaction management + manual free access grants
- Platform analytics (revenue, AI usage, plan counts, active users)
- Content management (templates, cost datasets, municipal rules)
- Feature flag management per tier or per user
- Architect marketplace moderation (verify/approve/suspend)
- Commission rate configuration
- AI provider monitoring (active provider per service, usage stats)
- Seed and update municipal rules per city/state

### 2.4 Verified Architect (Optional Role)

**Onboarding fields:** Full name · CoA Registration number · Years of experience · Portfolio uploads (PDF/images) · Certifications · City/State · Phone

- Enters **pending verification** queue on signup
- Admin reviews and approves/rejects
- Can browse and bid on completed plan review requests
- Submits annotated review reports (PDF + in-app)
- Earnings dashboard with Razorpay payout tracking
- Rating and review system
- WhatsApp + email + in-app notifications

### 2.5 Developer Team Roles (RBAC)

| Role | Can Modify Plans | Can Comment | View Cost Data | Manage Team |
|---|---|---|---|---|
| Admin (Dev) | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | ✓ | ✗ |
| Reviewer | ✗ | ✓ | ✓ | ✗ |
| Viewer | ✗ | ✗ | ✗ | ✗ |

---

## 3. Plan Status Lifecycle

```
                    ┌─────────┐
         Sign up    │  DRAFT  │  Auto-created on wizard start
                    └────┬────┘
                         │ User begins Step 1
                    ┌────▼──────────┐
                    │  IN PROGRESS  │  Steps 1–9 active
                    └────┬──────────┘
                         │ User completes Step 9 (Review & Export)
                    ┌────▼──────────┐
                    │   COMPLETED   │  Architect marketplace unlocked
                    └────┬──────────┘
                         │ User clicks "Reopen for editing"
                    ┌────▼──────────┐       ┌─────────────┐
                    │  IN PROGRESS  │       │  COMPLETED  │
                    │  (reopened)   │──────►│  (re-locked)│
                    └───────────────┘       └──────┬──────┘
                                                   │ User archives
                                             ┌─────▼──────┐
                                             │  ARCHIVED  │
                                             └────────────┘
```

### Status Rules

- **DRAFT → IN PROGRESS**: Auto-transition when Step 1 is saved
- **IN PROGRESS → COMPLETED**: Manual action by plan owner on Step 9
- **COMPLETED → IN PROGRESS**: "Reopen for editing" button — architect marketplace re-locked, collaborators notified
- **COMPLETED/IN PROGRESS → ARCHIVED**: Manual archive by owner or admin
- **ARCHIVED → IN PROGRESS**: Unarchive available (admin or owner)
- Each status change is logged in `ActivityLogs` with timestamp and actor
- Completing a reopened plan creates a new "completion event" in the activity log

---

## 4. Subscription & Monetization System

### 4.1 Tier Definitions

```javascript
// Stored in FeatureFlags + Subscriptions collections
const TIERS = {
  FREE: {
    plansLifetime: 1,
    aiGenerationsPerDay: 5,
    planVersions: 5,
    collaborators: 3,
    features: ['floor_plan', 'interior', 'exterior', 'utilities', 'cost_estimate',
               'contractor_view', 'architect_marketplace']
  },
  BASIC: {
    plansPerMonth: 3,
    aiGenerationsPerDay: 20,
    planVersions: 20,
    collaborators: 10,
    features: [...FREE.features, 'municipal_doc']
  },
  PRO: {
    plansPerMonth: Infinity,
    aiGenerationsPerDay: Infinity,
    planVersions: Infinity,
    collaborators: Infinity,
    features: [...BASIC.features, '3d_view', 'branded_export', 'priority_queue']
  },
  ENTERPRISE: {
    plansPerMonth: Infinity,
    aiGenerationsPerDay: Infinity,
    planVersions: Infinity,
    collaborators: Infinity,
    teamMembers: Infinity,
    features: [...PRO.features, 'team_rbac', 'bulk_projects', 'template_library',
               'client_portal', 'analytics_dashboard', 'api_access']
  }
}
```

### 4.2 Razorpay Integration

**Subscription flow:**
1. Frontend calls `POST /api/payments/create-subscription`
2. Backend creates Razorpay subscription → returns `subscriptionId`
3. Frontend opens Razorpay checkout
4. On success, webhook `POST /api/payments/webhook` updates `Subscriptions` collection
5. Backend verifies Razorpay signature before processing

**Pay-per-plan flow:**
1. `POST /api/payments/create-order` → Razorpay order
2. Frontend completes payment
3. Webhook: plan count incremented, feature unlocked

**Architect marketplace escrow:**
1. Homeowner confirms bid → `POST /api/marketplace/bids/:bidId/accept`
2. Razorpay payment captured, stored with status `HELD`
3. Review submitted + accepted → `POST /api/marketplace/reviews/:reviewId/accept`
4. Razorpay transfer to architect (minus commission) via Razorpay Routes
5. Commission credited to platform account

### 4.3 Daily AI Generation Rate Limiting

```javascript
// Redis key: ai_gen_limit:{userId}:{YYYY-MM-DD}
// TTL: 86400 seconds (resets at midnight IST)

async function checkGenerationLimit(userId, tier) {
  const key = `ai_gen_limit:${userId}:${getTodayIST()}`;
  const limit = TIERS[tier].aiGenerationsPerDay;
  if (limit === Infinity) return { allowed: true };
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 86400);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: getNextMidnightIST()
  };
}
```

---

## 5. Authentication & Onboarding

### 5.1 Auth Methods

- **Email + OTP**: 6-digit OTP sent via email, valid 10 minutes, max 3 attempts
- **Google OAuth2**: via Passport.js `passport-google-oauth20`
- **Facebook OAuth**: via Passport.js `passport-facebook`

### 5.2 Token Strategy

```javascript
// Access token: 15 min expiry, stored in memory (React state)
// Refresh token: 7 days expiry, stored in httpOnly + Secure + SameSite=Strict cookie
// On 401: frontend auto-calls POST /api/auth/refresh

const accessToken = jwt.sign(
  { userId, role, tier, teamRole },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: '15m' }
);

const refreshToken = jwt.sign(
  { userId },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);
```

### 5.3 Onboarding Flows

**Homeowner:**
```
Role select → Personal details (name, phone) → City/State →
Plot ownership status → Preferred language → Dashboard
```

**Developer:**
```
Role select → Company name → GSTIN (validated format) →
Designation → Team size → Primary regions (multi-select) →
Project types → Dashboard
```

**Architect:**
```
Role select → Personal details → CoA Registration No. →
Years of experience → Upload portfolio (PDF/images, max 10MB) →
Certifications → City/State →
"Your profile is under review" screen (restricted access)
```

### 5.4 RBAC Middleware (Express)

```javascript
// middlewares/rbac.js
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireFeature = (feature) => async (req, res, next) => {
  const flag = await FeatureFlag.findOne({ featureName: feature });
  const userTier = req.user.tier;
  const hasOverride = flag?.userOverrides?.includes(req.user.userId);
  if (!hasOverride && !flag?.enabledForTiers?.includes(userTier)) {
    return res.status(403).json({ error: 'Feature not available on your plan' });
  }
  next();
};

const requireTeamRole = (...teamRoles) => (req, res, next) => {
  if (!teamRoles.includes(req.user.teamRole)) {
    return res.status(403).json({ error: 'Insufficient team permissions' });
  }
  next();
};
```

---

## 6. Step-by-Step Plan Creation Journey

Each step auto-saves on completion and creates a new plan version.

### Step 1 — Land & Structure Setup

**Inputs:**
- Land area + unit toggle (sq ft / sq meters)
- Plot shape: Rectangular / L-shaped / Corner / Irregular
  - Irregular: Upload sketch image → AI shape recognition → auto-detected coordinate polygon
  - If AI confidence < 70%: fallback to manual coordinate input UI
- Facing direction: 8-point compass selector
- Number of floors: 1–5
- City/State: cascading dropdown → auto-loads FSI/FAR, setback rules, NBC zone, solar index
- Vastu toggle (global, persists all steps)

**AI Shape Recognition:**
- Dev: Hugging Face `facebook/maskformer-swin-large-ade` (free)
- Prod: Google Vision API (Shape detection + boundary extraction)
- Output: Array of `{x, y}` coordinates normalised to plot dimensions
- Manual fallback: interactive canvas point-placement tool

### Step 2 — Room Requirements

**Inputs:**
- Bedrooms (1–10)
- Bathrooms: attached count + common count
- Kitchen type: Modular / Open / Traditional
- Additional spaces: Living room, Dining, Pooja room, Study/Office, Garage, Servant quarters, Balconies (count), Staircases (count), Terrace, Storage rooms
- Floor-wise distribution UI for multi-storey (drag-and-drop room assignment per floor)

**AI Smart Suggestions Panel:**
- Triggered on blur of last room field
- Calls `POST /api/ai/room-suggestions` with land area + floors + FSI
- Returns: feasibility rating, recommended adjustments, NBC compliance warnings (English)
- Displayed as MUI `Alert` chips — user can accept or ignore

### Step 3 — Base Floor Plan Generation

**Process:**
1. User clicks "Generate Floor Plans"
2. Generation limit check → if exceeded, show wait time + upgrade prompt
3. BullMQ job queued (priority based on tier)
4. Job calls AI Plan Service → structured JSON → AI Image Service → renders 3 options
5. WebSocket event `plan:generated` pushed to client
6. Client renders 3 option cards

**View Toggle (Dropdown):**
- Image View (default): AI-generated architectural render image
- 2D Structured View: React SVG renderer from JSON floor plan data
  - Rooms drawn as labelled rectangles with dimension annotations
  - Color-coded by room type
  - Vastu compass overlay if vastu enabled

**Enforced Rules (AI Prompt Engineering):**
- NBC minimum room dimensions (bedroom ≥ 9.5 sqm, kitchen ≥ 5 sqm, etc.)
- Setback compliance per city zone
- Bedroom privacy (bedrooms not adjacent to entrance/kitchen)
- Natural ventilation (every habitable room must have external window)
- Sunlight orientation (living rooms prefer south/east facing in India)
- Vastu: main door north/east, kitchen south-east, master bedroom south-west (if toggled)
- Fire egress: staircase within 30m of all rooms
- Load-bearing wall logic for multi-storey

**Version:** Each generation = new version. "Regenerate" always available.

### Step 4 — Interior Design

**Inputs:**
- Global style: Modern / Minimalist / Traditional / Contemporary / Industrial / Indo-Colonial
- Per-room overrides: each room can have a different style
- Kitchen configurator (if kitchen selected):
  - Layout: L-shaped / U-shaped / Straight / Island / Parallel
  - Appliance zones: Hob, Chimney, Refrigerator, Microwave, Dishwasher
- Color palette: AI suggests 3 palettes per style, user can pick

**Output:** Room-wise AI interior image (default) + 2D furniture layout toggle
**Versioning:** Per-room regeneration tracked independently

### Step 5 — Exterior Design

**Inputs:**
- Façade style: Flat / Sloped / Contemporary / Colonial / Vernacular Indian
- Roof type: Flat / Hip / Gabled / Shed / Mansard
- Boundary wall style
- Main gate design
- Driveway: Yes/No + material (concrete / paver blocks / gravel)
- Front garden/landscaping: preset themes (Tropical / Formal / Minimal / None)

**Output:**
- Front elevation image
- Side elevation image (left/right selectable)
- Versioned per regeneration

### Step 6 — Utilities & Infrastructure

**AI generates (structured JSON + overlay on floor plan):**
- Plumbing: wet wall identification, pipe routing, drainage points
- Electrical: switchboard positions, light points, fan points, AC provisions, earthing
- HVAC: ventilation shaft recommendations, AC outdoor unit placement
- Water tanks: overhead sizing formula (135L/person/day × occupants), underground sump
- Sewage: routing to municipal drain or septic tank based on city data
- Solar: feasibility report using MNRE city irradiance data; estimated panel count for roof area

**All overlaid as toggleable layers on the 2D floor plan view**

### Step 7 — Cost Estimation

**Data source:** `CostDatasets` MongoDB collection (admin-managed, state-level)

**Output structure:**
```
Civil Structure:     ₹ XX,XX,XXX
Electrical Works:    ₹  X,XX,XXX
Plumbing:            ₹  X,XX,XXX
Flooring:            ₹  X,XX,XXX
Painting:            ₹    XX,XXX
Finishing/Fixtures:  ₹  X,XX,XXX
─────────────────────────────────
Estimated Total:     ₹ XX,XX,XXX  (±15%)
```

- Finish tier toggle: Economy / Standard / Premium (multiplier applied)
- Exportable as PDF
- Region note: "Based on [State] material rates as of [Month Year]"

### Step 8 — 3D View (Premium)

**Unlock:** Pro subscription or one-time pay-per-plan via Razorpay

**Bird's-eye 3D render:**
- AI image generation from plan JSON + style data
- Prompt includes: floor count, roof type, façade style, approximate dimensions

**Basic walkthrough (Three.js):**
- JSON floor plan → Three.js geometry generation (client-side)
- Rooms as extruded box geometries
- Wall textures from selected interior style
- Orbit controls (mouse drag / touch pinch)
- Room labels as 3D text sprites
- Export: shareable view-only link

**Mobile:** Touch-enabled Three.js canvas (pinch zoom, swipe rotate)

### Step 9 — Municipal Approval Module

**Triggered:** After Step 3 (floor plan) minimum

**Generates:**
1. **Compliance Checklist** (item-by-item against city/state rules from `MunicipalRules`):
   - Setback compliance ✓/✗
   - FAR/FSI within limits ✓/✗
   - Parking norms (based on plot size) ✓/✗
   - Fire egress compliance ✓/✗
   - Minimum road width requirement ✓/✗
   - Structural safety notes
2. **Draft Submission Document:**
   - Applicant details
   - Site details (plot number, survey number fields — user fills)
   - Land use zone
   - Proposed construction summary (floors, rooms, total built-up area)
   - FSI/FAR calculation statement
   - Vastu declaration (if applicable)

**Export:** PDF via server-side PDF generation
**Disclaimer (always shown):** "This document is a guidance aid generated using publicly available bye-laws. Final approval must be obtained from your local municipal authority (ULB/Corporation)."

### Step 10 — Review, Collaborate & Export

- Final review of all steps (summary cards)
- Shareable links management (collaborator / contractor / 3D)
- Collaboration panel: threaded comments per room/section
- Full PDF export
- Version history panel
- Plan status: "Mark as Completed" button → triggers status → COMPLETED

### Step 11 — Architect Marketplace

**Visible only when plan status = COMPLETED**

See Section 18 for full details.

---

## 7. AI Pipeline & Abstraction Layer

### 7.1 Provider Interface Contracts

```javascript
// services/ai/interfaces/ImageGenerationService.js
class ImageGenerationService {
  async generateImage(prompt, options = {}) {
    // Returns: { imageUrl: string, provider: string, generationId: string }
    throw new Error('Not implemented');
  }
}

// services/ai/interfaces/PlanGenerationService.js
class PlanGenerationService {
  async generateFloorPlan(requirements) {
    // Returns: { rooms: [], walls: [], doors: [], windows: [], stairs: [] }
    throw new Error('Not implemented');
  }
  async generateRoomSuggestions(landArea, floors, city, state) {
    // Returns: { suggestions: [], warnings: [], maxBUA: number }
    throw new Error('Not implemented');
  }
  async generateCostEstimate(planData, state, tier) {
    // Returns: { breakdown: {}, total: number, variance: 0.15 }
    throw new Error('Not implemented');
  }
  async generateMunicipalChecklist(planData, city, state) {
    // Returns: { checklist: [], draftDocument: string }
    throw new Error('Not implemented');
  }
}

// services/ai/interfaces/ShapeRecognitionService.js
class ShapeRecognitionService {
  async detectPlotBoundary(imageBuffer) {
    // Returns: { coordinates: [{x,y}], confidence: number, boundingBox: {} }
    throw new Error('Not implemented');
  }
}
```

### 7.2 Provider Implementations

```javascript
// services/ai/providers/image/DalleProvider.js (PROD)
const { OpenAI } = require('openai');
class DalleProvider extends ImageGenerationService {
  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  async generateImage(prompt, options = {}) {
    const response = await this.client.images.generate({
      model: 'dall-e-3',
      prompt: `Architectural render: ${prompt}`,
      size: options.size || '1024x1024',
      quality: 'hd',
      n: 1
    });
    return { imageUrl: response.data[0].url, provider: 'dalle3' };
  }
}

// services/ai/providers/image/PollinationsProvider.js (DEV)
class PollinationsProvider extends ImageGenerationService {
  async generateImage(prompt, options = {}) {
    const encoded = encodeURIComponent(`Architectural: ${prompt}`);
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=1024&height=1024&nologo=true`;
    return { imageUrl, provider: 'pollinations' };
  }
}

// services/ai/providers/plan/GPT4oProvider.js (PROD)
class GPT4oProvider extends PlanGenerationService {
  async generateFloorPlan(requirements) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: FLOOR_PLAN_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(requirements) }
      ],
      response_format: { type: 'json_object' }
    });
    return JSON.parse(response.choices[0].message.content);
  }
}
```

### 7.3 Factory Pattern

```javascript
// services/ai/AIServiceFactory.js
const providers = {
  image: {
    dalle: () => new DalleProvider(),
    huggingface: () => new HuggingFaceImageProvider(),
    pollinations: () => new PollinationsProvider()
  },
  plan: {
    gpt4o: () => new GPT4oProvider(),
    ollama: () => new OllamaProvider(),
    'openai-free': () => new OpenAIFreeProvider()
  },
  shape: {
    'google-vision': () => new GoogleVisionProvider(),
    roboflow: () => new RoboflowProvider(),
    huggingface: () => new HFShapeProvider()
  }
};

class AIServiceFactory {
  static getImageService() {
    const key = process.env.AI_IMAGE_PROVIDER || 'pollinations';
    return providers.image[key]?.() ?? new PollinationsProvider();
  }
  static getPlanService() {
    const key = process.env.AI_PLAN_PROVIDER || 'ollama';
    return providers.plan[key]?.() ?? new OllamaProvider();
  }
  static getShapeService() {
    const key = process.env.AI_SHAPE_PROVIDER || 'huggingface';
    return providers.shape[key]?.() ?? new HFShapeProvider();
  }
}
```

### 7.4 BullMQ Job Queue

```javascript
// queues/aiGenerationQueue.js
const { Queue, Worker } = require('bullmq');

const aiQueue = new Queue('ai-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
});

// Job priorities: PRO=1, BASIC=5, FREE=10 (lower = higher priority)
async function enqueueGeneration(userId, tier, jobData) {
  const priority = tier === 'PRO' || tier === 'ENTERPRISE' ? 1 : tier === 'BASIC' ? 5 : 10;
  const job = await aiQueue.add('generate', { userId, ...jobData }, { priority });
  return job.id;
}

// Worker processes jobs and pushes WebSocket events on completion
const worker = new Worker('ai-generation', async (job) => {
  const { userId, type, planId, stepData } = job.data;
  const result = await processAIJob(type, stepData);
  await saveGenerationResult(planId, type, result);
  io.to(`user:${userId}`).emit('generation:complete', { planId, type, result });
}, { connection: redisConnection });
```

### 7.5 AI Prompt Templates

```javascript
// prompts/floorPlanPrompt.js
const FLOOR_PLAN_SYSTEM_PROMPT = `
You are an expert Indian architect following NBC 2016 standards.
Generate a JSON floor plan with the following structure:
{
  "floors": [{
    "level": 0,
    "rooms": [{ "id", "type", "width_ft", "height_ft", "x", "y", "rotation", "vastuCompliant" }],
    "walls": [{ "x1","y1","x2","y2","thickness","isLoadBearing" }],
    "doors": [{ "roomId","wall","position","width" }],
    "windows": [{ "roomId","wall","position","width","height" }]
  }],
  "complianceNotes": [],
  "warnings": []
}
Rules:
- Bedroom minimum 9.5 sqm, Kitchen minimum 5 sqm (NBC)
- Bedrooms must not be adjacent to main entrance
- Every habitable room must have an external window
- Apply vastu rules if vastuEnabled=true
- Respect FSI and setback parameters provided
`;
```

---

## 8. Database Schema

### 8.1 Users

```javascript
{
  _id: ObjectId,
  email: { type: String, unique: true, index: true },
  phone: String,
  passwordHash: String, // null for social login
  authProvider: { type: String, enum: ['email', 'google', 'facebook'] },
  socialId: String,
  role: { type: String, enum: ['homeowner', 'developer', 'architect', 'admin'], index: true },
  isActive: { type: Boolean, default: true, index: true },
  isVerified: Boolean, // email verified
  preferredLanguage: { type: String, default: 'en' },
  subscriptionTier: { type: String, enum: ['FREE','BASIC','PRO','ENTERPRISE'], default: 'FREE' },
  onboardingData: {
    // Homeowner
    plotOwnershipStatus: String,
    // Developer
    companyName: String, gstin: String, designation: String,
    teamSize: Number, projectTypes: [String], primaryRegions: [String],
    // Architect
    coaRegistrationNo: String, yearsExperience: Number,
    portfolioUrls: [String], certifications: [String],
    verificationStatus: { type: String, enum: ['pending','approved','rejected'] }
  },
  cityState: { city: String, state: String },
  refreshTokenHash: String,
  aiGenerationsToday: { count: Number, date: String }, // fallback if Redis down
  createdAt: Date,
  updatedAt: Date
}
// Indexes: email (unique), role, subscriptionTier, isActive
```

### 8.2 Plans

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', index: true },
  projectId: ObjectId, // for developer bulk projects
  title: String,
  status: {
    type: String,
    enum: ['DRAFT','IN_PROGRESS','COMPLETED','ARCHIVED'],
    default: 'DRAFT',
    index: true
  },
  currentVersionId: { type: ObjectId, ref: 'PlanVersion' },
  stepProgress: {
    step1: { completed: Boolean, completedAt: Date },
    step2: { completed: Boolean, completedAt: Date },
    step3: { completed: Boolean, completedAt: Date },
    step4: { completed: Boolean, completedAt: Date },
    step5: { completed: Boolean, completedAt: Date },
    step6: { completed: Boolean, completedAt: Date },
    step7: { completed: Boolean, completedAt: Date },
    step8: { completed: Boolean, completedAt: Date }, // 3D
    step9: { completed: Boolean, completedAt: Date }, // Municipal
    step10: { completed: Boolean, completedAt: Date }
  },
  vastuEnabled: { type: Boolean, default: false },
  cityState: { city: String, state: String },
  landDetails: {
    area: Number, unit: String, shape: String,
    plotCoordinates: [{ x: Number, y: Number }],
    facingDirection: String, floors: Number,
    fsi: Number, far: Number, setbacks: Object
  },
  collaborators: [{ type: ObjectId, ref: 'Collaborator' }],
  contractorLinks: [{ type: ObjectId, ref: 'ContractorLink' }],
  is3DUnlocked: { type: Boolean, default: false },
  completedAt: Date,
  archivedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: userId, status, projectId, createdAt
```

### 8.3 PlanVersions

```javascript
{
  _id: ObjectId,
  planId: { type: ObjectId, ref: 'Plan', index: true },
  versionNumber: Number,
  stepName: { type: String, enum: ['step1','step2','step3','step4','step5',
                                    'step6','step7','step8','step9','manual'] },
  label: String, // e.g. "Floor Plan - Option 2" or "Manual save before exterior"
  snapshotData: Object, // full step data snapshot
  thumbnailUrl: String,
  generatedImages: [{ type: String, view: String }], // image URLs per view
  aiProvider: String,
  createdBy: { type: ObjectId, ref: 'User' },
  isRollbackPoint: Boolean,
  createdAt: Date
}
// Indexes: planId + versionNumber (compound unique), planId + createdAt
```

### 8.4 Comments

```javascript
{
  _id: ObjectId,
  planId: { type: ObjectId, ref: 'Plan', index: true },
  userId: { type: ObjectId, ref: 'User' },
  parentId: ObjectId, // null = root comment, set = reply
  roomId: String, // room identifier from floor plan JSON
  stepName: String, // which step comment is pinned to
  content: String,
  resolved: { type: Boolean, default: false },
  resolvedBy: ObjectId,
  resolvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: planId, planId+stepName, parentId
```

### 8.5 Collaborators

```javascript
{
  _id: ObjectId,
  planId: { type: ObjectId, ref: 'Plan', index: true },
  invitedBy: { type: ObjectId, ref: 'User' },
  userId: ObjectId, // set after invite accepted
  email: String, // invite target
  permission: { type: String, enum: ['view', 'comment', 'edit'] },
  inviteStatus: { type: String, enum: ['pending','accepted','declined'] },
  inviteToken: { type: String, index: true },
  expiresAt: Date,
  acceptedAt: Date,
  createdAt: Date
}
```

### 8.6 ContractorLinks

```javascript
{
  _id: ObjectId,
  planId: { type: ObjectId, ref: 'Plan', index: true },
  createdBy: { type: ObjectId, ref: 'User' },
  token: { type: String, unique: true, index: true },
  expiryType: { type: String, enum: ['24h','7d','permanent'] },
  expiresAt: Date,
  accessLog: [{
    ip: String, userAgent: String, accessedAt: Date
  }],
  isRevoked: { type: Boolean, default: false },
  createdAt: Date
}
```

### 8.7 Subscriptions

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', unique: true },
  tier: { type: String, enum: ['FREE','BASIC','PRO','ENTERPRISE'] },
  razorpaySubscriptionId: String,
  razorpayCustomerId: String,
  status: { type: String, enum: ['active','paused','cancelled','expired'] },
  plansUsedThisMonth: Number,
  versionsUsed: Number,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelledAt: Date,
  adminOverride: { isOverride: Boolean, grantedBy: ObjectId, reason: String },
  createdAt: Date,
  updatedAt: Date
}
```

### 8.8 Payments

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', index: true },
  planId: ObjectId,
  type: { type: String, enum: ['subscription','pay_per_plan','3d_unlock','marketplace_bid'] },
  amount: Number, // in paise
  currency: { type: String, default: 'INR' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  status: { type: String, enum: ['created','captured','failed','refunded'] },
  metadata: Object,
  createdAt: Date
}
```

### 8.9 ArchitectProfiles

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', unique: true },
  coaRegistrationNo: String,
  yearsExperience: Number,
  portfolioUrls: [String],
  certifications: [{ name: String, issuedBy: String, year: Number }],
  specializations: [String],
  cityState: { city: String, state: String },
  verificationStatus: { type: String, enum: ['pending','approved','rejected'] },
  verifiedBy: ObjectId,
  verifiedAt: Date,
  rejectionReason: String,
  rating: { average: Number, count: Number },
  totalReviewsCompleted: Number,
  totalEarnings: Number, // in paise
  razorpayContactId: String, // for payouts
  razorpayFundAccountId: String,
  isSuspended: Boolean,
  suspensionReason: String,
  createdAt: Date
}
```

### 8.10 Bids

```javascript
{
  _id: ObjectId,
  planId: { type: ObjectId, ref: 'Plan', index: true },
  architectId: { type: ObjectId, ref: 'User', index: true },
  reviewRequestId: ObjectId,
  proposedFee: Number, // in paise
  proposedTimeline: String, // e.g. "3-5 business days"
  coverNote: String,
  status: {
    type: String,
    enum: ['pending','accepted','rejected','completed','disputed'],
    index: true
  },
  acceptedAt: Date,
  completedAt: Date,
  paymentId: ObjectId,
  createdAt: Date
}
```

### 8.11 Reviews (Architect)

```javascript
{
  _id: ObjectId,
  bidId: { type: ObjectId, ref: 'Bid' },
  planId: { type: ObjectId, ref: 'Plan', index: true },
  architectId: { type: ObjectId, ref: 'User' },
  reportUrl: String,
  annotations: [{
    stepName: String, roomId: String,
    note: String, severity: String // 'info'|'warning'|'critical'
  }],
  summary: String,
  recommendedChanges: [String],
  userRating: Number, // 1-5
  userReview: String,
  status: { type: String, enum: ['submitted','accepted','disputed'] },
  submittedAt: Date,
  acceptedAt: Date
}
```

### 8.12 CostDatasets

```javascript
{
  _id: ObjectId,
  state: { type: String, index: true },
  city: String,
  materialType: String, // 'civil_structure'|'electrical'|'plumbing'|'flooring'|'painting'|'finishing'
  unitType: String, // 'per_sqft'|'per_unit'|'lumpsum'
  costs: {
    economy: Number,   // ₹ per unit
    standard: Number,
    premium: Number
  },
  lastUpdated: Date,
  updatedBy: ObjectId
}
// Index: state + city + materialType (compound)
```

### 8.13 MunicipalRules

```javascript
{
  _id: ObjectId,
  state: { type: String, index: true },
  city: { type: String, index: true },
  zone: String, // residential, mixed-use, etc.
  fsiLimit: Number,
  farLimit: Number,
  setbacks: { front: Number, rear: Number, side: Number }, // in metres
  maxHeight: Number, // in metres
  maxFloors: Number,
  parkingNorms: { twoWheeler: Number, fourWheeler: Number }, // per unit area
  roadWidthRequired: Number, // minimum abutting road width in metres
  fireNorms: { egress: String, hydrantRequired: Boolean },
  additionalRules: [{ rule: String, source: String }],
  lastUpdated: Date,
  dataSource: String, // e.g. "BBMP 2023 Bye-laws"
  isAdminEntered: Boolean // false = seeded from public data
}
// Index: state + city (compound unique)
```

### 8.14 FeatureFlags

```javascript
{
  _id: ObjectId,
  featureName: { type: String, unique: true },
  enabledForTiers: [String], // ['FREE','BASIC','PRO','ENTERPRISE']
  globalOverride: Boolean, // true = enabled for all
  userOverrides: [{ userId: ObjectId, enabled: Boolean, grantedBy: ObjectId }],
  description: String,
  updatedAt: Date
}
```

### 8.15 ActivityLogs

```javascript
{
  _id: ObjectId,
  planId: { type: ObjectId, index: true },
  userId: { type: ObjectId, index: true },
  action: {
    type: String,
    enum: [
      'plan_created','step_completed','plan_status_changed',
      'version_created','version_rolled_back',
      'collaborator_invited','collaborator_joined',
      'comment_added','comment_resolved',
      'contractor_link_created','contractor_link_accessed',
      'pdf_exported','3d_unlocked',
      'marketplace_request_posted','bid_placed','bid_accepted',
      'review_submitted','review_accepted',
      'payment_captured','subscription_changed'
    ]
  },
  metadata: Object,
  ipAddress: String,
  createdAt: { type: Date, index: true }
}
// TTL index: createdAt (auto-delete logs > 1 year for non-critical actions)
// Index: planId + createdAt, userId + createdAt
```

### 8.16 Projects (Developer)

```javascript
{
  _id: ObjectId,
  developerId: { type: ObjectId, ref: 'User', index: true },
  name: String,
  description: String,
  location: { city: String, state: String, address: String },
  planIds: [ObjectId],
  teamMembers: [{
    userId: ObjectId,
    teamRole: { type: String, enum: ['admin','editor','reviewer','viewer'] },
    addedAt: Date
  }],
  templateId: ObjectId,
  clientPortalEnabled: Boolean,
  clientPortalToken: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 9. REST API Design

Base URL: `/api/v1`  
All authenticated routes require `Authorization: Bearer <accessToken>` header.

### 9.1 Auth

```
POST   /auth/send-otp              Body: { email }
POST   /auth/verify-otp            Body: { email, otp }       → { accessToken, user }
POST   /auth/google                Body: { code }
POST   /auth/facebook              Body: { code }
POST   /auth/refresh               Cookie: refreshToken        → { accessToken }
POST   /auth/logout                                            Clears cookie
POST   /auth/onboarding            Auth · Body: onboardingData
```

### 9.2 Plans

```
GET    /plans                      Auth               → [Plan]
POST   /plans                      Auth               → Plan
GET    /plans/:planId              Auth               → Plan (with currentVersion)
PATCH  /plans/:planId              Auth+Owner         Body: { title, vastuEnabled }
PATCH  /plans/:planId/status       Auth+Owner         Body: { status }
DELETE /plans/:planId              Auth+Owner/Admin

GET    /plans/:planId/versions     Auth               → [PlanVersion]
POST   /plans/:planId/versions     Auth               Body: { label } (manual save)
POST   /plans/:planId/rollback     Auth+Owner         Body: { versionId }

GET    /plans/:planId/activity     Auth               → [ActivityLog]
```

### 9.3 Plan Steps

```
PUT    /plans/:planId/steps/1      Auth+Editor  Body: step1Data  → { version, suggestions }
PUT    /plans/:planId/steps/2      Auth+Editor  Body: step2Data  → { version, aiSuggestions }
POST   /plans/:planId/steps/3/generate   Auth+Editor  → { jobId } (queued)
GET    /plans/:planId/steps/3      Auth         → { options: [PlanVersion x3] }
PUT    /plans/:planId/steps/3/select     Auth+Editor  Body: { versionId }
POST   /plans/:planId/steps/4/generate   Auth+Editor  Body: { room, style } → { jobId }
POST   /plans/:planId/steps/5/generate   Auth+Editor  → { jobId }
GET    /plans/:planId/steps/:step  Auth         → stepData
PUT    /plans/:planId/steps/6      Auth+Editor  Body: utilitiesConfig → { overlay }
GET    /plans/:planId/steps/7      Auth         → costEstimate
PUT    /plans/:planId/steps/7      Auth+Editor  Body: { finishTier }
POST   /plans/:planId/steps/8/unlock     Auth+Owner  → Razorpay order (if not Pro)
POST   /plans/:planId/steps/8/generate   Auth+Editor  → { jobId }
GET    /plans/:planId/steps/9      Auth         → { checklist, draftDocument }
```

### 9.4 AI

```
POST   /ai/room-suggestions        Auth  Body: { landArea, floors, city, state }
POST   /ai/shape-recognition       Auth  Multipart: plotSketch image → { coordinates, confidence }
GET    /ai/jobs/:jobId             Auth  → { status, progress, result }
GET    /ai/usage                   Auth  → { today: { used, limit, remaining }, resetAt }
```

### 9.5 Collaboration

```
GET    /plans/:planId/collaborators        Auth
POST   /plans/:planId/collaborators/invite Auth+Owner  Body: { email, permission }
PATCH  /plans/:planId/collaborators/:id   Auth+Owner  Body: { permission }
DELETE /plans/:planId/collaborators/:id   Auth+Owner
POST   /collaborators/accept/:token       (public)    → redirect to plan
```

### 9.6 Contractor Links

```
POST   /plans/:planId/contractor-links   Auth+Owner  Body: { expiryType }  → { token, url }
GET    /plans/:planId/contractor-links   Auth+Owner  → [ContractorLink]
DELETE /plans/:planId/contractor-links/:id  Auth+Owner
GET    /contractor/:token                (public, no auth required)  → contractorView
```

Contractor view response omits: `costEstimate`, `collaborators`, `comments`, `userId`. Includes: `floorPlan`, `walls`, `utilities`, `dimensions`.

### 9.7 Comments

```
GET    /plans/:planId/comments         Auth  Query: ?step=&roomId=
POST   /plans/:planId/comments         Auth  Body: { stepName, roomId, content, parentId }
PATCH  /plans/:planId/comments/:id     Auth+Author  Body: { content }
DELETE /plans/:planId/comments/:id     Auth+Author/Admin
PATCH  /plans/:planId/comments/:id/resolve  Auth+Owner
```

### 9.8 Payments

```
POST   /payments/create-subscription   Auth  Body: { tier }  → { subscriptionId, key }
POST   /payments/create-order          Auth  Body: { type, planId }  → { orderId, amount, key }
POST   /payments/webhook               (Razorpay signature verified)
GET    /payments/history               Auth  → [Payment]
GET    /subscriptions/current          Auth  → Subscription
DELETE /subscriptions/current          Auth  (cancel)
```

### 9.9 Architect Marketplace

```
POST   /plans/:planId/review-requests  Auth+Owner(post-complete)  Body: { description, budget }
GET    /review-requests                Auth+Architect  Query: ?city=&state=&budget=
POST   /review-requests/:id/bids       Auth+Architect  Body: { fee, timeline, coverNote }
GET    /plans/:planId/bids             Auth+Owner
POST   /bids/:bidId/accept             Auth+Owner  → Razorpay order
POST   /bids/:bidId/submit-review      Auth+Architect  Multipart: { reportPdf, annotations }
POST   /reviews/:reviewId/accept       Auth+Owner  → triggers payout
POST   /reviews/:reviewId/dispute      Auth+Owner  Body: { reason }
GET    /architects/:architectId/profile Auth  → public profile + rating
POST   /reviews/:reviewId/rate         Auth+Owner  Body: { rating, review }
```

### 9.10 Admin

```
GET    /admin/users                    Admin  Query: ?role=&tier=&status=
PATCH  /admin/users/:id                Admin  Body: { isActive, tier, role }
GET    /admin/analytics                Admin  Query: ?from=&to=
GET    /admin/ai-usage                 Admin
GET    /admin/payments                 Admin
PATCH  /admin/feature-flags/:feature   Admin  Body: { enabledForTiers, userOverrides }
GET    /admin/architects/pending       Admin
PATCH  /admin/architects/:id/verify    Admin  Body: { status, rejectionReason }
PATCH  /admin/architects/:id/suspend   Admin  Body: { reason }
GET    /admin/municipal-rules          Admin  Query: ?state=&city=
POST   /admin/municipal-rules          Admin  Body: MunicipalRule
PUT    /admin/municipal-rules/:id      Admin
GET    /admin/cost-datasets            Admin  Query: ?state=
POST   /admin/cost-datasets            Admin  Body: CostDataset
PUT    /admin/cost-datasets/:id        Admin
PATCH  /admin/marketplace/commission   Admin  Body: { percentage }
```

### 9.11 Projects (Developer)

```
GET    /projects                       Auth+Developer
POST   /projects                       Auth+Developer  Body: projectData
GET    /projects/:id                   Auth+Developer+TeamMember
PATCH  /projects/:id                   Auth+Developer+Admin
POST   /projects/:id/team              Auth+Developer+Admin  Body: { userId, teamRole }
PATCH  /projects/:id/team/:memberId    Auth+Developer+Admin  Body: { teamRole }
DELETE /projects/:id/team/:memberId    Auth+Developer+Admin
POST   /projects/:id/plans             Auth+Developer+Editor  Body: planData
GET    /projects/:id/analytics         Auth+Developer+Admin
```

---

## 10. Folder Structure

```
ai-house-planner/
├── client/                          # React frontend
│   ├── public/
│   │   ├── locales/                 # i18n JSON files
│   │   │   ├── en/translation.json
│   │   │   ├── hi/translation.json
│   │   │   ├── bn/translation.json
│   │   │   └── ...
│   │   └── index.html
│   ├── src/
│   │   ├── api/                     # Axios API client modules
│   │   │   ├── axiosInstance.js     # Base axios with interceptors
│   │   │   ├── auth.api.js
│   │   │   ├── plans.api.js
│   │   │   ├── ai.api.js
│   │   │   ├── payments.api.js
│   │   │   ├── collaboration.api.js
│   │   │   └── marketplace.api.js
│   │   ├── components/
│   │   │   ├── common/              # Shared UI components
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── LanguageSwitcher.jsx
│   │   │   │   ├── LoadingOverlay.jsx
│   │   │   │   ├── ConfirmDialog.jsx
│   │   │   │   ├── StatusChip.jsx
│   │   │   │   └── ErrorBoundary.jsx
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   ├── OTPInput.jsx
│   │   │   │   ├── SocialLoginButtons.jsx
│   │   │   │   └── RoleSelector.jsx
│   │   │   ├── onboarding/
│   │   │   │   ├── HomeownerOnboarding.jsx
│   │   │   │   ├── DeveloperOnboarding.jsx
│   │   │   │   └── ArchitectOnboarding.jsx
│   │   │   ├── wizard/              # Plan creation wizard
│   │   │   │   ├── WizardShell.jsx  # Step router + progress indicator
│   │   │   │   ├── MobileStepDrawer.jsx
│   │   │   │   ├── Step1Land.jsx
│   │   │   │   ├── Step2Rooms.jsx
│   │   │   │   ├── Step3FloorPlan.jsx
│   │   │   │   ├── Step4Interior.jsx
│   │   │   │   ├── Step5Exterior.jsx
│   │   │   │   ├── Step6Utilities.jsx
│   │   │   │   ├── Step7Cost.jsx
│   │   │   │   ├── Step8ThreeD.jsx
│   │   │   │   ├── Step9Municipal.jsx
│   │   │   │   ├── Step10Review.jsx
│   │   │   │   └── Step11Marketplace.jsx
│   │   │   ├── floor-plan/
│   │   │   │   ├── FloorPlanRenderer.jsx   # SVG 2D renderer
│   │   │   │   ├── RoomBlock.jsx
│   │   │   │   ├── VastuOverlay.jsx
│   │   │   │   ├── UtilityLayer.jsx
│   │   │   │   └── ViewToggle.jsx
│   │   │   ├── three-d/
│   │   │   │   ├── ThreeDViewer.jsx        # Three.js canvas wrapper
│   │   │   │   ├── FloorPlanTo3D.js        # JSON → Three.js geometry
│   │   │   │   └── WalkthroughControls.jsx
│   │   │   ├── collaboration/
│   │   │   │   ├── CollaboratorPanel.jsx
│   │   │   │   ├── CommentThread.jsx
│   │   │   │   ├── CommentPin.jsx
│   │   │   │   └── InviteModal.jsx
│   │   │   ├── versioning/
│   │   │   │   ├── VersionHistoryPanel.jsx
│   │   │   │   ├── VersionCard.jsx
│   │   │   │   └── RollbackConfirm.jsx
│   │   │   ├── marketplace/
│   │   │   │   ├── ReviewRequestForm.jsx
│   │   │   │   ├── BidList.jsx
│   │   │   │   ├── BidCard.jsx
│   │   │   │   └── ReviewViewer.jsx
│   │   │   ├── admin/
│   │   │   │   ├── UserTable.jsx
│   │   │   │   ├── AnalyticsDashboard.jsx
│   │   │   │   ├── FeatureFlagManager.jsx
│   │   │   │   ├── MunicipalRulesEditor.jsx
│   │   │   │   ├── CostDatasetEditor.jsx
│   │   │   │   └── ArchitectVerification.jsx
│   │   │   └── payments/
│   │   │       ├── RazorpayCheckout.jsx
│   │   │       ├── SubscriptionCard.jsx
│   │   │       └── PaymentHistory.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Auth.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── PlanWizard.jsx
│   │   │   ├── PlanView.jsx           # Read-only / completed plan
│   │   │   ├── ContractorView.jsx     # Public token-based page
│   │   │   ├── Projects.jsx           # Developer
│   │   │   ├── ProjectDetail.jsx
│   │   │   ├── Marketplace.jsx
│   │   │   ├── ArchitectDashboard.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   └── Settings.jsx
│   │   ├── store/                     # Zustand stores
│   │   │   ├── authStore.js
│   │   │   ├── planStore.js
│   │   │   ├── wizardStore.js
│   │   │   ├── notificationStore.js
│   │   │   └── uiStore.js
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── usePlan.js
│   │   │   ├── useSocket.js
│   │   │   ├── useAIGeneration.js
│   │   │   ├── useVersions.js
│   │   │   └── useFeatureFlag.js
│   │   ├── utils/
│   │   │   ├── floorPlanToSVG.js
│   │   │   ├── formatCurrency.js
│   │   │   ├── dateUtils.js
│   │   │   └── validators.js
│   │   ├── theme/
│   │   │   ├── theme.js               # MUI theme config
│   │   │   └── palette.js
│   │   ├── router/
│   │   │   ├── AppRouter.jsx
│   │   │   ├── ProtectedRoute.jsx     # Auth + role guard
│   │   │   └── routes.js
│   │   ├── i18n/
│   │   │   └── i18n.js                # react-i18next config
│   │   ├── socket/
│   │   │   └── socketClient.js
│   │   └── main.jsx
│   ├── .env.development
│   ├── .env.production
│   └── package.json
│
├── server/                            # Express.js backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                  # MongoDB connection
│   │   │   ├── redis.js               # Redis/in-memory factory
│   │   │   ├── passport.js            # Passport strategies
│   │   │   └── providers.js           # Service factory init
│   │   ├── models/                    # Mongoose models
│   │   │   ├── User.model.js
│   │   │   ├── Plan.model.js
│   │   │   ├── PlanVersion.model.js
│   │   │   ├── Comment.model.js
│   │   │   ├── Collaborator.model.js
│   │   │   ├── ContractorLink.model.js
│   │   │   ├── Subscription.model.js
│   │   │   ├── Payment.model.js
│   │   │   ├── ArchitectProfile.model.js
│   │   │   ├── Bid.model.js
│   │   │   ├── Review.model.js
│   │   │   ├── CostDataset.model.js
│   │   │   ├── MunicipalRule.model.js
│   │   │   ├── FeatureFlag.model.js
│   │   │   ├── ActivityLog.model.js
│   │   │   └── Project.model.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── plans.routes.js
│   │   │   ├── steps.routes.js
│   │   │   ├── ai.routes.js
│   │   │   ├── collaboration.routes.js
│   │   │   ├── contractor.routes.js
│   │   │   ├── comments.routes.js
│   │   │   ├── payments.routes.js
│   │   │   ├── marketplace.routes.js
│   │   │   ├── projects.routes.js
│   │   │   └── admin.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── plans.controller.js
│   │   │   ├── steps.controller.js
│   │   │   ├── ai.controller.js
│   │   │   ├── collaboration.controller.js
│   │   │   ├── contractor.controller.js
│   │   │   ├── comments.controller.js
│   │   │   ├── payments.controller.js
│   │   │   ├── marketplace.controller.js
│   │   │   ├── projects.controller.js
│   │   │   └── admin.controller.js
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js     # JWT verification
│   │   │   ├── rbac.middleware.js     # Role + feature checks
│   │   │   ├── rateLimit.middleware.js
│   │   │   ├── aiLimit.middleware.js  # Daily AI generation check
│   │   │   ├── planStatus.middleware.js  # Status-gated routes
│   │   │   ├── upload.middleware.js   # Multer config
│   │   │   └── webhook.middleware.js  # Razorpay signature verify
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── ImageGenerationService.js
│   │   │   │   │   ├── PlanGenerationService.js
│   │   │   │   │   └── ShapeRecognitionService.js
│   │   │   │   ├── providers/
│   │   │   │   │   ├── image/
│   │   │   │   │   │   ├── DalleProvider.js
│   │   │   │   │   │   ├── HuggingFaceImageProvider.js
│   │   │   │   │   │   └── PollinationsProvider.js
│   │   │   │   │   ├── plan/
│   │   │   │   │   │   ├── GPT4oProvider.js
│   │   │   │   │   │   ├── OllamaProvider.js
│   │   │   │   │   │   └── OpenAIFreeProvider.js
│   │   │   │   │   └── shape/
│   │   │   │   │       ├── GoogleVisionProvider.js
│   │   │   │   │       ├── RoboflowProvider.js
│   │   │   │   │       └── HFShapeProvider.js
│   │   │   │   ├── AIServiceFactory.js
│   │   │   │   └── prompts/
│   │   │   │       ├── floorPlan.prompt.js
│   │   │   │       ├── interior.prompt.js
│   │   │   │       ├── exterior.prompt.js
│   │   │   │       ├── utilities.prompt.js
│   │   │   │       ├── costEstimate.prompt.js
│   │   │   │       └── municipalChecklist.prompt.js
│   │   │   ├── storage/
│   │   │   │   ├── interfaces/StorageService.js
│   │   │   │   ├── providers/
│   │   │   │   │   ├── CloudinaryProvider.js
│   │   │   │   │   ├── S3Provider.js
│   │   │   │   │   └── LocalProvider.js
│   │   │   │   └── StorageFactory.js
│   │   │   ├── notification/
│   │   │   │   ├── interfaces/NotificationService.js
│   │   │   │   ├── providers/
│   │   │   │   │   ├── email/
│   │   │   │   │   │   ├── SendGridProvider.js
│   │   │   │   │   │   └── MailtrapProvider.js
│   │   │   │   │   ├── whatsapp/
│   │   │   │   │   │   ├── TwilioProvider.js
│   │   │   │   │   │   ├── WATIProvider.js
│   │   │   │   │   │   └── MockWhatsAppProvider.js
│   │   │   │   │   └── realtime/
│   │   │   │   │       └── SocketIOProvider.js
│   │   │   │   └── NotificationFactory.js
│   │   │   ├── payment/
│   │   │   │   ├── RazorpayService.js
│   │   │   │   └── MockPaymentService.js
│   │   │   ├── pdf/
│   │   │   │   └── PDFGeneratorService.js  # puppeteer or pdfkit
│   │   │   ├── PlanVersionService.js
│   │   │   ├── CostEstimationService.js
│   │   │   └── MunicipalRuleService.js
│   │   ├── queues/
│   │   │   ├── aiGenerationQueue.js
│   │   │   ├── notificationQueue.js
│   │   │   └── workers/
│   │   │       ├── aiGenerationWorker.js
│   │   │       └── notificationWorker.js
│   │   ├── socket/
│   │   │   └── socketHandler.js
│   │   ├── utils/
│   │   │   ├── razorpayVerify.js
│   │   │   ├── tokenGenerator.js
│   │   │   ├── indianFSI.js          # FSI/FAR lookup helpers
│   │   │   ├── vastuRules.js
│   │   │   └── logger.js             # Winston logger
│   │   ├── seed/
│   │   │   ├── municipalRules.seed.js  # Public data for metros
│   │   │   ├── costDatasets.seed.js
│   │   │   └── featureFlags.seed.js
│   │   └── app.js                    # Express app setup
│   ├── server.js                     # Entry point
│   ├── .env
│   ├── .env.development
│   ├── .env.production
│   └── package.json
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
│   └── nginx.conf
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

---

## 11. Environment Variables

### 11.1 Server `.env`

```env
# ─── App ──────────────────────────────────────────────────
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
COOKIE_DOMAIN=localhost

# ─── MongoDB ──────────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/ai-house-planner

# ─── Redis / Cache / Queue ────────────────────────────────
CACHE_PROVIDER=in-memory          # dev: in-memory | prod: redis
QUEUE_PROVIDER=in-memory          # dev: in-memory | prod: bullmq
REDIS_URL=redis://localhost:6379  # used if CACHE/QUEUE_PROVIDER=redis or bullmq

# ─── Auth ─────────────────────────────────────────────────
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/v1/auth/facebook/callback

# ─── AI ───────────────────────────────────────────────────
AI_ENV=dev                         # dev | prod

AI_IMAGE_PROVIDER=pollinations     # dev: pollinations | huggingface
                                   # prod: dalle
AI_PLAN_PROVIDER=ollama            # dev: ollama | openai-free
                                   # prod: gpt4o
AI_SHAPE_PROVIDER=huggingface      # dev: huggingface
                                   # prod: google-vision | roboflow
AI_3D_PROVIDER=threejs             # both envs: threejs

# OpenAI (prod)
OPENAI_API_KEY=

# Hugging Face (dev)
HUGGINGFACE_API_KEY=
HUGGINGFACE_IMAGE_MODEL=stabilityai/stable-diffusion-2-1
HUGGINGFACE_SHAPE_MODEL=facebook/maskformer-swin-large-ade

# Ollama (dev)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Google Vision (prod shape)
GOOGLE_VISION_API_KEY=

# Roboflow (prod shape, alternative)
ROBOFLOW_API_KEY=
ROBOFLOW_WORKSPACE=
ROBOFLOW_PROJECT=

# AI Generation limits per tier per day
AI_LIMIT_FREE=5
AI_LIMIT_BASIC=20
AI_LIMIT_PRO=0        # 0 = unlimited
AI_LIMIT_ENTERPRISE=0

# Shape recognition confidence threshold (0–1)
AI_SHAPE_CONFIDENCE_THRESHOLD=0.70

# ─── Storage ──────────────────────────────────────────────
STORAGE_PROVIDER=local            # dev: local | prod: cloudinary
FILE_STORAGE_PROVIDER=local       # dev: local | prod: s3
LOCAL_STORAGE_PATH=./uploads

# Cloudinary (prod images)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# AWS S3 (prod files / PDFs)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=

# ─── Email ────────────────────────────────────────────────
EMAIL_PROVIDER=mailtrap           # dev: mailtrap | prod: sendgrid
EMAIL_FROM=noreply@aihouseplanner.in

MAILTRAP_HOST=smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USER=
MAILTRAP_PASS=

SENDGRID_API_KEY=

# ─── WhatsApp ─────────────────────────────────────────────
WHATSAPP_PROVIDER=mock            # dev: mock | prod: twilio | wati

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

WATI_API_URL=
WATI_API_KEY=

# ─── Payments ─────────────────────────────────────────────
PAYMENT_PROVIDER=mock             # dev: mock (Razorpay test mode) | prod: razorpay

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_COMMISSION_PERCENT=10    # Architect marketplace commission

# ─── Subscription Tier Pricing (in paise) ─────────────────
PRICE_BASIC_MONTHLY=49900         # ₹499/month
PRICE_PRO_MONTHLY=149900          # ₹1499/month
PRICE_ENTERPRISE_MONTHLY=499900   # ₹4999/month
PRICE_PAY_PER_PLAN=19900          # ₹199/plan
PRICE_3D_UNLOCK=29900             # ₹299/plan

# ─── Rate Limiting ────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000       # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AI_WINDOW_MS=60000     # 1 minute per AI call (burst protection)

# ─── Misc ─────────────────────────────────────────────────
LOG_LEVEL=debug                   # dev: debug | prod: info
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3
CONTRACTOR_LINK_DEFAULT_EXPIRY=7d
PDF_TEMPLATE_PATH=./templates/pdf
```

### 11.2 Client `.env.development`

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=
VITE_RAZORPAY_KEY_ID=           # Razorpay test key
VITE_DEFAULT_LANGUAGE=en
VITE_ENABLE_3D=true
VITE_ENABLE_WHATSAPP=false
```

### 11.3 Client `.env.production`

```env
VITE_API_BASE_URL=https://api.aihouseplanner.in/api/v1
VITE_SOCKET_URL=https://api.aihouseplanner.in
VITE_GOOGLE_CLIENT_ID=
VITE_RAZORPAY_KEY_ID=           # Razorpay live key
VITE_DEFAULT_LANGUAGE=en
VITE_ENABLE_3D=true
VITE_ENABLE_WHATSAPP=true
```

---

## 12. Frontend Architecture

### 12.1 State Management — Zustand

```javascript
// store/wizardStore.js
const useWizardStore = create((set, get) => ({
  currentStep: 1,
  planId: null,
  stepData: {}, // { step1: {...}, step2: {...}, ... }
  isDirty: false,
  generationJobId: null,
  generationStatus: null, // 'queued'|'processing'|'complete'|'failed'

  setStep: (step) => set({ currentStep: step }),
  saveStepData: (step, data) => set(state => ({
    stepData: { ...state.stepData, [`step${step}`]: data },
    isDirty: true
  })),
  setGenerationJob: (jobId) => set({ generationJobId: jobId, generationStatus: 'queued' }),
  resetWizard: () => set({ currentStep: 1, planId: null, stepData: {}, isDirty: false })
}));
```

### 12.2 Wizard Shell — Mobile vs Desktop

```javascript
// WizardShell.jsx
// Desktop: MUI Stepper (horizontal top bar) + main content area + sidebar (versions/comments)
// Mobile: Bottom navigation drawer with step icons + full-screen step content

const WizardShell = () => {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  return isMobile ? <MobileWizardLayout /> : <DesktopWizardLayout />;
};

// MobileWizardLayout: fixed bottom bar with step icons,
// swipeable step content (react-swipeable), FAB for generate action
// DesktopWizardLayout: left sidebar steps list, main content, right panel (versions)
```

### 12.3 MUI Theme

```javascript
// theme/theme.js
const theme = createTheme({
  palette: {
    primary: { main: '#1B5E20' },     // Deep green (Indian architecture feel)
    secondary: { main: '#E65100' },   // Burnt orange
    background: { default: '#F5F5F0', paper: '#FFFFFF' }
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans", sans-serif', // Noto Sans supports Indian scripts
    h1: { fontWeight: 700 },
    body1: { lineHeight: 1.7 }
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 8, textTransform: 'none' } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 12 } } }
  },
  breakpoints: { values: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1440 } }
});
```

### 12.4 Socket.io Client

```javascript
// socket/socketClient.js
let socket = null;
export const connectSocket = (accessToken) => {
  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnectionAttempts: 5
  });
  socket.on('generation:complete', handleGenerationComplete);
  socket.on('comment:new', handleNewComment);
  socket.on('plan:status_changed', handleStatusChange);
  socket.on('collaborator:joined', handleCollaboratorJoined);
};
```

---

## 13. Backend Architecture

### 13.1 Express App Setup

```javascript
// src/app.js
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
app.use('/api/', generalRateLimiter);
app.use('/api/v1/auth/', authRateLimiter);

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/plans', authenticate, plansRouter);
app.use('/api/v1/ai', authenticate, aiRouter);
app.use('/api/v1/payments', paymentsRouter); // webhook is unauthenticated
app.use('/api/v1/admin', authenticate, requireRole('admin'), adminRouter);
app.use('/api/v1/contractor', contractorRouter); // public token-based

// Global error handler
app.use(errorHandler);
```

### 13.2 Storage Abstraction

```javascript
// services/storage/StorageFactory.js
class StorageFactory {
  static getImageStorage() {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    switch (provider) {
      case 'cloudinary': return new CloudinaryProvider();
      case 's3': return new S3Provider({ bucket: process.env.AWS_S3_BUCKET });
      default: return new LocalProvider({ basePath: process.env.LOCAL_STORAGE_PATH });
    }
  }
  static getFileStorage() {
    const provider = process.env.FILE_STORAGE_PROVIDER || 'local';
    // Same pattern
  }
}
```

### 13.3 Notification Abstraction

```javascript
// services/notification/NotificationFactory.js
// All notification calls go through a unified interface:
// notifyUser(userId, type, data) → dispatches to email + whatsapp + in-app (socket)

const NOTIFICATION_TYPES = {
  COLLABORATOR_INVITED: { email: true, whatsapp: false, socket: true },
  COMMENT_ADDED: { email: true, whatsapp: true, socket: true },
  GENERATION_COMPLETE: { email: false, whatsapp: false, socket: true },
  BID_PLACED: { email: true, whatsapp: true, socket: true },
  REVIEW_SUBMITTED: { email: true, whatsapp: true, socket: true },
  SUBSCRIPTION_RENEWED: { email: true, whatsapp: false, socket: false },
  ARCHITECT_VERIFIED: { email: true, whatsapp: true, socket: true }
};
```

---

## 14. Collaboration & Notifications

### Collaboration Rules

- **View**: Can open plan in read-only mode, see all steps, view 3D (if unlocked)
- **Comment**: Above + can add/reply to comments, cannot edit plan data
- **Edit**: Above + can modify plan data in wizard (for Developer team members with Editor role)

### Comment Pinning

Comments are pinned by `stepName` + optional `roomId`. The floor plan renderer shows comment pin icons on rooms that have unresolved comments. Clicking a pin opens the thread panel.

### Notification Dispatch Flow

```
Action occurs (comment added)
  → NotificationService.notifyUser(userId, 'COMMENT_ADDED', { planId, comment })
    → socket.emit to user room (immediate in-app)
    → notificationQueue.add email job (async)
    → notificationQueue.add WhatsApp job (async, if WHATSAPP_PROVIDER != mock)
```

### Activity Log

Every significant action writes to `ActivityLogs`. The Plan Activity Panel (visible to owner + editors) shows a human-readable timeline:
- "Priya rolled back to Version 3 — Interior Design" (2 hours ago)
- "Rahul added a comment on Master Bedroom" (yesterday)
- "You marked this plan as Completed" (3 days ago)

---

## 15. Plan Versioning System

### Version Creation Rules

| Trigger | Step | Label Auto-assigned |
|---|---|---|
| Step 1 saved | step1 | "Land Setup — [date]" |
| Floor plan generated | step3 | "Floor Plan — Option [n]" |
| Room regenerated | step4 | "Interior — [Room] — [date]" |
| Exterior generated | step5 | "Exterior — [date]" |
| Manual save button | manual | "Manual save — [date]" |
| Before rollback | manual | "Auto-save before rollback" |

### Rollback Flow

```
User selects version V3 from history panel
  → Confirm dialog: "Roll back to [label]? Current state will be saved first."
  → POST /api/v1/plans/:planId/rollback { versionId: V3._id }
    → Server: creates new version from current state (label: "Auto-save before rollback")
    → Server: sets plan.currentVersionId = V3._id
    → Server: logs ActivityLog action: version_rolled_back
    → Notifies all collaborators via socket
  → Client: reloads plan data from V3 snapshot
```

### Storage Strategy

```javascript
// PlanVersionService.js
// FULL SNAPSHOT: entire step data stored per version
// Configurable: VERSIONING_STRATEGY=snapshot|delta
// Default: snapshot (simpler, storage cost acceptable for MVP)

// Version size estimate: ~50KB per version (JSON + image URLs)
// 20 versions × 50KB = ~1MB per plan (negligible)
// Delta can be enabled later via env if storage becomes a concern
```

---

## 16. Contractor View

### What is Shown

- Floor plan (2D structured view only — no AI images for privacy)
- Room dimensions and types
- Utility overlays: plumbing, electrical, HVAC
- Load-bearing wall markers
- Water tank placement
- Number of floors, total built-up area

### What is Hidden

- Cost estimates (all steps)
- Interior design images/styles
- 3D view
- Collaboration comments
- User personal data
- Version history
- Municipal documents

### Token Security

```javascript
// Token: crypto.randomBytes(32).toString('hex') — 64 char hex string
// Stored hashed in ContractorLinks collection
// Incoming token hashed and compared → prevents enumeration
// Access log records IP + user agent per view
// Owner can revoke at any time → isRevoked: true
```

---

## 17. Municipal Approval Module

### Seeded Cities (Initial Data)

```
Mumbai (MCGM Bye-laws 2023)   | Delhi (MPD 2021)
Bengaluru (BBMP 2023)          | Chennai (CMDA 2023)
Kolkata (KMC 2023)             | Hyderabad (GHMC 2023)
Pune (PMC 2023)                | Ahmedabad (AMC 2023)
Surat (SMC 2022)               | Jaipur (JMC 2022)
Lucknow (LMC 2022)             | Chandigarh (UT 2022)
```

Additional cities: Admin can add via `POST /admin/municipal-rules` panel.

### Compliance Check Logic

```javascript
// MunicipalRuleService.js
async function runComplianceCheck(planData, city, state) {
  const rules = await MunicipalRule.findOne({ city, state });
  const results = [];

  // FSI check
  const builtUpArea = calculateBUA(planData);
  const fsiUsed = builtUpArea / planData.landArea;
  results.push({
    rule: 'FSI Compliance',
    required: `≤ ${rules.fsiLimit}`,
    actual: fsiUsed.toFixed(2),
    passed: fsiUsed <= rules.fsiLimit
  });

  // Setback check (from room coordinates)
  const setbackResult = checkSetbacks(planData, rules.setbacks);
  results.push(setbackResult);

  // Parking norms
  const parkingResult = checkParking(planData, rules.parkingNorms);
  results.push(parkingResult);

  // ... additional checks

  return {
    checklist: results,
    overallCompliant: results.every(r => r.passed),
    warnings: results.filter(r => !r.passed)
  };
}
```

---

## 18. Architect Marketplace

### Flow Summary

```
Plan COMPLETED
  → "Get Professional Review" button appears
  → User posts review request (description + budget ₹500–₹50,000)
  → Verified architects receive notification (city/state matched)
  → Architects submit bids (fee + timeline + cover note)
  → User views bids, selects one
  → Razorpay payment captured (held)
  → Architect downloads plan data, submits annotated report (within deadline)
  → User reviews report, clicks "Accept"
  → Razorpay Routes transfer: architect gets (fee - commission%), platform keeps commission
  → User rates architect (1–5 stars)
  → If dispute: admin intervenes, can refund or partial pay
```

### Architect Matching (Notification)

```javascript
// When review request posted:
// Find architects where:
//   - verificationStatus = 'approved'
//   - isSuspended = false
//   - cityState.state matches plan's state (broad match)
//   - OR cityState.city matches (narrow match, higher priority)
// Notify via email + WhatsApp + in-app
```

---

## 19. Admin Panel

### Dashboard Metrics

- Total users (by role + tier breakdown)
- Plans created today / this month / total
- Revenue: MRR, total, by tier
- AI API usage (tokens/calls) by provider, by user
- Active subscriptions + churn rate
- Architect marketplace: pending bids, completed reviews, disputes
- Top cities by plan count

### Feature Flag Management

Admin can toggle any feature on/off per tier or grant to specific users:
```
Feature: 3d_view
Enabled for tiers: [PRO, ENTERPRISE]
User overrides: [userId1 → enabled, userId2 → disabled]
```

Changes take effect immediately (no deploy required). Frontend checks via `GET /api/v1/users/me/features` on load.

### Cost Dataset Update Flow

Admin uploads new state-level cost data via form or CSV import. The `lastUpdated` field is shown to users in the cost estimate step so they know the data freshness.

---

## 20. Internationalisation (i18n)

### Setup

```javascript
// client/src/i18n/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en','hi','bn','ta','te','mr','gu','kn'],
    backend: { loadPath: '/locales/{{lng}}/translation.json' },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    interpolation: { escapeValue: false }
  });
```

### Language Files Structure

```json
// locales/en/translation.json (excerpt)
{
  "wizard": {
    "step1": {
      "title": "Land & Structure Setup",
      "landArea": "Land Area",
      "plotShape": "Plot Shape",
      "facingDirection": "Facing Direction",
      "floors": "Number of Floors",
      "vastuToggle": "Enable Vastu Compliance",
      "generateBtn": "Proceed to Room Planning"
    }
  },
  "notifications": {
    "generationComplete": "Your floor plan is ready!",
    "commentAdded": "{{name}} commented on {{step}}"
  }
}
```

### Locale Formatting

```javascript
// utils/formatCurrency.js
export const formatCurrency = (amount, lang = 'en') => {
  return new Intl.NumberFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};
// Output: ₹12,50,000 (Indian numbering system)
```

---

## 21. DevOps & Deployment

### Docker Compose (Dev)

```yaml
# docker-compose.yml
version: '3.9'
services:
  client:
    build: ./client
    ports: ["3000:3000"]
    environment:
      - VITE_API_BASE_URL=http://localhost:5000/api/v1
    volumes: ["./client/src:/app/src"]

  server:
    build: ./server
    ports: ["5000:5000"]
    env_file: ./server/.env
    depends_on: [mongo, redis, ollama]
    volumes: ["./server/src:/app/src", "./server/uploads:/app/uploads"]

  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    volumes: ["ollama_data:/root/.ollama"]

volumes:
  mongo_data:
  ollama_data:
```

### Production Architecture

```
Internet → CloudFlare CDN (static assets + DDoS)
         → NGINX (SSL termination + reverse proxy)
           → React build (static files served by NGINX)
           → Express API (PM2 cluster mode, 4 workers)
             → MongoDB Atlas (M10 replica set)
             → Redis Cloud (cache + BullMQ)
             → AWS S3 (PDFs)
             → Cloudinary (images)
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    steps:
      - Run tests (Jest + Supertest)
      - Build React app
      - Build Docker images
      - Push to registry
      - SSH deploy to VPS: docker-compose -f docker-compose.prod.yml up -d
      - Run DB migrations/seeds if needed
      - Health check: curl /api/v1/health
```

---

## 22. Security Considerations

### API Security

- All AI provider keys stored server-side only — never exposed to client
- Razorpay webhook signature verified using HMAC-SHA256 before processing
- Contractor link tokens stored hashed (SHA-256) — raw token never in DB
- Invite tokens: crypto.randomBytes(32) — 256-bit entropy
- File uploads: MIME type + magic bytes validation, max size limits (10MB images, 20MB PDFs)
- All user inputs sanitised via `express-validator` before DB writes
- MongoDB queries use Mongoose (prevents NoSQL injection)
- Rate limiting on all endpoints; stricter limits on auth + AI routes

### RBAC Enforcement

- Role checked at Express middleware level before controller executes
- Plan ownership verified per request (userId on plan must match req.user.userId)
- Team member roles checked for Developer project routes
- Feature flags checked for gated features (3D, municipal docs)
- Admin-only routes grouped under `/admin` with dedicated middleware

### Data Privacy

- Personal data (phone, GSTIN) encrypted at rest using MongoDB field-level encryption (prod)
- Passwords hashed with bcrypt (rounds: 12)
- Refresh tokens stored as SHA-256 hash in DB — raw token only in httpOnly cookie
- Contractor view: no userId or personal data in response
- GDPR-style: users can request data export + account deletion (`DELETE /api/v1/users/me`)

### Payment Security

- Razorpay payment IDs verified server-side before unlocking features
- Marketplace payments held as Razorpay captured payments — never stored as cash on platform
- All payment amounts validated server-side — client amount never trusted

---

## 23. Scalability Strategy

### Database

- **Indexes**: Compound indexes on high-cardinality query patterns (userId+status, planId+createdAt)
- **Connection pooling**: Mongoose pool size 10 (dev) → 50 (prod)
- **TTL indexes**: ActivityLogs auto-expire non-critical entries after 365 days
- **Read replicas**: MongoDB Atlas secondary reads for analytics queries
- **Pagination**: All list endpoints cursor-based (`?cursor=lastId&limit=20`)

### AI Pipeline

- **BullMQ priority queue**: Pro users get priority 1, Basic priority 5, Free priority 10
- **Job timeout**: 120 seconds per generation job; auto-retry × 3 with exponential backoff
- **WebSocket**: User joins `user:{userId}` room on connect — job result pushed on completion
- **Polling fallback**: Client polls `GET /api/v1/ai/jobs/:jobId` every 3s if socket disconnects
- **AI provider failover**: If prod provider fails, automatically falls back to free provider with user notification

### Caching

```javascript
// Redis cache TTL strategy
// Municipal rules: 24 hours (rarely changes)
// Cost datasets: 6 hours
// FSI/FAR lookup: 1 hour
// User subscription tier: 5 minutes (balance freshness vs load)
// Feature flags: 5 minutes
```

### Horizontal Scaling

- Stateless Express server → PM2 cluster or Kubernetes horizontal pod autoscaling
- Redis for shared session state, queue, and cache across instances
- Socket.io with Redis adapter (`socket.io-redis`) for multi-instance WebSocket support
- Static React build on CloudFlare CDN — zero server load for frontend assets

---

*Document version 1.0 — AI House Planner System Design*  
*Stack: MERN + MUI v5 | Target: India | Last updated: 2025*
