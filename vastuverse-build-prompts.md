# 🏡 VastuVerse — AI-Powered House Planning Platform
### Step-by-Step Claude Build Prompts (Scratch → Production)

> **App Name:** **VastuVerse**
> *"Where ancient wisdom meets AI architecture"*
>
> **Stack:** MERN (MongoDB · Express.js · React.js · Node.js) + Material UI v5
> **Target Market:** India · Responsive Web · Online Only
> **Roles:** Homeowner · Real Estate Developer · Verified Architect · Admin

---

## 🧠 MASTER PROMPT — Read This First in Every Session

Paste this as your **very first message** when starting a new Claude session on this project:

```
I am building VastuVerse — an AI-powered house planning web app for the Indian market.

STACK: MERN (MongoDB, Express.js, React.js, Node.js) + Material UI v5
TARGET: Indian homeowners and real estate developers. India-specific rules (NBC norms, Vastu, FSI/FAR, state-level costs, municipal bye-laws).

ROLES: homeowner | developer | architect (verified) | admin
TIERS: FREE | BASIC | PRO | ENTERPRISE (Razorpay subscriptions)

KEY CONCEPTS:
- A "Plan" goes through a 10-step wizard: Land Setup → Rooms → Floor Plan → Interior → Exterior → Utilities → Cost Estimate → 3D View → Municipal Docs → Review & Export
- Each step auto-saves and creates a plan version
- AI is abstracted: dev uses Pollinations (images) + Ollama (plan JSON); prod uses DALL-E 3 + GPT-4o. Provider is set via .env
- BullMQ handles AI jobs. Pro users get priority. WebSocket pushes results to the client.
- Plan status lifecycle: DRAFT → IN_PROGRESS → COMPLETED → ARCHIVED
- Architect Marketplace unlocks only when plan status = COMPLETED
- i18n: 8 Indian languages via react-i18next

UI DESIGN SYSTEM:
- Brand colors: primary #2E7D32 (forest green), secondary #FF6F00 (deep amber), accent #00BCD4 (AI cyan)
- Dark mode / Light mode: full support, toggled via ThemeContext, persisted in localStorage
- Animations: Framer Motion for page transitions, scroll reveals, micro-interactions
- Glassmorphism cards in dark mode; clean white cards in light mode
- Futuristic elements: gradient text headings, glowing CTA buttons, animated backgrounds

FOLDER STRUCTURE:
/client (Vite + React)
/server (Express.js)
docker-compose.yml at root

Current progress: [TELL CLAUDE WHAT YOU HAVE BUILT SO FAR, OR "nothing yet — starting fresh"]

I will now give you a specific prompt for the next build step. Follow it exactly.
```

---

## PHASE 0 — Public Landing Page

---

### PROMPT 00 — VastuVerse Homepage (Futuristic, Animated, Dark/Light)

