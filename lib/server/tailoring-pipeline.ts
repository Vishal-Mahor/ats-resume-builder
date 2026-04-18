import { z } from 'zod';
import type { FullProfile, ResumeAnalysisSnapshot, ResumeContent, ResumeSettings, ResumeSkills, Suggestion } from '@/lib/api';
import { addSkillToResumeSkills, normalizeResumeSkills } from '@/lib/skill-taxonomy';
import { callOpenAI } from '@/lib/server/ai';
import {
  ATS_EVALUATION_PROMPT,
  BULLET_REWRITE_PROMPT,
  CANDIDATE_EVIDENCE_PROMPT,
  COVER_LETTER_PROMPT,
  FINAL_ASSEMBLY_PROMPT,
  JD_PARSING_PROMPT,
  RELEVANCE_MAPPING_PROMPT,
  SUMMARY_GENERATION_PROMPT,
} from '@/lib/server/prompts';

const jdRequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  weight: z.number().min(0).max(1),
  required: z.boolean(),
  kind: z.enum(['responsibility', 'skill', 'domain', 'communication', 'leadership', 'delivery']),
});

const jdSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  canonical_name: z.string().min(1),
  weight: z.number().min(0).max(1),
});

export const jdParseSchema = z.object({
  title: z.string().min(1).default('Target role'),
  seniority: z.enum(['junior', 'mid', 'senior', 'staff', 'lead', 'manager', 'unknown']).default('unknown'),
  domain: z.array(z.string()).default([]),
  responsibilities: z.array(jdRequirementSchema).default([]),
  required_skills: z.array(jdSkillSchema).default([]),
  preferred_skills: z.array(jdSkillSchema).default([]),
  soft_signals: z.array(z.string()).default([]),
  tools_platforms: z.array(z.string()).default([]),
  must_have_requirements: z.array(z.string()).default([]),
  nice_to_have_requirements: z.array(z.string()).default([]),
  explicit_keywords: z.array(z.string()).default([]),
  inferred_keywords: z.array(z.string()).default([]),
  minimum_years_experience: z.number().min(0).default(0),
});

