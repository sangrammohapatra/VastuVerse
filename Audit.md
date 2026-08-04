# VastuVerse — Comprehensive Code Audit

> **Audit Date:** 2026-06-21  
> **Branch:** `dev`  
> **Last Commit:** `31f7480` — Floor Plan through AI and its config from UI  
> **Scope:** Full codebase — `server/src`, `client/src`, `nginx.conf`, `docker-compose*.yml`, git history  
> **Previous Analysis Reference:** `VastuVerse-Review-architecture-and-gaps.md` (Parts A, B, C)

---

## 1. Previous Bug Fixes Verified (Git History)

| Commit | Date | Fix Description | Status |
|--------|------|-----------------|--------|
| `41ace62` | 2026-06-17 | Image URL persistence — images now uploaded to S3/Cloudinary instead of storing ephemeral Pollinations/DALL-E URLs | **FIXED** |
| `a458139` | 2026-06-18 | Storage config controller bug fix — removed redundant `await` calls causing double-resolution | **FIXED** |
| `a3d4c1f` | 2026-06-17 | `StorageFactory.persistImage()` wired into all queue job handlers (`floor-plan-image`, `interior-render`, `exterior-render`, `bird-eye-3d`) | **FIXED** |
| `3c77ae5` / `1917a6a` | 2026-06-18 | Floor plan overlap and missing-room bugs fixed — `_layoutSolver.js` retry logic + `forcePlaceAnywhere()` fallback ensures no rooms are silently dropped | **FIXED** |
| `6fa817d` / `0ba790b` | 2026-06-18 | Floor plan engine upgraded with zone-aware constraint solver, vertical structural alignment, Vastu scoring | **FIXED** |
| `f76ba0a` / `31f7480` | 2026-06-18 | AI provider config (GPT-4o, Ollama, Pollinations, DALL-E) configurable from Admin UI | **FIXED** |
| `a3d4c1f` (tierLimits) | 2026-06-17 | `TIER_LIMITS` removed from hardcoded `aiGenerationQueue.js` export; now read from `SystemSettings` via `tierLimits.js` with 60-second cache | **FIXED** |

---

## 2. Critical Bugs & Security Issues

### 2.1 XSS via Unsanitized SVG (CRITICAL)

**File:** `client/src/pages/ContractorViewPage.jsx:379`

```jsx
<Box dangerouslySetInnerHTML={{ __html: selected.svgString }} />
```

**Problem:** The `svgString` field originates from plan data stored in MongoDB. SVG elements support `<script>`, `onload`, `onmouseover`, and other event handlers that execute JavaScript when injected into the DOM via `innerHTML`. A malicious architect or plan-editor who can write to `svgString` could execute arbitrary JS in the browser of anyone visiting the public contractor view link — which is unauthenticated.

**Impact:** Full XSS in an unauthenticated route (`/contractor/:token`). Could steal admin session cookies, redirect payments, or deface contractor views.

**Fix:** Sanitize with DOMPurify before rendering:
```jsx
import DOMPurify from 'dompurify';
// ...
<Box dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.svgString, { USE_PROFILES: { svg: true } }) }} />
```

---

### 2.2 Missing Content-Security-Policy in Nginx (HIGH)

**File:** `client/nginx.conf:70–74`

The HTTPS server block defines `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `HSTS`, but **no `Content-Security-Policy` header is set**. The API server's Helmet adds CSP for API responses only. Static assets and the React SPA shell are served by Nginx without CSP — any injected script in the HTML can execute freely.

**Fix:** Add to `nginx.conf` after line 74:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: https://checkout.razorpay.com; frame-src checkout.razorpay.com;" always;
```

---

### 2.3 WhatsApp Integration is Stubbed (HIGH — Advertised Feature)

**File:** `server/src/services/notifications.js:46–54`

```javascript
// TODO: replace with Twilio WhatsApp / Meta Cloud API call.
console.log('[notify] whatsapp stub →', whatsapp.to, '·', whatsapp.text?.slice(0, 80));
```

The WhatsApp notification channel does nothing in production. The platform advertises WhatsApp bid/payment notifications — this is a broken user-facing feature, not a background concern. Phone numbers are logged to `stdout` in production (minor data leakage).

**Fix:** Integrate Twilio WhatsApp Business API or Meta Cloud API. Register HSM templates for: "Your floor plan is ready", "An architect has bid ₹X", "Payment received."