```
Build the public-facing homepage for VastuVerse at route "/".
This is a standalone React page — no auth required. It should be visually stunning,
futuristic, and conversion-focused. Think: a premium SaaS landing page meets Indian
architectural heritage.

DEPENDENCIES TO INSTALL:
npm install framer-motion @mui/material @emotion/react @emotion/styled
       @mui/icons-material react-router-dom react-intersection-observer
       react-countup react-type-animation react-tsparticles tsparticles-slim

FILE: /client/src/pages/HomePage.jsx (single file, all sections)
FILE: /client/src/theme/themeConfig.js (MUI theme with light + dark palettes)
FILE: /client/src/context/ThemeContext.jsx (dark/light toggle context)

─────────────────────────────────────────────────────────────
THEME SYSTEM
─────────────────────────────────────────────────────────────

themeConfig.js:
- Light palette: background #F8F9FA, surface #FFFFFF, primary #2E7D32,
  secondary #FF6F00, accent #00BCD4, text #1A1A2E
- Dark palette: background #0A0E1A, surface #111827, primary #4CAF50,
  secondary #FFB300, accent #00E5FF, text #E8EAF6
- Typography: headings → "Playfair Display" (serif, heritage feel),
  body → "Inter" (clean modern)
- Both palettes: load Google Fonts via @import in index.css

ThemeContext.jsx:
- useContext hook exposing { mode, toggleTheme }
- Default: detect system preference via window.matchMedia('prefers-color-scheme')
- Persist to localStorage key 'vastuverse-theme'
- Wrap the entire app in this context

─────────────────────────────────────────────────────────────
GLOBAL UI PATTERNS (apply throughout the homepage)
─────────────────────────────────────────────────────────────

Dark mode cards → glassmorphism: background rgba(255,255,255,0.05),
  border 1px solid rgba(255,255,255,0.1), backdrop-filter blur(20px)
Light mode cards → clean white with subtle box-shadow

Gradient text headings: background linear-gradient(135deg, #2E7D32, #00BCD4),
  -webkit-background-clip text, -webkit-text-fill-color transparent

Glow CTA button: primary green with box-shadow 0 0 30px rgba(46,125,50,0.5),
  hover: scale(1.05) + shadow intensifies. Use Framer Motion whileHover/whileTap.

Scroll-reveal: use react-intersection-observer. Every section fades up
  (y: 40 → 0, opacity: 0 → 1) when it enters the viewport. Stagger children.

─────────────────────────────────────────────────────────────
SECTION 1 — NAVBAR
─────────────────────────────────────────────────────────────

Sticky, transparent on scroll-top → blurred glass on scroll.
Left: VastuVerse logo (stylised "V" mandala-inspired SVG + wordmark).
Center: Nav links — Features, Vastu AI, How It Works, Pricing, Marketplace.
  Smooth scroll to section IDs on click. Active link gets accent underline.
Right: Dark/Light toggle (animated sun/moon icon swap with Framer Motion),
  Language selector (flag icon + 2-letter code), "Login" text button,
  "Get Started Free" filled glow button.
Mobile: hamburger → full-screen slide-in drawer with the same links.
Framer Motion: navbar slides down from y:-80 on mount.

─────────────────────────────────────────────────────────────
SECTION 2 — HERO
─────────────────────────────────────────────────────────────

Full-viewport-height section. Two-column layout (text left, visual right).
Desktop split 55/45. Mobile: stacked (visual above text).

BACKGROUND: Animated particle field using tsparticles-slim. In dark mode:
  deep navy with floating golden mandala-like particles (color #FFB300, size 2–4px,
  connected by thin lines). In light mode: soft white with sage green particles.
  Particle count: 60. interactivity: repulse on hover.

LEFT COLUMN — Copy:
  Eyebrow tag (MUI Chip): "🇮🇳 Built for Bharat · NBC 2016 Compliant"
  H1 (2 lines, Playfair Display 56px):
    "Design Your Dream Home"
    with react-type-animation cycling: "with AI Precision." | "the Vastu Way."
    | "in Minutes." — loop
  Subheading (Inter 20px, muted color):
    "VastuVerse combines ancient Vastu Shastra wisdom with cutting-edge AI to
     generate complete house plans — floor layouts, interiors, cost estimates,
     and municipal documents — without needing an architect."
  CTA row: "Start Planning Free" (glow button) + "Watch Demo" (outlined button
    with play icon, opens YouTube embed in MUI Dialog)
  Social proof strip below CTAs:
    "★★★★★  Trusted by 12,000+ homeowners across India"
    Animated counter (react-countup on scroll-enter):
      "10K+ Plans Generated" · "28 States Covered" · "₹50Cr+ Construction Planned"

RIGHT COLUMN — Visual:
  Floating 3D-ish isometric house illustration (pure CSS + SVG, no external image).
  The house has:
    - Animated "AI scan" glowing line sweeping top to bottom (CSS keyframe)
    - Floating info chips orbiting it (Framer Motion animate loop):
        "🧭 Vastu Compliant" (top-right)
        "📐 NBC Certified" (right)
        "💰 ₹45L Estimate" (bottom-right)
        "🏛️ 3D Ready" (bottom-left)
    - Each chip floats with a gentle up-down animation (y: 0↔-10, infinite)
  Behind the house: soft radial gradient glow (green in dark, amber in light).

─────────────────────────────────────────────────────────────
SECTION 3 — STATS TICKER
─────────────────────────────────────────────────────────────

Full-width dark strip (even in light mode: #1A1A2E).
Horizontal auto-scrolling marquee (CSS animation: translateX, infinite loop, no JS):
  "10,000+ Plans Generated 🏠  ·  28 Indian States  ·  NBC 2016 Compliant  ·
   Vastu-Enabled AI  ·  ₹50 Crore+ Construction Value Planned  ·
   8 Indian Languages  ·  Razorpay Secured  ·  Real Architects Verified  ·"
Repeats twice for seamless loop. Accent color (#00BCD4) on numbers and emojis.

─────────────────────────────────────────────────────────────
SECTION 4 — WHAT IS VASTU SHASTRA? (id="vastu")
─────────────────────────────────────────────────────────────

Section heading (gradient text): "The Ancient Science Behind VastuVerse"
Subheading: "5,000 years of Vedic architectural wisdom, encoded into AI"

Two-column layout:
LEFT — Animated compass illustration:
  SVG 8-point Vastu compass (Vastu Purusha Mandala inspired). The 8 directions
  each have a color zone and label:
    North (Mercury, green) — Wealth & Career
    North-East (Jupiter, yellow) — Prayer & Wisdom
    East (Sun, orange) — Health & Energy
    South-East (Venus, pink) — Kitchen & Fire
    South (Mars, red) — Fame & Ancestors
    South-West (Earth, brown) — Master Bedroom · Stability
    West (Saturn, blue) — Children & Creativity
    North-West (Moon, silver) — Guest & Air
  On hover of each segment → MUI Tooltip shows "Vastu rule: {rule}".
  The compass has a slow CSS rotation animation (360deg, 60s, linear, infinite)
  for the outer ring only. Inner zones stay fixed.

RIGHT — Content:
  Short paragraph: Explain Vastu Shastra as India's ancient system of
  spatial arrangement based on directional energies, the five elements
  (Pancha Bhuta), and cosmic forces — used by architects for millennia.

  Then 4 horizontal accordion items (MUI Accordion):
  1. "How VastuVerse applies Vastu" — AI prompt engineering enforces main door
     placement (north/east), kitchen in south-east, master bedroom in south-west,
     pooja room in north-east, no beams over beds, etc.
  2. "Is Vastu optional?" — Yes, toggled per plan. Works with or without Vastu.
  3. "Does Vastu conflict with NBC norms?" — Explanation of how we balance both.
  4. "Vastu for apartments vs. independent houses" — short note on adaptations.

  Framer Motion: accordion items stagger-fade in from the right when section
  enters viewport.

─────────────────────────────────────────────────────────────
SECTION 5 — HOW IT WORKS (id="how-it-works")
─────────────────────────────────────────────────────────────

Heading: "From Plot to Plan in 10 Steps"

Vertical stepper / timeline on mobile, horizontal card track on desktop.
10 step cards. Each card:
  - Large step number (gradient text, 64px)
  - Icon (MUI icon or emoji)
  - Step name + 1-line description

Steps:
  1 📐 Land & Structure — "Enter plot dimensions, shape, city, and vastu preference"
  2 🛏️ Room Planning — "Configure rooms; AI checks NBC feasibility instantly"
  3 🗺️ Floor Plan — "AI generates 3 layout options with 2D SVG view"
  4 🛋️ Interior Design — "Choose style per room; AI renders interiors"
  5 🏠 Exterior Design — "Façade, roof, gate, landscaping — AI visualizes it all"
  6 🔌 Utilities — "Plumbing, electrical, solar — overlaid on your floor plan"
  7 💰 Cost Estimate — "State-level material rates. Economy → Premium tiers."
  8 🎮 3D View — "Three.js interactive walkthrough of your home (Pro)"
  9 🏛️ Municipal Docs — "Compliance checklist + draft submission document (Basic+)"
  10 ✅ Review & Export — "Collaborate, version, export PDF, share with contractor"

Animation: on desktop, as user scrolls, each card animates in from alternating
sides (left/right) with a connecting dashed line between cards that "draws"
using SVG stroke-dashoffset animation triggered by scroll.

─────────────────────────────────────────────────────────────
SECTION 6 — FEATURE DEEP DIVE (id="features")
─────────────────────────────────────────────────────────────

Heading: "Everything Your Home Needs, Powered by AI"

3-column grid of feature cards (2-col on tablet, 1-col mobile). 9 cards:

1. 🧠 AI Floor Plan Generator
   "3 layout options per generation. NBC-compliant room sizing,
   setback rules, and natural ventilation baked in."

2. 🧭 Vastu Intelligence
   "Deep Vastu rule engine: door placement, kitchen direction,
   bedroom orientation, pooja room location — all AI-enforced."

3. 🎨 Interior & Exterior AI
   "6 design styles. Per-room customisation. AI-generated renders
   of every space — from living rooms to façades."

4. 📏 NBC & FSI Compliance
   "Auto-fetched city-level FSI/FAR limits, setback rules, and
   parking norms. Instant compliance warnings."

5. 💡 Utilities Planning
   "Plumbing routes, electrical points, HVAC, solar feasibility —
   all layered on your floor plan as toggleable overlays."

6. 💰 India-Specific Cost Engine
   "State-level material rate datasets. Economy / Standard /
   Premium tiers. ±15% variance shown transparently."

7. 🏛️ Municipal Approval Docs
   "AI-generated compliance checklist and draft submission
   document for your local ULB/Corporation."

8. 🎮 3D Interactive Walkthrough
   "Three.js-powered real-time 3D view of your home.
   Orbit, zoom, and explore every room."

9. 🤝 Architect Marketplace
   "Connect with CoA-verified architects for professional
   plan reviews. Escrow payment via Razorpay."

Each card: glassmorphism in dark mode. Framer Motion: stagger fade-up.
On hover: card lifts (y: -8px), glow border appears (primary color).
Card icon area: soft gradient background circle.

─────────────────────────────────────────────────────────────
SECTION 7 — AI PROVIDER TRANSPARENCY BANNER
─────────────────────────────────────────────────────────────

Slim full-width section with subtle gradient background.
Heading (small): "AI Stack"
Content: 3 logos/badges in a row:
  - "Floor Plans: GPT-4o / Ollama" with AI chip icon
  - "Renders: DALL-E 3 / Pollinations" with image icon
  - "Shape Recognition: Google Vision" with eye icon
Subtext: "All AI providers are swappable via environment config.
Your data never trains third-party models."
This builds trust with technical users and developers.

─────────────────────────────────────────────────────────────
SECTION 8 — FOR WHOM (Role Cards)
─────────────────────────────────────────────────────────────

Heading: "Built for Every Stakeholder"

4 large role cards in a row (2x2 on mobile):

1. 🏠 Individual Homeowners
   "Plan your dream home yourself — no architect fees in the
   design phase. Vastu-compliant, budget-aware, export-ready."
   CTA: "Start Free"

2. 🏢 Real Estate Developers
   "Bulk project management, team RBAC, client sharing portal,
   template library, and branded PDF exports."
   CTA: "Explore Enterprise"

3. 📐 Verified Architects
   "Join the marketplace. Get paid to review AI-generated plans.
   Build your digital portfolio. Razorpay payouts."
   CTA: "Apply as Architect"

4. 🏛️ Municipal Consultants
   "AI-generated compliance checklists mapped to city-specific
   bye-laws. Draft submission documents in minutes."
   CTA: "Learn More"

Each card: tall card with a top color band (unique per role), icon, title,
description, and CTA button. Hover: full card border glow.

─────────────────────────────────────────────────────────────
SECTION 9 — PRICING (id="pricing")
─────────────────────────────────────────────────────────────

Heading: "Transparent Pricing for Every Budget"
Toggle at top: Monthly / Yearly (Yearly = 20% off badge).

4 pricing cards in a row (scroll horizontal on mobile):

FREE — ₹0/month
  1 plan lifetime · 5 AI gen/day · 5 versions
  Floor plan, interior, exterior, cost estimate, contractor view
  CTA: "Get Started"

BASIC — ₹499/month
  3 plans/month · 20 AI gen/day · 20 versions
  Everything in Free + Municipal docs
  CTA: "Start Basic"

PRO — ₹1,499/month  ← "Most Popular" badge (amber ribbon)
  Unlimited plans · Unlimited AI gen · 3D View
  Branded PDF · Priority AI queue · All features
  CTA: "Go Pro" (glow button)

ENTERPRISE — ₹4,999/month
  Everything in Pro + Team RBAC · Bulk projects
  Client portal · Analytics API · Dedicated AI queue
  CTA: "Contact Sales"

PRO card: elevated with primary glow border. Scale 1.05 on desktop.
Framer Motion: cards slide up on scroll-enter with stagger.
Below cards: "All plans include Razorpay-secured payments · Cancel anytime
· Free plan never expires · 14-day refund policy"

─────────────────────────────────────────────────────────────
SECTION 10 — TESTIMONIALS
─────────────────────────────────────────────────────────────

Heading: "What Homeowners Are Saying"
Auto-scrolling carousel (no external carousel lib — pure CSS scroll-snap +
Framer Motion drag). 6 testimonial cards:

1. "Finally a tool that understands both Vastu and modern design.
   Generated my Bengaluru 30x40 plan in 10 minutes!"
   — Rajesh K., Homeowner, Bengaluru ★★★★★

2. "The cost estimate saved me from contractor overquoting.
   The state-wise rates are spot on."
   — Priya S., Homeowner, Pune ★★★★★

3. "As a developer managing 50+ plots, the bulk project management
   and team RBAC is exactly what we needed."
   — Amit Doshi, Developer, Surat ★★★★★

4. "The Vastu compliance feature is incredible. It even flagged
   my kitchen direction before I raised the walls!"
   — Lakshmi R., Homeowner, Chennai ★★★★★

5. "Municipal checklist saved us weeks of back-and-forth with
   the BBMP office. Everything was pre-checked."
   — Suresh M., Contractor, Bengaluru ★★★★★

6. "The 3D walkthrough wowed my clients. They approved the plan
   on the first presentation."
   — Neha Sharma, Architect, Delhi ★★★★★

Each card: glassmorphism, avatar circle (initials, gradient bg), quote text,
name, city, 5 stars. Left/right arrows for manual navigation. Auto-advances
every 5 seconds. Dots indicator below.

─────────────────────────────────────────────────────────────
SECTION 11 — INDIA MAP COVERAGE (Visual)
─────────────────────────────────────────────────────────────

Heading: "Covering All of India"
Subheading: "Municipal rules, cost datasets, and FSI norms loaded for
28 states and 8 Union Territories"

Show a simplified SVG outline map of India (hardcode a basic path — no
external map library needed). Overlay animated pulsing dots on 10 major
cities: Delhi, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata, Ahmedabad,
Pune, Jaipur, Lucknow. Each dot: primary green circle with a CSS pulse
keyframe animation (ring expanding outward, fading). On hover: tooltip
showing "Data available for {City} · {State} municipal rules loaded".

To the right of the map: stats column
  "28 States + 8 UTs covered"
  "150+ City-level municipal rule sets"
  "State-wise material cost datasets updated quarterly"
  "MNRE solar irradiance data for all zones"

─────────────────────────────────────────────────────────────
SECTION 12 — ARCHITECT MARKETPLACE PREVIEW
─────────────────────────────────────────────────────────────

Heading: "Connect With Verified Architects"
Subheading: "Once your AI plan is complete, get it reviewed by a
CoA-registered architect — without leaving VastuVerse"

Two-panel layout:
LEFT: Homeowner perspective — "Post a review request with your
completed plan and budget. Receive bids from verified architects within 24 hours."
RIGHT: Architect perspective — "Browse completed plans seeking review.
Place bids, submit annotated reports, receive Razorpay payouts."

Below: 3 mock architect profile cards (fictional, clearly labelled "Sample"):
  Card: avatar, name, city, specializations chips, rating stars,
  "₹2,500–5,000 per review", CoA verified badge.

CTA: "View Marketplace" button linking to /marketplace (public preview page).

─────────────────────────────────────────────────────────────
SECTION 13 — SECURITY & COMPLIANCE TRUST STRIP
─────────────────────────────────────────────────────────────

6 trust badges in a flex row with icons:
🔒 JWT + Refresh Token Auth
🛡️ HMAC-Verified Payments
🏦 Razorpay Escrow
📜 NBC 2016 Compliant
🔐 bcrypt Password Hashing
🌐 SSL / HTTPS Enforced

Dark strip background. Badge: icon + title + 1-line description.

─────────────────────────────────────────────────────────────
SECTION 14 — FAQ
─────────────────────────────────────────────────────────────

Heading: "Frequently Asked Questions"

MUI Accordion list, 8 questions:
1. Do I need to know anything about architecture to use VastuVerse?
2. Is Vastu compliance mandatory?
3. Can I use this for an apartment / flat?
4. Is the AI-generated floor plan legally valid for submission?
5. How accurate is the cost estimate?
6. What happens after I complete my plan?
7. How are architects verified on the marketplace?
8. Can I use VastuVerse in Hindi or other Indian languages?

Each accordion: question as summary, 2–4 sentence answer as detail.
Framer Motion: accordion content animates height expand/collapse.

─────────────────────────────────────────────────────────────
SECTION 15 — FINAL CTA
─────────────────────────────────────────────────────────────

Full-width section. Dark background in both modes.
Animated gradient background: slow-moving conic gradient from primary to
accent colors (CSS @keyframes rotating the gradient, 8s infinite).

Large centered heading (white, Playfair Display):
  "Your Dream Home is One Plan Away"

Subtext: "Join 12,000+ Indian homeowners who designed smarter with AI."

Two buttons: "Start Planning Free" (large glow) + "Book a Demo" (outlined white)

Below buttons: 3 micro-trust lines:
  ✅ No credit card required  ·  ✅ Free plan never expires  ·  ✅ Cancel anytime

─────────────────────────────────────────────────────────────
SECTION 16 — FOOTER
─────────────────────────────────────────────────────────────

4-column footer:
Col 1: VastuVerse logo + tagline + social icons (Twitter/X, LinkedIn, Instagram,
  YouTube) with hover color animations.
Col 2: Product — Features, Pricing, How It Works, 3D View, Marketplace, Mobile App (coming soon)
Col 3: Company — About Us, Blog, Careers, Press, Contact
Col 4: Legal — Privacy Policy, Terms of Service, Refund Policy, NBC Disclaimer,
  Cookie Settings (opens MUI Dialog for cookie consent toggle)

Bottom bar: "© 2025 VastuVerse Technologies Pvt. Ltd. · Made with ❤️ for Bharat
  · CIN: UXXXXXXMH2025PTC000000 (placeholder)"
Language selector repeated here.
Dark/light toggle button here too.

─────────────────────────────────────────────────────────────
COOKIE CONSENT BANNER
─────────────────────────────────────────────────────────────

On first visit: fixed bottom bar slides up (Framer Motion y: 100 → 0):
"We use cookies to improve your experience. We never sell your data."
Buttons: "Accept All" (primary) · "Reject Non-Essential" (text) · "Manage" (opens Dialog)
Store consent decision in localStorage key 'vastuverse-cookie-consent'.
Banner never shows again after decision.

─────────────────────────────────────────────────────────────
SCROLL-TO-TOP BUTTON
─────────────────────────────────────────────────────────────

Floating button (bottom-right, above footer). Visible after scrolling 400px.
Icon: KeyboardArrowUp. On click: smooth scroll to top.
Framer Motion: scale + opacity animate in/out.

─────────────────────────────────────────────────────────────
PERFORMANCE NOTES
─────────────────────────────────────────────────────────────

- All Framer Motion animations: respect prefers-reduced-motion
  (wrap in useReducedMotion hook; skip animations if true)
- Particle background: disable on mobile (window.innerWidth < 768)
  to save battery and performance
- Images: none needed — all visuals are SVG/CSS/MUI components
- Fonts: subset load via Google Fonts display=swap
- The entire homepage must be a single JSX file with named section
  components defined in the same file (no separate files needed)
```

