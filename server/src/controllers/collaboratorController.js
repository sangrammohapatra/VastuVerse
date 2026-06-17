/**
 * Collaborator controller.
 *
 *   POST   /api/v1/plans/:planId/collaborators          (invite)
 *   GET    /api/v1/plans/:planId/collaborators          (list)
 *   DELETE /api/v1/plans/:planId/collaborators/:id      (revoke)
 *   GET    /api/v1/invites/:token                       (accept — authed; binds userId)
 *
 * Token model: a 24-byte URL-safe token is generated server-side, hashed with
 * SHA-256, and only the hash is persisted. The raw token is emailed once and
 * never returned through any API after creation.
 */

const crypto = require('crypto');

const Collaborator = require('../models/Collaborator');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { sendInviteEmail } = require('../config/mailer');
const { getIO } = require('../config/socket');

const INVITE_TTL_MS = 14 * 24 * 3600 * 1000; // 14 days

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function assertPlanOwner(planId, userId, res) {
  const plan = await Plan.findOne({ _id: planId, userId }).select('_id title');
  if (!plan) { res.status(404).json({ error: 'plan_not_found' }); return null; }
  return plan;
}

/* ── 1. Invite ─────────────────────────────────────────────────────── */

exports.invite = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.params;
    const { email, permission = 'view' } = req.body || {};

    const plan = await assertPlanOwner(planId, userId, res);
    if (!plan) return;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email_required' });
    }
    if (!['view', 'comment', 'edit'].includes(permission)) {
      return res.status(400).json({ error: 'invalid_permission' });
    }
    const clean = email.trim().toLowerCase();

    // Reject inviting yourself
    const inviter = await User.findById(userId).select('email fullName').lean();
    if (inviter?.email === clean) {
      return res.status(400).json({ error: 'cannot_invite_self' });
    }

    // Reuse the row if an invite already exists for this (plan, email) — refresh token & status
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const update = {
      planId,
      invitedBy: userId,
      email: clean,
      permission,
      inviteStatus: 'pending',
      inviteToken: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    };

    let collab;
    try {
      collab = await Collaborator.findOneAndUpdate(
        { planId, email: clean },
        { $set: update },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'duplicate_invite' });
      throw e;
    }

    // Email — best effort; failure does not roll back the invite (the caller can resend)
    const inviteUrl = `${(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/invites/${rawToken}`;
    sendInviteEmail({
      to: clean,
      inviterName: inviter?.fullName || inviter?.email || 'A VastuVerse user',
      planTitle: plan.title,
      inviteUrl,
      permission,
    }).catch((e) => console.warn('[invite-email]', e.message));

    res.status(201).json({
      collaboratorId: collab._id,
      email: clean,
      permission,
      inviteStatus: 'pending',
      expiresAt: collab.expiresAt,
      // Raw token returned only here so the calling UI can show a "copy invite link" fallback.
      inviteUrl,
    });
  } catch (e) { next(e); }
};

/* ── 2. List ──────────────────────────────────────────────────────── */

exports.list = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.params;
    const plan = await assertPlanOwner(planId, userId, res);
    if (!plan) return;

    const rows = await Collaborator.find({ planId })
      .populate('userId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      collaborators: rows.map((r) => ({
        id: r._id,
        email: r.email,
        permission: r.permission,
        inviteStatus: r.inviteStatus,
        acceptedAt: r.acceptedAt,
        expiresAt: r.expiresAt,
        user: r.userId
          ? { id: r.userId._id, fullName: r.userId.fullName, email: r.userId.email, avatarUrl: r.userId.avatarUrl }
          : null,
      })),
    });
  } catch (e) { next(e); }
};

/* ── 3. Revoke ────────────────────────────────────────────────────── */

exports.revoke = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId, id } = req.params;
    const plan = await assertPlanOwner(planId, userId, res);
    if (!plan) return;

    const updated = await Collaborator.findOneAndUpdate(
      { _id: id, planId },
      { $set: { inviteStatus: 'revoked' } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'collaborator_not_found' });

    res.json({ ok: true, id: updated._id, inviteStatus: 'revoked' });
  } catch (e) { next(e); }
};

/* ── 4. Accept invite ─────────────────────────────────────────────── */

exports.accept = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'token_required' });

    const invite = await Collaborator.findOne({ inviteToken: hashToken(token) })
      .select('+inviteToken planId email permission inviteStatus expiresAt invitedBy')
      .populate('planId', 'title userId');
    if (!invite) return res.status(404).json({ error: 'invite_not_found' });

    if (invite.inviteStatus === 'revoked') return res.status(410).json({ error: 'invite_revoked' });
    if (invite.inviteStatus === 'declined') return res.status(410).json({ error: 'invite_declined' });
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(410).json({ error: 'invite_expired' });
    }

    // Confirm the accepting user's email matches the invite email
    const user = await User.findById(userId).select('email').lean();
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (user.email.toLowerCase() !== invite.email) {
      return res.status(403).json({ error: 'email_mismatch' });
    }

    invite.inviteStatus = 'accepted';
    invite.acceptedAt = new Date();
    invite.userId = userId;
    invite.inviteToken = undefined; // clear hashed token once accepted
    await invite.save();

    // Notify the plan owner (and other collaborators) via socket
    try {
      const io = getIO();
      if (io && invite.planId) {
        io.to(`plan:${invite.planId._id}:status`).emit('collaborator:joined', {
          planId: invite.planId._id,
          userId,
          email: invite.email,
          permission: invite.permission,
        });
      }
    } catch (_) { /* non-fatal */ }

    res.json({
      planId: invite.planId?._id || invite.planId,
      planTitle: invite.planId?.title,
      permission: invite.permission,
    });
  } catch (e) { next(e); }
};
