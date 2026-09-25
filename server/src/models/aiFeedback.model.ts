import { Model, model, models, Schema, Types } from 'mongoose';
import { z } from 'zod';

export const debriefInputSchema = z.object({
  topicsCovered: z.array(z.string().trim().min(1).max(160)).max(20),
  challenges: z.string().trim().max(2000).default(''),
}).strict();
export const aiFeedbackOutputSchema = z.object({
  learnerRecommendations: z.array(z.string().min(1).max(500)).min(1).max(8),
  teachingInsights: z.object({ strengths: z.array(z.string().max(400)).max(8), improvements: z.array(z.string().max(400)).max(8) }).strict(),
  nextSteps: z.array(z.object({ title: z.string().max(160), detail: z.string().max(500), estimatedMinutes: z.number().int().min(5).max(240) }).strict()).length(3),
}).strict();
export type AIFeedbackOutput = z.infer<typeof aiFeedbackOutputSchema>;

export interface AIFeedbackRecord extends AIFeedbackOutput {
  sessionId: Types.ObjectId;
  debriefs: Array<{ userId: Types.ObjectId; topicsCovered: string[]; challenges: string; submittedAt: Date }>;
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiFeedbackSchema = new Schema<AIFeedbackRecord>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, unique: true },
  debriefs: [{ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, topicsCovered: { type: [String], default: [] }, challenges: { type: String, maxlength: 2000, default: '' }, submittedAt: { type: Date, default: Date.now } }],
  learnerRecommendations: { type: [String], default: [] },
  teachingInsights: { strengths: { type: [String], default: [] }, improvements: { type: [String], default: [] } },
  nextSteps: [{ title: { type: String, required: true, maxlength: 160 }, detail: { type: String, required: true, maxlength: 500 }, estimatedMinutes: { type: Number, min: 5, max: 240, required: true } }],
  generatedAt: Date,
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true });

export const AIFeedback = (models.AIFeedback as Model<AIFeedbackRecord> | undefined) || model<AIFeedbackRecord>('AIFeedback', aiFeedbackSchema);
