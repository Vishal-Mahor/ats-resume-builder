import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { FullProfile, ResumeContent } from '@/lib/api';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { db } from '@/lib/server/db';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import { callOpenAI } from '@/lib/server/ai';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  resume_content: z.any(),
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

const chatResponseSchema = z.object({
  allowed: z.boolean(),
  reply: z.string().min(1),
  resume_content: resumeContentSchema.optional(),
  changes: z.array(z.string()).default([]),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const body = requestSchema.parse(await request.json());
    const currentResumeContent = resumeContentSchema.parse(body.resume_content) as ResumeContent;

    const {
      rows: [resume],
    } = await db.query<{ company_name: string; job_title: string }>(
      'SELECT company_name, job_title FROM resumes WHERE id=$1 AND user_id=$2',
      [id, userId]
    );

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    const profile = await getFullProfile(userId);
    const raw = await callOpenAI(
      buildResumeChatPrompt({
        message: body.message,
        resumeName: resume.company_name,
        jobTitle: resume.job_title,
        currentResumeContent,
        profile,
      }),
      true,
      'gpt-5.4-mini'
    );
    const parsed = chatResponseSchema.parse(JSON.parse(raw));

    if (!parsed.allowed) {
      return NextResponse.json({
        allowed: false,
        reply: parsed.reply,
        changes: [],
      });
    }

    return NextResponse.json({
      allowed: true,
      reply: parsed.reply,
      changes: parsed.changes,
      resume_content: resumeContentSchema.parse(parsed.resume_content ?? currentResumeContent),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function buildResumeChatPrompt(input: {
  message: string;
  resumeName: string;
  jobTitle: string;
  currentResumeContent: ResumeContent;
  profile: FullProfile;
}) {
  return `
You are a resume-editing assistant embedded inside an ATS resume builder.

Hard guardrails:
- Only help with editing, improving, adding, removing, reorganizing, or tailoring content inside the provided resume JSON.
- If the user asks for anything outside resume editing, return allowed=false and refuse briefly.
- Do not answer general questions, write unrelated content, browse, code, plan travel, give legal/medical/financial advice, or discuss topics unrelated to this resume.
- Do not invent employers, degrees, dates, certifications, metrics, tools, or achievements that are not already present in the resume/profile or explicitly provided by the user.
- You may improve wording, clarity, ATS keyword alignment, grammar, concision, and bullet strength using only supported information.
- If the user asks to remove something, remove only the requested resume item.
- Return valid JSON only. No markdown. No commentary outside JSON.

Output schema:
{
  "allowed": boolean,
  "reply": "short user-facing response",
  "changes": ["short change summary"],
  "resume_content": { full updated resume content, same shape as input }
}

Resume name: ${JSON.stringify(input.resumeName)}
Target/base role: ${JSON.stringify(input.jobTitle)}
User message: ${JSON.stringify(input.message)}

Saved profile context, for support only:
${JSON.stringify({
  name: input.profile.name,
  summary: input.profile.summary,
  skills: input.profile.skills,
  technicalSkills: input.profile.technicalSkills,
  softSkills: input.profile.softSkills,
  experiences: input.profile.experiences,
  projects: input.profile.projects,
  education: input.profile.education,
  achievements: input.profile.achievements,
  languages: input.profile.languages,
}, null, 2)}

Current resume JSON:
${JSON.stringify(input.currentResumeContent, null, 2)}
`;
}
