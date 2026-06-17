/**
 * Global Jest setup — runs ONCE before all test files.
 *
 *   1. Boot mongodb-memory-server, set MONGO_URI to its connection string
 *   2. Set test-mode env vars so index.js skips auto-boot + crash-guards
 *   3. Stash the mongo instance in global so teardown can stop it cleanly
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Test-mode env vars
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';                       // suppress noisy info logs
  process.env.JWT_SECRET = 'test_jwt_secret_for_jest';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_jest';
  process.env.CLIENT_URL = 'http://localhost:3000';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
  process.env.RAZORPAY_KEY_SECRET = 'dummy_secret';
  process.env.TRUST_PROXY = '0';                          // no proxy hops in tests

  // Boot in-memory MongoDB
  const mongo = await MongoMemoryServer.create({
    binary: { version: '7.0.0' },
    instance: { dbName: 'vastuverse_test' },
  });
  process.env.MONGO_URI = mongo.getUri('vastuverse_test');

  // Stash for teardown
  globalThis.__MONGO__ = mongo;

  console.log(`[jest] mongodb-memory-server up at ${process.env.MONGO_URI}`);
};