---

## PHASE 1 — Project Scaffolding & Infrastructure

---

### PROMPT 01 — Monorepo Scaffold + Docker Setup

```
Set up the VastuVerse monorepo from scratch.

CREATE these at the root:
1. /client — Vite + React app
   - Run: npm create vite@latest client -- --template react
   - Install: @mui/material @emotion/react @emotion/styled @mui/icons-material
     react-router-dom axios socket.io-client react-i18next i18next
     i18next-browser-languagedetector i18next-http-backend
     framer-motion react-intersection-observer react-countup
     react-type-animation

2. /server — Node.js + Express app
   - Init: npm init -y
   - Install: express mongoose redis ioredis bullmq socket.io jsonwebtoken
     bcryptjs passport passport-google-oauth20 passport-facebook
     express-validator multer cors helmet morgan dotenv razorpay
     nodemailer axios

3. docker-compose.yml at root with services:
   - client (port 3000), server (port 5000), mongo (port 27017),
     redis (port 6379), ollama (port 11434)
   - Server depends on mongo, redis, ollama
   - Volumes: mongo_data, ollama_data

4. /server/.env.example with ALL variables (no real values):
   PORT, MONGO_URI, REDIS_URL,
   JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
   AI_IMAGE_PROVIDER (pollinations/dalle/huggingface),
   AI_PLAN_PROVIDER (ollama/gpt4o),
   AI_SHAPE_PROVIDER (huggingface/google-vision),
   OPENAI_API_KEY, GOOGLE_VISION_API_KEY,
   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
   FACEBOOK_APP_ID, FACEBOOK_APP_SECRET,
   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS,
   WHATSAPP_API_URL, WHATSAPP_API_TOKEN,
   CLIENT_URL, AWS_S3_BUCKET, AWS_REGION, CLOUDINARY_URL

5. /server/src folder structure:
   config/ controllers/ middlewares/ models/ routes/ services/
   queues/ prompts/ utils/

Show all files created. Do not write logic yet — just the scaffold.
```

