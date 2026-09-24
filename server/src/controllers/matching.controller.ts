import { RequestHandler } from 'express';
import { Model, Types } from 'mongoose';
import { CandidateNode, bipartiteMatchingEngine } from '../services/bipartiteMatching.service';

interface SkillRecord { name?: string }
interface RatingRecord { rating: number }
interface LegacyUserRecord {
  _id: Types.ObjectId;
  name: string;
  isPublic?: boolean;
  skillsOffered?: Array<SkillRecord | string>;
  skillsWanted?: Array<SkillRecord | string>;
  reputationScore?: number;
  availableSlots?: number[];
  ratings?: RatingRecord[];
}

const User = require('../../models/User') as Model<LegacyUserRecord>;
const auth = require('../../middleware/auth') as RequestHandler;
const fields = 'name isPublic skillsOffered.name skillsWanted.name reputationScore availableSlots ratings.rating';

function skillNames(skills: Array<SkillRecord | string> | undefined): string[] {
  return (skills || []).map((skill) => typeof skill === 'string' ? skill : skill.name || '').map((skill) => skill.trim()).filter(Boolean);
}

function toCandidate(user: LegacyUserRecord): CandidateNode {
  const ratings = (user.ratings || []).map((entry) => entry.rating).filter((rating) => Number.isFinite(rating) && rating >= 0 && rating <= 5);
  const measuredReputation = ratings.length ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length : user.reputationScore ?? 5;
  return {
    userId: user._id.toString(),
    name: user.name,
    skillsOffered: skillNames(user.skillsOffered),
    skillsWanted: skillNames(user.skillsWanted),
    reputationScore: measuredReputation,
    availableSlots: (user.availableSlots || []).filter((slot) => Number.isInteger(slot) && slot >= 0 && slot <= 167),
  };
}

async function loadPublicCandidates(exceptId?: string): Promise<CandidateNode[]> {
  const query = exceptId ? { isPublic: true, _id: { $ne: new Types.ObjectId(exceptId) } } : { isPublic: true };
  const users = await User.find(query).select(fields).lean().exec() as unknown as LegacyUserRecord[];
  return users.map(toCandidate);
}

export const getAutoMatchesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const candidates = await loadPublicCandidates();
    res.json({ matches: bipartiteMatchingEngine.solveOptimalMatches(candidates) });
  } catch (error) { next(error); }
};

export const getMatchesForUserHandler: RequestHandler = async (req, res, next) => {
  try {
    const authenticatedId = String(req.user?._id || '');
    const requestedId = req.params.userId === 'me' ? authenticatedId : req.params.userId;
    if (!Types.ObjectId.isValid(requestedId)) { res.status(400).json({ message: 'Invalid user ID' }); return; }
    if (requestedId !== authenticatedId && !req.user?.isAdmin) { res.status(403).json({ message: 'You can only view your own match recommendations' }); return; }

    const targetRecord = await User.findById(requestedId).select(fields).lean().exec() as unknown as LegacyUserRecord | null;
    if (!targetRecord || (targetRecord.isPublic === false && requestedId !== authenticatedId)) { res.status(404).json({ message: 'User not found' }); return; }
    const target = toCandidate(targetRecord);
    const candidates = await loadPublicCandidates(requestedId);
    const matches = candidates.flatMap((candidate) => {
      const trade = bipartiteMatchingEngine.findMutualTrade(target, candidate);
      if (!trade) return [];
      const affinity = bipartiteMatchingEngine.calculateAffinity(target, candidate);
      return [{
        userA: { id: target.userId, name: target.name, teaches: trade.skillAtoB },
        userB: { id: candidate.userId, name: candidate.name, teaches: trade.skillBtoA },
        affinityScore: affinity.score,
        overlappingSlotsCount: affinity.overlappingSlots.length,
        overlappingSlots: affinity.overlappingSlots,
      }];
    }).sort((a, b) => b.affinityScore - a.affinityScore || b.overlappingSlotsCount - a.overlappingSlotsCount || a.userB.id.localeCompare(b.userB.id));
    res.json({ targetUserId: target.userId, matches });
  } catch (error) { next(error); }
};

export const matchingAuth = auth;
