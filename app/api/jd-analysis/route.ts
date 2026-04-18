import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import { getUserSettings } from '@/lib/server/settings-service';
import { assertCanUse, consumeUsage } from '@/lib/server/billing-service';
import { analyzeCandidateAgainstJD } from '@/lib/server/tailoring-pipeline';

export const runtime = 'nodejs';

const analysisSchema = z.object({
  job_description: z.string().min(50).max(8000),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = analysisSchema.parse(await request.json());
    await assertCanUse(userId, 'jd-analysis');
    const [userProfile, userSettings] = await Promise.all([getFullProfile(userId), getUserSettings(userId)]);

    const result = await analyzeCandidateAgainstJD({
      jobDescription: body.job_description,
      candidateProfile: userProfile,
      resumeSettings: userSettings.resume,
    });
    await consumeUsage(userId, 'jd-analysis');

    const matchLabel =
      result.deterministic.score >= 80 ? 'Strong match' : result.deterministic.score >= 65 ? 'Promising fit' : 'Needs strengthening';
    const mappings = result.mappings.mappings ?? [];

    return NextResponse.json({
      extractedRole: inferRoleFromAnalysis(result.jdParse),
      seniorityLevel: result.jdParse.seniority ?? 'unknown',
      domain: result.jdParse.domain?.[0] ?? 'other',
      yearsExperience: Number(result.jdParse.minimum_years_experience ?? 0),
      requiredSkills: (result.jdParse.required_skills ?? []).map((item) => item.name),
      preferredSkills: (result.jdParse.preferred_skills ?? []).map((item) => item.name),
      keywords: result.jdParse.explicit_keywords ?? [],
      techStack: result.jdParse.tools_platforms ?? [],
      responsibilities: (result.jdParse.responsibilities ?? []).map((item) => item.text),
      matchedSkills: result.deterministic.matchedSkills ?? [],
      missingSkills: result.deterministic.missingSkills ?? [],
      matchedKeywords: result.deterministic.matchedKeywords ?? [],
      missingKeywords: result.deterministic.missingKeywords ?? [],
      strengths: mappings
        .filter((item) => item.match_strength === 'strong_match')
        .slice(0, 4)
        .map((item) => item.rationale),
      gaps: mappings
        .filter((item) => item.match_strength === 'no_match')
        .slice(0, 4)
        .map((item) => `No grounded evidence found for ${findRequirementLabel(result.jdParse, item.requirement_id)}.`),
      suggestions: buildAnalysisSuggestions(result.jdParse, result.mappings),
      atsScore: Number(result.deterministic.score ?? 0),
      profileMatchLabel: matchLabel,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function inferRoleFromAnalysis(jdAnalysis: {
  title?: string;
  domain?: string[];
  tools_platforms?: string[];
}) {
  const techStack = jdAnalysis.tools_platforms ?? [];
  const domain = jdAnalysis.domain?.[0] ?? 'other';

  if (jdAnalysis.title) return jdAnalysis.title;
  if (domain === 'frontend') return 'Frontend-focused role';
  if (domain === 'backend') return 'Backend-focused role';
  if (domain === 'fullstack') return 'Full-stack role';
  if (domain === 'ml') return 'Machine learning role';
  if (domain === 'devops') return 'Platform or DevOps role';
  if (techStack.length > 0) return `${String(techStack[0])} oriented role`;
  return 'General software role';
}

function findRequirementLabel(
  jdAnalysis: {
    responsibilities?: Array<{ id: string; text: string }>;
    required_skills?: Array<{ id: string; name: string }>;
    preferred_skills?: Array<{ id: string; name: string }>;
  },
  requirementId: string
) {
  return (
    jdAnalysis.responsibilities?.find((item) => item.id === requirementId)?.text ||
    jdAnalysis.required_skills?.find((item) => item.id === requirementId)?.name ||
    jdAnalysis.preferred_skills?.find((item) => item.id === requirementId)?.name ||
    'a target requirement'
  );
}

function buildAnalysisSuggestions(
  jdAnalysis: {
    responsibilities?: Array<{ id: string; text: string; weight: number }>;
    required_skills?: Array<{ id: string; name: string; weight: number }>;
    preferred_skills?: Array<{ id: string; name: string; weight: number }>;
  },
  mappings: {
    mappings?: Array<{
      requirement_id: string;
      match_strength: 'strong_match' | 'partial_match' | 'adjacent_match' | 'no_match';
      unsupported_terms_to_avoid?: string[];
    }>;
  }
) {
  return (mappings.mappings ?? [])
    .filter((item) => item.match_strength !== 'strong_match')
    .slice(0, 6)
    .map((item) => {
      const label = findRequirementLabel(jdAnalysis, item.requirement_id);
      const impact =
        item.match_strength === 'partial_match'
          ? 7
          : item.match_strength === 'adjacent_match'
            ? 9
            : 11;

      return {
        action: `Strengthen evidence for ${label}`,
        impact_pct: impact,
        reason:
          item.match_strength === 'no_match'
            ? `This requirement has no grounded evidence yet. Avoid unsupported terms like ${(item.unsupported_terms_to_avoid ?? []).slice(0, 3).join(', ') || 'unverified tools'}.`
            : `This area is only partially supported right now. Add stronger evidence-backed bullets if the candidate has it.`,
      };
    });
}
