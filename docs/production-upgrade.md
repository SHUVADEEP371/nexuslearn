# NexusLearn production upgrade blueprint

This plan upgrades the current React 18 / Express 4 / Mongoose 8 MVP in compatible slices. The current app uses JavaScript, CommonJS, `User` and `Swap` documents, and REST routes under `/api`; keep those contracts working while the new API is introduced. New public branding is NexusLearn. The examples below use the existing requester/recipient language where it helps migration.

## Incremental architecture roadmap

| Phase | Change | Compatibility / exit criteria |
| --- | --- | --- |
| 0. Baseline | Capture current API shapes, add contract tests and request IDs, centralize errors, validate env at boot, pin Node/runtime versions. | Existing auth, browse, profile, swap and admin flows pass unchanged. |
| 1. Typed foundation | Add `server/src` TypeScript alongside `server/index.js`; compile to `server/dist`. Use strict TS, Zod at HTTP boundaries, and a controller → service → repository dependency direction. Convert one route at a time; leave old route mounted until parity is proven. | CI builds both old app and TS server. No `any` crosses the service boundary. |
| 2. Durable domain | Add the schemas below with additive fields and indexes. Backfill in resumable batches; dual-read where needed; do not rename/remove legacy fields until usage telemetry confirms clients have migrated. | Migration is repeatable, has a dry run, and reports counts/errors. |
| 3. TimeBank | Add immutable ledger entries and wallet projection. Route all balance changes through one transactional service with idempotency keys. Enable Mongo transactions only on replica-set/sharded deployments. | Concurrent duplicate requests cannot double-credit; reconciliation matches wallet balances to ledger. |
| 4. Scheduling | Add recurring weekly availability, date overrides and timezone IDs; create concrete UTC sessions with unique teacher/time constraints. Add ICS export; Google Calendar is an opt-in OAuth integration with revocable tokens. | Existing availability remains readable during a transition; booking conflicts fail atomically. |
| 5. Trust & proof | Both attendees check in; a completion job verifies timing and both confirmations before settling credits. Add dispute/report state and admin review. | Reviews and settlement require verified completion; disputes freeze settlement. |
| 6. Async + realtime | Use a transactional outbox to publish notifications after commit. BullMQ handles email/reminders/reconciliation. Socket.IO authenticates the handshake and authorizes every room/message. | Queue consumers are idempotent; REST remains the source of truth if sockets are unavailable. |
| 7. Media + client | Move uploads to private S3/Cloudinary via short-lived signed uploads; scan/validate files. Add React TS incrementally, TanStack Query for remote state, then Radix/shadcn components. Keep local UI state local. | No public server upload directory; old React routes continue to work during page-by-page conversion. |
| 8. Production readiness | Add structured logs/metrics/traces, backups/restore drills, rate limits by identity, security headers, dependency scanning, load tests, and staged rollout/rollback. | SLO dashboards and rollback runbook exist; migrations and restores tested against production-like data. |

Suggested server structure:

```text
server/src/
  app.ts                 # Express construction; no listen side effect
  main.ts                # env validation, DB/Redis connect, graceful shutdown
  config/                # Zod-validated env, logger, clients
  http/{routes,middleware,controllers}/
  domain/{users,swaps,sessions,wallets}/
    *.schema.ts          # Zod boundary/domain schemas
    *.model.ts           # Mongoose persistence schema
    *.repository.ts      # persistence queries only
    *.service.ts         # business invariants and transactions
  jobs/                  # BullMQ producers/workers
  realtime/              # Socket.IO auth and event handlers
  shared/                # errors, ids, pagination, clock
```

Controllers parse and authorize HTTP input. Services enforce invariants. Repositories own database access. Use dependency injection at composition time so transaction, clock, queue and repository behavior can be replaced in tests. Never make a controller own a transaction or put business rules in a Mongoose hook.

## Typed boundary and persistence models

These are complete domain-shape examples for the new platform fields. References use string IDs in API/domain types and `ObjectId` in persistence. Zod validates untrusted input; Mongoose validation and indexes protect stored data. Add these in new collections first; do not mutate the legacy `User`/`Swap` model in place on the first deploy.

