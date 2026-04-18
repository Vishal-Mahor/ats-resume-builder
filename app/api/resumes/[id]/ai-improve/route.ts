import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ResumeAnalysisSnapshot, ResumeContent, Suggestion } from '@/lib/api';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { getFullProfile } from '@/lib/server/profile-service';
import { getUserSettings } from '@/lib/server/settings-service';
import { improveResumeWithContext } from '@/lib/server/tailoring-pipeline';

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
  section_visibility: z.object({
    summary: z.boolean().optional(),
    skills: z.boolean().optional(),
    experience: z.boolean().optional(),
    projects: z.boolean().optional(),
    achievements: z.boolean().optional(),
    education: z.boolean().optional(),
    languages: z.boolean().optional(),
    hobbies: z.boolean().optional(),
  }).optional(),
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
      analysis_snapshot?: ResumeAnalysisSnapshot | string;
      matched_keywords?: string[] | string;
      missing_keywords?: string[] | string;
      suggestions?: Suggestion[] | string;
    }>(
      `SELECT company_name, job_title, analysis_snapshot, matched_keywords, missing_keywords, suggestions
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

    const [profile, userSettings] = await Promise.all([getFullProfile(userId), getUserSettings(userId)]);
    const improved = await improveResumeWithContext({
      companyName: resume.company_name,
      jobTitle: resume.job_title,
      currentResumeContent: resumeContentSchema.parse(body.resume_content) as ResumeContent,
      focusText: body.focus_text,
      candidateProfile: profile,
      resumeSettings: userSettings.resume,
      analysisSnapshot: parseOptionalJsonObject<ResumeAnalysisSnapshot>(resume.analysis_snapshot),
      matchedKeywords,
      missingKeywords,
      suggestions,
    });

    return NextResponse.json({
      resume_content: improved.resumeContent,
      ats_score: improved.atsReport.overallScore,
      matched_keywords: improved.atsReport.matchedKeywords,
      missing_keywords: improved.atsReport.missingKeywords,
      suggestions: improved.atsReport.suggestions,
      analysis_snapshot: improved.analysisSnapshot,
    });
  } catch (error) {
    return handleRouteError(error);
  }
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

function parseOptionalJsonObject<T>(value: unknown) {
  if (value && typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}
