import { Router, RequestHandler, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { Model, Types } from 'mongoose';
import { z } from 'zod';
import { aiNoteDraftSchema, AINoteDraft } from '../models/aiNote.model';
import { debriefInputSchema } from '../models/aiFeedback.model';
import { isSessionCompleted, isSessionOpen } from '../models/session.model';
import { sessionRepository } from '../repositories/session.repository';
import { aiSessionRepository } from '../repositories/aiSession.repository';
import { aiSessionService, AIUnavailableError } from '../ai/aiSession.service';

interface LegacySwapRecord {
  _id: Types.ObjectId;
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: string;
  requestedSkill: { name: string; proficiency?: string };
}
const LegacySwap = require('../../models/Swap') as Model<LegacySwapRecord>;
const notesRequestSchema = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), transcript: z.string().max(8000).default('') }).strict();
const markdownSchema = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), markdown: z.string().max(20000), expectedRevision: z.number().int().min(0) }).strict();
const syllabusRequestSchema = z.object({ swapId: z.string().regex(/^[a-f\d]{24}$/i), learningGoal: z.string().trim().min(2).max(500), durationMinutes: z.union([z.literal(30), z.literal(60)]) }).strict();

const wrap = (handler: (req: Parameters<RequestHandler>[0], res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => { void handler(req, res, next).catch(next); };
const mongoId = (value: string) => new Types.ObjectId(value);

export function createAISessionRouter(io: Server): Router {
  const router = Router();

  router.post('/session-notes', wrap(async (req, res) => {
    const parsed = notesRequestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Invalid AI note request', issues: parsed.error.issues }); return; }
    const userId = String(req.user?._id || '');
    const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, userId);
    if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
    if (!isSessionOpen(session.status) || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { res.status(409).json({ message: 'Notes can only be generated for an active, paid session' }); return; }

    const room = `session:${session._id}`;
    const existing = await aiSessionRepository.getNote(session._id);
    const draft = await aiSessionService.streamNotes({
      skill: session.skill,
      notes: existing?.markdown || '',
      transcript: parsed.data.transcript,
      onChunk: (chunk, attempt) => io.to(room).emit('ai:notes:chunk', { sessionId: session.id, chunk, attempt }),
    });
    const note = await aiSessionRepository.saveDraft(session._id, mongoId(userId), draft as AINoteDraft);
    io.to(room).emit('ai:notes:complete', { sessionId: session.id, note });
    res.json({ note });
  }));

  router.put('/session-notes', wrap(async (req, res) => {
    const parsed = markdownSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Invalid note update', issues: parsed.error.issues }); return; }
    const userId = String(req.user?._id || '');
    const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, userId);
    if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
    if (!isSessionOpen(session.status) || (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED')) { res.status(409).json({ message: 'This session notes document is read-only' }); return; }
    const note = await aiSessionRepository.updateMarkdown(session._id, mongoId(userId), parsed.data.markdown.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''), parsed.data.expectedRevision);
    if (!note) { res.status(409).json({ message: 'Notes changed elsewhere. Refresh and retry.' }); return; }
    io.to(`session:${session._id}`).emit('notes:updated', { sessionId: session.id, note });
    res.json({ note });
  }));

  router.post('/session-feedback', wrap(async (req, res) => {
    const parsed = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), debrief: debriefInputSchema }).strict().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Invalid session debrief', issues: parsed.error.issues }); return; }
    const userId = String(req.user?._id || '');
    const session = await sessionRepository.findParticipantSession(parsed.data.sessionId, userId);
    if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
    if (!isSessionCompleted(session.status)) { res.status(409).json({ message: 'Feedback is available after the session ends' }); return; }

    const feedback = await aiSessionRepository.addDebrief(session._id, mongoId(userId), parsed.data.debrief);
    if (feedback.debriefs.length < 2) { res.status(202).json({ status: 'awaiting-other-participant', feedback }); return; }
    try {
      const note = await aiSessionRepository.getNote(session._id);
      const output = await aiSessionService.generateFeedback({
        skill: session.skill,
        notes: note?.markdown || '',
        debriefs: feedback.debriefs.map((item) => ({ role: item.userId.equals(session.teacherId) ? 'teacher' : 'learner', topics: item.topicsCovered, challenges: item.challenges })),
      });
      const saved = await aiSessionRepository.saveFeedback(session._id, output);
      io.to(`session:${session._id}`).emit('ai:feedback:ready', { sessionId: session.id, feedback: saved });
      res.json({ status: 'complete', feedback: saved });
    } catch (error) {
      if (error instanceof AIUnavailableError) { res.status(202).json({ status: 'saved-ai-pending', feedback }); return; }
      throw error;
    }
  }));

  router.get('/session-feedback/:sessionId', wrap(async (req, res) => {
    const userId = String(req.user?._id || '');
    const session = await sessionRepository.findParticipantSession(req.params.sessionId, userId);
    if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
    const feedback = await aiSessionRepository.getFeedback(session._id);
    if (!feedback) { res.status(404).json({ message: 'Session feedback is not available yet' }); return; }
    res.json({ feedback });
  }));

  router.post('/generate-syllabus', wrap(async (req, res) => {
    const parsed = syllabusRequestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Invalid syllabus request', issues: parsed.error.issues }); return; }
    const swap = await LegacySwap.findById(parsed.data.swapId).lean();
    if (!swap) { res.status(404).json({ message: 'Swap not found' }); return; }
    const userId = String(req.user?._id || '');
    if (![String(swap.requester), String(swap.recipient)].includes(userId)) { res.status(403).json({ message: 'Only exchange participants can generate a lesson plan' }); return; }
    if (swap.status !== 'accepted') { res.status(409).json({ message: 'Accept the exchange before planning a session' }); return; }
    const syllabus = await aiSessionService.generateSyllabus({
      offeredSkill: swap.requestedSkill.name,
      level: swap.requestedSkill.proficiency || 'intermediate',
      learningGoal: parsed.data.learningGoal,
      durationMinutes: parsed.data.durationMinutes,
    });
    res.json({ syllabus });
  }));

  return router;
}