---

### PROMPT 02 — MongoDB Models

```
Create all Mongoose models for VastuVerse inside /server/src/models/

Create one file per model with full schema, validations, and indexes:

1. User.js — fields: email, phone, passwordHash, authProvider (email/google/facebook),
   socialId, role (homeowner/developer/architect/admin), isActive, isVerified,
   preferredLanguage, subscriptionTier (FREE/BASIC/PRO/ENTERPRISE),
   onboardingData (nested: plotOwnershipStatus for homeowner; companyName, gstin,
   designation, teamSize, projectTypes[], primaryRegions[] for developer;
   coaRegistrationNo, yearsExperience, portfolioUrls[], certifications[],
   verificationStatus for architect), cityState {city, state},
   refreshTokenHash, createdAt, updatedAt

2. Plan.js — fields: userId, projectId, title, status
   (DRAFT/IN_PROGRESS/COMPLETED/ARCHIVED), currentVersionId, stepProgress
   (step1–step10 each with completed + completedAt), vastuEnabled, cityState,
   landDetails {area, unit, shape, plotCoordinates[], facingDirection, floors,
   fsi, far, setbacks}, collaborators[], contractorLinks[], is3DUnlocked,
   completedAt, archivedAt

3. PlanVersion.js — planId, versionNumber, stepName, label, snapshotData (Mixed),
   thumbnailUrl, generatedImages[], aiProvider, createdBy, isRollbackPoint, createdAt

4. Comment.js — planId, userId, parentId, roomId, stepName, content,
   resolved, resolvedBy, resolvedAt

5. Collaborator.js — planId, invitedBy, userId, email, permission
   (view/comment/edit), inviteStatus, inviteToken, expiresAt, acceptedAt

6. ContractorLink.js — planId, createdBy, token (hashed), tokenHash,
   expiryType (24h/7d/permanent), expiresAt, accessLog [{ip, userAgent, accessedAt}],
   isRevoked

7. Subscription.js — userId (unique), tier, razorpaySubscriptionId,
   razorpayCustomerId, status, plansUsedThisMonth, currentPeriodStart,
   currentPeriodEnd, cancelledAt, adminOverride {isOverride, grantedBy, reason}

8. Payment.js — userId, planId, type (subscription/pay_per_plan/3d_unlock/
   marketplace_bid), amount (paise), currency, razorpayOrderId,
   razorpayPaymentId, razorpaySignature, status, metadata

9. ArchitectProfile.js — userId (unique), coaRegistrationNo, yearsExperience,
   portfolioUrls[], certifications[], specializations[], cityState,
   verificationStatus, verifiedBy, verifiedAt, rejectionReason, rating {average,
   count}, totalReviewsCompleted, totalEarnings, razorpayContactId,
   razorpayFundAccountId, isSuspended, suspensionReason

10. Bid.js — planId, architectId, reviewRequestId, proposedFee,
    proposedTimeline, coverNote, status (pending/accepted/rejected/completed/disputed),
    acceptedAt, completedAt, paymentId

11. ArchitectReview.js — bidId, planId, architectId, reportUrl,
    annotations [{stepName, roomId, note, severity}], summary,
    recommendedChanges[], userRating, userReview, status, submittedAt, acceptedAt

12. CostDataset.js — state, city, materialType, unitType,
    costs {economy, standard, premium}, lastUpdated, updatedBy

13. MunicipalRule.js — state, city, zone, fsiLimit, farLimit,
    setbacks {front, rear, side}, maxHeight, maxFloors, parkingNorms,
    roadWidthRequired, fireNorms, additionalRules[], lastUpdated,
    dataSource, isAdminEntered

14. FeatureFlag.js — featureName (unique), enabledForTiers[], globalOverride,
    userOverrides [{userId, enabled, grantedBy}], description, updatedAt

15. ActivityLog.js — planId, userId, action (enum of 20 actions),
    metadata, ipAddress, createdAt (TTL index 365 days)

16. Project.js (Developer) — developerId, name, description, location,
    planIds[], teamMembers [{userId, teamRole, addedAt}], templateId,
    clientPortalEnabled, status, createdAt

Add compound indexes. Export all from /server/src/models/index.js
```

---

### PROMPT 03 — Auth System (Email OTP + Google + Facebook)

```
Build the complete authentication system for VastuVerse.

FILES TO CREATE:

1. /server/src/config/passport.js
   - Google OAuth2 strategy — find or create user with role='homeowner', authProvider='google'
   - Facebook OAuth strategy — same logic
   - Both: if user exists with same email via different provider, link accounts

2. /server/src/services/authService.js
   - generateOTP() — 6-digit, valid 10 min, max 3 attempts
     (Redis key otp:{email}, TTL 600s)
   - verifyOTP(email, otp) — check Redis, decrement attempts
   - generateTokens(user) — accessToken (15m, payload: userId/role/tier/teamRole)
     + refreshToken (7d)
   - storeRefreshToken(userId, token) — SHA-256 hash in User.refreshTokenHash
   - refreshAccessToken(refreshToken) — verify hash, return new access token

3. /server/src/controllers/authController.js
   - POST /api/v1/auth/send-otp → generate + email OTP
   - POST /api/v1/auth/verify-otp → verify, create user if new, return tokens
   - POST /api/v1/auth/refresh → refresh access token
   - POST /api/v1/auth/logout → clear refreshTokenHash + httpOnly cookie
   - GET /api/v1/auth/google → passport.authenticate('google')
   - GET /api/v1/auth/google/callback → set httpOnly refresh cookie,
     redirect to /onboarding or /dashboard
   - GET /api/v1/auth/facebook → same pattern

4. /server/src/middlewares/auth.js
   - authenticateToken — verify JWT from Authorization header
   - requireRole(...roles) — check req.user.role
   - requireFeature(featureName) — check FeatureFlag vs user tier + overrides
   - requireTeamRole(...teamRoles) — check req.user.teamRole

5. /server/src/routes/authRoutes.js — wire all routes

6. /client/src/context/AuthContext.jsx
   - State: user (decoded JWT), accessToken (in-memory only)
   - On mount: try POST /auth/refresh via httpOnly cookie to restore session
   - Functions: login, logout, refreshToken

7. /client/src/utils/axiosInstance.js
   - Base URL from VITE_API_BASE_URL
   - Request: attach Authorization Bearer
   - Response: on 401 → refreshToken() → retry once

bcryptjs rounds: 12. nodemailer for OTP emails.
Refresh token: httpOnly + Secure + SameSite=Strict cookie.
```

