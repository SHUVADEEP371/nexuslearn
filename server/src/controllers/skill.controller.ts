import { RequestHandler } from 'express';
import { Model } from 'mongoose';
import { z } from 'zod';

interface SkillRecord { name: string }
interface PublicUserSkills { skillsOffered: SkillRecord[]; skillsWanted: SkillRecord[] }
const User = require('../../models/User') as Model<PublicUserSkills>;
const querySchema = z.string().trim().min(2).max(80);

export const getPopularSkills: RequestHandler = async (_req, res, next) => {
  try {
    const users = await User.find({ isPublic: true }).select('skillsOffered.name skillsWanted.name').lean().exec();
    const counts = new Map<string, { name: string; offered: number; wanted: number }>();
    for (const user of users) {
      for (const skill of user.skillsOffered || []) {
        const key = skill.name.trim().toLocaleLowerCase('en-US');
        if (!key) continue;
        const count = counts.get(key) || { name: skill.name.trim(), offered: 0, wanted: 0 };
        count.offered += 1; counts.set(key, count);
      }
      for (const skill of user.skillsWanted || []) {
        const key = skill.name.trim().toLocaleLowerCase('en-US');
        if (!key) continue;
        const count = counts.get(key) || { name: skill.name.trim(), offered: 0, wanted: 0 };
        count.wanted += 1; counts.set(key, count);
      }
    }
    res.json([...counts.values()].map((skill) => ({ ...skill, total: skill.offered + skill.wanted }))
      .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name)).slice(0, 20));
  } catch (error) { next(error); }
};

export const getSkillSuggestions: RequestHandler = async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query.q);
    if (!parsed.success) { res.json([]); return; }
    const needle = parsed.data.toLocaleLowerCase('en-US');
    const users = await User.find({ isPublic: true }).select('skillsOffered.name skillsWanted.name').lean().exec();
    const suggestions = new Map<string, string>();
    for (const user of users) for (const skill of [...(user.skillsOffered || []), ...(user.skillsWanted || [])]) {
      const normalized = skill.name.trim().toLocaleLowerCase('en-US');
      if (normalized.includes(needle)) suggestions.set(normalized, skill.name.trim());
    }
    res.json([...suggestions.values()].sort((a, b) => a.localeCompare(b)).slice(0, 10));
  } catch (error) { next(error); }
};
