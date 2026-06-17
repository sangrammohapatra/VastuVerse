/**
 * VastuVerse API — production-hardened entry point.
 *
 * Middleware order (matters):
 *   1. trust proxy             — so req.ip works behind nginx/cloudflare
 *   2. helmet + CSP            — security headers
 *   3. cors                    — origin allow-list
 *   4. morgan → winston        — HTTP access log
 *   5. global rate limiter     — 200/15min/IP, skips webhook + auto-save
 *   6. payments webhook raw    — MUST run before express.json()
 *   7. express.json (10mb)     — body parser
 *   8. passport                — OAuth strategies
 *   9. routes                  — with per-route rate limiters
 *  10. 404                     — catch-all not-found
 *  11. errorHandler            — last, 4-param, structured response
 */

require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const morgan = require("morgan");

const passport = require("./config/passport");
const { init: initSocket } = require("./config/socket");
const { startWorker } = require("./queues/aiGenerationQueue");
const { connectDB } = require("./config/db");

const logger = require("./utils/logger");
const security = require("./middlewares/security");
const rateLimiter = require("./middlewares/rateLimiter");
const errorHandler = require("./middlewares/errorHandler");

const authRoutes = require("./routes/authRoutes");
const planRoutes = require("./routes/planRoutes");
const municipalRoutes = require("./routes/municipalRoutes");
const aiRoutes = require("./routes/aiRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const collaborationRoutes = require("./routes/collaborationRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationAndContractorRoutes = require("./routes/notificationRoutes");
const healthRoute = require("./routes/healthRoute");
const paymentsController = require("./controllers/paymentsController");

const app = express();
const PORT = process.env.PORT || 5000;

/* ── 1. Trust proxy ────────────────────────────────────────────────
   Required so req.ip reflects the real client IP behind any reverse
   proxy (nginx, Cloudflare, Heroku router). Critical for rate-limit
   keying and access logging.
   - 'true'  trusts the X-Forwarded-For chain (use in cloud envs)
   - integer trusts N hops (use behind a fixed-depth proxy)
   - 'false' don't trust (use only when binding directly to 0.0.0.0)
*/
app.set("trust proxy", process.env.TRUST_PROXY === "false" ? false
                     : process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || true
                     : true);
app.disable("x-powered-by");

/* ── 2-4. Security + access log ──────────────────────────────────── */
app.use(security.helmet);
app.use(security.cors());
app.use(morgan(
  process.env.NODE_ENV === "production" ? "combined" : "dev",
  { stream: logger.stream }
));

/* ── 5. Global rate limit ────────────────────────────────────────── */
app.use(rateLimiter.global);

/* ── 6. Razorpay webhook (raw body — BEFORE express.json) ────────── */
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  paymentsController.webhook
);

/* ── 7. Body parsers (10 MB JSON for embedded plan payloads) ─────── */
app.use(security.jsonBody);
app.use(security.urlEncoded);

/* ── 8. Passport ─────────────────────────────────────────────────── */
app.use(passport.initialize());

/* ── 9. Health (mounted before route limiters so probes always pass) ─ */
app.use("/api/v1/health", healthRoute);

/* ── Static: architect portfolio uploads ─────────────────────────────
   Serves files from <repo>/server/uploads/ at /uploads/*.
   In production replace this with a CDN / signed S3 URL approach.     */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* ── 10. Routes (per-route limiters layered on top of global) ────── */

// Auth — OTP routes get the strict 5/15min limiter inside authRoutes.js;
// every other auth endpoint inherits only the global limiter.
app.use("/api/v1/auth",         authRoutes);
app.use("/api/v1/users",        userRoutes);
app.use("/api/v1/plans",        planRoutes);
app.use("/api/v1/municipal",    municipalRoutes);
app.use("/api/v1/ai",           rateLimiter.ai,    aiRoutes);
app.use("/api/v1/payments",     paymentRoutes);
app.use("/api/v1/marketplace",  marketplaceRoutes);
app.use("/api/v1/admin",        rateLimiter.admin, adminRoutes);
app.use("/api/v1",              notificationAndContractorRoutes);
app.use("/api/v1",              collaborationRoutes);

/* ── 11. 404 (any unmatched /api/v1/* hits this) ─────────────────── */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "not_found", message: `${req.method} ${req.originalUrl} does not exist.` },
  });
});

/* ── 12. Global error handler (4-param, MUST be last) ────────────── */
app.use(errorHandler);

/* ─── Boot ────────────────────────────────────────────────────────── */
const server = http.createServer(app);

async function start() {
  // DB with pooling + reconnect
  try {
    await connectDB();
  } catch (e) {
    logger.error("[boot] DB connect ultimately failed", { err: e.message });
  }

  // Socket.io (uses Redis adapter when REDIS_URL is set)
  try { await initSocket(server); }
  catch (e) { logger.warn("[socket] init failed", { err: e.message }); }

  // BullMQ AI worker
  try { startWorker(); }
  catch (e) { logger.warn("[ai-queue] worker start failed", { err: e.message }); }

  server.listen(PORT, () => logger.info(`[boot] API listening on :${PORT}`));
}

/* ─── Crash guards ─────────────────────────────────────────────────
   Log uncaught exceptions / unhandled rejections. We exit(1) on
   uncaughtException so a process supervisor (pm2, k8s, systemd) can
   restart cleanly. Don't exit on unhandled rejection — Node 16+ has
   set this to throw by default, which uncaughtException catches.
*/
process.on("uncaughtException", (err) => {
  logger.error("[fatal] uncaughtException", { err: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 250);
});
process.on("unhandledRejection", (reason) => {
  logger.error("[fatal] unhandledRejection", {
    err: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Skip auto-boot in test mode so supertest can attach to the app directly.
if (process.env.NODE_ENV !== "test") {
  start();
}

module.exports = app;