---

## PHASE 2 — Onboarding & Core UI Shell

---

### PROMPT 04 — Onboarding Wizard (All 4 Roles)

```
Build the onboarding flow in React + MUI v5 with Framer Motion animations.

ROUTE: /onboarding — accessible only after first login
       (check user.onboardingComplete = false)

ANIMATIONS: Use Framer Motion AnimatePresence for step transitions.
Each step slides in from the right (x: 60 → 0) and slides out to the left
(x: 0 → -60). Duration 0.35s, ease: "easeInOut".

STEP 1 — Role Selection:
- Full-screen centered layout with VastuVerse logo at top
- Heading: "Welcome to VastuVerse — Who are you?" (gradient text)
- 4 large cards in a 2x2 grid (MUI Card + Framer Motion whileHover scale 1.03):
  Homeowner, Real Estate Developer, Verified Architect, Admin (greyed: "By invitation only")
- Each: large icon, title, 2-line description
- Selected card: primary green border glow

STEP 2 — Role-specific form:

Homeowner: Full name*, Phone (+91)*, City*, State* (MUI Select — all Indian states),
  Plot ownership status (Own/Rented/Prospective Buyer),
  Preferred language (en/hi/bn/ta/te/mr/gu/kn)

Developer: Company name*, GSTIN* (15-char alphanumeric validation),
  Designation*, Team size select, Primary regions (multi-select Indian states),
  Project types (multi-select), Phone*

Architect: Full name*, Phone*, CoA Registration No* (XXXXX/YYYY format),
  Years experience*, City*, State*, Portfolio upload (PDF/images, max 10MB, 5 files),
  Certifications (dynamic add/remove)
  → After submit: "Profile Under Review" screen — padlock SVG illustration,
    reassuring message. Architect blocked until admin approves.

SUBMIT: POST /api/v1/users/onboarding
  → sets onboardingComplete=true → redirect to /dashboard

Use react-hook-form. MUI LinearProgress at top during submit.
```

---

### PROMPT 05 — App Shell, Theme System & Dashboard

```
Build the app shell, global theme system, and role-based dashboard.

1. /client/src/theme/themeConfig.js — MUI createTheme with two palettes:
   LIGHT: background.default #F8F9FA, background.paper #FFFFFF,
     primary #2E7D32, secondary #FF6F00, info #00BCD4
   DARK: background.default #0A0E1A, background.paper #111827,
     primary #4CAF50, secondary #FFB300, info #00E5FF
   Both: typography fontFamily "Inter, Playfair Display, sans-serif"
   Custom component overrides: MuiCard rounded corners 16px,
   MuiButton textTransform none

2. /client/src/context/ThemeContext.jsx
   - Provide { mode, toggleTheme }
   - Detect system preference on first load
   - Persist to localStorage 'vastuverse-theme'

3. /client/src/App.jsx — React Router v6:
   Public: /, /login, /onboarding, /contractor/:token
   Protected: /dashboard, /plans, /plans/new,
     /plans/:planId/step/:stepNumber, /marketplace, /profile
   Admin: /admin/*   Architect: /architect/*
   Wrap all protected routes in <AnimatePresence> for page transitions
   (Framer Motion: opacity 0→1, y 20→0, duration 0.3s)

4. /client/src/layouts/MainLayout.jsx
   - AppBar: logo left, nav center, notification bell + dark/light toggle
     (animated sun↔moon icon) + avatar menu right
   - Dark/light toggle: Framer Motion animate icon rotation (180deg)
   - MUI Drawer sidebar (collapsible, role-filtered nav items)
   - Mobile: bottom navigation (Dashboard, Plans, Marketplace, Profile)

5. /client/src/pages/Dashboard.jsx
   Homeowner: "Namaste, {name}!" gradient heading, "Start New Plan" glow CTA,
     recent plans grid (PlanCards with Framer Motion stagger),
     AI generations remaining (animated progress ring),
     subscription tier badge
   Developer: Projects overview, team activity feed
   Architect: Bid requests, active bids, earnings summary
   All dashboard cards: glassmorphism in dark mode, white in light mode

6. /client/src/components/PlanCard.jsx
   - Status chip color-coded, step progress bar, last updated, actions
   - Framer Motion: card fades up on mount, hover lifts y:-4px
```

---

## PHASE 3 — Plan Wizard Core (Steps 1–3)

---

### PROMPT 06 — Plan Wizard Shell + Step 1 (Land & Structure)

```
Build the Plan Wizard shell and Step 1.

WIZARD SHELL — /client/src/pages/PlanWizard.jsx
- MUI Stepper (horizontal desktop, vertical mobile), 10 steps
- Active step has pulsing green indicator (CSS keyframe glow)
- Completed steps: check icon with Framer Motion scale pop animation
- Content area animates between steps: x slide transition via AnimatePresence
- "Save & Continue" (glow button) and "Back" (outlined) at bottom
- Auto-save indicator top-right: animated save icon + "Saved" text

STEP 1 — /client/src/pages/wizard/Step1Land.jsx:
- Land area: number input + unit toggle (sq ft / sq m)
- Plot shape: 4 cards with icons (Rectangular / L-shaped / Corner / Irregular)
  Irregular → file upload → call POST /api/v1/ai/shape-recognition
  → show detected polygon on HTML Canvas (green lines on dark canvas)
  → if confidence < 70%: fallback manual coordinate canvas UI
- Facing direction: 8-point SVG compass selector (animated rotation on select)
- Floors: MUI Slider 1–5 with custom animated value label
- City autocomplete + State select (Indian states)
- Vastu toggle (MUI Switch) — global toggle, persisted in Plan.vastuEnabled
  When toggled ON: ambient green glow appears around the form card

On City+State: GET /api/v1/municipal/rules?city=&state=
→ MUI Alert slides in (Framer Motion) with FSI, FAR, setback info

SERVER:
- POST /api/v1/plans — create plan (status: DRAFT)
- PUT /api/v1/plans/:planId/steps/step1 — save, set IN_PROGRESS
- GET /api/v1/municipal/rules — Redis cache 1hr
- POST /api/v1/ai/shape-recognition — AIServiceFactory.getShapeService()
```

---

### PROMPT 07 — Step 2 (Room Requirements) + AI Suggestions

```
Build Step 2: Room Requirements with live AI feasibility suggestions.

FILE: /client/src/pages/wizard/Step2Rooms.jsx

FIELDS:
- Bedrooms: animated number stepper (1–10) with +/- buttons
- Attached bathrooms (0–10), Common bathrooms (0–5)
- Kitchen type: Radio cards (Modular / Open / Traditional)
- Additional spaces: 3-column checkbox grid with icons:
  Living Room, Dining Room, Pooja Room, Study/Office, Garage,
  Servant Quarters, Balconies (with count stepper), Staircases
  (min 1 if floors>1), Terrace, Storage Rooms

Multi-storey (floors > 1): drag-and-drop floor distribution
  - Use @hello-pangea/dnd
  - Each floor is a drop zone; room chips are draggables
  - Warning banner if staircase missing on any floor

AI SUGGESTIONS PANEL:
- Triggers on blur of last field
- Animated skeleton loader (pulsing, dark-mode aware)
- Call POST /api/v1/ai/room-suggestions
- Results: MUI Alert chips with Framer Motion stagger fade-in:
  Green: feasibility confirmed
  Orange: suggestion to adjust
  Red: NBC compliance warning
- Dismiss button (×) on each chip

SERVER:
- PUT /api/v1/plans/:planId/steps/step2
- POST /api/v1/ai/room-suggestions → { suggestions[], warnings[], maxBUA,
  feasibilityRating } · Redis cache 5min on identical body hash
```

