import { Model, model, models, Schema, Types } from 'mongoose';

export interface RefreshTokenRecord {
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  isAdmin?: boolean;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  familyId: { type: String, required: true, index: true, maxlength: 64 },
  tokenHash: { type: String, required: true, unique: true, select: false },
  isAdmin: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedByHash: { type: String, select: false },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, familyId: 1 });

export const RefreshToken = (models.RefreshToken as Model<RefreshTokenRecord> | undefined) || model<RefreshTokenRecord>('RefreshToken', refreshTokenSchema);
