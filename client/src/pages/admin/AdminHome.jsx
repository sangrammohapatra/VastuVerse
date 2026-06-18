import { Routes, Route } from 'react-router-dom';

import AdminLayout from '../../layouts/AdminLayout';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminSubscriptions from './AdminSubscriptions';
import AdminMarketplace from './AdminMarketplace';
import AdminAIMonitoring from './AdminAIMonitoring';
import AdminContent from './AdminContent';
import AdminFeatureFlags from './AdminFeatureFlags';
import AdminPlans from './AdminPlans';
import AdminAuditLogs from './AdminAuditLogs';
import AdminStorageSettings from './AdminStorageSettings';
import AdminAISettings from './AdminAISettings';

/**
 * Admin router shell. AdminLayout renders the sidebar + Outlet.
 *
 *   /admin                  → Dashboard
 *   /admin/users            → User mgmt (with architect queue tab)
 *   /admin/plans            → Plans table
 *   /admin/subscriptions    → Subscriptions + payments
 *   /admin/marketplace      → Requests + bids + commission config
 *   /admin/ai-monitoring    → Provider config + queue depth + recent failures
 *   /admin/content          → Cost datasets + municipal rules
 *   /admin/feature-flags    → Tier×Feature matrix + per-user overrides
 *   /admin/audit-logs       → Activity log viewer
 *   /admin/storage-settings → S3 bucket config + usage stats
 */
export default function AdminHome() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index               element={<AdminDashboard />} />
        <Route path="users"        element={<AdminUsers />} />
        <Route path="plans"        element={<AdminPlans />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="marketplace"  element={<AdminMarketplace />} />
        <Route path="ai-monitoring" element={<AdminAIMonitoring />} />
        <Route path="content"      element={<AdminContent />} />
        <Route path="feature-flags" element={<AdminFeatureFlags />} />
        <Route path="audit-logs"      element={<AdminAuditLogs />} />
        <Route path="storage-settings" element={<AdminStorageSettings />} />
        <Route path="ai-settings"      element={<AdminAISettings />} />
      </Route>
    </Routes>
  );
}
