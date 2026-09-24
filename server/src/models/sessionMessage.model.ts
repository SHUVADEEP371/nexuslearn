import { Model, model, models, Schema, Types } from 'mongoose';
import { z } from 'zod';

export const chatMessageInput = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i), clientMessageId: z.string().min(8).max(100), body: z.string().trim().min(1).max(4000) }).strict();
export interface SessionMessageRecord {
  sessionId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientMessageId: string;
  body: string;
  createdAt: Date;
}

const sessionMessageSchema = new Schema<SessionMessageRecord>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientMessageId: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' });

sessionMessageSchema.index({ sessionId: 1, createdAt: -1 });
sessionMessageSchema.index({ sessionId: 1, senderId: 1, clientMessageId: 1 }, { unique: true });
export const SessionMessage = (models.SessionMessage as Model<SessionMessageRecord> | undefined) || model<SessionMessageRecord>('SessionMessage', sessionMessageSchema);