```ts
// server/src/domain/shared.ts
import { z } from 'zod';
import mongoose, { Schema, Types, InferSchemaType, Model } from 'mongoose';

export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i);
export const timezoneId = z.string().min(1).max(64); // validate against Intl.supportedValuesOf('timeZone') at service boundary
export const skillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  normalizedName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(''),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
});
export type Skill = z.infer<typeof skillSchema>;

const skillSubSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  normalizedName: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'intermediate' },
  tags: { type: [String], default: [] },
}, { _id: true, strict: 'throw' });

// User: sensitive authentication fields never belong in public DTOs.
export const userInputSchema = z.object({
  name: z.string().trim().min(1).max(80), email: z.string().email().max(254),
  timezone: timezoneId.default('UTC'), bio: z.string().trim().max(500).default(''),
  location: z.string().trim().max(120).default(''), isPublic: z.boolean().default(true),
  skillsOffered: z.array(skillSchema).max(30).default([]),
  skillsWanted: z.array(skillSchema).max(30).default([]),
});
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, select: false },
  passwordHash: { type: String, required: true, select: false },
  timezone: { type: String, required: true, default: 'UTC', maxlength: 64 },
  bio: { type: String, trim: true, maxlength: 500, default: '' },
  location: { type: String, trim: true, maxlength: 120, default: '' },
  profileImageKey: { type: String, maxlength: 512 }, // storage key only; signed URL is short-lived
  isPublic: { type: Boolean, default: true, index: true },
  skillsOffered: { type: [skillSubSchema], default: [] },
  skillsWanted: { type: [skillSubSchema], default: [] },
  roles: { type: [String], enum: ['member', 'admin'], default: ['member'] },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active', index: true },
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });
userSchema.index({ 'skillsOffered.normalizedName': 1, isPublic: 1, status: 1 });
userSchema.index({ 'skillsWanted.normalizedName': 1, isPublic: 1, status: 1 });
export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel: Model<UserDoc> = mongoose.models.UserV2 || mongoose.model<UserDoc>('UserV2', userSchema);

// Swap is the proposal/relationship. Sessions are the actual bookable events.
export const swapInputSchema = z.object({
  recipientId: objectIdString, requestedSkillId: objectIdString, offeredSkillId: objectIdString,
  message: z.string().trim().max(1000).default(''),
});
const swapSchema = new Schema({
  requester: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true },
  requestedSkillId: { type: Schema.Types.ObjectId, required: true },
  offeredSkillId: { type: Schema.Types.ObjectId, required: true },
  message: { type: String, trim: true, maxlength: 1000, default: '' },
  mode: { type: String, enum: ['direct', 'credit'], required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled', 'completed', 'disputed'], default: 'pending', index: true },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true },
  acceptedAt: Date, cancelledAt: Date,
}, { timestamps: true, strict: 'throw' });
swapSchema.index({ requester: 1, recipient: 1, status: 1 });
swapSchema.index({ createdBy: 1, idempotencyKey: 1 }, { unique: true });
export type SwapDoc = InferSchemaType<typeof swapSchema>;
export const SwapModel: Model<SwapDoc> = mongoose.models.SwapV2 || mongoose.model<SwapDoc>('SwapV2', swapSchema);

// Availability is a weekly rule in the owner's timezone plus date exceptions.
export const timeSlotInputSchema = z.object({
  userId: objectIdString, timezone: timezoneId,
  weekly: z.array(z.object({ weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440),
    active: z.boolean().default(true) })).max(42),
  overrides: z.array(z.object({ date: z.string().date(), kind: z.enum(['available', 'unavailable']),
    startMinute: z.number().int().min(0).max(1439).optional(), endMinute: z.number().int().min(1).max(1440).optional() })).max(100),
}).superRefine((v, ctx) => {
  for (const [i, slot] of v.weekly.entries()) if (slot.endMinute <= slot.startMinute)
    ctx.addIssue({ code: 'custom', path: ['weekly', i], message: 'End must be after start' });
});
const timeSlotSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true, unique: true },
  timezone: { type: String, required: true, maxlength: 64 },
  weekly: [{ weekday: { type: Number, min: 0, max: 6, required: true }, startMinute: { type: Number, min: 0, max: 1439, required: true }, endMinute: { type: Number, min: 1, max: 1440, required: true }, active: { type: Boolean, default: true } }],
  overrides: [{ date: { type: String, required: true }, kind: { type: String, enum: ['available', 'unavailable'], required: true }, startMinute: Number, endMinute: Number }],
  version: { type: Number, default: 1 },
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });
export type TimeSlotDoc = InferSchemaType<typeof timeSlotSchema>;
export const TimeSlotModel: Model<TimeSlotDoc> = mongoose.models.TimeSlotV2 || mongoose.model<TimeSlotDoc>('TimeSlotV2', timeSlotSchema);

export const sessionInputSchema = z.object({
  swapId: objectIdString, teacherId: objectIdString, learnerId: objectIdString,
  startsAt: z.string().datetime({ offset: true }), durationMinutes: z.number().int().min(15).max(240),
  timezone: timezoneId,
});
const sessionSchema = new Schema({
  swap: { type: Schema.Types.ObjectId, ref: 'SwapV2', required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true },
  learner: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true },
  startsAt: { type: Date, required: true }, // UTC instant
  endsAt: { type: Date, required: true },
  displayTimezone: { type: String, required: true, maxlength: 64 },
  durationMinutes: { type: Number, required: true, min: 15, max: 240 },
  creditCost: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['booked', 'cancelled', 'awaiting_checkin', 'completed', 'disputed', 'no_show'], default: 'booked', index: true },
  teacherCheckedInAt: Date, learnerCheckedInAt: Date, completedAt: Date,
  dispute: { openedBy: Schema.Types.ObjectId, reason: { type: String, maxlength: 2000 }, openedAt: Date, resolution: { type: String, enum: ['refund', 'release', 'partial', 'dismissed'] }, resolvedAt: Date },
  roomId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
}, { timestamps: true, strict: 'throw' });
sessionSchema.index({ teacher: 1, startsAt: 1, endsAt: 1, status: 1 });
sessionSchema.index({ learner: 1, startsAt: 1, status: 1 });
sessionSchema.index({ createdAt: 1, status: 1 });
sessionSchema.index({ swap: 1, idempotencyKey: 1 }, { unique: true });
export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const SessionModel: Model<SessionDoc> = mongoose.models.SessionV2 || mongoose.model<SessionDoc>('SessionV2', sessionSchema);

// Wallet is a cached balance projection; ledger is the auditable source of truth.
const walletSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true, unique: true },
  available: { type: Number, required: true, min: 0, default: 0 },
  reserved: { type: Number, required: true, min: 0, default: 0 },
  lifetimeEarned: { type: Number, required: true, min: 0, default: 0 },
  version: { type: Number, required: true, default: 0 },
}, { timestamps: true, strict: 'throw' });
export type WalletDoc = InferSchemaType<typeof walletSchema>;
export const WalletModel: Model<WalletDoc> = mongoose.models.WalletV2 || mongoose.model<WalletDoc>('WalletV2', walletSchema);

const ledgerSchema = new Schema({
  wallet: { type: Schema.Types.ObjectId, ref: 'WalletV2', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'UserV2', required: true },
  amount: { type: Number, required: true, validate: (n: number) => Number.isSafeInteger(n) && n !== 0 },
  kind: { type: String, enum: ['session_earn', 'session_spend', 'reserve', 'release', 'refund', 'adjustment'], required: true },
  session: { type: Schema.Types.ObjectId, ref: 'SessionV2' },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  actor: { type: Schema.Types.ObjectId, ref: 'UserV2' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, strict: 'throw', immutable: true });
ledgerSchema.index({ owner: 1, createdAt: -1 });
ledgerSchema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });
export type LedgerDoc = InferSchemaType<typeof ledgerSchema>;
export const LedgerModel: Model<LedgerDoc> = mongoose.models.CreditLedger || mongoose.model<LedgerDoc>('CreditLedger', ledgerSchema);
```

