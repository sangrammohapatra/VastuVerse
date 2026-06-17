import { Component } from 'react';
import { Box, Stack, Typography, Button, Card, Collapse } from '@mui/material';

import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import EmptyState from './EmptyState';

/**
 * Top-level error boundary.
 *
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<MyCustomFallback />}>
 *     <RiskySubtree />
 *   </ErrorBoundary>
 *
 * Catches synchronous render errors AND lifecycle errors in the React
 * tree below it. Does NOT catch:
 *   - Errors in event handlers (those go to window.onerror)
 *   - Errors in setTimeout / async code (window.onerror too)
 *   - SSR errors (server-side, not relevant in CSR app)
 *
 * Logs to console in dev; in production should report to Sentry/Datadog.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  // React's official lifecycle method for capturing render errors
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Dev: log to console with full stack
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, errorInfo);
    }

    // Production: report to error tracking (Sentry/Datadog/Rollbar)
    if (typeof window !== 'undefined' && window.Sentry) {
      try {
        window.Sentry.captureException(error, {
          contexts: { react: { componentStack: errorInfo?.componentStack } },
        });
      } catch (_) { /* never let reporting fail the fallback render */ }
    }

    // Allow parent to react (analytics, store cleanup, etc.)
    this.props.onError?.(error, errorInfo);
  }

  handleReload = () => {
    // Hard reload — clears any corrupted in-memory state (Redux store,
    // React Query cache, etc.) and re-fetches the JS bundle in case a
    // deploy mid-session caused a chunk-load error.
    window.location.reload();
  };

  handleGoHome = () => {
    // SPA navigation back to root. Cheaper than reload if the error is
    // confined to one route.
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Custom fallback wins
    if (this.props.fallback) return this.props.fallback;

    const { error, errorInfo, showDetails } = this.state;
    const isChunkLoadError = error?.name === 'ChunkLoadError'
      || /Loading chunk \d+ failed/i.test(error?.message || '');

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'background.default',
          p: { xs: 2, md: 4 },
        }}
      >
        <Card
          elevation={0}
          sx={{
            maxWidth: 560,
            width: '100%',
            p: { xs: 3, md: 5 },
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <EmptyState
            illustration="error"
            title={isChunkLoadError ? 'A new version is available' : 'Something went wrong'}
            description={
              isChunkLoadError
                ? 'The app was updated while you were here. Reload to get the latest version.'
                : "We hit an unexpected error rendering this page. The team has been notified."
            }
            primaryAction={{
              label: 'Reload',
              icon: <RefreshIcon />,
              onClick: this.handleReload,
            }}
            secondaryAction={{
              label: 'Back to home',
              icon: <HomeIcon />,
              onClick: this.handleGoHome,
            }}
            size="medium"
          />

          {/* Diagnostic details — dev only, behind a disclosure */}
          {import.meta.env.DEV && error && (
            <Box sx={{ mt: 3, pt: 3, borderTop: (t) => `1px dashed ${t.palette.divider}` }}>
              <Button
                size="small"
                onClick={this.toggleDetails}
                startIcon={<ReportProblemIcon />}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                {showDetails ? 'Hide' : 'Show'} technical details
              </Button>
              <Collapse in={showDetails}>
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                      ERROR
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontSize: '0.72rem',
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        background: (t) => t.palette.action.hover,
                        p: 1.5, borderRadius: 1.5,
                        overflow: 'auto',
                        maxHeight: 160,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'error.main',
                      }}
                    >
                      {error.toString()}
                      {error.stack ? `\n\n${error.stack}` : ''}
                    </Box>
                  </Box>
                  {errorInfo?.componentStack && (
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.6 }}>
                        COMPONENT STACK
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          fontSize: '0.72rem',
                          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                          background: (t) => t.palette.action.hover,
                          p: 1.5, borderRadius: 1.5,
                          overflow: 'auto',
                          maxHeight: 160,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {errorInfo.componentStack}
                      </Box>
                    </Box>
                  )}
                </Stack>
              </Collapse>
            </Box>
          )}
        </Card>
      </Box>
    );
  }
}

export default ErrorBoundary;
