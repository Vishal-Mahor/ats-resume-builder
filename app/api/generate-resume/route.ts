import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { callOpenAI } from '@/lib/server/ai';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import {
  COVER_LETTER_PROMPT,
  JD_ANALYSIS_PROMPT,
  MATCH_PROFILE_PROMPT,
  RESUME_GENERATION_PROMPT,
} from '@/lib/server/prompts';

export const runtime = 'nodejs';

const generateSchema = z.object({
  company_name: z.string().min(1).max(200),
  job_title: z.string().min(1).max(200),
  source_platform: z.enum(['linkedin', 'indeed', 'naukri', 'manual']).default('manual'),
  job_description: z.string().min(50).max(8000),
  cover_letter_tone: z.enum(['formal', 'modern', 'aggressive']).default('formal'),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = generateSchema.parse(await request.json());
    const userProfile = await getFullProfile(userId);

    const jdAnalysis = JSON.parse(await callOpenAI(JD_ANALYSIS_PROMPT(body.job_description)));
    const matchResult = JSON.parse(await callOpenAI(MATCH_PROFILE_PROMPT(userProfile, jdAnalysis)));
    const resumeContent = JSON.parse(
      await callOpenAI(
        RESUME_GENERATION_PROMPT(
          userProfile,
          jdAnalysis,
          matchResult,
          body.company_name,
          body.job_title
        )
      )
    );

    const coverLetter = await callOpenAI(
      COVER_LETTER_PROMPT(
        userProfile,
        jdAnalysis,
        resumeContent,
        body.company_name,
        body.job_title,
        body.cover_letter_tone
      ),
      false
    );

    const {
      rows: [resume],
    } = await db.query(
      `INSERT INTO resumes
         (user_id, company_name, job_title, source_platform, resume_content, cover_letter, cover_letter_tone,
          ats_score, matched_keywords, missing_keywords, suggestions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, created_at`,
      [
        userId,
        body.company_name,
        body.job_title,
        body.source_platform,
        JSON.stringify(resumeContent),
        coverLetter,
        body.cover_letter_tone,
        matchResult.ats_score,
        JSON.stringify(matchResult.matched_keywords),
        JSON.stringify(matchResult.missing_keywords),
        JSON.stringify(matchResult.suggestions),
      ]
    );

    return NextResponse.json(
      {
        resume_id: resume.id,
        resume_content: resumeContent,
        cover_letter: coverLetter,
        source_platform: body.source_platform,
        ats_score: matchResult.ats_score,
        matched_keywords: matchResult.matched_keywords,
        missing_keywords: matchResult.missing_keywords,
        suggestions: matchResult.suggestions,
        created_at: resume.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
