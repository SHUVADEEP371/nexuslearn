import { Document, Model, model, models, Schema, Types } from 'mongoose';
import { z } from 'zod';

export const UserAvailabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
}).strict();

const walletSchema = z.object({
  availableCredits: z.number().finite().min(0).default(2),
  lockedCredits: z.number().finite().min(0).default(0),
}).strict();

const normalizedSkills = z.array(z.string().trim().min(1).max(80).transform((skill) => skill.toLowerCase())).min(1).max(100);
export const UserValidationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  skillsOffered: normalizedSkills,
  skillsWanted: normalizedSkills,
  reputationScore: z.number().finite().min(0).max(5).default(5),
  ratingCount: z.number().int().min(0).default(0),
  wallet: walletSchema.default({ availableCredits: 2, lockedCredits: 0 }),
  availableSlots: z.array(z.number().int().min(0).max(167)).max(168).default([]),
  bio: z.string().max(500).optional(),
}).strict();

export type IUser = z.infer<typeof UserValidationSchema>;
export interface IUserDocument extends IUser, Document<Types.ObjectId> {
  createdAt: Date;
  updatedAt: Date;
}

const userContractSchema = new Schema<IUserDocument>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
  skillsOffered: { type: [String], required: true, validate: [(skills: string[]) => skills.length > 0, 'At least one offered skill is required'] },
  skillsWanted: { type: [String], required: true, validate: [(skills: string[]) => skills.length > 0, 'At least one wanted skill is required'] },
  reputationScore: { type: Number, min: 0, max: 5, default: 5 },
  ratingCount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  wallet: {
    availableCredits: { type: Number, min: 0, default: 2 },
    lockedCredits: { type: Number, min: 0, default: 0 },
  },
  availableSlots: { type: [{ type: Number, min: 0, max: 167, validate: Number.isInteger }], default: [] },
  bio: { type: String, maxlength: 500 },
}, { timestamps: true, strict: 'throw', collection: 'users' });

// MongoDB cannot compound-index two array fields together for documents that
// populate both arrays. Keep each skill direction compound-indexed with its
// scalar ranking key instead, and retain the standalone reputation index.
userContractSchema.index({ skillsOffered: 1, reputationScore: -1 });
userContractSchema.index({ skillsWanted: 1, reputationScore: -1 });
userContractSchema.index({ reputationScore: -1 });

// A separate model name avoids replacing the legacy User model's richer schema;
// both models intentionally target the same physical users collection.
export const UserModel = (models.NexusUserContract as Model<IUserDocument> | undefined)
  || model<IUserDocument>('NexusUserContract', userContractSchema, 'users');
