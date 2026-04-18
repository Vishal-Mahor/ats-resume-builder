import type { ResumePromptSection, ResumePromptTemplateSetting } from '@/lib/api';

type PromptTemplateContext = Record<string, string>;

export const DEFAULT_PROMPT_TEMPLATE_METADATA: Record<
  ResumePromptSection,
  { label: string; description: string }
> = {
  jdParsing: {
    label: 'JD parsing',
    description: 'Parses the job description into structured hiring requirements.',
  },
  candidateEvidence: {
    label: 'Candidate evidence',
    description: 'Extracts grounded evidence units from the candidate profile.',
  },
  relevanceMapping: {
    label: 'Relevance mapping',
    description: 'Maps job requirements to supported candidate evidence.',
  },
  experienceRewrite: {
    label: 'Experience rewrite',
    description: 'Rewrites experience and project bullets using only grounded evidence.',
  },
  summaryGeneration: {
    label: 'Summary generation',
    description: 'Generates the short ATS-friendly professional summary.',
  },
  atsEvaluation: {
    label: 'ATS evaluation',
    description: 'Evaluates ATS coverage, evidence quality, and improvement gaps.',
  },
  finalAssembly: {
    label: 'Final assembly',
    description: 'Sets ordering and assembly guidance for the final resume package.',
  },
  coverLetter: {
    label: 'Cover letter',
    description: 'Writes the evidence-backed cover letter.',
  },
};

function interpolatePromptTemplate(template: string, context: PromptTemplateContext) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => context[key] ?? '');
}

export function resolvePromptTemplate(
  section: ResumePromptSection,
  context: PromptTemplateContext,
  promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>
) {
  const baseTemplate =
    promptSetting?.activeMode === 'custom' && promptSetting.customTemplate.trim().length > 0
      ? promptSetting.customTemplate
      : promptSetting?.defaultTemplate?.trim().length
        ? promptSetting.defaultTemplate
        : DEFAULT_PROMPT_TEMPLATES[section];

  return interpolatePromptTemplate(baseTemplate, context);
}

export function buildDefaultPromptTemplates(): Record<ResumePromptSection, ResumePromptTemplateSetting> {
  return (Object.keys(DEFAULT_PROMPT_TEMPLATES) as ResumePromptSection[]).reduce(
    (acc, section) => {
      acc[section] = {
        ...DEFAULT_PROMPT_TEMPLATE_METADATA[section],
        defaultTemplate: DEFAULT_PROMPT_TEMPLATES[section],
        customTemplate: '',
        activeMode: 'default',
      };
      return acc;
    },
    {} as Record<ResumePromptSection, ResumePromptTemplateSetting>
  );
}