---

### PROMPT 08 — Step 3 (Floor Plan Generation) + BullMQ + WebSocket

```
Build Step 3: AI Floor Plan Generation with job queue and WebSocket results.

SERVER:
1. /server/src/queues/aiGenerationQueue.js
   - BullMQ Queue 'ai-generation' on Redis
   - Worker: calls correct AI service per job.data.type
   - On complete: Socket.io emit 'generation:complete' to room user:{userId}
   - On fail: emit 'generation:failed'
   - Priority: PRO/ENTERPRISE=1, BASIC=5, FREE=10
   - Timeout: 120s, retries: 3, backoff exponential 2s

2. /server/src/config/socket.js
   - Socket.io + Redis adapter for multi-instance
   - On connect: join room user:{userId} (JWT query param auth)

3. /server/src/controllers/aiController.js
   - POST /api/v1/plans/:planId/generate/floor-plan
     a. Check Redis ai_gen_limit:{userId}:{date} (TTL 86400s)
     b. If exceeded: 429 + upgradePrompt
     c. Enqueue job → return { jobId }
   - GET /api/v1/ai/jobs/:jobId — polling fallback

4. /server/src/services/ai/AIServiceFactory.js
   - getImageService() → PollinationsProvider (dev) / DalleProvider (prod)
   - getPlanService() → OllamaProvider (dev) / GPT4oProvider (prod)

5. Providers:
   - PollinationsProvider: URL with encoded prompt + seed
   - DalleProvider: openai SDK, dall-e-3, quality: hd
   - OllamaProvider: POST ollama:11434/api/generate, model: llama3
   - GPT4oProvider: openai gpt-4o, response_format: json_object

6. /server/src/prompts/floorPlanPrompt.js — NBC rules system prompt

CLIENT: /client/src/pages/wizard/Step3FloorPlan.jsx
- "Generate Floor Plans" → receive jobId, connect Socket.io
- Loading: animated progress bar with cycling messages:
  "Analysing your plot..." → "Applying NBC norms..." →
  "Placing rooms..." → "Rendering options..."
  (Framer Motion AnimatePresence for message fade transitions)
- Polling fallback: poll every 3s if no socket event in 10s
- Result: 3 option cards (Framer Motion stagger slide-up from bottom)
  Each card: image view OR 2D SVG toggle (button above cards)
- 2D SVG Renderer: rooms as color-coded labelled rectangles,
  dimension annotations, vastu compass overlay
- "Select" button → glow confirm animation → proceed
- "Regenerate" button (creates new version)
- Limit reached: upgrade MUI Dialog with animated tier comparison table
```

---

## PHASE 4 — Plan Wizard (Steps 4–7)

---

### PROMPT 09 — Steps 4 & 5 (Interior + Exterior Design)

```
Build Step 4 (Interior) and Step 5 (Exterior).

STEP 4 — /client/src/pages/wizard/Step4Interior.jsx:
- Global style selector: 6 cards (Modern / Minimalist / Traditional /
  Contemporary / Industrial / Indo-Colonial)
  Cards have gradient top bands; selected card glows with primary color
- Per-room overrides: MUI Accordion, one panel per room (collapsed = "Using global style")
- Kitchen configurator (if kitchen selected):
  Layout radio cards with diagrams, appliance toggles with icons
- Color palette: POST /api/v1/ai/color-palettes → 3 palette options
  Render as large circular swatches. Selected palette pulses green border.
  Framer Motion: swatches pop in with stagger scale animation
- "Generate Interiors" → per-room job queue → per-room loading states
  (each room card has its own skeleton/spinner until result arrives)
- Results: 2-column image grid, each card has "Regenerate this room" button

STEP 5 — /client/src/pages/wizard/Step5Exterior.jsx:
- Façade style: 5 radio cards with preview color swatches
- Roof type, Boundary wall, Main gate: MUI Selects
- Driveway toggle + material select (animated slide-down on Yes)
- Landscaping: 4 cards with icons
- "Generate Exterior" → 2 jobs (front + side elevation)
- Results: 2 image cards with animated reveal (Framer Motion scale from 0.8→1)
  Side toggle: "Left / Right" MUI ToggleButtonGroup

SERVER for both:
- PUT /api/v1/plans/:planId/steps/step4 and step5
- POST /api/v1/ai/color-palettes — short AI call
- /server/src/utils/buildImagePrompt.js — constructs detailed India-context prompt
```

---

### PROMPT 10 — Steps 6 & 7 (Utilities + Cost Estimate)

```
Build Step 6 (Utilities) and Step 7 (Cost Estimate).

STEP 6 — /client/src/pages/wizard/Step6Utilities.jsx:
- "Generate Utility Plan" button → single AI job
- Loading: animated skeleton floor plan (pulsing boxes matching room layout)
- Result: 2D floor plan SVG with TOGGLEABLE OVERLAY LAYERS
  Toggle pills at top (Framer Motion whileHover scale):
    Plumbing (blue) | Electrical (yellow) | HVAC (grey) |
    Water Tanks (cyan) | Sewage (brown) | Solar (orange)
  Each layer: animated draw-in (SVG stroke-dashoffset on mount)
- Summary cards below: one per utility with icon + stats
- Water tank formula chip: "Recommended: {X}L overhead tank"

SERVER:
- PUT /api/v1/plans/:planId/steps/step6
- Utility JSON: plumbing, electrical, hvac, waterTanks, sewage, solar

STEP 7 — /client/src/pages/wizard/Step7Cost.jsx:
- Finish tier toggle: Economy | Standard | Premium (MUI ToggleButtonGroup)
  Animated: on toggle, cost numbers count up/down (react-countup)
- Cost breakdown table (MUI Table):
  Categories: Civil, Electrical, Plumbing, Flooring, Painting, Fixtures
  Bold total row with ±15% variance note
- MUI Alert: "Based on {State} rates as of {Month Year}"
- Bar chart below table (recharts BarChart): visual cost breakdown by category
  Animated bar entry (recharts isAnimationActive=true)
- "Export Cost Estimate as PDF" button
- "Proceed to 3D" or "Skip to Municipal Docs"

SERVER:
- GET /api/v1/plans/:planId/cost-estimate — CostDatasets (Redis cache 6h)
- GET /api/v1/plans/:planId/export/cost-pdf — pdfkit stream
- PUT /api/v1/plans/:planId/steps/step7
```

---

## PHASE 5 — Premium Features (Steps 8–9)

---

### PROMPT 11 — Step 8 (3D View) — Three.js + Razorpay Paywall

```
Build Step 8: 3D View with Three.js and Razorpay unlock gate.

PAYWALL:
- On mount: check plan.is3DUnlocked and user tier
- If locked: animated lock card (Framer Motion bounce on mount)
  "Unlock 3D View" → POST /api/v1/payments/create-order { planId, type:'3d_unlock' }
  → Razorpay checkout → POST /api/v1/payments/verify
  → on success: Framer Motion celebration animation (scale pop + confetti burst
    using CSS keyframes) → re-render unlocked view

3D CONTENT — /client/src/components/ThreeJSViewer.jsx:
1. Bird's-eye AI render: "Generate 3D Bird's-eye View" button → queue job
   Image card with download button + Framer Motion fade-in reveal

2. Three.js walkthrough:
   - Rooms → BoxGeometry (width×height×3m) from floor plan JSON x,y positions
   - Walls → PlaneGeometry with MeshStandardMaterial
   - Floor → PlaneGeometry + texture (style-based color)
   - Labels → CSS2DRenderer sprites floating above rooms
   - Lighting: AmbientLight + DirectionalLight (south-facing, India)
   - Controls: OrbitControls (drag/scroll/right-click)
   - Mobile: touch pinch=zoom, swipe=rotate
   - UI overlay: room tooltip on hover/tap, Reset View button, Top/Perspective toggle
   - "Share 3D View" → returns shareable token URL

SERVER:
- POST /api/v1/payments/create-order — Razorpay order (paise)
- POST /api/v1/payments/verify — HMAC-SHA256 signature check
- POST /api/v1/payments/webhook — verify webhook sig, process events
- On unlock: Payment record + plan.is3DUnlocked=true + ActivityLog
```

