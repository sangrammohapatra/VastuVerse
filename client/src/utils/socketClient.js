import { io } from 'socket.io-client';

/**
 * Lightweight Socket.io client wrapper.
 *
 * - Lazy connect: socket created on first getSocket() call
 * - Token can be (re)set via setAuthToken — useful after a token refresh
 * - Returns the same instance across the app
 *
 * Usage:
 *   const socket = getSocket();
 *   socket.on('generation:complete', handler);
 *   return () => socket.off('generation:complete', handler);
 */

let socket = null;
let currentToken = null;

function inferBaseUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    const port = import.meta.env?.VITE_API_PORT || 5000;
    return `${protocol}//${hostname}:${port}`;
  }
  return 'http://localhost:5000';
}

export function setAuthToken(token) {
  currentToken = token || null;
  if (socket) {
    socket.auth = { token: currentToken };
    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  }
}

export function getSocket() {
  if (socket) return socket;

  const url = import.meta.env?.VITE_API_URL || inferBaseUrl();
  socket = io(url, {
    autoConnect: !!currentToken,
    auth: { token: currentToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 6,
    reconnectionDelay: 1200,
  });

  // Connect lazily once a token is available
  if (!currentToken) {
    const tryConnect = () => {
      if (currentToken && !socket.connected) {
        socket.auth = { token: currentToken };
        socket.connect();
      }
    };
    // small poller — gives AuthContext time to mount and set the token
    const t = setInterval(() => {
      if (currentToken) { tryConnect(); clearInterval(t); }
    }, 250);
    setTimeout(() => clearInterval(t), 10000);
  }

  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
