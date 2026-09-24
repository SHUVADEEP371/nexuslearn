import { Router, RequestHandler, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ClientSession, Model, Types } from 'mongoose';
import { z } from 'zod';
import { RefreshToken } from '../models/refreshToken.model';
import { createSharedRateLimitStore } from '../infra/redis';

interface LegacyUserRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  comparePassword(candidate: string): Promise<boolean>;
  save(options?: { session?: ClientSession }): Promise<LegacyUserRecord>;
  getPublicProfile(): Record<string, unknown>;
}
const User = require('../../models/User') as Model<LegacyUserRecord>;
const legacyAuth = require('../../middleware/auth') as RequestHandler;
export const authRouter = Router();
const credentialLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, store: createSharedRateLimitStore('nexuslearn:auth:') });
const credentialsSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(6).max(128) }).strict();
const registrationSchema = credentialsSchema.extend({ name: z.string().trim().min(2).max(80) }).strict();
const refreshCookieName = 'nexuslearn_refresh';
const refreshDurationMs = 30 * 24 * 60 * 60 * 1000;
const secureCookie = process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production');

function hashToken(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function readRefreshCookie(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}
function setRefreshCookie(res: Response, token: string): void {
  const secure = secureCookie ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${refreshCookieName}=${encodeURIComponent(token)}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(refreshDurationMs / 1000)}${secure}`);
}
function clearRefreshCookie(res: Response): void {
  const secure = secureCookie ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${refreshCookieName}=; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
function mintAccessToken(userId: string, isAdmin = false): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ userId, ...(isAdmin ? { isAdmin: true } : {}) }, secret, { expiresIn: '15m', issuer: 'nexuslearn-api', audience: 'nexuslearn-client' });
}
function wrap(handler: (req: Parameters<RequestHandler>[0], res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => { void handler(req, res, next).catch(next); };
}
function validateOrigin(req: Parameters<RequestHandler>[0], res: Response): boolean {
  const origin = req.get('origin');
  const allowed = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((item) => item.trim());
  if (origin && !allowed.includes(origin)) { res.status(403).json({ message: 'Origin not allowed' }); return false; }
  return true;
}

authRouter.post('/register', credentialLimiter, wrap(async (req, res) => {
  const input = registrationSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ message: 'Invalid registration details', issues: input.error.issues }); return; }
  const duplicate = await User.exists({ email: input.data.email });
  if (duplicate) { res.status(409).json({ message: 'An account already exists for this email' }); return; }
  const user = new User({ name: input.data.name, email: input.data.email, password: input.data.password });
  await user.save();
  const refreshValue = randomBytes(48).toString('base64url');
  await RefreshToken.create({ userId: user._id, familyId: randomBytes(20).toString('hex'), tokenHash: hashToken(refreshValue), expiresAt: new Date(Date.now() + refreshDurationMs) });
  setRefreshCookie(res, refreshValue);
  res.status(201).json({ token: mintAccessToken(user._id.toString()), user: user.getPublicProfile() });
}));

authRouter.post('/login', credentialLimiter, wrap(async (req, res) => {
  const input = credentialsSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ message: 'Invalid credentials' }); return; }
  if (input.data.email === process.env.ADMIN_ID && input.data.password === process.env.ADMIN_PASS && process.env.ADMIN_ID && process.env.ADMIN_PASS) {
    const adminId = '000000000000000000000001';
    const refreshValue = randomBytes(48).toString('base64url');
    await RefreshToken.create({ userId: new Types.ObjectId(adminId), isAdmin: true, familyId: randomBytes(20).toString('hex'), tokenHash: hashToken(refreshValue), expiresAt: new Date(Date.now() + refreshDurationMs) });
    setRefreshCookie(res, refreshValue);
    res.json({ token: mintAccessToken(adminId, true), user: { _id: adminId, name: 'Admin', email: process.env.ADMIN_ID, isAdmin: true, isPublic: false, profilePhoto: null, skillsOffered: [], skillsWanted: [] } });
    return;
  }
  const user = await User.findOne({ email: input.data.email });
  if (!user || !(await user.comparePassword(input.data.password))) { res.status(401).json({ message: 'Invalid email or password' }); return; }

  const refreshValue = randomBytes(48).toString('base64url');
  await RefreshToken.create({ userId: user._id, familyId: randomBytes(20).toString('hex'), tokenHash: hashToken(refreshValue), expiresAt: new Date(Date.now() + refreshDurationMs) });
  setRefreshCookie(res, refreshValue);
  res.json({ token: mintAccessToken(user._id.toString()), user: user.getPublicProfile() });
}));

authRouter.post('/refresh', wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!validateOrigin(req, res)) return;
  const rawToken = readRefreshCookie((req as typeof req & { cookies?: Record<string, unknown> }).cookies?.[refreshCookieName]);
  if (!rawToken) { res.status(401).json({ message: 'Session expired' }); return; }
  const tokenHash = hashToken(rawToken);
  const mongoSession = await RefreshToken.startSession();
  try {
    let nextValue: string | null = null;
    let userId: string | null = null;
    let isAdmin = false;
    let reused = false;
    await mongoSession.withTransaction(async () => {
      const oldToken = await RefreshToken.findOne({ tokenHash }).session(mongoSession);
      if (!oldToken) return;
      if (oldToken.revokedAt) {
        await RefreshToken.updateMany({ familyId: oldToken.familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }, { session: mongoSession });
        reused = true;
        return;
      }
      if (oldToken.expiresAt <= new Date()) return;
      const value = randomBytes(48).toString('base64url');
      const nextHash = hashToken(value);
      const consumed = await RefreshToken.findOneAndUpdate({ _id: oldToken._id, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }, { $set: { revokedAt: new Date(), replacedByHash: nextHash } }, { new: true, session: mongoSession });
      if (!consumed) return;
      await RefreshToken.create([{ userId: oldToken.userId, isAdmin: oldToken.isAdmin === true, familyId: oldToken.familyId, tokenHash: nextHash, expiresAt: new Date(Date.now() + refreshDurationMs) }], { session: mongoSession });
      nextValue = value;
      userId = oldToken.userId.toString();
      isAdmin = oldToken.isAdmin === true;
    });
    if (reused) { clearRefreshCookie(res); res.status(401).json({ message: 'Refresh token reuse detected; please sign in again' }); return; }
    if (!nextValue || !userId) { clearRefreshCookie(res); res.status(401).json({ message: 'Session expired' }); return; }
    setRefreshCookie(res, nextValue);
    res.json({ token: mintAccessToken(userId, isAdmin) });
  } finally { await mongoSession.endSession(); }
}));

authRouter.post('/logout', wrap(async (req, res) => {
  const rawToken = readRefreshCookie((req as typeof req & { cookies?: Record<string, unknown> }).cookies?.[refreshCookieName]);
  if (rawToken) await RefreshToken.updateOne({ tokenHash: hashToken(rawToken), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  clearRefreshCookie(res);
  res.status(204).end();
}));

authRouter.get('/me', legacyAuth, (req, res) => res.json({ user: req.user }));
