import { Router, RequestHandler } from 'express';
import { updateAvailabilityHandler } from '../controllers/user.controller';

const auth = require('../../middleware/auth') as RequestHandler;
export const userRoutes = Router();
userRoutes.put('/availability', auth, updateAvailabilityHandler);
