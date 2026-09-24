import { Router } from 'express';
import { getAutoMatchesHandler, getMatchesForUserHandler, matchingAuth } from '../controllers/matching.controller';

export const matchingRoutes = Router();
matchingRoutes.get('/auto-match', matchingAuth, getAutoMatchesHandler);
matchingRoutes.get('/user/:userId', matchingAuth, getMatchesForUserHandler);
