import { Types } from 'mongoose';
import { AINote, AINoteRecord } from '../models/aiNote.model';
import { AIFeedback, AIFeedbackRecord } from '../models/aiFeedback.model';

function noteMarkdown(note: { summary: string; takeaways: string[]; codeSnippets: Array<{ language: string; code: string; context: string }>; definitions: Array<{ term: string; definition: string }> }): string {
  const sections = ['## Session summary', note.summary, '## Key takeaways', ...note.takeaways.map((item) => `- ${item}`)];
  if (note.definitions.length) sections.push('## Definitions', ...note.definitions.map((item) => `- **${item.term}:** ${item.definition}`));
  if (note.codeSnippets.length) sections.push('## Code discussed', ...note.codeSnippets.map((item) => `### ${item.context}\n\n\`\`\`${item.language}\n${item.code}\n\`\`\``));
  return sections.join('\n\n').slice(0, 20000);
}

export class AISessionRepository {
  async getNote(sessionId: Types.ObjectId) { return AINote.findOne({ sessionId }); }
  async getFeedback(sessionId: Types.ObjectId) { return AIFeedback.findOne({ sessionId }); }

  async updateMarkdown(sessionId: Types.ObjectId, updatedBy: Types.ObjectId, markdown: string, expectedRevision: number) {
    return AINote.findOneAndUpdate(
      { sessionId, revision: expectedRevision },
      { $set: { markdown, updatedBy }, $inc: { revision: 1 }, $setOnInsert: { sessionId, summary: '', takeaways: [], codeSnippets: [], definitions: [] } },
      { upsert: expectedRevision === 0, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  async saveDraft(sessionId: Types.ObjectId, updatedBy: Types.ObjectId, draft: Omit<AINoteRecord, 'sessionId' | 'markdown' | 'revision' | 'updatedBy' | 'createdAt' | 'updatedAt'>) {
    const content = { ...draft, markdown: noteMarkdown(draft) };
    return AINote.findOneAndUpdate(
      { sessionId },
      { $set: { ...content, updatedBy }, $inc: { revision: 1 }, $setOnInsert: { sessionId } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  async addDebrief(sessionId: Types.ObjectId, userId: Types.ObjectId, value: { topicsCovered: string[]; challenges: string }) {
    const existing = await AIFeedback.findOne({ sessionId });
    if (!existing) {
      return AIFeedback.create({ sessionId, debriefs: [{ userId, ...value, submittedAt: new Date() }] });
    }
    const old = existing.debriefs.find((item) => item.userId.equals(userId));
    if (old) {
      old.topicsCovered = value.topicsCovered;
      old.challenges = value.challenges;
      old.submittedAt = new Date();
    } else {
      existing.debriefs.push({ userId, ...value, submittedAt: new Date() });
    }
    await existing.save();
    return existing;
  }

  async saveFeedback(sessionId: Types.ObjectId, output: { learnerRecommendations: string[]; teachingInsights: { strengths: string[]; improvements: string[] }; nextSteps: Array<{ title: string; detail: string; estimatedMinutes: number }> }) {
    return AIFeedback.findOneAndUpdate({ sessionId }, { $set: { ...output, generatedAt: new Date() } }, { new: true, runValidators: true });
  }
}

export const aiSessionRepository = new AISessionRepository();
