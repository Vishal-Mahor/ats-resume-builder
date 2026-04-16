import type { ResumeContent, Suggestion } from '@/lib/api';
import { normalizeResumeSkills } from '@/lib/skill-taxonomy';

export function refreshResumeAtsAnalysis(input: {
  resumeContent: ResumeContent;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
}) {
  const targetKeywords = uniqueCaseInsensitive([...input.matchedKeywords, ...input.missingKeywords]);
  const haystack = buildResumeHaystack(input.resumeContent);

  const nextMatched = targetKeywords.filter((keyword) => includesKeyword(haystack, keyword));
  const nextMissing = targetKeywords.filter((keyword) => !includesKeyword(haystack, keyword));
  const nextScore = calculateAtsScore(input.resumeContent, nextMatched.length, targetKeywords.length);

  const nextSuggestions: Suggestion[] = [
    ...nextMissing.slice(0, 6).map((keyword) => ({
      action: `Add ${keyword} to the most relevant section`,
      impact_pct: Math.max(4, Math.round(40 / Math.max(nextMissing.length, 1))),
      reason: `${keyword} is part of the current ATS target set but is not clearly represented in the resume yet.`,
    })),
    ...input.suggestions.filter(
      (suggestion) =>
        !nextMissing.some((keyword) => suggestion.action.toLowerCase().includes(keyword.toLowerCase()))
    ),
  ].slice(0, 8);

  return {
    atsScore: nextScore,
    matchedKeywords: nextMatched,
    missingKeywords: nextMissing,
    suggestions: nextSuggestions,
  };
}

function buildResumeHaystack(content: ResumeContent) {
  const normalizedSkills = normalizeResumeSkills(content.skills);
  const skillTerms = [
    ...normalizedSkills.technical.programming_languages,
    ...normalizedSkills.technical.frameworks,
    ...normalizedSkills.technical.cloud,
    ...normalizedSkills.technical.databases,
    ...normalizedSkills.technical.tools,
    ...normalizedSkills.technical.other,
    ...normalizedSkills.soft,
  ];

  return [
    content.summary,
    ...skillTerms,
    ...content.experience.flatMap((entry) => [entry.job_title, entry.company, entry.location || '', ...entry.bullets]),
    ...content.projects.flatMap((project) => [
      project.name,
      project.tech_stack,
      project.summary || '',
      project.description || '',
      ...(project.bullets || []),
    ]),
    ...content.education.flatMap((entry) => [entry.degree, entry.institution, entry.year, entry.gpa || '', ...(entry.bullets || [])]),
  ]
    .join(' \n ')
    .toLowerCase();
}

function includesKeyword(haystack: string, keyword: string) {
  return haystack.includes(keyword.trim().toLowerCase());
}

function uniqueCaseInsensitive(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item.trim());
  }

  return result;
}

function calculateAtsScore(content: ResumeContent, matchedCount: number, totalCount: number) {
  const keywordCoverage = totalCount > 0 ? matchedCount / totalCount : 1;
  const normalizedSkills = normalizeResumeSkills(content.skills);
  const technicalSkillCount =
    normalizedSkills.technical.programming_languages.length +
    normalizedSkills.technical.frameworks.length +
    normalizedSkills.technical.cloud.length +
    normalizedSkills.technical.databases.length +
    normalizedSkills.technical.tools.length +
    normalizedSkills.technical.other.length;

  let structureBonus = 0;
  if (content.summary.trim().length >= 80) structureBonus += 0.08;
  if (technicalSkillCount >= 6) structureBonus += 0.07;
  if (content.experience.some((entry) => entry.bullets.length >= 2)) structureBonus += 0.06;
  if (content.projects.some((project) => (project.bullets?.length || 0) >= 2)) structureBonus += 0.04;

  return Math.max(30, Math.min(98, Math.round((keywordCoverage * 0.75 + Math.min(structureBonus, 0.25)) * 100)));
}
