import { Router } from 'express';
import { getPopularSkills, getSkillSuggestions } from '../controllers/skill.controller';

export const skillRoutes = Router();
skillRoutes.get('/popular', getPopularSkills);
skillRoutes.get('/suggestions', getSkillSuggestions);
