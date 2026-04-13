import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { callOpenAI } from '@/lib/server/ai';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import { getUserSettings } from '@/lib/server/settings-service';
import { getResumeTemplateById } from '@/lib/server/template-service';
import { createNotificationForUser } from '@/lib/server/notification-service';
import { assertCanUse, consumeUsage } from '@/lib/server/billing-service';
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
  template_id: z.string().min(1).max(80),
  source_platform: z.enum(['linkedin', 'indeed', 'naukri', 'manual']).default('manual'),
  job_description: z.string().min(50).max(8000),
  cover_letter_tone: z.enum(['formal', 'modern', 'aggressive']).default('formal'),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = generateSchema.parse(await request.json());
    await assertCanUse(userId, 'resume');
    const [userProfile, selectedTemplate, userSettings] = await Promise.all([
      getFullProfile(userId),
      getResumeTemplateById(body.template_id),
      getUserSettings(userId),
    ]);

    if (!selectedTemplate) {
      return NextResponse.json({ error: 'Selected template was not found.' }, { status: 400 });
    }

    if (
      userSettings.verificationRequirement === 'required-before-generation' &&
      !(userProfile.email_verified_at && userProfile.phone_verified_at)
    ) {
      throw new HttpError(403, 'Verify both your email and phone number before generating a resume.');
    }

    const effectiveProfile = userSettings.privacy.allowAiReuse
      ? userProfile
      : {
          ...userProfile,
          summary: '',
          achievements: [],
          languages: [],
          hobbies: [],
          technicalSkills: [],
          softSkills: [],
          skills: [],
          experiences: [],
          projects: [],
          education: [],
        };

    const jdAnalysis = JSON.parse(await callOpenAI(JD_ANALYSIS_PROMPT(body.job_description)));
    const matchResult = JSON.parse(await callOpenAI(MATCH_PROFILE_PROMPT(effectiveProfile, jdAnalysis)));
    const resumeContent = JSON.parse(
      await callOpenAI(
        RESUME_GENERATION_PROMPT(
          effectiveProfile,
          jdAnalysis,
          matchResult,
          body.company_name,
          body.job_title
        )
      )
    );

    const coverLetter = await callOpenAI(
      COVER_LETTER_PROMPT(
        effectiveProfile,
        jdAnalysis,
        resumeContent,
        body.company_name,
        body.job_title,
        body.cover_letter_tone
      ),
      false
    );

    if (!userSettings.privacy.keepResumeHistory) {
      await db.query('DELETE FROM resumes WHERE user_id=$1', [userId]);
    }

    const {
      rows: [resume],
    } = await db.query(
      `INSERT INTO resumes
         (user_id, template_id, company_name, job_title, source_platform, resume_content, cover_letter, cover_letter_tone,
          ats_score, matched_keywords, missing_keywords, suggestions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, created_at`,
      [
        userId,
        body.template_id,
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
    await consumeUsage(userId, 'resume');

    try {
      await createNotificationForUser({
        userId,
        type: 'resume-ready',
        title: 'Resume generated',
        message: `${body.job_title} at ${body.company_name} is ready to review.`,
        metadata: { resumeId: resume.id, company: body.company_name, role: body.job_title },
      });

      if ((matchResult.missing_keywords ?? []).length > 0) {
        await createNotificationForUser({
          userId,
          type: 'ats-alert',
          title: 'ATS keyword gaps found',
          message: `Found ${matchResult.missing_keywords.length} missing keywords for ${body.company_name}.`,
          metadata: { resumeId: resume.id, missingKeywords: matchResult.missing_keywords.slice(0, 8) },
        });
      }

      if (!(userProfile.email_verified_at && userProfile.phone_verified_at)) {
        await createNotificationForUser({
          userId,
          type: 'verification-alert',
          title: 'Verification still pending',
          message: 'Verify your email and phone to unlock stricter verification-based workflows.',
          metadata: { emailVerified: Boolean(userProfile.email_verified_at), phoneVerified: Boolean(userProfile.phone_verified_at) },
        });
      }
    } catch {
      // Notification persistence must never block resume generation.
    }

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