---

### 2.4 No Tests for Business-Critical Rule Engines (HIGH — Liability)

**Files checked:** `server/tests/` contains only `auth.test.js`, `setup.js`, `global-setup.js`, `global-teardown.js`

The following pure-function rule engines have **zero test coverage**:
- `server/src/services/ai/plan/_municipal.js` — compliance checks used in legal-facing PDF reports
- `server/src/services/ai/plan/_costEstimate.js` — financial estimates shown to contractors
- `server/src/services/ai/plan/_rules.js` — NBC 2016 minimum dimension checks
- `server/src/services/ai/plan/_floorPlanValidator.js` — feasibility gating
- `server/src/services/ai/plan/_vastuScore.js` — Vastu scoring engine

A miscalculation in FSI, setback, or minimum room dimensions exposes the platform to legal liability. The Jest config (`server/jest.config.js`) sets a 65% line coverage threshold — it is meaningless while these files are untested and excluded from coverage.

---

### 2.5 Queue Processor: Silent Failure on DB Persist (MEDIUM)

**File:** `server/src/queues/aiGenerationQueue.js:105–122` (and similar in all job handlers)

```javascript
try {
  await Plan.findOneAndUpdate(...);
} catch (e) {
  console.warn('[queue] failed to persist floorPlan:', e.message);
}
```

If MongoDB is unreachable or the plan document was deleted, the job completes with `result.status = 'completed'` but the plan data is **never saved**. The user gets a WebSocket `generation:complete` event with results that don't exist in the database. On page reload, the plan is empty.

**Fix:** Re-throw the error from the catch block (or return a partial result with an error flag) so BullMQ marks the job as failed and triggers the retry/backoff mechanism.

---

### 2.6 Payment Webhook: No Idempotency Deduplication (MEDIUM)

Razorpay retries webhook delivery on non-2xx responses or timeouts. The `paymentsController.js` checks `alreadyVerified` for the `/verify` endpoint but the analysis confirms the **webhook handler lacks an idempotency deduplication guard** on `razorpayPaymentId`. A retried `payment_captured` event could double-grant subscription credits, double-unlock 3D features, or double-trigger architect payouts.

**Fix:** Before processing any webhook event, check:
```javascript
const existing = await Payment.findOne({ razorpayPaymentId, status: 'captured' });
if (existing) return res.status(200).json({ ok: true, duplicate: true });
```

---

### 2.7 Three.js Not Lazy-Loaded (MEDIUM — Performance)

**File:** `client/src/components/wizard/ThreeJSViewer.jsx:13–15`

```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
```

Three.js (~1 MB) is eagerly bundled and loaded for every user on every page, even if they never visit Step 8 (3D View). On Indian 4G networks (~5 Mbps avg), this adds ~1.6 seconds to initial load.

**Fix:** Use dynamic imports inside a `useEffect` or React.lazy + Suspense:
```javascript
const THREE = await import('three');
```

---

### 2.8 Missing `schemaVersion` on Plan Documents (MEDIUM)

**File:** `server/src/models/Plan.js`

The `Plan` schema has no `schemaVersion` field. When the AI-generated floor plan JSON schema changes (as it already has between the original mock and the current constraint solver), old `PlanVersions.snapshotData` documents become unreadable by the new renderer without a migration. This will silently break "roll back to previous version" for all plans created before the schema change.

**Fix:** Add `schemaVersion: { type: Number, default: 1 }` to `PlanSchema` and to `PlanVersionSchema`. Increment on each breaking change and write a renderer that handles legacy versions gracefully.

---

### 2.9 Social Login: Implicit Account Merging by Email (LOW-MEDIUM)

**File:** `server/src/config/passport.js:38–44`

When a user authenticates via Google with email `user@example.com` and an account with that email already exists (created via email/OTP), the strategy silently links them. This is a potential **account takeover vector**: if an attacker registers `user@example.com` via email/OTP with any verified-looking flow, and the victim then logs in via Google, the attacker-created account is merged.

**Fix:** Require explicit confirmation before linking social providers to an existing account, or verify the original account's email is confirmed before allowing merge.

---

### 2.10 CSP `img-src: https:` is Too Permissive (LOW)

**File:** `server/src/middlewares/security.js` (Helmet CSP config)

