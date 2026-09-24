import { Model, model, models, Schema, Types } from 'mongoose';
import { z } from 'zod';

export const LedgerEntryTypeSchema = z.enum(['HOLD', 'RELEASE', 'REFUND', 'DISPUTE', 'SIGNUP_BONUS', 'DIRECT_UPI_PAYMENT']);
export const LedgerStatusSchema = z.enum(['PENDING', 'COMMITTED', 'ROLLED_BACK']);
export const LedgerCurrencySchema = z.enum(['SKILL_CREDIT', 'INR']);
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;
export type LedgerStatus = z.infer<typeof LedgerStatusSchema>;
export type LedgerCurrency = z.infer<typeof LedgerCurrencySchema>;

export const TransactionLedgerValidationSchema = z.object({
  fromUserId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  toUserId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  sessionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  amount: z.number().finite().positive(),
  currency: LedgerCurrencySchema.default('SKILL_CREDIT'),
  type: LedgerEntryTypeSchema,
  status: LedgerStatusSchema.default('COMMITTED'),
  externalReference: z.string().trim().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export interface TransactionLedgerRecord {
  fromUserId?: Types.ObjectId;
  toUserId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
  amount: number;
  currency: LedgerCurrency;
  type: LedgerEntryType;
  status: LedgerStatus;
  externalReference?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const transactionLedgerSchema = new Schema<TransactionLedgerRecord>({
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  toUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
  amount: { type: Number, required: true, min: Number.EPSILON, validate: Number.isFinite },
  currency: { type: String, enum: ['SKILL_CREDIT', 'INR'], default: 'SKILL_CREDIT', required: true },
  type: { type: String, enum: ['HOLD', 'RELEASE', 'REFUND', 'DISPUTE', 'SIGNUP_BONUS', 'DIRECT_UPI_PAYMENT'], required: true, index: true },
  status: { type: String, enum: ['PENDING', 'COMMITTED', 'ROLLED_BACK'], default: 'COMMITTED', required: true },
  externalReference: { type: String, trim: true, maxlength: 200 },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' });

transactionLedgerSchema.index({ fromUserId: 1, type: 1 });
transactionLedgerSchema.index({ toUserId: 1, type: 1 });
transactionLedgerSchema.index({ sessionId: 1, type: 1 }, { unique: true, partialFilterExpression: { sessionId: { $exists: true } } });

export const TransactionLedgerModel = (models.TransactionLedger as Model<TransactionLedgerRecord> | undefined)
  || model<TransactionLedgerRecord>('TransactionLedger', transactionLedgerSchema);