`Session` uniqueness needs overlap protection beyond a basic compound index. In a transaction, acquire a teacher/day lock document (unique `{teacher, dayUtc}`), then query overlapping active sessions (`startsAt < requestedEnd && endsAt > requestedStart`) and insert. This serializes bookings for that teacher/day; use short bounded transactions and retry transient transaction errors. Store instants in UTC and preserve the IANA timezone used to render the booking. Reject nonexistent/ambiguous local times unless the client disambiguates them.

## Transactional credit service

Credits are integer minutes internally: 60 teaching minutes earn 60 credits and 60 credits buy 60 minutes. This avoids fractional money-like balances. The client may display credits as hours. Ledger entries are append-only, balances are updated only in the same MongoDB transaction, and every operation has a caller-generated idempotency key. A replica set is mandatory for transactions; fail closed if transactions are unavailable.

```ts
// server/src/domain/wallets/credit.service.ts
import mongoose, { ClientSession, Types } from 'mongoose';
import { WalletModel, LedgerModel, SessionModel } from '../models';

type SettlementInput = { sessionId: string; idempotencyKey: string };

export class CreditService {
  async settleVerifiedSession({ sessionId, idempotencyKey }: SettlementInput) {
    const mongoSession = await mongoose.startSession();
    try {
      let result: unknown;
      await mongoSession.withTransaction(async () => {
        const lesson = await SessionModel.findById(sessionId).session(mongoSession);
        if (!lesson) throw new Error('SESSION_NOT_FOUND');
        if (lesson.status !== 'awaiting_checkin' || !lesson.teacherCheckedInAt || !lesson.learnerCheckedInAt)
          throw new Error('SESSION_NOT_VERIFIED');

        // A previous successful attempt is an idempotent success.
        const alreadySettled = await LedgerModel.exists({ session: lesson._id, kind: 'session_spend' }).session(mongoSession);
        if (alreadySettled) { result = lesson; return; }

        const minutes = lesson.durationMinutes;
        const teacherWallet = await WalletModel.findOneAndUpdate(
          { owner: lesson.teacher },
          { $inc: { available: minutes, lifetimeEarned: minutes, version: 1 } },
          { upsert: true, new: true, session: mongoSession },
        );
        const learnerWallet = await WalletModel.findOneAndUpdate(
          { owner: lesson.learner, available: { $gte: minutes } },
          { $inc: { available: -minutes, reserved: -minutes, version: 1 } },
          { new: true, session: mongoSession },
        );
        if (!learnerWallet) throw new Error('CREDIT_RESERVATION_MISSING');

        await LedgerModel.create([
          { wallet: teacherWallet._id, owner: lesson.teacher, amount: minutes, kind: 'session_earn', session: lesson._id, idempotencyKey: `${idempotencyKey}:earn` },
          { wallet: learnerWallet._id, owner: lesson.learner, amount: -minutes, kind: 'session_spend', session: lesson._id, idempotencyKey: `${idempotencyKey}:spend` },
        ], { session: mongoSession });
        lesson.status = 'completed';
        lesson.completedAt = new Date();
        await lesson.save({ session: mongoSession });
        result = lesson;
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      return result;
    } finally { await mongoSession.endSession(); }
  }

  async reserveForBooking(ownerId: Types.ObjectId, minutes: number, sessionId: Types.ObjectId, key: string, tx: ClientSession) {
    if (!Number.isSafeInteger(minutes) || minutes <= 0) throw new Error('INVALID_CREDIT_AMOUNT');
    const prior = await LedgerModel.findOne({ owner: ownerId, idempotencyKey: key }).session(tx);
    if (prior) return;
    const wallet = await WalletModel.findOneAndUpdate(
      { owner: ownerId, available: { $gte: minutes } },
      { $inc: { available: -minutes, reserved: minutes, version: 1 } },
      { new: true, session: tx },
    );
    if (!wallet) throw new Error('INSUFFICIENT_CREDITS');
    await LedgerModel.create([{ wallet: wallet._id, owner: ownerId, amount: -minutes, kind: 'reserve', session: sessionId, idempotencyKey: key }], { session: tx });
  }
}
```