The API server's Helmet CSP allows images from any `https://` origin. Combined with the missing Nginx CSP (§2.2), this allows loading images from attacker-controlled domains, which could be used for tracking pixels, side-channel attacks, or content injection in the 3D viewer.

**Fix:** Restrict to known CDN origins: `'self' data: blob: https://res.cloudinary.com https://*.amazonaws.com https://image.pollinations.ai`.

---

## 3. Architecture Flaws

### 3.1 Municipal Compliance Engine: Road Width Always Returns Warning

**File:** `server/src/services/ai/plan/_municipal.js`

The road width compliance check always returns `'warning'` because Step 1 of the wizard never captures the plot's adjacent road width. The check uses NBC defaults without a measured road width, making it impossible to correctly assess setback requirements which depend on road width under most municipal bye-laws.

**Gap from previous analysis:** Still open. The previous architecture review flagged this. No road width input field was added.

---

### 3.2 Cost Estimation Rates Are Hardcoded Bangalore Values

**File:** `server/src/services/ai/plan/_costEstimate.js:20–23`

```javascript
const DEFAULT_RATES = {
  economy:  { civil: 950, ... },  // Bangalore mid-2025 reference
  standard: { civil: 1300, ... },
  premium:  { civil: 1800, ... },
};
```

These rates are used as fallback when `CostDataset` has no rows for a given state. Construction costs vary 40–80% across Indian states. A Chennai project estimated at Bangalore rates could be off by ₹15–25 lakhs on a 2000 sqft house. The missing line items are:
- Architect/engineer fees (7–10% of civil cost)
- Municipal approval fees (₹50,000–₹5,00,000 depending on city/plot size)
- GST on services (18%)
- Contingency (10–15%)

---

### 3.3 Vastu "Vastu Optimised" Label Depends on `vastuEnabled` Flag

**File:** `server/src/services/ai/plan/_layoutMock.js:381`

```javascript
const isVastuVariant = variantIdx === 0 && vastuEnabled;
```

The label "Vastu Optimised" is correctly conditional on `vastuEnabled`, which is an improvement. However, the Vastu scoring engine (`_vastuScore.js`) computes a score but there is no disclosure on the client that the score is algorithmic and unverified by a certified Vastu Shastri. Users paying for "Vastu-compliant" plans on the marketplace may have unrealistic expectations.

---

### 3.4 No GST Invoice Generation

Razorpay captures payment and a `Payment` record is stored, but no GST-compliant invoice is generated. Indian GST law (CGST Act §31) requires a tax invoice for all B2B supplies and a receipt-cum-invoice for B2C above ₹200. Architect marketplace commissions are taxable services requiring SAC code + CGST/SGST breakup.

---

### 3.5 No Error Monitoring / Sentry Integration

**Files:** `server/src/utils/logger.js`, `client/src/components/ErrorBoundary.jsx:55–59`

The `ErrorBoundary` has a commented Sentry hook:
```javascript
// if (typeof Sentry !== 'undefined') Sentry.captureException(error);
```

No Sentry (or equivalent) is integrated on either client or server. AI provider failures, queue job failures, and payment webhook failures only log to Winston/console. There is no alerting when the Redis queue fills, a provider rate limit is hit, or when job failure rates spike.

---

### 3.6 Optimistic Concurrency Missing for Team Editor Role

**File:** `server/src/models/Plan.js`

The Developer persona supports "Editor" team members who can modify plan step data. There is no `version` integer or optimistic locking on the Plan document. Two Editors can overwrite each other's step changes simultaneously with no conflict detection.

---

### 3.7 Financial Audit Log Has No TTL-Exempt Collection

The `ActivityLogs` model has a 365-day TTL index. Financial events (payment captures, payouts, subscription changes) stored in this collection will be deleted after one year. Indian Income Tax rules require financial records for 8 years. No separate `FinancialAuditLog` collection without a TTL index exists.

---

### 3.8 Backup / Disaster Recovery Not Documented

No evidence of a defined backup policy, point-in-time restore test, or RPO/RTO targets for the MongoDB Atlas cluster. Given that `PlanVersions` and `Payments` require durability guarantees, and Indian tax law requires 8-year retention for financial records, this is a P1 operational gap.

---

## 4. Shortfalls vs Real-World Requirements (Still Open)

