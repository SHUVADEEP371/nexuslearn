import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Model, Types } from 'mongoose';
import { z } from 'zod';
import { AINote } from '../models/aiNote.model';
import { SessionMessage, chatMessageInput } from '../models/sessionMessage.model';
import { sessionRepository } from '../repositories/session.repository';
import { isSessionOpen } from '../models/session.model';
import { aiSessionService } from '../ai/aiSession.service';
import { allowSocketAIRequest } from '../infra/redis';

interface AuthClaims { userId: string; isAdmin?: boolean }
interface SessionSocket extends Socket { data: { userId?: string } }
interface UserIdentity { _id: Types.ObjectId }
const User = require('../../models/User') as Model<UserIdentity>;
const noteUpdateSchema = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), markdown: z.string().max(20_000), expectedRevision: z.number().int().min(0) }).strict();
const aiTriggerSchema = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), transcript: z.string().max(8_000).default('') }).strict();
const callSignalSchema = z.discriminatedUnion('kind', [
  z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), kind: z.enum(['offer', 'answer']), sdp: z.string().min(1).max(200_000) }).strict(),
  z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), kind: z.literal('ice'), candidate: z.object({ candidate: z.string().max(4000), sdpMid: z.string().max(100).nullable().optional(), sdpMLineIndex: z.number().int().min(0).max(100).nullable().optional() }).strict() }).strict(),
  z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), kind: z.literal('ready') }).strict(),
  z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), kind: z.literal('hangup') }).strict(),
]);