Production implementation should use typed domain errors, confirm the session is inside its completion window, and pair reserve/release/refund ledger keys with stable unique constraints. The worker must retry only transient transaction failures; never retry validation, authorization or insufficient-credit failures. Add a daily reconciliation job that sums the ledger and compares it to each wallet projection, alerting rather than silently rewriting balances.

## Two-way matching engine

Matching has two distinct concepts: **mutual skill compatibility** and **one-way semantic discovery**. The two-way score below requires both directions; synonyms improve recall but should not silently assert proficiency. Normalize skill aliases through a curated taxonomy first, then use token overlap/edit distance as a fallback. Vector search can be added later behind the same interface.

```ts
type MatchUser = { id: string; offers: string[]; wants: string[]; timezone?: string; rating?: number; completed?: number };
const aliases: Record<string, string[]> = {
  'react': ['frontend development', 'react.js', 'reactjs', 'web development'],
  'frontend development': ['react', 'javascript', 'web development', 'ui engineering'],
  'javascript': ['js', 'ecmascript', 'frontend development'],
  'ux design': ['user experience', 'product design', 'interaction design'],
};
const norm = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
const concepts = (s: string) => new Set([norm(s), ...(aliases[norm(s)] || []).map(norm)]);
const overlapScore = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0;
  const right = new Set(b.flatMap(x => [...concepts(x)]));
  const hits = a.flatMap(x => [...concepts(x)]).filter(x => right.has(x));
  return Math.min(1, hits.length / Math.max(1, new Set(a.flatMap(x => [...concepts(x)])).size));
};

export function scoreTwoWay(viewer: MatchUser, candidate: MatchUser) {
  const viewerGets = overlapScore(viewer.wants, candidate.offers);
  const candidateGets = overlapScore(candidate.wants, viewer.offers);
  // Harmonic mean prevents a strong match in only one direction from dominating.
  const mutual = viewerGets + candidateGets === 0 ? 0 : 2 * viewerGets * candidateGets / (viewerGets + candidateGets);
  const trust = Math.min(1, ((candidate.rating ?? 0) / 5) * 0.75 + Math.log1p(candidate.completed ?? 0) / 12);
  return { score: Math.round((mutual * 0.85 + trust * 0.15) * 100), viewerGets, candidateGets, mutual, mutualMatch: viewerGets > 0 && candidateGets > 0 };
}

export function rankCandidates(viewer: MatchUser, candidates: MatchUser[]) {
  return candidates.filter(c => c.id !== viewer.id)
    .map(candidate => ({ candidate, ...scoreTwoWay(viewer, candidate) }))
    .filter(row => row.mutualMatch)
    .sort((a, b) => b.score - a.score);
}
```

