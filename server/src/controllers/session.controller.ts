import { Router, RequestHandler, Response, NextFunction } from 'express';
import { Types, Model } from 'mongoose';
import { createSessionInput, Session } from '../models/session.model';
import { sessionRepository } from '../repositories/session.repository';
import { escrowService } from '../services/escrow.service';

interface LegacySwapRecord {
  _id: Types.ObjectId;
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: string;
  requestedSkill: { name: string };
  offeredSkill?: { name: string };
}
const LegacySwap = require('../../models/Swap') as Model<LegacySwapRecord>;
const auth = require('../../middleware/auth') as RequestHandler;
export const sessionRouter = Router();

const wrap = (handler: (req: Parameters<RequestHandler>[0], res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => { void handler(req, res, next).catch(next); };

sessionRouter.post('/', auth, wrap(async (req, res) => {
  const input = createSessionInput.safeParse(req.body);
  if (!input.success) { res.status(400).json({ message: 'Invalid session request', issues: input.error.issues }); return; }
  const requesterId = String(req.user?._id || '');
  if (!Types.ObjectId.isValid(requesterId)) { res.status(401).json({ message: 'Authentication required' }); return; }

  const swap = await LegacySwap.findById(input.data.swapId).lean();
  if (!swap) { res.status(404).json({ message: 'Swap not found' }); return; }
  if (swap.status !== 'accepted') { res.status(409).json({ message: 'Only accepted exchanges can be scheduled' }); return; }
  const requester = String(swap.requester);
  const recipient = String(swap.recipient);
  if (requesterId !== requester && requesterId !== recipient) { res.status(403).json({ message: 'Only exchange participants can schedule a session' }); return; }

  const startsAt = new Date(input.data.startsAt);
  if (startsAt.getTime() < Date.now() + 5 * 60_000) { res.status(400).json({ message: 'Sessions must be scheduled at least five minutes ahead' }); return; }
  const endsAt = new Date(startsAt.getTime() + input.data.durationMinutes * 60_000);
  const priceInInr = input.data.mode === 'PAID'
    ? Math.ceil(input.data.durationMinutes / 60) * Number(process.env.SESSION_PRICE_INR_PER_HOUR || 0)
    : 0;
  if (input.data.mode === 'PAID' && (!Number.isSafeInteger(priceInInr) || priceInInr <= 0)) {
    res.status(503).json({ message: 'Paid sessions are not configured' }); return;
  }
  const participantIds = [new Types.ObjectId(requester), new Types.ObjectId(recipient)];
  const transaction = await Session.startSession();
  try {
    let created = null;
    await transaction.withTransaction(async () => {
      const overlap = await Session.exists({ participants: { $in: participantIds }, status: { $in: ['SCHEDULED', 'ACTIVE', 'scheduled', 'live'] }, startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }).session(transaction);
      if (overlap) throw Object.assign(new Error('A participant already has a session at that time'), { status: 409 });
      [created] = await Session.create([{
        swapId: swap._id,
        participants: participantIds,
        teacherId: swap.recipient,
        learnerId: swap.requester,
        mentorId: swap.recipient,
        skillOffered: swap.requestedSkill.name,
        skillWanted: swap.offeredSkill?.name,
        mode: input.data.mode,
        status: 'SCHEDULED',
        paymentStatus: 'PENDING',
        priceInInr,
        skill: swap.requestedSkill.name,
        startsAt,
        endsAt,
        startTime: startsAt,
        endTime: endsAt,
        roomId: new Types.ObjectId().toString(),
      }], { session: transaction });
      if (input.data.mode === 'CREDIT') {
        const locked = await escrowService.lockCreditForSessionWithinTransaction(requester, created._id.toString(), 1, transaction);
        if (!locked) throw Object.assign(new Error('Not enough available Skill Credits to book this session'), { status: 409 });
        created.paymentStatus = 'HELD_IN_ESCROW';
      }
    });
    res.status(201).json(created);
  } catch (error) {
    if ((error as { status?: number }).status === 409) { res.status(409).json({ message: (error as Error).message }); return; }
    if ((error as { code?: number }).code === 11000) { res.status(409).json({ message: 'This session has already been scheduled' }); return; }
    throw error;
  } finally { await transaction.endSession(); }
}));

sessionRouter.get('/:sessionId', auth, wrap(async (req, res) => {
  const session = await sessionRepository.findParticipantSession(req.params.sessionId, String(req.user?._id || ''));
  if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrls = (process.env.TURN_SERVER_URL || '').split(',').map((url) => url.trim()).filter(Boolean);
  if (turnUrls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({ urls: turnUrls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  res.json({ ...session.toObject(), iceServers });
}));

sessionRouter.get('/:sessionId/ics', auth, wrap(async (req, res) => {
  const session = await sessionRepository.findParticipantSession(req.params.sessionId, String(req.user?._id || ''));
  if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
  const escapeText = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const utc = (value: Date): string => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const foldLine = (line: string): string => {
    const chunks: string[] = [];
    let current = '';
    let byteCount = 0;
    for (const character of Array.from(line)) {
      const characterBytes = Buffer.byteLength(character, 'utf8');
      if (byteCount + characterBytes > 75) { chunks.push(current); current = ` ${character}`; byteCount = 1 + characterBytes; }
      else { current += character; byteCount += characterBytes; }
    }
    chunks.push(current);
    return chunks.join('\r\n');
  };
  const stamp = utc(new Date());
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NexusLearn//Session Calendar//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${session.id}@nexuslearn`, `DTSTAMP:${stamp}`,
    `DTSTART:${utc(new Date(session.startsAt))}`, `DTEND:${utc(new Date(session.endsAt))}`,
    `SUMMARY:${escapeText(`NexusLearn learning session: ${session.skill}`)}`,
    `DESCRIPTION:${escapeText('Peer learning session. Open NexusLearn to join the session room.')}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldLine).join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nexuslearn-session-${session.id}.ics"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(content);
}));

sessionRouter.post('/:sessionId/cancel', auth, wrap(async (req, res) => {
  const session = await sessionRepository.findParticipantSession(req.params.sessionId, String(req.user?._id || ''));
  if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
  if (session.status !== 'SCHEDULED' || session.mode !== 'CREDIT' || session.paymentStatus !== 'HELD_IN_ESCROW') {
    res.status(409).json({ message: 'Only scheduled Skill Credit sessions can be cancelled through this endpoint' }); return;
  }
  const refunded = await escrowService.refundEscrow(session.id, 1);
  if (!refunded) { res.status(409).json({ message: 'Session changed or escrow could not be refunded; reload and try again' }); return; }
  res.json(await Session.findById(session._id));
}));

sessionRouter.post('/:sessionId/dispute', auth, wrap(async (req, res) => {
  const session = await sessionRepository.findParticipantSession(req.params.sessionId, String(req.user?._id || ''));
  if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 1000) { res.status(400).json({ message: 'A dispute reason between 5 and 1000 characters is required' }); return; }
  if (session.status !== 'SCHEDULED' || session.mode !== 'CREDIT' || session.paymentStatus !== 'HELD_IN_ESCROW') {
    res.status(409).json({ message: 'Only scheduled Skill Credit sessions with held escrow can be disputed' }); return;
  }
  const userId = String(req.user?._id || '');
  const disputed = await escrowService.disputeEscrow(session.id, userId, reason);
  if (!disputed) { res.status(409).json({ message: 'Session changed or dispute could not be recorded; reload and try again' }); return; }
  res.json(await Session.findById(session._id));
}));

sessionRouter.post('/:sessionId/end', auth, wrap(async (req, res) => {
  const session = await sessionRepository.findParticipantSession(req.params.sessionId, String(req.user?._id || ''));
  if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
  if (!['SCHEDULED', 'ACTIVE', 'scheduled', 'live'].includes(session.status)) { res.status(409).json({ message: 'Session cannot be ended from its current state' }); return; }
  if (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED') { res.status(409).json({ message: 'Complete payment before ending this session' }); return; }
  if (session.mode === 'CREDIT' && session.paymentStatus === 'HELD_IN_ESCROW') {
    const released = await escrowService.releaseEscrowOnCompletion(session.id, 1);
    if (!released) { res.status(409).json({ message: 'Could not release the held Skill Credit; reload and try again' }); return; }
    const completed = await Session.findById(session._id);
    res.json(completed);
    return;
  }
  const ended = await Session.findOneAndUpdate(
    { _id: session._id, participants: session.participants, status: { $in: ['SCHEDULED', 'ACTIVE', 'scheduled', 'live'] } },
    { $set: { status: 'COMPLETED', endedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!ended) { res.status(409).json({ message: 'Session state changed; reload and try again' }); return; }
  res.json(ended);
}));