export function installSessionSocket(io: Server): void {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !process.env.JWT_SECRET) return next(new Error('UNAUTHORIZED'));
      const claims = jwt.verify(token, process.env.JWT_SECRET) as AuthClaims;
      if (claims.isAdmin || !Types.ObjectId.isValid(claims.userId)) return next(new Error('UNAUTHORIZED'));
      if (!(await User.exists({ _id: claims.userId }))) return next(new Error('UNAUTHORIZED'));
      socket.data.userId = claims.userId;
      next();
    } catch { next(new Error('UNAUTHORIZED')); }
  });

  io.on('connection', (socket: SessionSocket) => {
    socket.on('session:join', async (payload: unknown, acknowledge?: (result: { ok: boolean; message?: string }) => void) => {
      const parsed = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i) }).strict().safeParse(payload);
      if (!parsed.success || !socket.data.userId) { acknowledge?.({ ok: false, message: 'Invalid session' }); return; }
      try {
        const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, socket.data.userId);
        if (!session || session.status === 'CANCELLED' || session.status === 'cancelled' || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { acknowledge?.({ ok: false, message: 'Session access denied or payment is pending' }); return; }
        await socket.join(`session:${session.id}`);
        io.to(`session:${session.id}`).emit('session:participant-joined', { userId: socket.data.userId });
        const note = await AINote.findOne({ sessionId: session._id }).lean();
        const messages = (await SessionMessage.find({ sessionId: session._id }).sort({ createdAt: -1 }).limit(50).lean()).reverse();
        acknowledge?.({ ok: true });
        socket.emit('notes:initial', { sessionId: session.id, note });
        socket.emit('chat:history', { sessionId: session.id, messages });
      } catch { acknowledge?.({ ok: false, message: 'Unable to join session' }); }
    });

    socket.on('chat:send', async (payload: unknown, acknowledge?: (result: { ok: boolean; message?: string }) => void) => {
      const parsed = chatMessageInput.safeParse(payload);
      if (!parsed.success || !socket.data.userId) { acknowledge?.({ ok: false, message: 'Invalid message' }); return; }
      try {
        const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, socket.data.userId);
        if (!session || !isSessionOpen(session.status) || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { acknowledge?.({ ok: false, message: 'Chat is unavailable for this session' }); return; }
        const body = parsed.data.body.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
        if (!body) { acknowledge?.({ ok: false, message: 'Message cannot be empty' }); return; }
        const message = await SessionMessage.findOneAndUpdate(
          { sessionId: session._id, senderId: socket.data.userId, clientMessageId: parsed.data.clientMessageId },
          { $setOnInsert: { sessionId: session._id, senderId: new Types.ObjectId(socket.data.userId), clientMessageId: parsed.data.clientMessageId, body } },
          { upsert: true, new: true, runValidators: true },
        ).lean();
        io.to(`session:${session.id}`).emit('chat:message', message);
        acknowledge?.({ ok: true });
      } catch { acknowledge?.({ ok: false, message: 'Unable to save message' }); }
    });

    socket.on('call:signal', async (payload: unknown, acknowledge?: (result: { ok: boolean }) => void) => {
      const parsed = callSignalSchema.safeParse(payload);
      if (!parsed.success || !socket.data.userId) { acknowledge?.({ ok: false }); return; }
      try {
        const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, socket.data.userId);
        if (!session || !isSessionOpen(session.status) || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { acknowledge?.({ ok: false }); return; }
        socket.to(`session:${session.id}`).emit('call:signal', { ...parsed.data, from: socket.data.userId });
        acknowledge?.({ ok: true });
      } catch { acknowledge?.({ ok: false }); }
    });

    socket.on('notes:edit', async (payload: unknown, acknowledge?: (result: { ok: boolean; revision?: number; message?: string }) => void) => {
      const parsed = noteUpdateSchema.safeParse(payload);
      if (!parsed.success || !socket.data.userId) { acknowledge?.({ ok: false, message: 'Invalid notes update' }); return; }
      try {
        const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, socket.data.userId);
        if (!session || !isSessionOpen(session.status) || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { acknowledge?.({ ok: false, message: 'Notes are read-only' }); return; }
        const markdown = parsed.data.markdown.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
        const note = await AINote.findOneAndUpdate(
          { sessionId: session._id, revision: parsed.data.expectedRevision },
          { $set: { markdown, updatedBy: new Types.ObjectId(socket.data.userId) }, $inc: { revision: 1 }, $setOnInsert: { sessionId: session._id, summary: '', takeaways: [], codeSnippets: [], definitions: [] } },
          { upsert: parsed.data.expectedRevision === 0, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        if (!note) { acknowledge?.({ ok: false, message: 'Notes changed. Refresh to continue.' }); return; }
        io.to(`session:${session.id}`).emit('notes:updated', { sessionId: session.id, note });
        acknowledge?.({ ok: true, revision: note.revision });
      } catch (error) {
        const code = (error as { code?: number }).code;
        acknowledge?.({ ok: false, message: code === 11000 ? 'Notes changed. Refresh to continue.' : 'Unable to save notes' });
      }
    });

    socket.on('ai:notes:trigger', async (payload: unknown, acknowledge?: (result: { ok: boolean; message?: string }) => void) => {
      const parsed = aiTriggerSchema.safeParse(payload);
      if (!parsed.success || !socket.data.userId) { acknowledge?.({ ok: false, message: 'Invalid AI request' }); return; }
      try {
        const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, socket.data.userId);
        if (!session || !isSessionOpen(session.status) || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { acknowledge?.({ ok: false, message: 'Session is not active' }); return; }
        if (!(await allowSocketAIRequest(socket.data.userId))) { acknowledge?.({ ok: false, message: 'AI request limit reached. Try again shortly.' }); return; }
        const room = `session:${session.id}`;
        const existing = await AINote.findOne({ sessionId: session._id }).lean();
        const draft = await aiSessionService.streamNotes({ skill: session.skill, notes: existing?.markdown || '', transcript: parsed.data.transcript, onChunk: (chunk, attempt) => io.to(room).emit('ai:notes:chunk', { sessionId: session.id, chunk, attempt }) });
        const note = await AINote.findOneAndUpdate(
          { sessionId: session._id },
          { $set: { ...draft, markdown: draft.summary, updatedBy: new Types.ObjectId(socket.data.userId) }, $inc: { revision: 1 }, $setOnInsert: { sessionId: session._id } },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        io.to(room).emit('ai:notes:complete', { sessionId: session.id, note });
        acknowledge?.({ ok: true });
      } catch {
        socket.emit('ai:notes:error', { message: 'AI notes are temporarily unavailable. Your session is still active.' });
        acknowledge?.({ ok: false, message: 'AI notes are temporarily unavailable' });
      }
    });
  });
}