Run cheap indexed skill candidate retrieval first, then rank a bounded candidate set. Return matched skill labels and score explanation, not just a mysterious percentage. Add unit tests for aliases, empty profiles, one-way-only matches, duplicate skills and score ordering before shipping.

## Persistent chat and Socket.IO authorization

Persist before emitting. REST history pagination remains available during socket outages. Authenticate the socket handshake with the same signed access token as HTTP; authorize membership on every conversation action (not only on connect). Never trust a client-supplied room name. Redis adapter is needed when running multiple Node processes.

```ts
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const sendMessage = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), clientMessageId: z.string().min(8).max(100), body: z.string().trim().min(1).max(4000) });
export function installRealtime(io: Server, deps: {
  secret: string;
  conversationRepo: { isParticipant(conversationId: string, userId: string): Promise<boolean> };
  messageService: { persist(input: { conversationId: string; senderId: string; clientMessageId: string; body: string }): Promise<{ id: string; conversationId: string; senderId: string; body: string; createdAt: Date }> };
}) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('UNAUTHORIZED'));
      const claims = jwt.verify(token, deps.secret) as { sub: string; tokenVersion?: number };
      socket.data.userId = claims.sub;
      next();
    } catch { next(new Error('UNAUTHORIZED')); }
  });

  io.on('connection', socket => {
    socket.on('conversation:join', async (raw: unknown, ack?: (r: object) => void) => {
      const parsed = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i) }).safeParse(raw);
      if (!parsed.success || !(await deps.conversationRepo.isParticipant(parsed.data.conversationId, socket.data.userId))) {
        ack?.({ ok: false, code: 'FORBIDDEN' }); return;
      }
      socket.join(`conversation:${parsed.data.conversationId}`);
      ack?.({ ok: true });
    });
    socket.on('message:send', async (raw: unknown, ack?: (r: object) => void) => {
      const parsed = sendMessage.safeParse(raw);
      if (!parsed.success) { ack?.({ ok: false, code: 'INVALID_MESSAGE' }); return; }
      const { conversationId, clientMessageId, body } = parsed.data;
      if (!(await deps.conversationRepo.isParticipant(conversationId, socket.data.userId))) { ack?.({ ok: false, code: 'FORBIDDEN' }); return; }
      try {
        const message = await deps.messageService.persist({ conversationId, senderId: socket.data.userId, clientMessageId, body });
        io.to(`conversation:${conversationId}`).emit('message:new', message);
        ack?.({ ok: true, message });
      } catch { ack?.({ ok: false, code: 'MESSAGE_FAILED' }); }
    });
    socket.on('typing:set', async (raw: unknown) => {
      const parsed = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), typing: z.boolean() }).safeParse(raw);
      if (!parsed.success || !(await deps.conversationRepo.isParticipant(parsed.data.conversationId, socket.data.userId))) return;
      socket.to(`conversation:${parsed.data.conversationId}`).emit('typing:changed', { userId: socket.data.userId, typing: parsed.data.typing });
    });
  });
}
```

Use a unique `{conversationId, senderId, clientMessageId}` index for message deduplication, server-generated timestamps, content retention rules, abuse throttles and unread counters updated transactionally. WebRTC signaling should exchange only ephemeral offer/answer/ICE data through an authorized session room; use a managed SFU (LiveKit/Daily) for production calls rather than routing media through Express. Whiteboard events need persistence/snapshots and per-room authorization too.

