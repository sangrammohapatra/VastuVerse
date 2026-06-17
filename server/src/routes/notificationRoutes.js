/**
 * Notification + contractor routes.
 *
 *   /api/v1/notifications/*       authenticated (the bell)
 *   /api/v1/contractor/:token     PUBLIC, no auth — token gates access
 */

const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const notifications = require('../controllers/notificationController');
const contractor = require('../controllers/contractorController');

const router = express.Router();

/* ── Authenticated notification endpoints (the bell) ──────────────── */
const notifRouter = express.Router();
notifRouter.use(authenticateToken);
notifRouter.get('/',                notifications.list);
notifRouter.get('/unread-count',    notifications.unreadCount);
notifRouter.put('/read-all',        notifications.markAllRead);
notifRouter.put('/:id/read',        notifications.markRead);

/* ── Public contractor view ──────────────────────────────────────── */
const contractorRouter = express.Router();
contractorRouter.get('/:token', contractor.getContractorPlan);

router.use('/notifications', notifRouter);
router.use('/contractor',    contractorRouter);

module.exports = router;
