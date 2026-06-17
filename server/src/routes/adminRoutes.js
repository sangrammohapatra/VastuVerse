/**
 * Admin routes — mounted at /api/v1/admin.
 *
 * Every endpoint is gated by requireRole('admin'); a non-admin token gets a
 * 403 forbidden_role response.
 */

const express = require('express');

const { authenticateToken, requireRole } = require('../middlewares/auth');

const users        = require('../controllers/admin/usersController');
const analytics    = require('../controllers/admin/analyticsController');
const aiMon        = require('../controllers/admin/aiMonitoringController');
const content      = require('../controllers/admin/contentController');
const flags        = require('../controllers/admin/featureFlagsController');
const subs         = require('../controllers/admin/subscriptionsController');
const plans        = require('../controllers/admin/plansController');
const storage      = require('../controllers/admin/storageSettingsController');
const tierLimits   = require('../controllers/admin/tierLimitsController');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

/* ── Dashboard analytics + audit logs ────────────────────────────── */
router.get('/analytics',   analytics.getAnalytics);
router.get('/audit-logs',  analytics.listAuditLogs);

/* ── Plans ────────────────────────────────────────────────────────── */
router.get('/plans',                          plans.listPlans);
router.put('/plans/:planId/archive',          plans.archivePlan);

/* ── Users + architect verification ──────────────────────────────── */
router.get('/users',                          users.listUsers);
router.put('/users/:userId',                  users.updateUser);
router.post('/users/:userId/grant-tier',      users.grantTier);
router.get('/users/search',                   flags.searchUsers);   // for feature-flag autocomplete

router.get('/architect-verifications',                  users.listArchitectVerifications);
router.put('/architects/:userId/verify',                users.verifyArchitect);
router.put('/architects/:userId/suspend',               users.suspendArchitect);

/* ── Subscriptions + payments + marketplace overview ─────────────── */
router.get('/subscriptions',                   subs.listSubscriptions);
router.post('/subscriptions/:userId/revoke',   subs.revokeSubscription);
router.get('/payments',                        subs.listPayments);
router.get('/marketplace/overview',            subs.listMarketplaceOverview);
router.get('/marketplace/commission',          subs.getCommissionConfig);

/* ── AI monitoring ────────────────────────────────────────────────── */
router.get('/ai-monitoring',                   aiMon.getMonitoring);

/* ── Content: cost datasets + municipal rules ────────────────────── */
router.get('/cost-datasets',                   content.listCostDatasets);
router.put('/cost-datasets/:id',               content.updateCostDataset);
router.delete('/cost-datasets/:id',            content.deleteCostDataset);
// CSV import accepts text/csv directly OR { csv } in application/json
router.post('/cost-datasets/import',
  express.text({ type: 'text/csv', limit: '2mb' }),
  content.importCostDatasetsCsv
);

router.get('/municipal-rules',                 content.listMunicipalRules);
router.post('/municipal-rules',                content.upsertMunicipalRule);
router.delete('/municipal-rules/:id',          content.deleteMunicipalRule);

/* ── AI generation tier limits ───────────────────────────────────── */
router.get('/tier-limits',  tierLimits.getLimits);
router.put('/tier-limits',  tierLimits.saveLimits);

/* ── Storage provider settings ───────────────────────────────────── */
router.get('/storage-settings',        storage.getSettings);
router.put('/storage-settings',        storage.saveSettings);
router.post('/storage-settings/test',  storage.testConnection);

/* ── Feature flags ────────────────────────────────────────────────── */
router.get('/feature-flags',                                  flags.listFlags);
router.put('/feature-flags',                                  flags.upsertFlag);
router.post('/feature-flags/:featureName/user-override',      flags.setUserOverride);
router.delete('/feature-flags/:featureName/user-override',    flags.removeUserOverride);

module.exports = router;