## REST API surface

All write routes require auth, Zod validation, rate limits and an `Idempotency-Key` where retries could create a second resource. Use cursor pagination (`?limit=20&cursor=...`) and stable public DTOs. Return `application/problem+json` errors with request ID; use `If-Match`/version for mutable availability/profile edits.

```text
POST   /api/v2/auth/sessions                       login; rotate refresh token
DELETE /api/v2/auth/sessions/current               logout/revoke
GET    /api/v2/users/me                            current private profile + wallet summary
PATCH  /api/v2/users/me                            profile update (If-Match)
GET    /api/v2/matches?skill=&cursor=&limit=       ranked mutual matches
GET    /api/v2/users/:userId                       public profile only
PUT    /api/v2/users/me/availability               recurring rules + overrides
GET    /api/v2/users/:userId/availability?from=&to= computed UTC bookable slots
POST   /api/v2/swaps                               create direct/credit proposal
GET    /api/v2/swaps?status=&cursor=&limit=        user's proposals
GET    /api/v2/swaps/:swapId                       proposal detail (participants only)
POST   /api/v2/swaps/:swapId/accept                accept proposal
POST   /api/v2/swaps/:swapId/decline               decline proposal
POST   /api/v2/sessions                            book an offered slot (transaction)
GET    /api/v2/sessions?from=&to=&status=          participant's sessions
GET    /api/v2/sessions/:sessionId                 session detail (participant only)
POST   /api/v2/sessions/:id/cancel                 cancel under policy
POST   /api/v2/sessions/:id/check-ins               { attendance: true }; participant only
POST   /api/v2/sessions/:id/disputes                open dispute, freezes settlement
POST   /api/v2/sessions/:id/reviews                 review after verified completion only
GET    /api/v2/sessions/:id/calendar.ics            authorized participant calendar file
GET    /api/v2/wallet                               available/reserved balance
GET    /api/v2/wallet/ledger?cursor=&limit=         immutable ledger history
POST   /api/v2/media/uploads                        create short-lived signed upload intent
POST   /api/v2/conversations                        create/find session conversation
GET    /api/v2/conversations                        conversation list + unread counts
GET    /api/v2/conversations/:id/messages?before=   cursor-paged history
POST   /api/v2/integrations/google-calendar/connect OAuth start; state/PKCE protected
DELETE /api/v2/integrations/google-calendar         revoke credentials and sync
POST   /api/v2/admin/sessions/:id/resolve-dispute   admin-only audited decision
```

## Operational invariants and rollout guardrails

- Use an outbox record in the same Mongo transaction as booking/settlement, then publish to BullMQ; queue delivery is at-least-once, so each worker must deduplicate by job key. Redis loss must not lose financial truth.
- Configure Redis ACL/TLS, separate BullMQ and Socket.IO key prefixes, and apply distributed user/IP throttles. Cache only public browse data; invalidate by version/event and never cache private DTOs across users.
- Validate uploads by content signature, size, image decode and malware scanning; upload to a quarantine key, then promote after checks. Keep storage private and serve a short-lived URL.
- Protect auth cookies with `HttpOnly`, `Secure`, `SameSite`; rotate refresh tokens, store only hashed refresh token identifiers, support revocation and CSRF protection. Avoid exposing email/IDs in public profiles or socket payloads.
- Google credentials belong encrypted server-side and must be removable. Use OAuth `state`, PKCE, narrow scopes, refresh-token rotation and webhook reconciliation. Calendar sync is best-effort and never controls the canonical session time.
- Add indexes before switching reads. Build potentially large indexes with deployment-safe procedures; verify duplicate/null data first. MongoDB transaction tests require a replica set (e.g. test replica set), not standalone memory server defaults.
- Roll out behind feature flags: deploy additive schema → backfill → shadow-compute matches/availability → compare → enable to staff → small cohort → all users. Every phase has a rollback switch and does not require dropping legacy collections.

## Test plan for the migration

Use Vitest for pure domain algorithms and UI units; Supertest for HTTP behavior; a replica-set Mongo integration environment for booking/credits; Redis test instance for queue/socket adapter behavior. Critical cases: two simultaneous bookings for one slot, duplicate settlement retries, a failed second wallet write rolling back the first, double check-in, one party missing check-in, disputes freezing funds, DST gaps/folds, forged conversation IDs, cross-user profile leakage, expired signed uploads, and outbox replay. Add contract tests against the current `/api/auth`, `/api/users`, and `/api/swaps` responses before migrating those routes.