---

### PROMPT 12 — Step 9 (Municipal Approval Docs)

```
Build Step 9: Municipal Approval Document Generator.

FILE: /client/src/pages/wizard/Step9Municipal.jsx
Feature gate: Basic+ only. Free users see animated upgrade card.

COMPLIANCE CHECKLIST:
- "Generate Compliance Report" button → POST /api/v1/plans/:planId/generate/municipal-checklist
- Loading: skeleton list with Framer Motion pulse
- Results: MUI List with animated entry (stagger from left):
  ✅ Setback compliance (with actual vs required values)
  ✅ FAR within limits
  ❌ Parking norms (clear fail reason)
  ✅ Fire egress compliance
  ✅ Minimum road width
  ⚠️  Structural safety note
  Each expandable: shows NBC/bye-law reference text

DRAFT DOCUMENT:
- User-fill fields: Plot number, Survey/Khasra No., Local authority, Owner name
- AI fills: land use zone, proposed BUA, FSI statement, room summary
- Preview: MUI Paper styled like official document (serif font, ruled sections)
- "Export as PDF" button

DISCLAIMER (always visible, cannot dismiss):
MUI Alert severity="warning" with amber background + lock icon:
"This is a guidance document only. Final approval must be obtained from
your local ULB/Corporation. VastuVerse does not guarantee compliance."

SERVER:
- POST /api/v1/plans/:planId/generate/municipal-checklist
  → fetch MunicipalRules (Redis 24h) → AI checklist JSON
- GET /api/v1/plans/:planId/export/municipal-pdf — disclaimer on every page
- PUT /api/v1/plans/:planId/steps/step9
```

---

## PHASE 6 — Collaboration, Versioning & Export

---

### PROMPT 13 — Step 10 (Review, Collaborate & Export)

```
Build Step 10: Final Review, Collaboration Panel, and Export.

FILE: /client/src/pages/wizard/Step10Review.jsx
Layout: 2-column desktop (summary left, collaboration right). Single on mobile.

LEFT PANEL:
- Step summary cards (1–9): step name, status chip, key data, "Edit" button
  Framer Motion: stagger fade-up on mount
- Version history: MUI Timeline (newest first)
  Each entry: version number, step, date, creator, "Rollback" button
  Rollback: confirm MUI Dialog → creates new version from snapshot
- Export buttons:
  "Full Plan PDF" (Basic+; Free = watermarked)
  "Share Contractor View" (copy token URL with clipboard animation)
  "Invite Collaborator" (opens MUI Dialog)
- "Mark as Completed" — large glow CTA button
  On click: Framer Motion celebration burst → status = COMPLETED
  → Architect Marketplace unlocked banner slides in

RIGHT PANEL — Real-time Collaboration:
- Collaborator list: avatars with permission badges
- Invite dialog: email + permission select → POST /api/v1/plans/:planId/collaborators
- Threaded comments:
  Step filter tabs at top (All / per-step)
  Thread list: avatar, name, timestamp, content, reply, resolve (✓) button
  New comment: step + room selectors + textarea + Send button
  Real-time via Socket.io room plan:{planId}:comments
  New comment animates in from bottom (Framer Motion y: 20 → 0)

SERVER:
- POST /api/v1/plans/:planId/collaborators → invite email with token
- GET /api/v1/invites/:token → accept invite
- PUT /api/v1/plans/:planId/status → log ActivityLog, notify via WebSocket
- POST/GET /api/v1/plans/:planId/comments — cursor-based pagination
- PUT /api/v1/comments/:commentId/resolve
- POST /api/v1/plans/:planId/contractor-links — SHA-256 hashed token
- PUT /api/v1/plans/:planId/versions/:versionId/rollback
- GET /api/v1/plans/:planId/export/full-pdf — watermark FREE tier
```

---

## PHASE 7 — Architect Marketplace

---

### PROMPT 14 — Architect Marketplace (Full)

```
Build the Architect Marketplace module. Visible only when plan.status === 'COMPLETED'.

CLIENT — Homeowner side (/client/src/pages/Marketplace.jsx):
1. "Post Review Request" form (Framer Motion slide-in panel):
   - Select completed plan, description, preferred timeline, max budget
   - Submit → POST /api/v1/marketplace/review-requests

2. My Review Requests list:
   - Request cards: plan title, budget, status chip (animated color change)
   - Expand: bids list with architect rating stars, fee, timeline, cover note
   - "Accept Bid" → Razorpay payment → bid status → 'accepted'
     Architect notified via Socket.io + email + WhatsApp

3. Submitted reviews: PDF embed + severity-coded annotation cards
   "Accept Review" → payment release → star rating form

CLIENT — Architect (/client/src/pages/architect/ArchitectDashboard.jsx):
1. Open requests feed: filter by city/state + budget range
   "Place Bid" → animated form slide-in
2. Active bids list with live status chips
3. Earnings: total, pending, completed, rating avg (animated counters)

SERVER:
- POST /api/v1/marketplace/review-requests → broadcast to Socket.io room 'architects'
- GET /api/v1/marketplace/review-requests — paginated feed
- POST /api/v1/marketplace/bids → notify homeowner
- POST /api/v1/marketplace/bids/:bidId/accept → Razorpay escrow capture
- POST /api/v1/marketplace/reviews → architect submits (PDF + annotations JSON)
- POST /api/v1/marketplace/reviews/:reviewId/accept → Razorpay Routes transfer
  (architect fee minus 15% commission) → update earnings → rating recalculate
```

---

## PHASE 8 — Admin Panel

---

### PROMPT 15 — Admin Panel

```
Build the Admin Panel at /admin (role='admin' required).

MUI DataGrid for all tables. Left sidebar: Dashboard, Users, Plans,
Subscriptions, Marketplace, AI Monitoring, Content, Feature Flags.
Sidebar has animated active-item indicator (sliding underline, Framer Motion).

1. Dashboard: KPI cards with animated counters (react-countup on mount):
   Active users, New users this week, Plans by status (recharts PieChart),
   Revenue this month, AI generations today, Subscriptions per tier

2. User Management (/admin/users):
   DataGrid: email, name, role, tier, status, joined date
   Actions: Change Role/Tier, Activate/Deactivate, Grant Free Pro Access
   Architect queue tab: portfolio viewer (PDF embed + image gallery),
   Approve/Reject buttons with rejection reason textarea

3. Subscriptions & Payments: subscription list + Razorpay IDs,
   manual grant/revoke, payment transactions with status filter

4. Marketplace Moderation: requests + bids overview,
   suspend architect, commission rate config

5. AI Provider Monitoring:
   Active provider per service (live badge, reads from config)
   24h generation stats (recharts LineChart, live via polling)
   BullMQ queue depth indicator (animated fill bar)

6. Content Management:
   CostDatasets editor table (inline edit + CSV import)
   MunicipalRules add/edit per city/state

7. Feature Flags:
   Checkbox matrix (feature × tier) — changes apply instantly
   User override: search box → toggle per user

SERVER:
All /api/v1/admin/* protected by requireRole('admin')
- GET/PUT /api/v1/admin/users
- GET /api/v1/admin/architect-verifications
- PUT /api/v1/admin/architects/:userId/verify (approve/reject)
- GET /api/v1/admin/analytics — aggregate KPI queries
- PUT /api/v1/admin/feature-flags
- POST /api/v1/admin/cost-datasets/import — CSV parse + upsert
- GET /api/v1/admin/ai-monitoring — BullMQ queue.getJobCounts()
```

---

## PHASE 9 — Notifications, i18n & Contractor View

---

### PROMPT 16 — Notification System + i18n + Contractor View

