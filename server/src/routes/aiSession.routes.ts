import { RequestHandler, Router } from 'express';
import { Server } from 'socket.io';
import { createAISessionRouter } from '../controllers/aiSession.controller';
import { aiRateLimiter } from '../middleware/rateLimiter';

const auth = require('../../middleware/auth') as RequestHandler;

export function createAISessionRoutes(io: Server): Router {
  const router = Router();
  router.use(auth);
  router.use(aiRateLimiter);
  router.use(createAISessionRouter(io));
  return router;
}
