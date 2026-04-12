import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callOpenAI } from '@/lib/server/ai';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import { JD_ANALYSIS_PROMPT, MATCH_PROFILE_PROMPT } from '@/lib/server/prompts';

export const runtime = 'nodejs';

const analysisSchema = z.object({
  job_description: z.string().min(50).max(8000),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = analysisSchema.parse(await request.json());
    const userProfile = await getFullProfile(userId);

    const jdAnalysis = JSON.parse(await callOpenAI(JD_ANALYSIS_PROMPT(body.job_description)));
    const matchResult = JSON.parse(await callOpenAI(MATCH_PROFILE_PROMPT(userProfile, jdAnalysis)));

    const matchLabel =
      matchResult.ats_score >= 80 ? 'Strong match' : matchResult.ats_score >= 65 ? 'Promising fit' : 'Needs strengthening';

    return NextResponse.json({
      extractedRole: inferRoleFromAnalysis(jdAnalysis),
      seniorityLevel: jdAnalysis.seniority_level ?? 'unknown',
      domain: jdAnalysis.domain ?? 'other',
      yearsExperience: Number(jdAnalysis.min_years_experience ?? 0),
      requiredSkills: jdAnalysis.required_skills ?? [],
      preferredSkills: jdAnalysis.preferred_skills ?? [],
      keywords: jdAnalysis.keywords ?? [],
      techStack: jdAnalysis.tech_stack_mentioned ?? [],
      responsibilities: jdAnalysis.key_responsibilities ?? [],
      matchedSkills: matchResult.matched_skills ?? [],
      missingSkills: matchResult.missing_skills ?? [],
      matchedKeywords: matchResult.matched_keywords ?? [],
      missingKeywords: matchResult.missing_keywords ?? [],
      strengths: matchResult.strengths ?? [],
      gaps: matchResult.gaps ?? [],
      suggestions: matchResult.suggestions ?? [],
      atsScore: Number(matchResult.ats_score ?? 0),
      profileMatchLabel: matchLabel,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function inferRoleFromAnalysis(jdAnalysis: Record<string, unknown>) {
  const techStack = Array.isArray(jdAnalysis.tech_stack_mentioned) ? jdAnalysis.tech_stack_mentioned : [];
  const domain = typeof jdAnalysis.domain === 'string' ? jdAnalysis.domain : 'other';

  if (domain === 'frontend') return 'Frontend-focused role';
  if (domain === 'backend') return 'Backend-focused role';
  if (domain === 'fullstack') return 'Full-stack role';
  if (domain === 'ml') return 'Machine learning role';
  if (domain === 'devops') return 'Platform or DevOps role';
  if (techStack.length > 0) return `${String(techStack[0])} oriented role`;
  return 'General software role';
}
