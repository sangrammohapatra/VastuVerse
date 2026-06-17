import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard.
 *   - while AuthContext is doing its mount-time refresh check  → spinner
 *   - if the user is not authenticated                          → redirect to /login
 *   - if `requireRole` is set and the user's role is excluded   → redirect to /dashboard
 *   - otherwise render children
 *
 * Usage:
 *   <ProtectedRoute>            <Page/>            </ProtectedRoute>
 *   <ProtectedRoute requireRole={['developer']}> <Page/> </ProtectedRoute>
 */
export default function ProtectedRoute({ children, requireRole }) {
  const { isAuthenticated, loading, user, sessionExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, sessionExpired: sessionExpired || undefined }}
        replace
      />
    );
  }

  if (
    requireRole &&
    Array.isArray(requireRole) &&
    user?.role &&
    !requireRole.includes(user.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
