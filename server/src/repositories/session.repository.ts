import { Types } from 'mongoose';
import { Session, SessionRecord } from '../models/session.model';

export class SessionRepository {
  findParticipantSession(sessionId: string, participantId: string) {
    if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(participantId)) return Promise.resolve(null);
    return Session.findOne({ _id: sessionId, participants: new Types.ObjectId(participantId) });
  }

  create(record: Omit<SessionRecord, 'createdAt' | 'updatedAt'>) {
    return Session.create(record);
  }
}

export const sessionRepository = new SessionRepository();
