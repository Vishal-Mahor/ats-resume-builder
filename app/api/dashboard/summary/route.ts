import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import { getFullProfile } from '@/lib/server/profile-service';

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
    const [profile, recentResumesResult, allResumesResult] = await Promise.all([
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
    ]);

    const resumes = allResumesResult.rows;
    const recentResumes = recentResumesResult.rows;
    const currentBatch = resumes.slice(0, 5);
    const previousBatch = resumes.slice(5, 10);

    const currentAverage = average(currentBatch.map((resume) => resume.ats_score ?? 0));
    const previousAverage = average(previousBatch.map((resume) => resume.ats_score ?? 0));
    const avgDelta = previousBatch.length
      ? `${formatSignedDelta(Math.round(currentAverage - previousAverage))} vs previous batch`
      : 'Build your first ATS benchmark';

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
        label: 'Total Resumes Created',
        value: resumes.length,
        delta: resumes.length > 0 ? `+${Math.min(resumes.length, 5)} recent drafts` : 'Start your first role-targeted draft',
        helper: 'All tailored resume versions saved',
        trend: 'up' as const,
      },
      {
        label: 'Average ATS Score',
        value: Math.round(currentAverage),
        delta: avgDelta,
        helper: 'Across your latest tailored resumes',
        trend: currentAverage >= previousAverage ? 'up' as const : 'down' as const,
      },
      {
        label: 'Jobs Targeted',
        value: new Set(resumes.map((resume) => resume.company_name)).size,
        delta: resumes.length > 0 ? `${countPlatforms(resumes)} source channels tracked` : 'LinkedIn, Indeed, Naukri, Manual',
        helper: 'Distinct companies pursued',
        trend: 'steady' as const,
      },
      {
        label: 'Best ATS Match',
        value: Math.max(0, ...resumes.map((resume) => resume.ats_score ?? 0)),
        delta: missingKeywords.length > 0 ? `${missingKeywords[0]} is still a common gap` : 'No keyword gaps detected yet',
        helper: 'Highest scoring resume so far',
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
      stats,
      quickActions: [
        {
          id: 'paste-jd',
          title: 'Paste a job description',
          description: 'Analyze ATS keywords from LinkedIn, Naukri, Indeed, or manual briefs.',
          href: '/jd-analysis',
        },
        {
          id: 'create-resume',
          title: 'Create resume from profile',
          description: 'Use your saved experience and skills to generate a tailored draft faster.',
          href: '/new-resume',
        },
        {
          id: 'history',
          title: 'Review resume history',
          description: 'Compare past ATS scores, statuses, and target companies in one place.',
          href: '/resume-history',
        },
        {
          id: 'profile',
          title: 'Complete your profile',
          description: 'Improve output quality by filling in contact details, achievements, and skills.',
          href: '/profile',
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
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary?: string;
  skills?: string[];
  experiences?: unknown[];
  projects?: unknown[];
  education?: unknown[];
}) {
  const checks = [
    Boolean(profile.phone),
    Boolean(profile.location),
    Boolean(profile.linkedin),
    Boolean(profile.summary),
    Boolean(profile.skills?.length),
    Boolean(profile.experiences?.length),
    Boolean(profile.projects?.length),
    Boolean(profile.education?.length),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
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
    steps.push('Create your first targeted resume from a live job description.');
  }
  if (input.profileCompletion < 80) {
    steps.push('Complete more of your profile so future resumes need less manual editing.');
  }
  if (input.missingKeywords.length > 0) {
    steps.push(`Add missing keywords like ${input.missingKeywords.slice(0, 3).join(', ')} to improve ATS alignment.`);
  }
  if (input.recommendations.length > 0) {
    steps.push(input.recommendations[0].action);
  }

  return steps.slice(0, 4);
}