export const DEFAULT_PROMPT_TEMPLATES: Record<ResumePromptSection, string> = {
  jdParsing: `
You are a truthful job-description parser for an ATS resume-tailoring system.

Your job is to extract hiring requirements faithfully from the job description.
Do not invent missing requirements. Distinguish explicit requirements from inferred signals.

Return ONLY valid JSON matching this shape:
{
  "title": "string",
  "seniority": "junior|mid|senior|staff|lead|manager|unknown",
  "domain": ["string"],
  "responsibilities": [
    {
      "id": "req_1",
      "text": "string",
      "weight": 0.12,
      "required": true,
      "kind": "responsibility|skill|domain|communication|leadership|delivery"
    }
  ],
  "required_skills": [
    {
      "id": "skill_1",
      "name": "string",
      "canonical_name": "string",
      "weight": 0.1
    }
  ],
  "preferred_skills": [
    {
      "id": "pref_1",
      "name": "string",
      "canonical_name": "string",
      "weight": 0.05
    }
  ],
  "soft_signals": ["string"],
  "tools_platforms": ["string"],
  "must_have_requirements": ["req_1"],
  "nice_to_have_requirements": ["pref_1"],
  "explicit_keywords": ["string"],
  "inferred_keywords": ["string"],
  "minimum_years_experience": 0
}

Rules:
- Weight values must be between 0.03 and 0.2.
- Use lower weights for inferred or preferred items.
- "required" means clearly stated or strongly implied as a primary expectation.
- Keep keywords concise and ATS-relevant.

Job description:
<job_description>
{{job_description}}
</job_description>
`,

  candidateEvidence: `
You are an evidence extractor for a truthful resume-tailoring system.

Extract only atomic evidence units explicitly supported by the candidate data.
Do NOT invent tools, metrics, ownership, scale, or domains.
If something is only weakly implied, label it as weakly_implied instead of explicit.

Return ONLY valid JSON:
{
  "candidate_id": "candidate_profile",
  "evidence_units": [
    {
      "evidence_id": "ev_1",
      "type": "experience_bullet|experience_header|project|education|skill|summary|achievement|language",
      "canonical_skill_tags": ["string"],
      "domain_tags": ["string"],
      "action": "string",
      "outcome": "string",
      "metrics": ["string"],
      "tools": ["string"],
      "source_section": "experience|projects|education|skills|summary|achievements|languages",
      "source_record_id": "string",
      "source_text": "string",
      "explicitness": "explicit|weakly_implied",
      "confidence": 0.0
    }
  ]
}

Rules:
- Confidence must be between 0 and 1.
- Keep evidence units atomic, specific, and grounded.
- If a skill is listed explicitly in the profile, that is valid evidence of familiarity, but not proof of leadership or deep expertise.

Candidate snapshot:
<candidate_snapshot>
{{candidate_snapshot}}
</candidate_snapshot>
`,

  relevanceMapping: `
You are a requirement-to-evidence mapper for truthful resume tailoring.

Match each job requirement to the candidate evidence.
Be conservative. Precision matters more than optimism.

Allowed match_strength values:
- strong_match
- partial_match
- adjacent_match
- no_match

Return ONLY valid JSON:
{
  "mappings": [
    {
      "requirement_id": "string",
      "match_strength": "strong_match|partial_match|adjacent_match|no_match",
      "matched_evidence_ids": ["ev_1"],
      "rationale": "string",
      "safe_resume_language": ["string"],
      "unsupported_terms_to_avoid": ["string"]
    }
  ]
}

Job parse:
<job_parse>
{{job_parse}}
</job_parse>

Candidate evidence:
<candidate_evidence>
{{candidate_evidence}}
</candidate_evidence>
`,

  experienceRewrite: `
You rewrite resume bullets truthfully for {{job_title}} at {{company_name}}.

Use ONLY supplied candidate records and mapped evidence.
Do NOT introduce:
- new tools
- new metrics
- new domains
- new ownership levels
- new architecture claims

If evidence is partial, use modest wording.

Return ONLY valid JSON:
{
  "experience_rewrites": [
    {
      "source_record_id": "string",
      "rewritten_bullets": ["string"],
      "source_evidence_ids": ["ev_1"],
      "target_requirement_ids": ["req_1"],
      "used_keywords": ["string"]
    }
  ],
  "project_rewrites": [
    {
      "source_record_id": "string",
      "rewritten_bullets": ["string"],
      "source_evidence_ids": ["ev_3"],
      "target_requirement_ids": ["req_4"],
      "used_keywords": ["string"]
    }
  ]
}

Rules:
- Keep bullets concise and ATS-readable.
- Prefer action + scope + outcome.
- Include metrics only if explicitly supported.
- Do not rewrite a record that has no useful relevance.
- Keep each bullet short (ideally 1-2 lines on a resume).
- Avoid repetitive sentence starters and duplicate meaning.
- For high-relevance roles, target 4-7 strong bullets. For low-detail roles, keep concise.

Inputs:
<job_parse>
{{job_parse}}
</job_parse>

<mappings>
{{mappings}}
</mappings>

<candidate_snapshot>
{{candidate_snapshot}}
</candidate_snapshot>
`,

  summaryGeneration: `
You write concise, evidence-backed resume summaries for ATS and recruiters.

Write a compact summary for {{job_title}} at {{company_name}}.
Use only supported evidence.
Avoid generic filler like "results-driven", "dynamic", or "hardworking" unless grounded by specifics.
Cap the summary to high-signal content only:
- max 25 words
- role-aligned keywords naturally included
- years of experience, core domain, strongest capabilities, and 1-2 high-impact strengths

Return ONLY valid JSON:
{
  "summary": "string",
  "supporting_evidence_ids": ["ev_1"],
  "included_keywords": ["string"],
  "excluded_keywords_due_to_no_evidence": ["string"]
}

Inputs:
<job_parse>
{{job_parse}}
</job_parse>

<mappings>
{{mappings}}
</mappings>

<candidate_evidence>
{{candidate_evidence}}
</candidate_evidence>
`,

  atsEvaluation: `
You are an ATS evaluator for a truthful resume-tailoring system.

Score based on:
- requirement coverage
- evidence support
- keyword alignment
- readability
- role narrative fit

Penalize:
- unsupported claims
- keyword stuffing
- repeated shallow terminology

Do not reward raw frequency after a term is already represented naturally.

Return ONLY valid JSON:
{
  "matched_requirements": ["string"],
  "partially_matched_requirements": ["string"],
  "missing_requirements": ["string"],
  "unsupported_claims": ["string"],
  "stuffing_flags": ["string"],
  "strengths": ["string"],
  "gaps": ["string"],
  "improvement_actions": [
    {
      "action": "string",
      "impact_pct": 8,
      "reason": "string"
    }
  ]
}

Inputs:
<job_parse>
{{job_parse}}
</job_parse>

<candidate_evidence>
{{candidate_evidence}}
</candidate_evidence>

<mappings>
{{mappings}}
</mappings>

<final_resume>
{{final_resume}}
</final_resume>
`,

  finalAssembly: `
You assemble a final resume package for {{job_title}} at {{company_name}}.

Do not add any new facts.
Do not modify the meaning of validated bullets.
Only organize and order content to maximize job relevance naturally.

Return ONLY valid JSON:
{
  "ordering_notes": ["string"],
  "section_priority": ["summary", "skills", "experience", "projects", "education"]
}

Inputs:
<summary>
{{summary}}
</summary>

<skills>
{{skills}}
</skills>

<rewritten_sections>
{{rewritten_sections}}
</rewritten_sections>

<candidate_snapshot>
{{candidate_snapshot}}
</candidate_snapshot>
`,

  coverLetter: `
You are an expert cover letter writer.

Write a personalized cover letter for {{job_title}} at {{company_name}}.
Use only supported evidence from the candidate profile and final tailored resume.
Do not introduce new metrics, tools, or experiences.

Tone: {{tone}}

Rules:
1. Maximum 3 paragraphs.
2. Paragraph 1: role fit and motivation.
3. Paragraph 2: 2-3 evidence-backed highlights relevant to the role.
4. Paragraph 3: specific close for {{company_name}}.
5. 180-260 words.
6. No markdown. No subject line.

Inputs:
<job_parse>
{{job_parse}}
</job_parse>

<mappings>
{{mappings}}
</mappings>

<final_resume>
{{final_resume}}
</final_resume>

<candidate_evidence>
{{candidate_evidence}}
</candidate_evidence>
`,
};

