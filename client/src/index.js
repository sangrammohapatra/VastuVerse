/**
 * VastuVerse API — entry point.
 * Boots Express with security/logging middleware, Passport (Google + Facebook),
 * mounts feature routers, and connects to MongoDB if MONGO_URI is set.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const passport = require("./config/passport");

const authRoutes = require("./routes/authRoutes");
const planRoutes = require("./routes/planRoutes");
const municipalRoutes = require("./routes/municipalRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

/* ---- middleware ---- */
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

/* ---- routes ---- */
app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    service: "vastuverse-api",
    time: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/plans", planRoutes);
app.use("/api/v1/municipal", municipalRoutes);
app.use("/api/v1/ai", aiRoutes);

/* ---- 404 + error handler ---- */
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(err.status || 500).json({ error: err.code || "server_error" });
});

/* ---- bootstrap ---- */
async function start() {
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("[mongo] connected");
    } catch (e) {
      console.error("[mongo] connection failed:", e.message);
    }
  } else {
    console.warn("[mongo] MONGO_URI not set — starting without DB");
  }
  app.listen(PORT, () => console.log(`VastuVerse API listening on :${PORT}`));
}

start();

module.exports = app;
