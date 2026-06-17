/**
 * Wrap an async Express route handler so rejected promises forward to next().
 *
 * Without this every async controller needs a try/catch that calls next(e).
 * With this it's enough to:
 *
 *   const asyncHandler = require('../utils/asyncHandler');
 *   router.get('/users', asyncHandler(async (req, res) => {
 *     const users = await User.find();
 *     res.json({ users });
 *   }));
 *
 * Throwing or rejecting inside the handler bubbles up to errorHandler.js.
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