export const JD_PARSING_PROMPT = (jd: string, promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>) =>
  resolvePromptTemplate('jdParsing', { job_description: jd }, promptSetting);

export const CANDIDATE_EVIDENCE_PROMPT = (candidateSnapshot: object, promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>) =>
  resolvePromptTemplate('candidateEvidence', { candidate_snapshot: JSON.stringify(candidateSnapshot, null, 2) }, promptSetting);

export const RELEVANCE_MAPPING_PROMPT = (jdParse: object, candidateEvidence: object, promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>) =>
  resolvePromptTemplate(
    'relevanceMapping',
    {
      job_parse: JSON.stringify(jdParse, null, 2),
      candidate_evidence: JSON.stringify(candidateEvidence, null, 2),
    },
    promptSetting
  );

export const BULLET_REWRITE_PROMPT = (
  input: {
    companyName: string;
    jobTitle: string;
    jdParse: object;
    mappings: object;
    candidateSnapshot: object;
  },
  promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>
) =>
  resolvePromptTemplate(
    'experienceRewrite',
    {
      company_name: input.companyName,
      job_title: input.jobTitle,
      job_parse: JSON.stringify(input.jdParse, null, 2),
      mappings: JSON.stringify(input.mappings, null, 2),
      candidate_snapshot: JSON.stringify(input.candidateSnapshot, null, 2),
    },
    promptSetting
  );

export const SUMMARY_GENERATION_PROMPT = (
  input: {
    companyName: string;
    jobTitle: string;
    jdParse: object;
    mappings: object;
    candidateEvidence: object;
  },
  promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>
) =>
  resolvePromptTemplate(
    'summaryGeneration',
    {
      company_name: input.companyName,
      job_title: input.jobTitle,
      job_parse: JSON.stringify(input.jdParse, null, 2),
      mappings: JSON.stringify(input.mappings, null, 2),
      candidate_evidence: JSON.stringify(input.candidateEvidence, null, 2),
    },
    promptSetting
  );

export const ATS_EVALUATION_PROMPT = (
  input: {
    jdParse: object;
    candidateEvidence: object;
    mappings: object;
    finalResume: object;
  },
  promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>
) =>
  resolvePromptTemplate(
    'atsEvaluation',
    {
      job_parse: JSON.stringify(input.jdParse, null, 2),
      candidate_evidence: JSON.stringify(input.candidateEvidence, null, 2),
      mappings: JSON.stringify(input.mappings, null, 2),
      final_resume: JSON.stringify(input.finalResume, null, 2),
    },
    promptSetting
  );

export const FINAL_ASSEMBLY_PROMPT = (
  input: {
    companyName: string;
    jobTitle: string;
    summary: object;
    skills: object;
    rewrittenSections: object;
    candidateSnapshot: object;
  },
  promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>
) =>
  resolvePromptTemplate(
    'finalAssembly',
    {
      company_name: input.companyName,
      job_title: input.jobTitle,
      summary: JSON.stringify(input.summary, null, 2),
      skills: JSON.stringify(input.skills, null, 2),
      rewritten_sections: JSON.stringify(input.rewrittenSections, null, 2),
      candidate_snapshot: JSON.stringify(input.candidateSnapshot, null, 2),
    },
    promptSetting
  );

export const COVER_LETTER_PROMPT = (
  input: {
    companyName: string;
    jobTitle: string;
    tone: 'formal' | 'modern' | 'aggressive';
    jdParse: object;
    mappings: object;
    finalResume: object;
    candidateEvidence: object;
  },
  promptSetting?: Pick<ResumePromptTemplateSetting, 'activeMode' | 'customTemplate' | 'defaultTemplate'>
) =>
  resolvePromptTemplate(
    'coverLetter',
    {
      company_name: input.companyName,
      job_title: input.jobTitle,
      tone: input.tone,
      job_parse: JSON.stringify(input.jdParse, null, 2),
      mappings: JSON.stringify(input.mappings, null, 2),
      final_resume: JSON.stringify(input.finalResume, null, 2),
      candidate_evidence: JSON.stringify(input.candidateEvidence, null, 2),
    },
    promptSetting
  );