const evidenceUnitSchema = z.object({
  evidence_id: z.string().min(1),
  type: z.enum(['experience_bullet', 'experience_header', 'project', 'education', 'skill', 'summary', 'achievement', 'language']),
  canonical_skill_tags: z.array(z.string()).default([]),
  domain_tags: z.array(z.string()).default([]),
  action: z.string().default(''),
  outcome: z.string().default(''),
  metrics: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  source_section: z.enum(['experience', 'projects', 'education', 'skills', 'summary', 'achievements', 'languages']),
  source_record_id: z.string().min(1),
  source_text: z.string().min(1),
  explicitness: z.enum(['explicit', 'weakly_implied']).default('explicit'),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const candidateEvidenceSchema = z.object({
  candidate_id: z.string().min(1),
  evidence_units: z.array(evidenceUnitSchema).default([]),
});

const mappingSchema = z.object({
  requirement_id: z.string().min(1),
  match_strength: z.enum(['strong_match', 'partial_match', 'adjacent_match', 'no_match']),
  matched_evidence_ids: z.array(z.string()).default([]),
  rationale: z.string().default(''),
  safe_resume_language: z.array(z.string()).default([]),
  unsupported_terms_to_avoid: z.array(z.string()).default([]),
});

export const relevanceMappingSchema = z.object({
  mappings: z.array(mappingSchema).default([]),
});

const rewriteEntrySchema = z.object({
  source_record_id: z.string().min(1),
  rewritten_bullets: z.array(z.string().min(1)).default([]),
  source_evidence_ids: z.array(z.string()).default([]),
  target_requirement_ids: z.array(z.string()).default([]),
  used_keywords: z.array(z.string()).default([]),
});

export const bulletRewriteSchema = z.object({
  experience_rewrites: z.array(rewriteEntrySchema).default([]),
  project_rewrites: z.array(rewriteEntrySchema).default([]),
});

export const summaryGenerationSchema = z.object({
  summary: z.string().min(1),
  supporting_evidence_ids: z.array(z.string()).default([]),
  included_keywords: z.array(z.string()).default([]),
  excluded_keywords_due_to_no_evidence: z.array(z.string()).default([]),
});

export const atsEvaluationSchema = z.object({
  matched_requirements: z.array(z.string()).default([]),
  partially_matched_requirements: z.array(z.string()).default([]),
  missing_requirements: z.array(z.string()).default([]),
  unsupported_claims: z.array(z.string()).default([]),
  stuffing_flags: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  improvement_actions: z.array(z.object({
    action: z.string().min(1),
    impact_pct: z.number().min(0).max(100),
    reason: z.string().min(1),
  })).default([]),
});

export const finalAssemblySchema = z.object({
  ordering_notes: z.array(z.string()).default([]),
  section_priority: z.array(z.string()).default(['summary', 'skills', 'experience', 'projects', 'education']),
});

const aiImproveResponseSchema = z.object({
  resume_content: z.any(),
});

type JDParse = {
  title: string;
  seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'lead' | 'manager' | 'unknown';
  domain: string[];
  responsibilities: Array<z.infer<typeof jdRequirementSchema>>;
  required_skills: Array<z.infer<typeof jdSkillSchema>>;
  preferred_skills: Array<z.infer<typeof jdSkillSchema>>;
  soft_signals: string[];
  tools_platforms: string[];
  must_have_requirements: string[];
  nice_to_have_requirements: string[];
  explicit_keywords: string[];
  inferred_keywords: string[];
  minimum_years_experience: number;
};
type CandidateEvidence = {
  candidate_id: string;
  evidence_units: Array<z.infer<typeof evidenceUnitSchema>>;
};
type RelevanceMapping = {
  mappings: Array<z.infer<typeof mappingSchema>>;
};
type BulletRewrite = {
  experience_rewrites: Array<z.infer<typeof rewriteEntrySchema>>;
  project_rewrites: Array<z.infer<typeof rewriteEntrySchema>>;
};
type SummaryGeneration = z.infer<typeof summaryGenerationSchema>;
type AtsEvaluation = z.infer<typeof atsEvaluationSchema>;

export async function analyzeCandidateAgainstJD(input: {
  jobDescription: string;
  candidateProfile: FullProfile;
  resumeSettings?: ResumeSettings;
}) {
  const candidateSnapshot = buildCandidateSnapshot(input.candidateProfile);
  const prompts = input.resumeSettings?.prompts;
  const jdParse = normalizeJdParse(await runJsonPrompt(JD_PARSING_PROMPT(input.jobDescription, prompts?.jdParsing), jdParseSchema));
  const candidateEvidence = normalizeCandidateEvidence(
    await runJsonPrompt(CANDIDATE_EVIDENCE_PROMPT(candidateSnapshot, prompts?.candidateEvidence), candidateEvidenceSchema)
  );
  const mappings = normalizeRelevanceMappings(
    await runJsonPrompt(RELEVANCE_MAPPING_PROMPT(jdParse, candidateEvidence, prompts?.relevanceMapping), relevanceMappingSchema)
  );
  const deterministic = computeDeterministicMatch(jdParse, candidateEvidence, mappings);

  return {
    jdParse,
    candidateSnapshot,
    candidateEvidence,
    mappings,
    deterministic,
  };
}

export async function generateTailoredResumePackage(input: {
  companyName: string;
  jobTitle: string;
  coverLetterTone: 'formal' | 'modern' | 'aggressive';
  jobDescription: string;
  candidateProfile: FullProfile;
  resumeSettings?: ResumeSettings;
}) {
  const analysis = await analyzeCandidateAgainstJD({
    jobDescription: input.jobDescription,
    candidateProfile: input.candidateProfile,
    resumeSettings: input.resumeSettings,
  });
  const prompts = input.resumeSettings?.prompts;

  const rewrites = normalizeBulletRewrites(await runJsonPrompt(
    BULLET_REWRITE_PROMPT({
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jdParse: analysis.jdParse,
      mappings: analysis.mappings,
      candidateSnapshot: analysis.candidateSnapshot,
    }, prompts?.experienceRewrite),
    bulletRewriteSchema
  ).catch(() => ({ experience_rewrites: [], project_rewrites: [] })));

  const summary = normalizeSummaryGeneration(await runJsonPrompt(
    SUMMARY_GENERATION_PROMPT({
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jdParse: analysis.jdParse,
      mappings: analysis.mappings,
      candidateEvidence: analysis.candidateEvidence,
    }, prompts?.summaryGeneration),
    summaryGenerationSchema
  ).catch(() => buildFallbackSummary(input.candidateProfile, input.jobTitle, analysis.jdParse, analysis.deterministic.matchedKeywords, input.resumeSettings)));

  validateSupportIds(summary.supporting_evidence_ids, analysis.candidateEvidence);

  const draftedResumeContent = assembleResumeContent({
    candidateProfile: input.candidateProfile,
    jdParse: analysis.jdParse,
    candidateEvidence: analysis.candidateEvidence,
    mappings: analysis.mappings,
    rewrites,
    summary,
    resumeSettings: input.resumeSettings,
  });
  const resumeContent = finalizeResumeContent(draftedResumeContent, {
    candidateProfile: input.candidateProfile,
    jdParse: analysis.jdParse,
    candidateEvidence: analysis.candidateEvidence,
    mappings: analysis.mappings,
    resumeSettings: input.resumeSettings,
  });
  validateFinalResumeContent(resumeContent, analysis.candidateEvidence, input.resumeSettings);

  const aiAtsEvaluation = normalizeAtsEvaluation(await runJsonPrompt(
    ATS_EVALUATION_PROMPT({
      jdParse: analysis.jdParse,
      candidateEvidence: analysis.candidateEvidence,
      mappings: analysis.mappings,
      finalResume: resumeContent,
    }, prompts?.atsEvaluation),
    atsEvaluationSchema
  ).catch(() => ({
    matched_requirements: [],
    partially_matched_requirements: [],
    missing_requirements: [],
    unsupported_claims: [],
    stuffing_flags: [],
    strengths: [],
    gaps: [],
    improvement_actions: [],
  })));

  const assembly = normalizeFinalAssembly(await runJsonPrompt(
    FINAL_ASSEMBLY_PROMPT({
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      summary,
      skills: resumeContent.skills,
      rewrittenSections: rewrites,
      candidateSnapshot: analysis.candidateSnapshot,
    }, prompts?.finalAssembly),
    finalAssemblySchema
  ).catch(() => ({
    ordering_notes: [],
    section_priority: ['summary', 'skills', 'experience', 'projects', 'education'],
  })));

  const atsReport = scoreTailoredResume({
    resumeContent,
    jdParse: analysis.jdParse,
    candidateEvidence: analysis.candidateEvidence,
    mappings: analysis.mappings,
    aiEvaluation: aiAtsEvaluation,
  });

  const coverLetter = await callOpenAI(
    COVER_LETTER_PROMPT({
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      tone: input.coverLetterTone,
      jdParse: analysis.jdParse,
      mappings: analysis.mappings,
      finalResume: resumeContent,
      candidateEvidence: analysis.candidateEvidence,
    }, prompts?.coverLetter),
    false
  );

  return {
    ...analysis,
    rewrites,
    summary,
    assembly,
    resumeContent,
    coverLetter,
    atsReport,
  };
}

export async function improveResumeWithContext(input: {
  companyName: string;
  jobTitle: string;
  currentResumeContent: ResumeContent;
  focusText?: string;
  candidateProfile: FullProfile;
  resumeSettings?: ResumeSettings;
  analysisSnapshot?: ResumeAnalysisSnapshot | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
}) {
  const prompts = input.resumeSettings?.prompts;
  const analysis =
    input.analysisSnapshot?.jdParse && input.analysisSnapshot?.candidateEvidence && input.analysisSnapshot?.mappings
      ? {
          jdParse: normalizeJdParse(input.analysisSnapshot.jdParse),
          candidateSnapshot: (input.analysisSnapshot.candidateSnapshot as Record<string, unknown>) ?? buildCandidateSnapshot(input.candidateProfile),
          candidateEvidence: normalizeCandidateEvidence(input.analysisSnapshot.candidateEvidence),
          mappings: normalizeRelevanceMappings(input.analysisSnapshot.mappings),
          deterministic: computeDeterministicMatch(
            normalizeJdParse(input.analysisSnapshot.jdParse),
            normalizeCandidateEvidence(input.analysisSnapshot.candidateEvidence),
            normalizeRelevanceMappings(input.analysisSnapshot.mappings)
          ),
        }
      : await analyzeCandidateAgainstJD({
          jobDescription: buildSyntheticJobDescription(input.jobTitle, input.matchedKeywords, input.missingKeywords, input.suggestions),
          candidateProfile: input.candidateProfile,
          resumeSettings: input.resumeSettings,
        });

  const prompt = buildAiImprovePrompt({
    companyName: input.companyName,
    jobTitle: input.jobTitle,
    currentResumeContent: input.currentResumeContent,
    matchedKeywords: input.matchedKeywords,
    missingKeywords: input.missingKeywords,
    suggestions: input.suggestions,
    focusText: input.focusText,
    candidateProfile: input.candidateProfile,
    jdParse: analysis.jdParse,
    candidateEvidence: analysis.candidateEvidence,
    mappings: analysis.mappings,
    promptTemplates: {
      experienceRewrite: prompts?.experienceRewrite,
      summaryGeneration: prompts?.summaryGeneration,
      atsEvaluation: prompts?.atsEvaluation,
      finalAssembly: prompts?.finalAssembly,
    },
  });

  const raw = await callOpenAI(prompt);
  const parsed = aiImproveResponseSchema.parse(JSON.parse(raw));
  const finalized = finalizeResumeContent(parsed.resume_content as ResumeContent, {
    candidateProfile: input.candidateProfile,
    jdParse: analysis.jdParse,
    candidateEvidence: analysis.candidateEvidence,
    mappings: analysis.mappings,
    resumeSettings: input.resumeSettings,
  });
  validateFinalResumeContent(finalized, analysis.candidateEvidence, input.resumeSettings);

  const atsReport = scoreTailoredResume({
    resumeContent: finalized,
    jdParse: analysis.jdParse,
    candidateEvidence: analysis.candidateEvidence,
    mappings: analysis.mappings,
  });

  return {
    resumeContent: finalized,
    atsReport,
    analysisSnapshot: {
      jdParse: analysis.jdParse,
      candidateSnapshot: analysis.candidateSnapshot,
      candidateEvidence: analysis.candidateEvidence,
      mappings: analysis.mappings,
    } satisfies ResumeAnalysisSnapshot,
  };
}

export function scoreTailoredResume(input: {
  resumeContent: ResumeContent;
  jdParse: JDParse;
  candidateEvidence: CandidateEvidence;
  mappings: RelevanceMapping;
  aiEvaluation?: Partial<AtsEvaluation>;
}) {
  const haystack = buildResumeHaystack(input.resumeContent);
  const allRequirements = [
    ...input.jdParse.responsibilities,
    ...input.jdParse.required_skills.map((skill) => ({
      id: skill.id,
      text: skill.name,
      weight: skill.weight,
      required: true,
      kind: 'skill' as const,
    })),
    ...input.jdParse.preferred_skills.map((skill) => ({
      id: skill.id,
      text: skill.name,
      weight: skill.weight,
      required: false,
      kind: 'skill' as const,
    })),
  ];

  const mappingByRequirement = new Map(input.mappings.mappings.map((entry) => [entry.requirement_id, entry]));
  const evidenceById = new Map(input.candidateEvidence.evidence_units.map((entry) => [entry.evidence_id, entry]));

  let weightedCoverage = 0;
  let totalWeight = 0;
  let evidenceStrengthAccumulator = 0;
  let evidenceStrengthDenominator = 0;
  const matchedKeywords = new Set<string>();
  const missingKeywords = new Set<string>();

  for (const requirement of allRequirements) {
    const mapping = mappingByRequirement.get(requirement.id);
    const weight = Math.max(requirement.weight || 0.03, 0.03);
    totalWeight += weight;

    const matchValue =
      mapping?.match_strength === 'strong_match'
        ? 1
        : mapping?.match_strength === 'partial_match'
          ? 0.6
          : mapping?.match_strength === 'adjacent_match'
            ? 0.3
            : 0;

    weightedCoverage += weight * matchValue;

    if (includesKeyword(haystack, requirement.text)) {
      matchedKeywords.add(requirement.text);
    } else {
      missingKeywords.add(requirement.text);
    }

    for (const evidenceId of mapping?.matched_evidence_ids || []) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) continue;
      const evidenceValue =
        evidence.explicitness === 'explicit'
          ? evidence.metrics.length > 0
            ? 1
            : 0.8
          : 0.4;
      evidenceStrengthAccumulator += evidenceValue;
      evidenceStrengthDenominator += 1;
    }
  }

  const requirementCoverage = totalWeight > 0 ? (weightedCoverage / totalWeight) * 100 : 0;
  const evidenceStrength = evidenceStrengthDenominator > 0 ? (evidenceStrengthAccumulator / evidenceStrengthDenominator) * 100 : 50;
  const keywordAlignment = scoreKeywordAlignment(input.jdParse, haystack);
  const sectionQuality = scoreSectionQuality(input.resumeContent);
  const readability = scoreReadability(input.resumeContent);
  const roleNarrativeFit = scoreRoleNarrativeFit(input.resumeContent, input.jdParse, input.mappings);
  const unsupportedPenalty = Math.min((input.aiEvaluation?.unsupported_claims || []).length * 6, 18);
  const stuffingPenalty = Math.min((input.aiEvaluation?.stuffing_flags || []).length * 4 + countStuffingSignals(haystack, input.jdParse.explicit_keywords), 15);

  const overall =
    0.35 * requirementCoverage +
    0.2 * evidenceStrength +
    0.15 * keywordAlignment +
    0.1 * sectionQuality +
    0.1 * readability +
    0.1 * roleNarrativeFit -
    unsupportedPenalty -
    stuffingPenalty;

  return {
    overallScore: clamp(Math.round(overall), 25, 98),
    subScores: {
      requirementCoverage: Math.round(requirementCoverage),
      evidenceStrength: Math.round(evidenceStrength),
      keywordAlignment: Math.round(keywordAlignment),
      sectionQuality: Math.round(sectionQuality),
      readability: Math.round(readability),
      roleNarrativeFit: Math.round(roleNarrativeFit),
    },
    matchedKeywords: Array.from(matchedKeywords),
    missingKeywords: Array.from(missingKeywords).filter(Boolean),
    matchedSkills: getMatchedSkills(input.jdParse, input.resumeContent),
    missingSkills: getMissingSkills(input.jdParse, input.resumeContent),
    strengths: input.aiEvaluation?.strengths || [],
    gaps: input.aiEvaluation?.gaps || [],
    suggestions: (input.aiEvaluation?.improvement_actions || []).map((item) => ({
      action: item.action,
      impact_pct: item.impact_pct,
      reason: item.reason,
    })),
    matchedRequirements: input.aiEvaluation?.matched_requirements || [],
    partiallyMatchedRequirements: input.aiEvaluation?.partially_matched_requirements || [],
    missingRequirements: input.aiEvaluation?.missing_requirements || [],
    unsupportedClaims: input.aiEvaluation?.unsupported_claims || [],
    stuffingFlags: input.aiEvaluation?.stuffing_flags || [],
  };
}

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
  const sectionQuality = scoreSectionQuality(input.resumeContent);
  const readability = scoreReadability(input.resumeContent);
  const keywordCoverage = targetKeywords.length > 0 ? (nextMatched.length / targetKeywords.length) * 100 : 60;
  const stuffingPenalty = countStuffingSignals(haystack, targetKeywords);
  const nextScore = clamp(Math.round(0.5 * keywordCoverage + 0.25 * sectionQuality + 0.25 * readability - stuffingPenalty), 28, 97);

  const nextSuggestions: Suggestion[] = [
    ...nextMissing.slice(0, 6).map((keyword) => ({
      action: `Add ${keyword} where it is genuinely supported by your experience`,
      impact_pct: Math.max(4, Math.round(36 / Math.max(nextMissing.length, 1))),
      reason: `${keyword} is part of the target set but is not clearly represented in the current resume content.`,
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

async function runJsonPrompt<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T> {
  const raw = await callOpenAI(prompt);
  const parsed = JSON.parse(raw);
  return schema.parse(parsed);
}

function buildCandidateSnapshot(profile: FullProfile) {
  return {
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    linkedin: profile.linkedin || '',
    github: profile.github || '',
    website: profile.website || '',
    summary: profile.summary || '',
    technicalSkills: profile.technicalSkills || [],
    softSkills: profile.softSkills || [],
    achievements: profile.achievements || [],
    languages: profile.languages || [],
    experiences: (profile.experiences || []).map((experience, index) => ({
      id: experience.id || `exp_${index + 1}`,
      job_title: experience.job_title,
      company: experience.company,
      location: experience.location || '',
      start_date: experience.start_date,
      end_date: experience.end_date || '',
      is_current: experience.is_current,
      bullets: experience.bullets || [],
    })),
    projects: (profile.projects || []).map((project, index) => ({
      id: project.id || `proj_${index + 1}`,
      name: project.name,
      tech_stack: project.tech_stack || '',
      description: project.description,
      url: project.url || '',
    })),
    education: (profile.education || []).map((education, index) => ({
      id: education.id || `edu_${index + 1}`,
      degree: education.degree,
      institution: education.institution,
      year: education.year,
      gpa: education.gpa || '',
    })),
  };
}

function buildFallbackSummary(
  profile: FullProfile,
  jobTitle: string,
  jdParse: JDParse,
  matchedKeywords: string[],
  resumeSettings?: ResumeSettings
): SummaryGeneration {
  const topKeywords = matchedKeywords.slice(0, 4).join(', ');
  const years = jdParse.minimum_years_experience > 0 ? `${jdParse.minimum_years_experience}+ years targeted` : 'relevant experience';
  const summaryMaxWords = getSummaryWordLimit(resumeSettings);
  return {
    summary: compactSummary(
      profile.summary?.trim()
      ? profile.summary.trim()
      : `${jobTitle} candidate with ${years} across ${jdParse.domain.slice(0, 2).join(', ') || 'software delivery'}, with evidence-backed experience in ${topKeywords || 'core engineering work'}.`,
      jdParse,
      profile.summary || '',
      summaryMaxWords
    ),
    supporting_evidence_ids: [],
    included_keywords: matchedKeywords.slice(0, 6),
    excluded_keywords_due_to_no_evidence: [],
  };
}

function normalizeSummaryGeneration(input: any): SummaryGeneration {
  return {
    summary: input.summary ?? '',
    supporting_evidence_ids: input.supporting_evidence_ids ?? [],
    included_keywords: input.included_keywords ?? [],
    excluded_keywords_due_to_no_evidence: input.excluded_keywords_due_to_no_evidence ?? [],
  };
}

function normalizeJdParse(input: any): JDParse {
  return {
    title: input.title ?? 'Target role',
    seniority: input.seniority ?? 'unknown',
    domain: input.domain ?? [],
    responsibilities: input.responsibilities ?? [],
    required_skills: input.required_skills ?? [],
    preferred_skills: input.preferred_skills ?? [],
    soft_signals: input.soft_signals ?? [],
    tools_platforms: input.tools_platforms ?? [],
    must_have_requirements: input.must_have_requirements ?? [],
    nice_to_have_requirements: input.nice_to_have_requirements ?? [],
    explicit_keywords: input.explicit_keywords ?? [],
    inferred_keywords: input.inferred_keywords ?? [],
    minimum_years_experience: input.minimum_years_experience ?? 0,
  };
}

function normalizeCandidateEvidence(input: any): CandidateEvidence {
  return {
    candidate_id: input.candidate_id ?? 'candidate_profile',
    evidence_units: (input.evidence_units ?? []).map((unit: any) => ({
      evidence_id: unit.evidence_id,
      type: unit.type,
      canonical_skill_tags: unit.canonical_skill_tags ?? [],
      domain_tags: unit.domain_tags ?? [],
      action: unit.action ?? '',
      outcome: unit.outcome ?? '',
      metrics: unit.metrics ?? [],
      tools: unit.tools ?? [],
      source_section: unit.source_section,
      source_record_id: unit.source_record_id,
      source_text: unit.source_text,
      explicitness: unit.explicitness ?? 'explicit',
      confidence: unit.confidence ?? 0.5,
    })),
  };
}

function normalizeRelevanceMappings(input: any): RelevanceMapping {
  return {
    mappings: (input.mappings ?? []).map((mapping: any) => ({
      requirement_id: mapping.requirement_id,
      match_strength: mapping.match_strength,
      matched_evidence_ids: mapping.matched_evidence_ids ?? [],
      rationale: mapping.rationale ?? '',
      safe_resume_language: mapping.safe_resume_language ?? [],
      unsupported_terms_to_avoid: mapping.unsupported_terms_to_avoid ?? [],
    })),
  };
}

function normalizeBulletRewrites(input: any): BulletRewrite {
  return {
    experience_rewrites: (input.experience_rewrites ?? []).map((item: any) => ({
      source_record_id: item.source_record_id,
      rewritten_bullets: item.rewritten_bullets ?? [],
      source_evidence_ids: item.source_evidence_ids ?? [],
      target_requirement_ids: item.target_requirement_ids ?? [],
      used_keywords: item.used_keywords ?? [],
    })),
    project_rewrites: (input.project_rewrites ?? []).map((item: any) => ({
      source_record_id: item.source_record_id,
      rewritten_bullets: item.rewritten_bullets ?? [],
      source_evidence_ids: item.source_evidence_ids ?? [],
      target_requirement_ids: item.target_requirement_ids ?? [],
      used_keywords: item.used_keywords ?? [],
    })),
  };
}

function normalizeAtsEvaluation(input: any): AtsEvaluation {
  return {
    matched_requirements: input.matched_requirements ?? [],
    partially_matched_requirements: input.partially_matched_requirements ?? [],
    missing_requirements: input.missing_requirements ?? [],
    unsupported_claims: input.unsupported_claims ?? [],
    stuffing_flags: input.stuffing_flags ?? [],
    strengths: input.strengths ?? [],
    gaps: input.gaps ?? [],
    improvement_actions: input.improvement_actions ?? [],
  };
}

function normalizeFinalAssembly(input: any) {
  return {
    ordering_notes: input.ordering_notes ?? [],
    section_priority: input.section_priority ?? ['summary', 'skills', 'experience', 'projects', 'education'],
  };
}

function assembleResumeContent(input: {
  candidateProfile: FullProfile;
  jdParse: JDParse;
  candidateEvidence: CandidateEvidence;
  mappings: RelevanceMapping;
  rewrites: BulletRewrite;
  summary: SummaryGeneration;
  resumeSettings?: ResumeSettings;
}): ResumeContent {
  const maxBullets = getMaxBulletsPerSection(input.resumeSettings);
  const defaultSectionVisibility = getDefaultSectionVisibility(input.resumeSettings);
  const maxProjects = input.resumeSettings?.structure.maxProjects ?? 4;
  const maxEducationItems = input.resumeSettings?.structure.maxEducationItems ?? 3;
  const experienceRewrites = new Map(input.rewrites.experience_rewrites.map((item) => [item.source_record_id, item]));
  const projectRewrites = new Map(input.rewrites.project_rewrites.map((item) => [item.source_record_id, item]));

  const prioritizedExperience = [...(input.candidateProfile.experiences || [])]
    .map((experience, index) => ({
      ...experience,
      __recordId: experience.id || `exp_${index + 1}`,
      __relevance: scoreRecordRelevance(experience.id || `exp_${index + 1}`, input.mappings, input.candidateEvidence),
    }))
    .sort((a, b) => b.__relevance - a.__relevance);

  const prioritizedProjects = [...(input.candidateProfile.projects || [])]
    .map((project, index) => ({
      ...project,
      __recordId: project.id || `proj_${index + 1}`,
      __relevance: scoreRecordRelevance(project.id || `proj_${index + 1}`, input.mappings, input.candidateEvidence),
    }))
    .sort((a, b) => b.__relevance - a.__relevance);

  const selectedProjects = prioritizedProjects
    .filter((project) => {
      const rewriteBullets = projectRewrites.get(project.__recordId)?.rewritten_bullets || [];
      return rewriteBullets.length > 0 || Boolean(project.description?.trim());
    })
    .slice(0, maxProjects);

  const resumeContent: ResumeContent = {
    summary: compactSummary(input.summary.summary, input.jdParse, input.candidateProfile.summary || '', getSummaryWordLimit(input.resumeSettings)),
    skills: buildResumeSkills(input),
    section_visibility: defaultSectionVisibility,
    experience: prioritizedExperience.map((experience) => ({
      job_title: experience.job_title,
      company: experience.company,
      location: experience.location,
      start_date: experience.start_date,
      end_date: experience.end_date,
      is_current: experience.is_current,
      bullets: selectGroundedBullets(
        experienceRewrites.get(experience.__recordId)?.rewritten_bullets,
        experience.bullets || [],
        maxBullets
      ),
    })),
    projects: selectedProjects.map((project) => ({
      name: project.name,
      tech_stack: project.tech_stack || '',
      summary: project.description || '',
      bullets: selectGroundedBullets(
        projectRewrites.get(project.__recordId)?.rewritten_bullets,
        project.description ? [project.description] : [],
        maxBullets
      ),
      url: project.url || undefined,
    })),
    education: (input.candidateProfile.education || []).slice(0, maxEducationItems).map((education) => ({
      degree: education.degree,
      institution: education.institution,
      year: education.year,
      gpa: education.gpa,
    })),
  };

  const achievements = uniqueCaseInsensitive((input.candidateProfile.achievements || []).map((item) => item.trim()).filter(Boolean)).slice(0, maxBullets);
  if (achievements.length > 0) {
    resumeContent.achievements = achievements;
  }

  const languages = uniqueCaseInsensitive((input.candidateProfile.languages || []).map((item) => item.trim()).filter(Boolean)).slice(0, maxBullets);
  if (languages.length > 0) {
    resumeContent.languages = languages;
  }

  const hobbies = uniqueCaseInsensitive((input.candidateProfile.hobbies || []).map((item) => item.trim()).filter(Boolean)).slice(0, maxBullets);
  if (hobbies.length > 0) {
    resumeContent.hobbies = hobbies;
  }

  return resumeContent;
}

function buildResumeSkills(input: {
  candidateProfile: FullProfile;
  jdParse: JDParse;
  candidateEvidence: CandidateEvidence;
  mappings: RelevanceMapping;
}): ResumeSkills {
  let skills: ResumeSkills = {
    technical: {
      languages: [],
      backend_frameworks: [],
      ai_genai: [],
      streaming_messaging: [],
      databases_storage: [],
      cloud_infra: [],
      tools_platforms: [],
      other: [],
    },
    soft: [],
  };

  const explicitSkills = [
    ...(input.candidateProfile.technicalSkills || []),
    ...(input.candidateProfile.softSkills || []),
    ...input.candidateEvidence.evidence_units.flatMap((unit) => unit.canonical_skill_tags),
    ...input.candidateEvidence.evidence_units.flatMap((unit) => unit.tools),
  ];

  const matchedRequirementNames = new Set<string>();
  for (const mapping of input.mappings.mappings) {
    if (mapping.match_strength !== 'no_match') {
      const required = input.jdParse.required_skills.find((skill) => skill.id === mapping.requirement_id);
      if (required) matchedRequirementNames.add(required.name);
      const preferred = input.jdParse.preferred_skills.find((skill) => skill.id === mapping.requirement_id);
      if (preferred) matchedRequirementNames.add(preferred.name);
    }
  }

  const rankedSkills = uniqueCaseInsensitive([...matchedRequirementNames, ...explicitSkills])
    .filter((skill) => hasEvidenceForSkill(skill, input.candidateEvidence, input.candidateProfile))
    .slice(0, 36);

  for (const skill of rankedSkills) {
    skills = addSkillToResumeSkills(skills, skill);
  }

  const normalized = normalizeResumeSkills(skills);
  return {
    technical: normalized.technical,
    soft: normalized.soft,
  };
}

function computeDeterministicMatch(jdParse: JDParse, candidateEvidence: CandidateEvidence, mappings: RelevanceMapping) {
  const haystack = buildEvidenceHaystack(candidateEvidence);
  const requiredSkills = jdParse.required_skills.map((item) => item.name);
  const preferredSkills = jdParse.preferred_skills.map((item) => item.name);
  const matchedSkills = requiredSkills.filter((skill) => includesKeyword(haystack, skill));
  const missingSkills = requiredSkills.filter((skill) => !includesKeyword(haystack, skill));
  const matchedKeywords = uniqueCaseInsensitive(
    [...jdParse.explicit_keywords, ...jdParse.tools_platforms].filter((keyword) => includesKeyword(haystack, keyword))
  );
  const missingKeywords = uniqueCaseInsensitive(
    [...jdParse.explicit_keywords, ...jdParse.tools_platforms].filter((keyword) => !includesKeyword(haystack, keyword))
  );

  const matchedRequirementCount = mappings.mappings.filter((item) => item.match_strength === 'strong_match').length;
  const partialRequirementCount = mappings.mappings.filter((item) => item.match_strength === 'partial_match').length;
  const totalRequirements = Math.max(mappings.mappings.length, 1);
  const score = clamp(Math.round(((matchedRequirementCount + partialRequirementCount * 0.6) / totalRequirements) * 100), 20, 96);

  return {
    matchedSkills,
    missingSkills,
    matchedKeywords,
    missingKeywords,
    preferredSkills,
    score,
  };
}

function validateSupportIds(ids: string[], candidateEvidence: CandidateEvidence) {
  const validIds = new Set(candidateEvidence.evidence_units.map((unit) => unit.evidence_id));
  for (const id of ids) {
    if (!validIds.has(id)) {
      throw new Error(`Unsupported evidence reference: ${id}`);
    }
  }
}

function selectGroundedBullets(rewritten: string[] | undefined, fallback: string[], maxBullets: number) {
  const candidates = (rewritten && rewritten.length > 0 ? rewritten : fallback)
    .map((item) => item.trim())
    .filter(Boolean);
  return enforceBulletQuality(candidates, maxBullets);
}

function scoreRecordRelevance(recordId: string, mappings: RelevanceMapping, candidateEvidence: CandidateEvidence) {
  const evidenceIds = candidateEvidence.evidence_units
    .filter((unit) => unit.source_record_id === recordId)
    .map((unit) => unit.evidence_id);
  const evidenceSet = new Set(evidenceIds);
  let score = 0;

  for (const mapping of mappings.mappings) {
    if ((mapping.matched_evidence_ids || []).some((id) => evidenceSet.has(id))) {
      score += mapping.match_strength === 'strong_match' ? 3 : mapping.match_strength === 'partial_match' ? 2 : 1;
    }
  }

  return score;
}

function buildResumeHaystack(content: ResumeContent) {
  const normalizedSkills = normalizeResumeSkills(content.skills);
  const skillTerms = [
    ...normalizedSkills.technical.languages,
    ...normalizedSkills.technical.backend_frameworks,
    ...normalizedSkills.technical.ai_genai,
    ...normalizedSkills.technical.streaming_messaging,
    ...normalizedSkills.technical.databases_storage,
    ...normalizedSkills.technical.cloud_infra,
    ...normalizedSkills.technical.tools_platforms,
    ...normalizedSkills.technical.other,
    ...normalizedSkills.soft,
  ];

  return [
    content.summary,
    ...skillTerms,
    ...content.experience.flatMap((entry) => [entry.job_title, entry.company, entry.location || '', ...entry.bullets]),
    ...content.projects.flatMap((project) => [project.name, project.tech_stack, project.summary || '', project.description || '', ...(project.bullets || [])]),
    ...content.education.flatMap((entry) => [entry.degree, entry.institution, entry.year, entry.gpa || '', ...(entry.bullets || [])]),
    ...(content.achievements || []),
    ...(content.languages || []),
    ...(content.hobbies || []),
  ]
    .join('\n')
    .toLowerCase();
}

function buildEvidenceHaystack(candidateEvidence: CandidateEvidence) {
  return candidateEvidence.evidence_units
    .flatMap((unit) => [unit.source_text, ...unit.canonical_skill_tags, ...unit.domain_tags, ...unit.tools, ...unit.metrics])
    .join('\n')
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

function hasEvidenceForSkill(skill: string, candidateEvidence: CandidateEvidence, profile: FullProfile) {
  const normalized = skill.trim().toLowerCase();
  if (!normalized) return false;

  if ((profile.technicalSkills || []).some((item) => item.toLowerCase() === normalized)) return true;
  if ((profile.softSkills || []).some((item) => item.toLowerCase() === normalized)) return true;

  return candidateEvidence.evidence_units.some((unit) =>
    unit.canonical_skill_tags.some((tag) => tag.toLowerCase() === normalized) ||
    unit.tools.some((tool) => tool.toLowerCase() === normalized)
  );
}

function scoreKeywordAlignment(jdParse: JDParse, haystack: string) {
  const explicit = uniqueCaseInsensitive([...jdParse.explicit_keywords, ...jdParse.required_skills.map((item) => item.name)]);
  if (explicit.length === 0) return 70;
  const matched = explicit.filter((keyword) => includesKeyword(haystack, keyword)).length;
  return (matched / explicit.length) * 100;
}

function scoreSectionQuality(content: ResumeContent) {
  const normalizedSkills = normalizeResumeSkills(content.skills);
  const technicalSkillCount = Object.values(normalizedSkills.technical).reduce((sum, skills) => sum + skills.length, 0);
  let score = 45;
  if (content.summary.trim().length >= 50 && content.summary.trim().length <= 700) score += 15;
  if (technicalSkillCount >= 6) score += 15;
  if (content.experience.some((entry) => entry.bullets.length >= 2)) score += 15;
  if (content.projects.some((project) => (project.bullets?.length || 0) >= 1)) score += 10;
  if ((content.achievements?.length || 0) > 0) score += 5;
  return clamp(score, 30, 100);
}

function finalizeResumeContent(
  content: ResumeContent,
  context: {
    candidateProfile: FullProfile;
    jdParse: JDParse;
    candidateEvidence: CandidateEvidence;
    mappings: RelevanceMapping;
    resumeSettings?: ResumeSettings;
  }
) {
  const maxBullets = getMaxBulletsPerSection(context.resumeSettings);
  const maxProjects = context.resumeSettings?.structure.maxProjects ?? 4;
  const maxEducationItems = context.resumeSettings?.structure.maxEducationItems ?? 3;
  const summary = compactSummary(content.summary, context.jdParse, context.candidateProfile.summary || '', getSummaryWordLimit(context.resumeSettings));
  const experience = content.experience.map((entry) => ({
    ...entry,
    bullets: enforceBulletQuality(entry.bullets, maxBullets),
  }));
  const projects = (content.projects || [])
    .filter((project) => Boolean(project.name?.trim()) && ((project.bullets?.length || 0) > 0 || Boolean(project.summary || project.description)))
    .slice(0, maxProjects)
    .map((project) => ({
      ...project,
      bullets: enforceBulletQuality(project.bullets || [project.summary || project.description || ''], maxBullets),
    }));
  const education = (content.education || []).slice(0, maxEducationItems).map((entry) => ({
    degree: entry.degree,
    institution: entry.institution,
    year: entry.year,
    gpa: entry.gpa,
  }));

  return removeEmptyOptionalSections({
    ...content,
    summary,
    experience,
    projects,
    education,
    section_visibility: content.section_visibility || getDefaultSectionVisibility(context.resumeSettings),
    achievements: (content.achievements || []).slice(0, maxBullets),
    languages: (content.languages || []).slice(0, maxBullets),
    hobbies: (content.hobbies || []).slice(0, maxBullets),
  });
}

function removeEmptyOptionalSections(content: ResumeContent): ResumeContent {
  const next: ResumeContent = { ...content };
  if (!next.achievements?.length) delete next.achievements;
  if (!next.languages?.length) delete next.languages;
  if (!next.hobbies?.length) delete next.hobbies;
  return next;
}

function validateFinalResumeContent(content: ResumeContent, candidateEvidence: CandidateEvidence, resumeSettings?: ResumeSettings) {
  const summaryWords = content.summary.trim().split(/\s+/).filter(Boolean).length;
  if (summaryWords > getSummaryWordLimit(resumeSettings)) {
    throw new Error('Generated summary exceeded max length');
  }

  const normalizedSkills = normalizeResumeSkills(content.skills);
  const flattenedSkills = [
    ...Object.values(normalizedSkills.technical).flat(),
    ...normalizedSkills.soft,
  ].map((item) => item.toLowerCase());
  if (new Set(flattenedSkills).size !== flattenedSkills.length) {
    throw new Error('Generated skills contain duplicates across categories');
  }

  for (const experience of content.experience) {
    if (!Array.isArray(experience.bullets) || experience.bullets.length === 0) {
      throw new Error('Experience entries must contain bullets');
    }
    if (experience.bullets.length > getMaxBulletsPerSection(resumeSettings)) {
      throw new Error('Experience section exceeded max bullet count');
    }
    if (experience.bullets.some((bullet) => bullet.length > 240)) {
      throw new Error('Experience bullet too long');
    }
  }

  if ((content.projects || []).length > 0 && (candidateEvidence.evidence_units || []).length === 0) {
    throw new Error('Projects require evidence backing');
  }
}

function compactSummary(summary: string, jdParse: JDParse, fallback: string, maxWords = 25) {
  const source = (summary || fallback || '').trim();
  if (!source) return '';
  const words = source.split(/\s+/).filter(Boolean);
  const compacted = words.slice(0, maxWords).join(' ');
  if (compacted.length <= 700) return compacted;
  return compacted.slice(0, 697).trimEnd() + '...';
}

function enforceBulletQuality(bullets: string[], maxBullets: number) {
  const actionVerbs = [
    'built', 'designed', 'developed', 'led', 'optimized', 'implemented', 'automated',
    'improved', 'launched', 'reduced', 'scaled', 'delivered', 'integrated', 'architected',
  ];
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of bullets) {
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const lowered = normalized.toLowerCase();
    if (seen.has(lowered)) continue;
    seen.add(lowered);
    cleaned.push(normalized.length > 200 ? `${normalized.slice(0, 197).trimEnd()}...` : normalized);
  }

  const sorted = cleaned.sort((a, b) => {
    const aLead = actionVerbs.some((verb) => a.toLowerCase().startsWith(verb)) ? 1 : 0;
    const bLead = actionVerbs.some((verb) => b.toLowerCase().startsWith(verb)) ? 1 : 0;
    return bLead - aLead;
  });

  return (sorted.length > 0 ? sorted : ['Delivered role-relevant outcomes with measurable impact where available.']).slice(0, maxBullets);
}

function getSummaryWordLimit(settings?: ResumeSettings) {
  return settings?.formatting.summaryMaxWords ?? 25;
}

function getMaxBulletsPerSection(settings?: ResumeSettings) {
  return settings?.formatting.maxBulletsPerSection ?? 5;
}

function getDefaultSectionVisibility(settings?: ResumeSettings) {
  return {
    summary: settings?.structure.defaultSectionVisibility.summary ?? true,
    skills: settings?.structure.defaultSectionVisibility.skills ?? true,
    experience: settings?.structure.defaultSectionVisibility.experience ?? true,
    projects: settings?.structure.defaultSectionVisibility.projects ?? true,
    achievements: settings?.structure.defaultSectionVisibility.achievements ?? true,
    education: settings?.structure.defaultSectionVisibility.education ?? true,
    languages: settings?.structure.defaultSectionVisibility.languages ?? true,
    hobbies: settings?.structure.defaultSectionVisibility.hobbies ?? true,
  };
}

function buildSyntheticJobDescription(
  jobTitle: string,
  matchedKeywords: string[],
  missingKeywords: string[],
  suggestions: Suggestion[]
) {
  return [
    `Target role: ${jobTitle}`,
    matchedKeywords.length ? `Matched context: ${matchedKeywords.join(', ')}` : '',
    missingKeywords.length ? `Missing keywords: ${missingKeywords.join(', ')}` : '',
    suggestions.length ? `Improvement suggestions: ${suggestions.map((item) => `${item.action} (${item.reason})`).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildAiImprovePrompt(input: {
  companyName: string;
  jobTitle: string;
  currentResumeContent: ResumeContent;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
  focusText?: string;
  candidateProfile: FullProfile;
  jdParse: JDParse;
  candidateEvidence: CandidateEvidence;
  mappings: RelevanceMapping;
  promptTemplates: {
    experienceRewrite?: ResumeSettings['prompts']['experienceRewrite'];
    summaryGeneration?: ResumeSettings['prompts']['summaryGeneration'];
    atsEvaluation?: ResumeSettings['prompts']['atsEvaluation'];
    finalAssembly?: ResumeSettings['prompts']['finalAssembly'];
  };
}) {
  return `
You are improving a tailored resume for "${input.jobTitle}" at "${input.companyName}".

Your job:
- improve ATS relevance naturally
- keep all claims grounded in candidate evidence
- use the candidate profile, stored JD analysis, ATS gaps, and current resume together
- follow the active prompt-template intent below for summary, bullet rewriting, ATS improvement, and final assembly

Never:
- invent new experience, tools, metrics, scope, or achievements
- stuff keywords unnaturally
- remove accurate high-value details unless needed for clarity

Output only valid JSON:
{
  "resume_content": {
    "summary": "string",
    "skills": {},
    "section_visibility": {},
    "experience": [],
    "projects": [],
    "education": [],
    "achievements": [],
    "languages": [],
    "hobbies": []
  }
}

Focus text:
<focus_text>
${input.focusText || ''}
</focus_text>

Active summary prompt intent:
<summary_prompt>
${(input.promptTemplates.summaryGeneration?.activeMode === 'custom'
    ? input.promptTemplates.summaryGeneration.customTemplate
    : input.promptTemplates.summaryGeneration?.defaultTemplate) || ''}
</summary_prompt>

Active experience rewrite prompt intent:
<experience_rewrite_prompt>
${(input.promptTemplates.experienceRewrite?.activeMode === 'custom'
    ? input.promptTemplates.experienceRewrite.customTemplate
    : input.promptTemplates.experienceRewrite?.defaultTemplate) || ''}
</experience_rewrite_prompt>

Active ATS evaluation prompt intent:
<ats_prompt>
${(input.promptTemplates.atsEvaluation?.activeMode === 'custom'
    ? input.promptTemplates.atsEvaluation.customTemplate
    : input.promptTemplates.atsEvaluation?.defaultTemplate) || ''}
</ats_prompt>

Active final assembly prompt intent:
<final_assembly_prompt>
${(input.promptTemplates.finalAssembly?.activeMode === 'custom'
    ? input.promptTemplates.finalAssembly.customTemplate
    : input.promptTemplates.finalAssembly?.defaultTemplate) || ''}
</final_assembly_prompt>

Candidate profile:
<candidate_profile>
${JSON.stringify(buildCandidateSnapshot(input.candidateProfile), null, 2)}
</candidate_profile>

JD parse:
<jd_parse>
${JSON.stringify(input.jdParse, null, 2)}
</jd_parse>

Candidate evidence:
<candidate_evidence>
${JSON.stringify(input.candidateEvidence, null, 2)}
</candidate_evidence>

Requirement mappings:
<mappings>
${JSON.stringify(input.mappings, null, 2)}
</mappings>

Matched keywords:
${JSON.stringify(input.matchedKeywords, null, 2)}

Missing keywords:
${JSON.stringify(input.missingKeywords, null, 2)}

ATS suggestions:
${JSON.stringify(input.suggestions, null, 2)}

Current resume content:
${JSON.stringify(input.currentResumeContent, null, 2)}
`;
}

function scoreReadability(content: ResumeContent) {
  let score = 82;
  const longBullets = content.experience.flatMap((entry) => entry.bullets).filter((bullet) => bullet.length > 220).length;
  const duplicateBullets = countDuplicates(content.experience.flatMap((entry) => entry.bullets));
  const repeatedTermsPenalty = countStuffingSignals(buildResumeHaystack(content), []);
  score -= longBullets * 4;
  score -= duplicateBullets * 5;
  score -= repeatedTermsPenalty;
  return clamp(score, 35, 100);
}

function scoreRoleNarrativeFit(content: ResumeContent, jdParse: JDParse, mappings: RelevanceMapping) {
  let score = 50;
  if (content.summary.toLowerCase().includes(jdParse.title.toLowerCase().split(' ')[0] || '')) score += 10;
  if (content.experience.length > 0) score += 10;
  if (mappings.mappings.some((item) => item.match_strength === 'strong_match')) score += 20;
  if (jdParse.domain.some((domain) => includesKeyword(buildResumeHaystack(content), domain))) score += 10;
  return clamp(score, 30, 100);
}

function countStuffingSignals(haystack: string, keywords: string[]) {
  const terms = keywords.length > 0 ? keywords : ['agile', 'synergy', 'innovative', 'results-driven'];
  return terms.reduce((penalty, term) => {
    const occurrences = haystack.split(term.toLowerCase()).length - 1;
    return penalty + Math.max(0, occurrences - 3);
  }, 0);
}

function countDuplicates(items: string[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates += 1;
    seen.add(normalized);
  }
  return duplicates;
}

function getMatchedSkills(jdParse: JDParse, resumeContent: ResumeContent) {
  const haystack = buildResumeHaystack(resumeContent);
  return jdParse.required_skills.map((item) => item.name).filter((skill) => includesKeyword(haystack, skill));
}

function getMissingSkills(jdParse: JDParse, resumeContent: ResumeContent) {
  const haystack = buildResumeHaystack(resumeContent);
  return jdParse.required_skills.map((item) => item.name).filter((skill) => !includesKeyword(haystack, skill));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
