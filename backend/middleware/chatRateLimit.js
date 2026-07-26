const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';
const WINDOW_MS = 15 * 60 * 1000;
const MAX = isDev ? 300 : 30;

/**
 * Tighter limiter for expensive chat endpoints (Claude/Ollama).
 * Keyed by authenticated user id when available.
 * Exposes Retry-After for the client.
 */
const chatRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?._id) return String(req.user._id);
    return req.ip || 'anonymous';
  },
  handler: (req, res, _next, options) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSec = resetTime
      ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
      : Math.max(1, Math.ceil(WINDOW_MS / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(options.statusCode).json({
      success: false,
      message: 'חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.',
      retryAfterSec,
    });
  },
});

module.exports = { chatRateLimiter };
