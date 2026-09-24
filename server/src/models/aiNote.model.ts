import { Model, model, models, Schema, Types } from 'mongoose';
import { z } from 'zod';

export const aiNoteDraftSchema = z.object({
  summary: z.string().max(4000),
  takeaways: z.array(z.string().min(1).max(500)).max(12),
  codeSnippets: z.array(z.object({ language: z.string().max(40), code: z.string().max(6000), context: z.string().max(300) }).strict()).max(8),
  definitions: z.array(z.object({ term: z.string().max(120), definition: z.string().max(500) }).strict()).max(12),
}).strict();
export type AINoteDraft = z.infer<typeof aiNoteDraftSchema>;

export interface AINoteRecord extends AINoteDraft {
  sessionId: Types.ObjectId;
  markdown: string;
  revision: number;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aiNoteSchema = new Schema<AINoteRecord>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, unique: true },
  summary: { type: String, maxlength: 4000, default: '' },
  takeaways: { type: [String], default: [] },
  codeSnippets: [{ language: { type: String, maxlength: 40 }, code: { type: String, maxlength: 6000 }, context: { type: String, maxlength: 300 } }],
  definitions: [{ term: { type: String, maxlength: 120 }, definition: { type: String, maxlength: 500 } }],
  markdown: { type: String, maxlength: 20000, default: '' },
  revision: { type: Number, min: 0, default: 0 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });

aiNoteSchema.index({ sessionId: 1, revision: 1 });
export const AINote = (models.AINote as Model<AINoteRecord> | undefined) || model<AINoteRecord>('AINote', aiNoteSchema);
