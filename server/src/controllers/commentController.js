/**
 * Comment controller.
 *
 *   POST /api/v1/plans/:planId/comments               (create — root or reply)
 *   GET  /api/v1/plans/:planId/comments               (cursor-paginated list)
 *   PUT  /api/v1/comments/:commentId/resolve          (toggle resolved)
 *
 * Cursor: opaque base64 of `{ ts, id }` of the newest item already seen.
 * Sort order is newest-first; passing `before=<cursor>` returns older items.
 *
 * Socket fanout: every successful write emits to `plan:{planId}:comments` so
 * collaborators see the message stream in real time.
 */

const Comment = require('../models/Comment');
const Plan = require('../models/Plan');
const Collaborator = require('../models/Collaborator');
const ActivityLog = require('../models/ActivityLog');
const { getIO } = require('../config/socket');

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

/* ── Authorisation: owner or accepted collaborator can act ─────────── */

async function authorisedOnPlan(planId, userId, { commentRequired = false } = {}) {
  const plan = await Plan.findById(planId).select('userId').lean();
  if (!plan) return { ok: false, code: 'plan_not_found', status: 404 };
  if (String(plan.userId) === String(userId)) {
    return { ok: true, role: 'owner', planOwnerId: plan.userId };
  }
  const collab = await Collaborator.findOne({
    planId, userId, inviteStatus: 'accepted',
  }).lean();
  if (!collab) return { ok: false, code: 'not_a_collaborator', status: 403 };
  if (commentRequired && collab.permission === 'view') {
    return { ok: false, code: 'view_only_cannot_comment', status: 403 };
  }
  return { ok: true, role: 'collaborator', permission: collab.permission, planOwnerId: plan.userId };
}

/* ── Cursor codec ──────────────────────────────────────────────────── */

function encodeCursor(doc) {
  return Buffer.from(JSON.stringify({ ts: doc.createdAt.getTime(), id: String(doc._id) }))
    .toString('base64url');
}
function decodeCursor(c) {
  if (!c) return null;
  try {
    const o = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    return { ts: o.ts, id: o.id };
  } catch { return null; }
}

/* ── 1. Create ────────────────────────────────────────────────────── */

exports.create = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.params;
    const { content, stepName, roomId, parentId } = req.body || {};

    const auth = await authorisedOnPlan(planId, userId, { commentRequired: true });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.code });

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content_required' });
    }
    if (content.length > 4000) return res.status(400).json({ error: 'content_too_long' });

    // If a parent is named, sanity-check it belongs to the same plan
    if (parentId) {
      const parent = await Comment.findById(parentId).select('planId').lean();
      if (!parent || String(parent.planId) !== String(planId)) {
        return res.status(400).json({ error: 'parent_not_on_plan' });
      }
    }

    const doc = await Comment.create({
      planId,
      userId,
      content: content.trim(),
      stepName: stepName && stepName.match(/^step([1-9]|10)$/) ? stepName : undefined,
      roomId: typeof roomId === 'string' ? roomId.slice(0, 80) : undefined,
      parentId: parentId || null,
    });

    // Populate the author for the response + socket payload
    const author = await Comment.findById(doc._id)
      .populate('userId', 'fullName email avatarUrl')
      .lean();

    const payload = {
      id: author._id,
      planId: author.planId,
      parentId: author.parentId,
      stepName: author.stepName,
      roomId: author.roomId,
      content: author.content,
      resolved: author.resolved,
      createdAt: author.createdAt,
      author: author.userId
        ? { id: author.userId._id, fullName: author.userId.fullName, email: author.userId.email, avatarUrl: author.userId.avatarUrl }
        : null,
    };

    // Socket fanout
    try {
      const io = getIO();
      if (io) io.to(`plan:${planId}:comments`).emit('comment:created', payload);
    } catch (_) { /* non-fatal */ }

    await ActivityLog.create({
      planId, userId, action: 'comment_added',
      metadata: { commentId: doc._id, stepName: doc.stepName, isReply: !!doc.parentId },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.status(201).json({ comment: payload });
  } catch (e) { next(e); }
};

/* ── 2. List ──────────────────────────────────────────────────────── */

exports.list = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.params;

    const auth = await authorisedOnPlan(planId, userId);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.code });

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT, 1),
      PAGE_SIZE_MAX
    );
    const stepName = typeof req.query.stepName === 'string' && req.query.stepName.match(/^step([1-9]|10)$/)
      ? req.query.stepName : null;
    const cursor = decodeCursor(req.query.before);

    const q = { planId };
    if (stepName) q.stepName = stepName;
    if (cursor) q.$or = [
      { createdAt: { $lt: new Date(cursor.ts) } },
      { createdAt: new Date(cursor.ts), _id: { $lt: cursor.id } },
    ];

    const docs = await Comment.find(q)
      .populate('userId', 'fullName email avatarUrl')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore && slice.length > 0 ? encodeCursor(slice[slice.length - 1]) : null;

    res.json({
      comments: slice.map((c) => ({
        id: c._id,
        parentId: c.parentId,
        stepName: c.stepName,
        roomId: c.roomId,
        content: c.content,
        resolved: c.resolved,
        resolvedAt: c.resolvedAt,
        createdAt: c.createdAt,
        author: c.userId
          ? { id: c.userId._id, fullName: c.userId.fullName, email: c.userId.email, avatarUrl: c.userId.avatarUrl }
          : null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (e) { next(e); }
};

/* ── 3. Resolve / unresolve ───────────────────────────────────────── */

exports.toggleResolve = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { commentId } = req.params;
    const target = req.body?.resolved !== undefined ? !!req.body.resolved : true;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'comment_not_found' });

    const auth = await authorisedOnPlan(comment.planId, userId, { commentRequired: true });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.code });

    comment.resolved = target;
    comment.resolvedBy = target ? userId : null;
    comment.resolvedAt = target ? new Date() : null;
    await comment.save();

    try {
      const io = getIO();
      if (io) io.to(`plan:${comment.planId}:comments`).emit('comment:resolved', {
        id: comment._id, planId: comment.planId, resolved: comment.resolved, resolvedAt: comment.resolvedAt,
      });
    } catch (_) { /* non-fatal */ }

    await ActivityLog.create({
      planId: comment.planId, userId,
      action: 'comment_resolved',
      metadata: { commentId: comment._id, resolved: comment.resolved },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.json({ ok: true, id: comment._id, resolved: comment.resolved, resolvedAt: comment.resolvedAt });
  } catch (e) { next(e); }
};
