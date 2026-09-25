import { RequestHandler, Router } from 'express';
import { Server } from 'socket.io';
import { createAISessionRouter } from '../controllers/aiSession.controller';
import { recommendSkills } from '../controllers/ai.controller';
import { aiRateLimiter } from '../middleware/rateLimiter';

const auth = require('../../middleware/auth') as RequestHandler;

export function createAISessionRoutes(io: Server): Router {
  const router = Router();
  router.use(auth);
  router.use(aiRateLimiter);
  router.post('/recommend-skills', recommendSkills);
  router.use(createAISessionRouter(io));
  return router;
}
