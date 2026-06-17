/**
 * Collaboration routes — mounted at /api/v1.
 *
 *   POST   /plans/:planId/collaborators
 *   GET    /plans/:planId/collaborators
 *   DELETE /plans/:planId/collaborators/:id
 *   GET    /invites/:token
 *
 *   POST   /plans/:planId/comments
 *   GET    /plans/:planId/comments
 *   PUT    /comments/:commentId/resolve
 */

const express = require("express");

const { authenticateToken } = require("../middlewares/auth");
const collab = require("../controllers/collaboratorController");
const comments = require("../controllers/commentController");

const router = express.Router();
router.use(authenticateToken);

// Collaborators
router.post("/plans/:planId/collaborators",       collab.invite);
router.get("/plans/:planId/collaborators",        collab.list);
router.delete("/plans/:planId/collaborators/:id", collab.revoke);
router.get("/invites/:token",                     collab.accept);

// Comments
router.post("/plans/:planId/comments",        comments.create);
router.get("/plans/:planId/comments",         comments.list);
router.put("/comments/:commentId/resolve",    comments.toggleResolve);

module.exports = router;