```
Build three cross-cutting features.

PART A — Notification Service
/server/src/services/notificationService.js:
sendNotification(userId, event, data):
  1. Socket.io emit 'notification' to room user:{userId}
  2. Email: nodemailer with HTML template per event
  3. WhatsApp (if WHATSAPP_API_TOKEN set): POST to WHATSAPP_API_URL

Events: generation_complete, collaborator_invited, bid_placed,
  bid_accepted, review_submitted, payment_captured, plan_status_changed

/client/src/components/NotificationBell.jsx:
- Bell icon with animated unread badge (Framer Motion scale pop on new notification)
- Click → MUI Popover: notification list, newest first
- Each item: icon, message, timestamp, click-to-read
- "Mark all read" button
- Real-time: Socket.io 'notification' → append + badge++
- Unread items have subtle left-border accent

PART B — i18n Setup
/client/src/i18n/i18n.js — react-i18next:
  Languages: en, hi, bn, ta, te, mr, gu, kn
  Backend: /public/locales/{lng}/translation.json
  Fallback: en, Detection: localStorage → navigator

Create /public/locales/en/translation.json with keys for:
  wizard step titles + field labels, dashboard strings,
  notification messages, error messages, auth strings

Language selector in profile settings → PUT /api/v1/users/me
  + i18n.changeLanguage() animated dropdown with flag emojis

Currency: Intl.NumberFormat('en-IN', currency: 'INR') → ₹12,50,000

PART C — Contractor View (public, no auth)
Route: /contractor/:token

/client/src/pages/ContractorView.jsx:
- GET /api/v1/contractor/:token → sanitized plan (no userId / personal data)
- Read-only view: floor plan SVG, room list + dimensions,
  utility summary, cost estimate (if owner included it), step images
- "Download PDF" button
- Top MUI Alert (info): "Read-only contractor view. Contact the homeowner
  directly for project inquiries."
- Branded VastuVerse header with "Powered by VastuVerse" badge

SERVER:
- GET /api/v1/contractor/:token
  → SHA-256 hash → find ContractorLink → check not revoked/expired
  → log access (IP, userAgent, timestamp)
  → return sanitized plan (.select() excludes sensitive fields)
```

---

## PHASE 10 — DevOps & Production Readiness

---

### PROMPT 17 — Security, Rate Limiting & Error Handling

```
Harden the VastuVerse server for production.

1. /server/src/middlewares/rateLimiter.js (express-rate-limit):
   - Global: 200 req/15min per IP
   - Auth OTP routes: 5 req/15min per IP
   - AI generation routes: 10 req/min per userId
   - Admin routes: 30 req/min per userId

2. /server/src/middlewares/security.js:
   - helmet() with CSP policy
   - cors({ origin: CLIENT_URL, credentials: true })
   - express.json({ limit: '10mb' })
   - Multer: MIME whitelist (jpeg/png/webp/pdf) + 'file-type' magic bytes check
   - Max sizes: 10MB images, 20MB PDFs

3. /server/src/middlewares/errorHandler.js (global 4-param):
   - Differentiate: 400/401/403/404/429/500
   - Production: no stack traces in response
   - Return: { success: false, error: { code, message, details? } }

4. /server/src/utils/asyncHandler.js:
   module.exports = fn => (req, res, next) =>
     Promise.resolve(fn(req, res, next)).catch(next)

5. express-validator rules on all routes:
   - Auth: email format, OTP 6-digit, phone +91XXXXXXXXXX
   - Plan: landArea > 0, floors 1–5, city/state required
   - Payments: amount > 0, planId valid ObjectId

6. /server/src/utils/logger.js (winston):
   - Console (dev), File: logs/error.log + logs/combined.log
   - Format: timestamp + level + message + metadata

7. /server/src/config/db.js:
   - Mongoose poolSize 10 (dev) / 50 (prod via env)
   - Auto-reconnect with exponential backoff
   - Connection + error event logging
```

---

### PROMPT 18 — CI/CD, Docker Production & Final Polish

```
Set up production deployment and final polish for VastuVerse.

1. docker-compose.prod.yml:
   - client: multi-stage Dockerfile (build → nginx:alpine), serves /dist
   - server: NODE_ENV=production, PM2 cluster (ecosystem.config.js, 4 workers)
   - mongo/redis: internal network only (no exposed ports)
   - server healthcheck: curl /api/v1/health every 30s

2. /server/src/routes/healthRoute.js:
   GET /api/v1/health → MongoDB ping + Redis ping + BullMQ reachability
   Return: { status:'ok', db, redis, queue, uptime }

3. /client/nginx.conf:
   - SPA fallback: try_files → index.html
   - gzip: JS/CSS/SVG assets
   - Cache-control: 1yr hashed assets, no-cache index.html

4. .github/workflows/deploy.yml:
   a. Checkout
   b. cd server && npm test (Jest + Supertest)
   c. cd client && npm run build
   d. Docker build both images
   e. SSH VPS: docker-compose -f docker-compose.prod.yml up -d
   f. Health check: curl https://{DOMAIN}/api/v1/health

5. /server/tests/auth.test.js (Jest + Supertest):
   - POST /auth/send-otp: valid, invalid, rate-limit
   - POST /auth/verify-otp: valid, expired, wrong
   - POST /auth/refresh: valid cookie, missing, tampered

6. Final UI polish:
   - LoadingScreen.jsx: full-screen with VastuVerse logo SVG + Framer Motion
     morphing circle animation during route transitions
   - EmptyState.jsx: illustration (SVG) + CTA, used on Plans list + Marketplace
   - ErrorBoundary.jsx: friendly error UI + "Reload" button
   - react-helmet-async: page titles per route
   - /client/public/manifest.json: PWA manifest, theme_color #2E7D32
   - prefers-reduced-motion: wrap ALL Framer Motion animations in
     useReducedMotion() hook — skip animation if true
   - Performance audit: lazy-load all route pages via React.lazy() + Suspense
     Code-split Three.js viewer separately (it's large)
```

---

## 📋 BUILD ORDER REFERENCE

| Prompt | What Gets Built | Dependencies |
|--------|----------------|--------------|
| 00 | 🌟 **Homepage** (animated, dark/light, all sections) | None |
| 01 | Monorepo scaffold + Docker | None |
| 02 | All 16 MongoDB models | 01 |
| 03 | Auth system (OTP + OAuth) | 01, 02 |
| 04 | Onboarding wizard (all 4 roles) | 03 |
| 05 | App shell + Theme system + Dashboard | 03, 04 |
| 06 | Wizard shell + Step 1 (Land) | 05 |
| 07 | Step 2 (Rooms + AI suggestions) | 06 |
| 08 | Step 3 (Floor Plan + BullMQ + WebSocket) | 07 |
| 09 | Steps 4 & 5 (Interior + Exterior) | 08 |
| 10 | Steps 6 & 7 (Utilities + Cost Estimate) | 09 |
| 11 | Step 8 (3D View + Razorpay paywall) | 10 |
| 12 | Step 9 (Municipal Docs) | 11 |
| 13 | Step 10 (Review + Collaboration) | 12 |
| 14 | Architect Marketplace | 13 |
| 15 | Admin Panel | All previous |
| 16 | Notifications + i18n + Contractor View | All previous |
| 17 | Security hardening + error handling | All previous |
| 18 | CI/CD + Docker prod + final polish | All previous |

---

## 💡 Tips for Using These Prompts

1. **Always paste the Master Prompt first** in each new Claude session. Update the "Current progress" line each time.
2. **One prompt per session** — each is scoped for complete, runnable output without draining context.
3. **Homepage first** — Prompt 00 is independent. You can build and show it before the backend is ready.
4. **Test after each prompt** before proceeding to the next one.
5. **For bugs**, paste the Master Prompt + "I have a bug in [feature]: [error message]". Claude will have full context.
6. **Environment variables** — fill `.env` from `.env.example` (Prompt 01) before running AI or payment features.
7. **Dev AI providers** (Pollinations + Ollama) are free — use through Prompts 06–13. Switch to DALL-E 3 + GPT-4o for production.
8. **Animations** — all Framer Motion animations in the app respect `prefers-reduced-motion`. Test with OS accessibility setting enabled.
9. **Dark mode** — ThemeContext from Prompt 05 powers every page including the homepage. Test both modes after building each prompt.
