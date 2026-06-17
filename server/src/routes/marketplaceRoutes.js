/**
 * Marketplace routes — mounted at /api/v1/marketplace.
 *
 * Auth: every route requires a valid JWT (the controller does the
 * role/ownership checks per-endpoint).
 */

const express = require("express");

const { authenticateToken } = require("../middlewares/auth");
const m = require("../controllers/marketplaceController");

const router = express.Router();
router.use(authenticateToken);

// ── Homeowner ────────────────────────────────────────────────────────
router.post("/review-requests",                 m.createReviewRequest);
router.get("/review-requests/mine",             m.listMyRequests);
router.get("/review-requests/:requestId/review",m.getReviewByRequest);

router.post("/bids/:bidId/accept",        m.acceptBidOrder);
router.post("/bids/:bidId/accept/verify", m.acceptBidVerify);

router.post("/reviews/:reviewId/accept",  m.acceptReview);
router.post("/reviews/:reviewId/rating",  m.rateReview);

// ── Architect ────────────────────────────────────────────────────────
router.get("/review-requests",            m.listOpenRequests);
router.get("/bids/mine",                  m.listMyBids);
router.post("/bids",                      m.placeBid);
router.post("/reviews",                   m.submitReview);
router.get("/architects/me/earnings",     m.getEarnings);

module.exports = router;