The following items were identified in the previous architecture review and remain unaddressed:

| # | Item | Gap Summary | Priority |
|---|------|-------------|----------|
| S1 | Municipal compliance — city-specific rules | Only 12 seeded cities; 4,741 ULBs in India. FAR/setback checks use NBC defaults for ~99% of users | P2 |
| S2 | Cost estimation — missing line items | No professional fees, approval fees, GST, or contingency in output | P1 |
| S3 | Vastu expert review | Algorithmic Vastu score presented without expert credential or disclaimer | P2 |
| S4 | RERA eligibility check | No check when floors ≥ 3 or BUA > 500 sqm — legally mandatory disclosure | P2 |
| S5 | Electrical load calculator | No DISCOM sanctioned load calculation in Step 6 | P3 |
| S6 | BOQ export | Contractors need per-room item BOQ, not just category totals | P3 |
| S7 | DXF/CAD export | Architects need DXF to work in ArchiCAD/Revit | P3 |
| S8 | GIS plot verification | Users self-report plot dimensions; no satellite verification | P3 |
| S9 | Construction phase scheduler | No post-plan Gantt/timeline output | P3 |
| S10 | DPDP Act 2023 compliance | No itemized consent, no breach notification flow, no DPO | P1 (legal) |
| S11 | Admin MFA | Admin accounts have no TOTP/MFA requirement | P1 |
| S12 | Dependency vulnerability scanning | No `npm audit`, Snyk, or Dependabot in CI | P1 |
| S13 | Green building / ECBC checklist | Window-to-wall ratio, rainwater harvesting, thermal mass not assessed | P3 |
| S14 | Referral system | No user acquisition mechanism | P3 |
| S15 | In-app customer support | No chat widget or helpdesk integration | P3 |

---

## 5. Code Quality Issues

### 5.1 `console.warn` Leaking User Phone Numbers in Production

**File:** `server/src/services/notifications.js:51`

```javascript
console.log('[notify] whatsapp stub →', whatsapp.to, '·', whatsapp.text?.slice(0, 80));
```

`whatsapp.to` contains a user's phone number. This logs PII to stdout in production. Under DPDP Act 2023, logging personal data without purpose limitation is a compliance issue.

---

### 5.2 Queue Worker: No Plan Ownership Validation Before DB Update

**File:** `server/src/queues/aiGenerationQueue.js:107`

```javascript
await Plan.findOneAndUpdate({ _id: planId, userId }, ...)
```

The `userId` is checked in the `findOneAndUpdate` query, which is correct. However, the job was enqueued without re-verifying the plan still exists at processing time. If a plan is deleted between enqueue and processing, the update silently no-ops — the error is only surfaced in the next try-catch as a warning, not a job failure.

---

### 5.3 `console.warn` Debug Log Left in LanguageSelector

**File:** `client/src/i18n/i18n.js` or `client/src/components/LanguageSelector.jsx:51`

```javascript
console.warn('[language] persist failed:', e?.message);
```

Non-critical but should be removed from production builds.

---

### 5.4 Hardcoded Magic Numbers in Client

**Files:**
- `client/src/pages/wizard/Step8ThreeDView.jsx:15` — `UNLOCK_PRICE_INR = 499` (must match Razorpay pricing server-side)
- `client/src/components/wizard/ThreeJSViewer.jsx:19–22` — `WALL_HEIGHT_FT = 10`, `FLOOR_SPACING = 11`, `WALL_OPACITY = 0.35`
- `client/src/pages/wizard/Step9Municipal.jsx:22` — `SAVE_DEBOUNCE_MS = 1500`

The `UNLOCK_PRICE_INR` constant is the most dangerous — it's a display-only value derived by hardcoding rather than fetching from the server's `PRICING.js`. If pricing changes, the displayed price and the actual charge will differ.

---

### 5.5 Missing Startup Validation for Required Environment Variables

**File:** `server/src/index.js`

