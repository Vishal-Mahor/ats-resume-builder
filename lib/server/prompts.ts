export const JD_PARSING_PROMPT = (jd: string) => `
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
${jd}
</job_description>
`;

export const CANDIDATE_EVIDENCE_PROMPT = (candidateSnapshot: object) => `
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
${JSON.stringify(candidateSnapshot, null, 2)}
</candidate_snapshot>
`;

export const RELEVANCE_MAPPING_PROMPT = (jdParse: object, candidateEvidence: object) => `
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
${JSON.stringify(jdParse, null, 2)}
</job_parse>

Candidate evidence:
<candidate_evidence>
${JSON.stringify(candidateEvidence, null, 2)}
</candidate_evidence>
`;

export const BULLET_REWRITE_PROMPT = (input: {
  companyName: string;
  jobTitle: string;
  jdParse: object;
  mappings: object;
  candidateSnapshot: object;
}) => `
You rewrite resume bullets truthfully for ${input.jobTitle} at ${input.companyName}.

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
${JSON.stringify(input.jdParse, null, 2)}
</job_parse>

<mappings>
${JSON.stringify(input.mappings, null, 2)}
</mappings>

<candidate_snapshot>
${JSON.stringify(input.candidateSnapshot, null, 2)}
</candidate_snapshot>
`;

export const SUMMARY_GENERATION_PROMPT = (input: {
  companyName: string;
  jobTitle: string;
  jdParse: object;
  mappings: object;
  candidateEvidence: object;
}) => `
You write concise, evidence-backed resume summaries for ATS and recruiters.

Write a compact summary for ${input.jobTitle} at ${input.companyName}.
Use only supported evidence.
Avoid generic filler like "results-driven", "dynamic", or "hardworking" unless grounded by specifics.
Cap the summary to high-signal content only:
- max 3-5 lines (or about 110 words)
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
${JSON.stringify(input.jdParse, null, 2)}
</job_parse>

<mappings>
${JSON.stringify(input.mappings, null, 2)}
</mappings>

<candidate_evidence>
${JSON.stringify(input.candidateEvidence, null, 2)}
</candidate_evidence>
`;

export const ATS_EVALUATION_PROMPT = (input: {
  jdParse: object;
  candidateEvidence: object;
  mappings: object;
  finalResume: object;
}) => `
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
${JSON.stringify(input.jdParse, null, 2)}
</job_parse>

<candidate_evidence>
${JSON.stringify(input.candidateEvidence, null, 2)}
</candidate_evidence>

<mappings>
${JSON.stringify(input.mappings, null, 2)}
</mappings>

<final_resume>
${JSON.stringify(input.finalResume, null, 2)}
</final_resume>
`;

export const FINAL_ASSEMBLY_PROMPT = (input: {
  companyName: string;
  jobTitle: string;
  summary: object;
  skills: object;
  rewrittenSections: object;
  candidateSnapshot: object;
}) => `
You assemble a final resume package for ${input.jobTitle} at ${input.companyName}.

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
${JSON.stringify(input.summary, null, 2)}
</summary>

<skills>
${JSON.stringify(input.skills, null, 2)}
</skills>

<rewritten_sections>
${JSON.stringify(input.rewrittenSections, null, 2)}
</rewritten_sections>

<candidate_snapshot>
${JSON.stringify(input.candidateSnapshot, null, 2)}
</candidate_snapshot>
`;

export const COVER_LETTER_PROMPT = (input: {
  companyName: string;
  jobTitle: string;
  tone: 'formal' | 'modern' | 'aggressive';
  jdParse: object;
  mappings: object;
  finalResume: object;
  candidateEvidence: object;
}) => `
You are an expert cover letter writer.

Write a personalized cover letter for ${input.jobTitle} at ${input.companyName}.
Use only supported evidence from the candidate profile and final tailored resume.
Do not introduce new metrics, tools, or experiences.

Tone: ${input.tone}

Rules:
1. Maximum 3 paragraphs.
2. Paragraph 1: role fit and motivation.
3. Paragraph 2: 2-3 evidence-backed highlights relevant to the role.
4. Paragraph 3: specific close for ${input.companyName}.
5. 180-260 words.
6. No markdown. No subject line.

Inputs:
<job_parse>
${JSON.stringify(input.jdParse, null, 2)}
</job_parse>

<mappings>
${JSON.stringify(input.mappings, null, 2)}
</mappings>

<final_resume>
${JSON.stringify(input.finalResume, null, 2)}
</final_resume>

<candidate_evidence>
${JSON.stringify(input.candidateEvidence, null, 2)}
</candidate_evidence>
`;
