/**
 * Socket.io configuration.
 *
 * - JWT auth on handshake (token in auth.token or query.token)
 * - Each socket joins room `user:{userId}` on connect
 * - Redis adapter wired when available, so multiple API instances can fan
 *   out emits across the cluster
 *
 * Public API:
 *   init(httpServer)   — attaches Socket.io to the HTTP server. Idempotent.
 *   getIO()            — returns the initialised Server (or null pre-init)
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

async function init(httpServer) {
  if (io) return io;

  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  io = new Server(httpServer, {
    cors: { origin: CLIENT_URL, credentials: true },
    transports: ['websocket', 'polling'],
  });

  /* ─── Redis adapter (best effort) ──────────────────────────────── */
  try {
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const Redis = require('ioredis');
      const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
      const pubClient = new Redis(url, { maxRetriesPerRequest: null });
      pubClient.on('error', (err) => console.error('[socket] redis pub error:', err.message));
      const subClient = pubClient.duplicate();
      subClient.on('error', (err) => console.error('[socket] redis sub error:', err.message));
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[socket] redis adapter attached');
    }
  } catch (e) {
    console.warn('[socket] redis adapter unavailable, falling back to in-memory:', e.message);
  }

  /* ─── JWT auth on handshake ────────────────────────────────────── */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = payload.userId;
      socket.userRole = payload.role;
      socket.userTier = payload.tier;
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    if (socket.userRole === 'architect') {
      socket.join('architects'); // marketplace broadcast room
    }
    socket.emit('connected', { userId: socket.userId, role: socket.userRole });

    /* ─── Subscribe to a plan's collaboration rooms ────────────────
     * Client emits: socket.emit('plan:subscribe', { planId, channels: ['comments','status'] })
     * We confirm the user owns or is a collaborator on the plan, then
     * join the requested sub-rooms. Returns ack {ok:true|false}.
     */
    socket.on('plan:subscribe', async ({ planId, channels } = {}, ack) => {
      try {
        if (!planId) { ack?.({ ok: false, error: 'planId_required' }); return; }
        const Plan = require('../models/Plan');
        const Collaborator = require('../models/Collaborator');
        const plan = await Plan.findById(planId).select('userId').lean();
        if (!plan) { ack?.({ ok: false, error: 'plan_not_found' }); return; }

        let authorised = String(plan.userId) === String(socket.userId);
        if (!authorised) {
          const collab = await Collaborator.findOne({
            planId, userId: socket.userId, inviteStatus: 'accepted',
          }).lean();
          authorised = !!collab;
        }
        if (!authorised) { ack?.({ ok: false, error: 'forbidden' }); return; }

        const allowed = ['comments', 'status'];
        const joined = [];
        (Array.isArray(channels) ? channels : allowed).forEach((c) => {
          if (allowed.includes(c)) {
            socket.join(`plan:${planId}:${c}`);
            joined.push(c);
          }
        });
        ack?.({ ok: true, joined });
      } catch (e) {
        ack?.({ ok: false, error: 'subscribe_failed' });
      }
    });

    socket.on('plan:unsubscribe', ({ planId, channels } = {}) => {
      if (!planId) return;
      const allowed = ['comments', 'status'];
      (Array.isArray(channels) ? channels : allowed).forEach((c) => {
        if (allowed.includes(c)) socket.leave(`plan:${planId}:${c}`);
      });
    });

    socket.on('disconnect', () => { /* nothing for now */ });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { init, getIO };
