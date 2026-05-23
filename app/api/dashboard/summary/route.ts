import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';
import { listResumeTemplates } from '@/lib/server/template-service';

export const runtime = 'nodejs';

type ResumeRow = {
  id: string;
  company_name: string;
  job_title: string;
  source_platform?: string;
  ats_score: number;
  status: string;
  created_at: string;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: Array<{ action: string; impact_pct: number; reason: string }>;
};

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const [profile, recentResumesResult, allResumesResult, templates] = await Promise.all([
      getFullProfile(userId),
      db.query<ResumeRow>(
        `SELECT id, company_name, job_title, source_platform, ats_score, status, created_at
         FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 6`,
        [userId]
      ),
      db.query<ResumeRow>(
        `SELECT id, company_name, job_title, source_platform, ats_score, status, created_at,
                matched_keywords, missing_keywords, suggestions
         FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 18`,
        [userId]
      ),
      listResumeTemplates(),
    ]);

    const resumes = allResumesResult.rows;
    const recentResumes = recentResumesResult.rows;
    const currentBatch = resumes.slice(0, 5);
    const previousBatch = resumes.slice(5, 10);

    const currentAverage = average(currentBatch.map((resume) => resume.ats_score ?? 0));
    const previousAverage = average(previousBatch.map((resume) => resume.ats_score ?? 0));
    const avgDelta = previousBatch.length
      ? `${formatSignedDelta(Math.round(currentAverage - previousAverage))} readiness points vs previous batch`
      : 'Build your first job-readiness baseline';

    const missingKeywords = countTopTerms(resumes.flatMap((resume) => resume.missing_keywords ?? []), 6);
    const matchedKeywords = resumes.reduce(
      (total, resume) => total + (resume.matched_keywords?.length ?? 0),
      0
    );
    const missingKeywordCount = resumes.reduce(
      (total, resume) => total + (resume.missing_keywords?.length ?? 0),
      0
    );
    const keywordMatchRate =
      matchedKeywords + missingKeywordCount > 0
        ? Math.round((matchedKeywords / (matchedKeywords + missingKeywordCount)) * 100)
        : 0;

    const recommendationPool = resumes.flatMap((resume) => resume.suggestions ?? []);
    const recommendations = recommendationPool
      .sort((left, right) => (right.impact_pct ?? 0) - (left.impact_pct ?? 0))
      .slice(0, 4);

    const profileCompletion = calculateProfileCompletion(profile);
    const trend = [...recentResumes]
      .reverse()
      .map((resume) => ({
        label: new Date(resume.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: resume.ats_score ?? 0,
      }));

    const stats = [
      {
        label: 'Application Assets',
        value: resumes.length,
        delta: resumes.length > 0 ? `+${Math.min(resumes.length, 5)} recent role packages` : 'Start your first target role',
        helper: 'Resumes and application drafts prepared',
        trend: 'up' as const,
      },
      {
        label: 'Avg Readiness',
        value: Math.round(currentAverage),
        delta: avgDelta,
        helper: 'Across your latest target roles',
        trend: currentAverage >= previousAverage ? 'up' as const : 'down' as const,
      },
      {
        label: 'Jobs Targeted',
        value: new Set(resumes.map((resume) => resume.company_name)).size,
        delta: resumes.length > 0 ? `${countPlatforms(resumes)} source channels tracked` : 'LinkedIn, Indeed, Naukri, Manual',
        helper: 'Distinct companies or roles pursued',
        trend: 'steady' as const,
      },
      {
        label: 'Strongest Fit',
        value: Math.max(0, ...resumes.map((resume) => resume.ats_score ?? 0)),
        delta: missingKeywords.length > 0 ? `${missingKeywords[0]} is still a common evidence gap` : 'No repeated gaps detected yet',
        helper: 'Best role-readiness result so far',
        trend: 'up' as const,
      },
    ];

    const nextSteps = buildNextSteps({
      resumesCount: resumes.length,
      profileCompletion,
      missingKeywords,
      recommendations,
    });

    return NextResponse.json({
      templateCount: templates.length,
      stats,
      quickActions: [
        {
          id: 'paste-jd',
          title: 'Evaluate a target role',
          description: 'Understand fit, risks, gaps, and whether to apply now or improve first.',
          href: '/jd-analysis',
        },
        {
          id: 'create-resume',
          title: 'Prepare application assets',
          description: 'Generate a role-specific resume after you know the positioning strategy.',
          href: '/new-resume',
        },
        {
          id: 'history',
          title: 'Review target history',
          description: 'Compare past roles, readiness, statuses, and companies in one place.',
          href: '/resume-history',
        },
        {
          id: 'profile',
          title: 'Strengthen your account profile',
          description: 'Add quantified achievements, projects, skills, and proof points.',
          href: '/settings?tab=profile',
        },
      ],
      recentResumes,
      atsInsights: {
        averageKeywordMatch: keywordMatchRate,
        topMissingKeywords: missingKeywords,
        recommendations,
        profileCompletion,
        profileStrength:
          profileCompletion >= 80 ? 'Ready to tailor quickly' : profileCompletion >= 55 ? 'Solid base, a few gaps left' : 'Profile needs a stronger base',
      },
      trend,
      nextSteps,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatSignedDelta(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function countTopTerms(values: string[], limit: number) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function calculateProfileCompletion(profile: {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary?: string;
  technicalSkills?: string[];
  skills?: string[];
  experiences?: unknown[];
  projects?: unknown[];
  education?: unknown[];
}) {
  const checks = [
    hasText(profile.name),
    hasText(profile.email),
    hasText(profile.phone),
    hasText(profile.location),
    hasText(profile.linkedin),
    hasText(profile.summary),
    Boolean(profile.technicalSkills?.length || profile.skills?.length),
    Boolean(profile.experiences?.length),
    Boolean(profile.projects?.length),
    Boolean(profile.education?.length),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function hasText(value?: string) {
  return Boolean(value?.trim());
}

function countPlatforms(resumes: Array<{ source_platform?: string }>) {
  return new Set(resumes.map((resume) => resume.source_platform ?? 'manual')).size;
}

function buildNextSteps(input: {
  resumesCount: number;
  profileCompletion: number;
  missingKeywords: string[];
  recommendations: Array<{ action: string }>;
}) {
  const steps: string[] = [];

  if (input.resumesCount === 0) {
    steps.push('Evaluate one real job description and decide whether to apply now, improve first, or skip.');
  }
  if (input.profileCompletion < 80) {
    steps.push('Complete more of your profile so the app can find stronger proof points for each role.');
  }
  if (input.missingKeywords.length > 0) {
    steps.push(`Add real evidence for gaps like ${input.missingKeywords.slice(0, 3).join(', ')} before chasing a higher score.`);
  }
  if (input.recommendations.length > 0) {
    steps.push(input.recommendations[0].action);
  }

  return steps.slice(0, 4);
}
