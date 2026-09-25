import { GoogleGenAI } from '@google/genai';
import { NextFunction, RequestHandler, Response } from 'express';
import { z } from 'zod';

const recommendSkillsInput = z.object({
  skills: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
}).strict();

const recommendSkillsOutput = z.object({
  recommendations: z.array(z.object({
    skill: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(1).max(240),
  }).strict()).min(1).max(8),
}).strict();

const responseSchema = {
  type: 'OBJECT',
  required: ['recommendations'],
  properties: {
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['skill', 'reason'],
        properties: { skill: { type: 'STRING' }, reason: { type: 'STRING' } },
      },
    },
  },
} as const;

export const recommendSkills: RequestHandler = async (req, res: Response, next: NextFunction) => {
  try {
    const parsed = recommendSkillsInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Provide between 1 and 30 valid skills', issues: parsed.error.issues }); return; }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(503).json({ message: 'AI recommendations are not configured' }); return; }

    const skills = [...new Set(parsed.data.skills.map((skill) => skill.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, '').trim()).filter(Boolean))];
    if (skills.length === 0) { res.status(400).json({ message: 'Provide at least one valid skill' }); return; }
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: `Suggest complementary skills a peer-learning member could teach or learn based on this list: ${JSON.stringify(skills)}. Return practical, distinct skills not already listed, with a short reason for each.`,
      config: { responseMimeType: 'application/json', responseSchema },
    });
    const output = recommendSkillsOutput.safeParse(JSON.parse(result.text || '{}'));
    if (!output.success) { res.status(502).json({ message: 'AI returned an invalid recommendation response' }); return; }
    const existing = new Set(skills.map((skill) => skill.toLocaleLowerCase()));
    const recommendations = output.data.recommendations
      .filter((item) => !existing.has(item.skill.toLocaleLowerCase()))
      .slice(0, 8);
    res.json({ recommendations });
  } catch (error) {
    if (error instanceof SyntaxError) { res.status(502).json({ message: 'AI returned an invalid recommendation response' }); return; }
    next(error);
  }
};
