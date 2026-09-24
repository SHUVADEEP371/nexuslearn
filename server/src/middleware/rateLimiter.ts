import rateLimit from 'express-rate-limit';
import { createSharedRateLimitStore } from '../infra/redis';

export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  keyGenerator: (req) => {
    const userId = req.user?._id;
    return userId ? `user:${userId}` : `ip:${req.ip}`;
  },
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: 'AI generation limit reached for this window. Please wait a few minutes.',
  }),
  store: createSharedRateLimitStore('nexuslearn:ai:15m:', true),
});
