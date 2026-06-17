/**
 * Per-test-file setup. Runs in each Jest worker AFTER the global setup
 * has booted mongodb-memory-server.
 *
 *   - afterEach: clears all collections (test isolation)
 *   - afterAll:  closes the mongoose connection
 *
 * Tests can override beforeEach themselves if they need a specific
 * seeded state — those run BEFORE this file's afterEach.
 */

const mongoose = require('mongoose');

afterEach(async () => {
  // Don't trip if the test never opened a connection (rare but possible)
  if (mongoose.connection.readyState !== 1) return;

  // Empty every collection but keep indexes intact.
  // dropDatabase() would be cleaner but indexes have to rebuild then,
  // costing ~50ms per test which compounds quickly.
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
