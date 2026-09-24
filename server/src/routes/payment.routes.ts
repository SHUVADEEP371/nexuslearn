import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { createSharedRateLimitStore } from '../infra/redis';
import { createPaymentOrderHandler, verifyPaymentHandler } from '../controllers/payment.controller';

const auth = require('../../middleware/auth') as RequestHandler;
const limiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false, passOnStoreError: true, store: createSharedRateLimitStore('nexuslearn:payments:') });
export const paymentRoutes = Router();
paymentRoutes.post('/create-order', auth, limiter, createPaymentOrderHandler);
paymentRoutes.post('/verify', auth, limiter, verifyPaymentHandler);
