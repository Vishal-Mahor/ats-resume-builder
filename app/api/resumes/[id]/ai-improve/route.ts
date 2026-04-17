import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ResumeContent, Suggestion } from '@/lib/api';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { callOpenAI } from '@/lib/server/ai';
import { refreshResumeAtsAnalysis } from '@/lib/server/ats-service';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  resume_content: z.any(),
  focus_text: z.string().max(4000).optional(),
});

const resumeContentSchema = z.object({
  summary: z.string().default(''),
  skills: z.any(),
  experience: z.array(z.object({
    job_title: z.string().default(''),
    company: z.string().default(''),
    location: z.string().optional(),
    start_date: z.string().default(''),
    end_date: z.string().optional(),
    is_current: z.boolean().optional(),
    bullets: z.array(z.string()).default([]),
  })).default([]),
  projects: z.array(z.object({
    name: z.string().default(''),
    tech_stack: z.string().default(''),
    description: z.string().optional(),
    summary: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    url: z.string().optional(),
  })).default([]),
  education: z.array(z.object({
    degree: z.string().default(''),
    institution: z.string().default(''),
    year: z.string().default(''),
    gpa: z.string().optional(),
    bullets: z.array(z.string()).optional(),
  })).default([]),
  achievements: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  hobbies: z.array(z.string()).optional(),
});

const responseSchema = z.object({
  resume_content: resumeContentSchema,
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());

    const {
      rows: [resume],
    } = await db.query<{
      company_name: string;
      job_title: string;
      matched_keywords?: string[] | string;
      missing_keywords?: string[] | string;
      suggestions?: Suggestion[] | string;
    }>(
      `SELECT company_name, job_title, matched_keywords, missing_keywords, suggestions
       FROM resumes
       WHERE id=$1 AND user_id=$2`,
      [id, userId]
    );

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    const matchedKeywords = parseJsonArray<string>(resume.matched_keywords);
    const missingKeywords = parseJsonArray<string>(resume.missing_keywords);
    const suggestions = parseJsonArray<Suggestion>(resume.suggestions);

    const prompt = buildAiImprovePrompt({
      companyName: resume.company_name,
      jobTitle: resume.job_title,
      currentResumeContent: body.resume_content as ResumeContent,
      matchedKeywords,
      missingKeywords,
      suggestions,
      focusText: body.focus_text,
    });

    const raw = await callOpenAI(prompt);
    const parsed = responseSchema.parse(JSON.parse(raw));
    const improvedResumeContent = parsed.resume_content as ResumeContent;

    const ats = refreshResumeAtsAnalysis({
      resumeContent: improvedResumeContent,
      matchedKeywords,
      missingKeywords,
      suggestions,
    });

    return NextResponse.json({
      resume_content: improvedResumeContent,
      ats_score: ats.atsScore,
      matched_keywords: ats.matchedKeywords,
      missing_keywords: ats.missingKeywords,
      suggestions: ats.suggestions,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function buildAiImprovePrompt(input: {
  companyName: string;
  jobTitle: string;
  currentResumeContent: ResumeContent;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
  focusText?: string;
}) {
  return `
You are an ATS resume improver.

Task:
- Improve the provided resume content for the role "${input.jobTitle}" at "${input.companyName}".
- Use JD-derived context (missing keywords + suggestions) to improve relevance.
- Read the current textbox content and preserve factual truth.

Strict rules:
1) Do NOT invent new experience, tools, metrics, responsibilities, or achievements.
2) Keep edits concise and ATS-friendly.
3) Prefer measurable wording only when already present in source text.
4) Keep the same top-level JSON structure.
5) Maintain existing section order and object count unless a field is empty.
6) Add naturally grounded keywords from missing keywords where valid.
7) Improve summary and bullets first, then skills alignment.

Return ONLY valid JSON in this shape:
{
  "resume_content": {
    "summary": "string",
    "skills": {},
    "experience": [],
    "projects": [],
    "education": [],
    "achievements": [],
    "languages": [],
    "hobbies": []
  }
}

Focus text from active input (if any):
<focus_text>
${input.focusText || ''}
</focus_text>

JD-derived matched keywords:
${JSON.stringify(input.matchedKeywords, null, 2)}

JD-derived missing keywords:
${JSON.stringify(input.missingKeywords, null, 2)}

JD-derived suggestions:
${JSON.stringify(input.suggestions, null, 2)}

Current resume content:
${JSON.stringify(input.currentResumeContent, null, 2)}
`;
}

function parseJsonArray<T>(value: unknown) {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