No startup check validates that critical environment variables (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_KEY_SECRET`, `MONGODB_URI`) are set before the server starts accepting connections. A misconfigured deployment will fail at runtime (on first request) rather than at startup, making the failure harder to diagnose.

**Fix:**
```javascript
const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI'];
required.forEach(k => { if (!process.env[k]) throw new Error(`Missing required env var: ${k}`); });
```

---

### 5.6 `expandToFillPlot()` Can Produce Zero-Width/Zero-Height Rooms

**File:** `server/src/services/ai/plan/_layoutMock.js:222–276`

The four-pass expansion algorithm (right → down → left → up) may produce zero-width or zero-height rooms when all four sides of a room are already at plot boundaries. The `r.w = right - r.x` line can produce `w = 0` if `right === r.x`. This would create invisible rooms in the SVG renderer.

**Fix:** Add `r.w = Math.max(3, right - r.x)` and `r.h = Math.max(3, bottom - r.y)` to enforce the minimum 3ft render dimension after expansion.

---

### 5.7 `forcePlaceAnywhere()` as Last Resort Causes Overlaps

**File:** `server/src/services/ai/plan/_layoutSolver.js:112–124`

When all zone placements fail, `forcePlaceAnywhere()` places a room at `{x: 0, y: 0}` if the plot is completely full. This guarantees an overlap, which is then reported in `layoutWarnings`. The client renders these overlapping rooms, displaying a visually incorrect floor plan. The warning is surfaced in the API response but is not prominently displayed in the UI.

**Impact:** Users may not notice the `layoutWarnings` field and proceed with an invalid plan. This is especially likely for small plots with many rooms.

**Fix:** On the client, display a visible inline error when `placementError` or `layoutWarnings` are present on a selected floor plan option, and prevent step completion.

---

## 6. Nginx / Infrastructure Issues

### 6.1 Missing `Permissions-Policy` Header

**File:** `client/nginx.conf`

No `Permissions-Policy` (formerly `Feature-Policy`) header is set. The browser can access geolocation, camera, microphone, and payment APIs by any injected script without restriction.

**Fix:**
```nginx
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=(self)" always;
```

### 6.2 Health Check on Port 80 is Plaintext

**File:** `client/nginx.conf:38–43`

The `/health` endpoint on port 80 returns `200 "ok"`. Docker Compose uses this for healthchecks. No authentication. This is acceptable for internal network access but should not be publicly routed.

---

## 7. Summary: Consolidated Priority Matrix

### P0 — Fix Immediately (Production Correctness / Security)

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| P0-1 | **XSS via unsanitized SVG** in ContractorViewPage | `client/src/pages/ContractorViewPage.jsx:379` | 1 hr |
| P0-2 | **Nginx missing CSP header** | `client/nginx.conf` | 30 min |
| P0-3 | **Queue silent failure on DB persist** — re-throw instead of swallowing | `server/src/queues/aiGenerationQueue.js` | 1 hr |
| P0-4 | **Payment webhook idempotency** — dedup on `razorpayPaymentId` | `server/src/controllers/paymentsController.js` | 2 hrs |
| P0-5 | **Phone number logged to stdout** — remove PII console.log | `server/src/services/notifications.js:51` | 15 min |
| P0-6 | **Startup env var validation** | `server/src/index.js` | 30 min |

### P1 — Fix This Sprint (High Impact)

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| P1-1 | **WhatsApp integration** — complete Twilio/Meta API integration | `server/src/services/notifications.js` | 3 days |
| P1-2 | **Unit tests for rule engines** — `_municipal.js`, `_costEstimate.js`, `_rules.js` | `server/tests/` | 2 days |
| P1-3 | **Admin MFA (TOTP)** | Auth flow | 1 day |
| P1-4 | **Sentry + BullMQ Bull Board** error monitoring | Server + client | 1 day |
| P1-5 | **GST invoice generation** on `payment_captured` | New service | 3 days |
| P1-6 | **`schemaVersion` field** on Plan + PlanVersion | `server/src/models/Plan.js` | 2 hrs |
| P1-7 | **Financial audit log** — separate collection, no TTL | New model | 3 hrs |
| P1-8 | **Dependency scanning** — `npm audit` + Snyk in CI | `.github/workflows/` | 4 hrs |
| P1-9 | **Backup/DR policy** — define RPO/RTO, test Atlas point-in-time restore | Operational | 1 day |
| P1-10 | **DPDP Act 2023** compliance review (legal + engineering) | All data flows | 1–2 weeks |

### P2 — Next Iteration

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| P2-1 | **Lazy-load Three.js** | `ThreeJSViewer.jsx` | 2 hrs |
| P2-2 | **`UNLOCK_PRICE_INR` fetched from server** instead of hardcoded | `Step8ThreeDView.jsx` | 2 hrs |
| P2-3 | **`expandToFillPlot()` zero-dimension guard** | `_layoutMock.js` | 30 min |
| P2-4 | **Client-side floor plan overlap warning** — block step if `placementError` present | Step5 client UI | 2 hrs |
| P2-5 | **Road width input** in Step 1 wizard | Step1 UI + municipal engine | 0.5 days |
| P2-6 | **Cost estimate missing line items** — professional fees, approval costs, GST, contingency | `_costEstimate.js` | 2 days |
| P2-7 | **RERA eligibility check** in municipal module | `_municipal.js` | 1 day |
| P2-8 | **Optimistic concurrency (plan `version` field)** for Editor-role edits | `Plan.js` + PUT handlers | 2 days |
| P2-9 | **Vastu disclaimer** — visible label that score is AI-generated, not expert-reviewed | Client UI | 1 hr |
| P2-10 | **Permissions-Policy header** in Nginx | `nginx.conf` | 15 min |
| P2-11 | **Narrow CSP `img-src`** to known CDN origins | `security.js` | 1 hr |
| P2-12 | **Social login account-merge confirmation** — require explicit approval | `passport.js` | 1 day |
| P2-13 | **Seed CostDataset** for all 28 states + 8 UTs | Admin seeder script | 2 days |
| P2-14 | **PWA service worker** for offline form caching | `client/` | 2 days |

### P3 — Backlog

| ID | Item | Effort |
|----|------|--------|
| P3-1 | Cross-floor structural alignment validator (after single-floor solver) | 4–6 weeks |
| P3-2 | BOQ export — gated on layout solver | 3 days |
| P3-3 | DXF/CAD export — gated on layout solver | 3 days |
| P3-4 | GIS plot boundary verification | 1 week |
| P3-5 | Electrical load calculator (Step 6) | 1 week |
| P3-6 | Green building / ECBC checklist | 1 week |
| P3-7 | Construction phase scheduler (post-plan) | 1 week |
| P3-8 | Referral system | 3 days |
| P3-9 | In-app customer support (Crisp/Freshdesk) | 1 day |
| P3-10 | AI generation unit-economics dashboard (cost vs. revenue per tier) | 3 days |
| P3-11 | City-specific municipal rule database (beyond 12 seeded cities) | Ongoing |

---

## 8. What Is Working Well

The following areas are implemented correctly and do not require immediate attention:

- **JWT authentication** — proper httpOnly cookies, SameSite=Strict, 15-minute access token, 7-day refresh token, no tokens in localStorage
- **Payment HMAC verification** — `timingSafeEqual()` used correctly, raw body handler before JSON parser
- **File upload security** — two-stage MIME validation (declared type + magic bytes), size limits
- **RBAC** — multi-level role + feature flag system implemented correctly
- **Rate limiting** — per-user and per-IP limits with Redis store and memory fallback
- **NoSQL injection** — all Mongoose queries use literal filter objects, no user input interpolated
- **Invite token security** — 24-byte random token emailed, SHA-256 hash stored (never plaintext), 14-day expiry
- **Image URL persistence** — images now downloaded and uploaded to S3/Cloudinary on every AI generation (confirmed fixed in commit `a3d4c1f`)
- **Tier limits** — single source of truth in `SystemSettings`, admin-configurable at runtime (confirmed fixed)
- **Floor plan solver** — zone-aware constraint placement with Vastu scoring, vertical staircase/plumbing alignment, retry logic, and post-placement validation (confirmed working after `1917a6a` / `31f7480`)
- **PWA manifest** — `public/manifest.json` present with correct icons, shortcuts, and display mode
- **Health check endpoint** — probes MongoDB, Redis, and Queue with 1.5s timeouts; returns structured JSON
- **Axios interceptor** — single-flight token refresh with 401 retry, no duplicate refresh calls
- **Error boundaries** — app-wide React error boundary with Sentry hook (ready to enable)
- **Nginx TLS** — TLSv1.2/1.3 only, strong ciphers, HSTS with preload, HTTP/2 enabled
- **Dev seeding** — `scripts/seed-dev-users.js` refuses to run in production, creates test personas with distinguishable emails

---

*End of Audit — 2026-06-21*
