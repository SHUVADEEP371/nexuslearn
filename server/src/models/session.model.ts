import { Model, model, models, Schema, Types } from 'mongoose';
import { z } from 'zod';

export const SessionModeSchema = z.enum(['CREDIT', 'PAID']);
export const SessionStatusSchema = z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED']);
export const PaymentStatusSchema = z.enum(['NOT_APPLICABLE', 'PENDING', 'HELD_IN_ESCROW', 'COMPLETED', 'REFUNDED']);
export type SessionMode = z.infer<typeof SessionModeSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type LegacySessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'disputed';
export type PersistedSessionStatus = SessionStatus | LegacySessionStatus;

export const createSessionInput = z.object({
  swapId: z.string().regex(/^[a-f\d]{24}$/i),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240),
  mode: SessionModeSchema.default('CREDIT'),
}).strict();

export interface SessionRecord {
  mentorId: Types.ObjectId;
  learnerId: Types.ObjectId;
  skillOffered: string;
  skillWanted?: string;
  mode: SessionMode;
  status: PersistedSessionStatus;
  startTime: Date;
  endTime: Date;
  priceInInr: number;
  paymentStatus: PaymentStatus | 'PENDING';
  paymentRef?: string;
  notesId?: Types.ObjectId;
  feedbackId?: Types.ObjectId;
  // Compatibility fields retained for existing session rooms and stored records.
  swapId: Types.ObjectId;
  participants: Types.ObjectId[];
  teacherId: Types.ObjectId;
  skill: string;
  startsAt: Date;
  endsAt: Date;
  roomId: string;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionRecord>({
  mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  learnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  skillOffered: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  skillWanted: { type: String, trim: true, maxlength: 120 },
  mode: { type: String, enum: ['CREDIT', 'PAID'], default: 'CREDIT', required: true },
  status: { type: String, enum: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'scheduled', 'live', 'completed', 'cancelled', 'disputed'], default: 'SCHEDULED', index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  priceInInr: { type: Number, min: 0, default: 0 },
  paymentStatus: { type: String, enum: ['NOT_APPLICABLE', 'PENDING', 'HELD_IN_ESCROW', 'COMPLETED', 'REFUNDED'], default: 'HELD_IN_ESCROW', required: true },
  paymentRef: { type: String, trim: true, maxlength: 200 },
  notesId: { type: Schema.Types.ObjectId, ref: 'AINote' },
  feedbackId: { type: Schema.Types.ObjectId, ref: 'AIFeedback' },
  swapId: { type: Schema.Types.ObjectId, ref: 'Swap', required: true, index: true },
  participants: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true, validate: [(ids: Types.ObjectId[]) => ids.length === 2 && new Set(ids.map((id) => id.toString())).size === 2, 'A session must have exactly two distinct participants'] },
  teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  skill: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true },
  roomId: { type: String, required: true, unique: true, immutable: true },
  endedAt: Date,
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });

sessionSchema.pre('validate', function validateTimeRange(next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) this.invalidate('endTime', 'Session end time must be after start time');
  next();
});

sessionSchema.index({ mentorId: 1, startTime: 1 });
sessionSchema.index({ learnerId: 1, startTime: 1 });
sessionSchema.index({ swapId: 1, startsAt: 1 }, { unique: true });
sessionSchema.index({ participants: 1, startsAt: -1 });
sessionSchema.index({ status: 1, endsAt: 1 });

export function isSessionOpen(status: PersistedSessionStatus): boolean {
  return status === 'SCHEDULED' || status === 'ACTIVE' || status === 'scheduled' || status === 'live';
}
export function isSessionCompleted(status: PersistedSessionStatus): boolean {
  return status === 'COMPLETED' || status === 'completed';
}

export const SessionModel = (models.Session as Model<SessionRecord> | undefined) || model<SessionRecord>('Session', sessionSchema);
// Existing repositories import this name; it aliases the dual-mode model.
export const Session = SessionModel;
