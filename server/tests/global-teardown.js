/**
 * Global Jest teardown — runs ONCE after all test files complete.
 *
 *   - Disconnect mongoose (defensive; should already be done in afterAll hooks)
 *   - Stop the in-memory MongoDB server
 */

const mongoose = require('mongoose');

module.exports = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (_) { /* ignore — best-effort cleanup */ }

  if (globalThis.__MONGO__) {
    await globalThis.__MONGO__.stop();
    console.log('[jest] mongodb-memory-server stopped');
  }
};
