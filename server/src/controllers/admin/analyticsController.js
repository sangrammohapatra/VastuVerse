/**
 * Admin KPI analytics.
 *
 *   GET /admin/analytics
 *     → {
 *         activeUsers, newUsersThisWeek, totalUsers,
 *         plansByStatus: [{ name, value, color }],
 *         revenueThisMonthPaise, revenueByMonth: [{ month, paise }],
 *         aiGenerationsToday,
 *         subsByTier: [{ tier, count }],
 *         generationsByDay: [{ day, count }]   // last 24h, hourly buckets
 *       }
 *
 * Heavy aggregates are cached in Redis for 60s to keep the dashboard snappy.
 */

const User = require('../../models/User');
const Plan = require('../../models/Plan');
const Subscription = require('../../models/Subscription');
const Payment = require('../../models/Payment');
const ActivityLog = require('../../models/ActivityLog');
const redis = require('../../config/redis');

const CACHE_KEY = 'admin:analytics:v1';
const CACHE_TTL = 60; // seconds

const STATUS_COLORS = {
  DRAFT:       '#9E9E9E',
  IN_PROGRESS: '#FF6F00',
  COMPLETED:   '#2E7D32',
  ARCHIVED:    '#616161',
};

function startOfDayUTC() {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d;
}
function startOfMonthUTC() {
  const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d;
}
function daysAgoUTC(n) {
  const d = startOfDayUTC(); d.setUTCDate(d.getUTCDate() - n); return d;
}

exports.getAnalytics = async (req, res, next) => {
  try {
    // Cache lookup
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json({ ...JSON.parse(cached), cached: true });
    } catch (_) { /* fall through */ }

    const now = new Date();
    const weekAgo  = daysAgoUTC(7);
    const monthStart = startOfMonthUTC();
    const dayStart   = startOfDayUTC();

    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      plansByStatusAgg,
      revenueThisMonthAgg,
      revenueByMonthAgg,
      aiGenerationsTodayAgg,
      subsByTierAgg,
      generationsLast24hAgg,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Plan.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'captured', type: { $in: ['subscription', 'pay_per_plan', '3d_unlock', 'marketplace_bid'] }, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'captured', createdAt: { $gte: daysAgoUTC(180) } } },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            paise: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      ActivityLog.aggregate([
        { $match: {
            action: { $in: ['plan_created', 'step_completed', '3d_unlocked', 'review_submitted'] },
            createdAt: { $gte: dayStart },
        } },
        { $count: 'count' },
      ]),
      Subscription.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } },
      ]),
      // Last 24h hourly bucket — uses $hour grouping
      ActivityLog.aggregate([
        { $match: { action: { $in: ['plan_created', 'step_completed'] }, createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Shape the 24h generations into a continuous series (zero-fill missing hours)
    const series = [];
    const byHour = Object.fromEntries(generationsLast24hAgg.map((r) => [r._id, r.count]));
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3600 * 1000);
      d.setUTCMinutes(0, 0, 0);
      const key = d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:\d{2}Z$/, ':00:00Z');
      series.push({
        hour: d.getUTCHours().toString().padStart(2, '0') + ':00',
        count: byHour[key] || 0,
      });
    }

    const payload = {
      activeUsers, newUsersThisWeek, totalUsers,
      plansByStatus: plansByStatusAgg.map((s) => ({
        name: s._id || 'UNKNOWN',
        value: s.count,
        color: STATUS_COLORS[s._id] || '#9E9E9E',
      })),
      revenueThisMonthPaise: revenueThisMonthAgg[0]?.total || 0,
      revenueByMonth: revenueByMonthAgg.map((r) => ({
        month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`,
        paise: r.paise,
      })),
      aiGenerationsToday: aiGenerationsTodayAgg[0]?.count || 0,
      subsByTier: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].map((t) => ({
        tier: t,
        count: subsByTierAgg.find((r) => r._id === t)?.count || 0,
      })),
      generationsByHour: series,
      generatedAt: now.toISOString(),
    };

    try { await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL); } catch (_) { /* ignore */ }

    res.json(payload);
  } catch (e) { next(e); }
};

/* ── Audit log list ───────────────────────────────────────────────── */

const { ACTIONS } = require('../../models/ActivityLog');

exports.listAuditLogs = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const q = {};
    if (req.query.action && ACTIONS.includes(req.query.action)) {
      q.action = req.query.action;
    }
    if (req.query.userId) {
      q.userId = req.query.userId;
    }
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   q.createdAt.$lte = new Date(new Date(req.query.to).setHours(23, 59, 59, 999));
    }

    const [rows, total] = await Promise.all([
      ActivityLog.find(q)
        .populate('userId', 'email fullName avatarUrl')
        .populate('planId', 'title')
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(q),
    ]);

    res.json({
      rows: rows.map(r => ({
        id:        String(r._id),
        action:    r.action,
        user:      r.userId ? { id: String(r.userId._id), email: r.userId.email, fullName: r.userId.fullName, avatarUrl: r.userId.avatarUrl } : null,
        plan:      r.planId ? { id: String(r.planId._id), title: r.planId.title } : null,
        metadata:  r.metadata || {},
        ipAddress: r.ipAddress || null,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
      actions: ACTIONS,
    });
  } catch (e) { next(e); }
};
