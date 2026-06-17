import { Routes, Route, Navigate } from 'react-router-dom';

import ArchitectDashboard from './ArchitectDashboard';

/**
 * Architect workspace router shell.
 *   /architect           → dashboard
 *   /architect/dashboard → dashboard
 *
 * Future: /architect/bids, /architect/reviews/:id (review submission form), /architect/profile
 */
export default function ArchitectHome() {
  return (
    <Routes>
      <Route path="" element={<ArchitectDashboard />} />
      <Route path="dashboard" element={<ArchitectDashboard />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
