/**
 * Notification controller — backs the NotificationBell component.
 *
 *   GET    /api/v1/notifications              list (cursor paginated)
 *   GET    /api/v1/notifications/unread-count badge number
 *   PUT    /api/v1/notifications/:id/read     mark single
 *   PUT    /api/v1/notifications/read-all     mark all
 */

const Notification = require('../models/Notification');

exports.list = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const filter = { userId: req.user.userId };

    // Cursor: notifications older than this createdAt
    if (req.query.before) {
      const d = new Date(req.query.before);
      if (!isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }
    if (req.query.unreadOnly === 'true') filter.read = false;

    const rows = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;

    res.json({
      notifications: rows.map((n) => ({
        id: n._id,
        event: n.event,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl,
        data: n.data,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      nextCursor,
    });
  } catch (e) { next(e); }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.userId, read: false });
    res.json({ count });
  } catch (e) { next(e); }
};

exports.markRead = async (req, res, next) => {
  try {
    const result = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'notification_not_found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ ok: true, marked: result.modifiedCount });
  } catch (e) { next(e); }
};
