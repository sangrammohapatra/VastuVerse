/**
 * Jest configuration for VastuVerse API.
 *
 * Tests run against:
 *   - In-memory MongoDB (mongodb-memory-server) — fast, ephemeral
 *   - ioredis-mock (no real Redis needed)
 *   - SMTP via nodemailer jsonTransport (logs payload, doesn't send)
 *
 * Suite tags:
 *   tests/*.test.js                 — unit + integration (this config)
 *   tests/e2e/*.test.js             — end-to-end (separate config, run rarely)
 *
 * Run with:
 *   npm test                        — all
 *   npm test -- auth                — pattern match
 *   npm test -- --coverage          — with coverage report
 */

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],

  // Global setup loads mongo + sets env vars BEFORE any test imports run
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js',

  // Per-test-file setup loads inside each worker (e.g. mocking nodemailer)
  setupFilesAfterEach: ['<rootDir>/tests/setup.js'],

  // Force sequential because rate-limit / shared mongo state would
  // collide otherwise. Override with --maxWorkers if individual suites
  // can be parallelized.
  maxWorkers: 1,

  // 15s — Mongo memory boot + initial connect can take ~5s on cold CI
  testTimeout: 15000,

  // Coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/passport.js',           // external OAuth flow, hard to mock
    '!src/queues/aiGenerationQueue.js',  // requires Redis worker; covered by e2e
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },

  // Don't truncate diffs — easier to debug 400-byte HTTP responses
  verbose: true,
};
