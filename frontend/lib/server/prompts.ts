export const JD_ANALYSIS_PROMPT = (jd: string) => `
You are an expert ATS (Applicant Tracking System) analyst. Analyze the job description below.

<job_description>
${jd}
</job_description>

Return ONLY valid JSON (no markdown, no explanation):
{
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill3"],
  "key_responsibilities": ["resp1", "resp2"],
  "seniority_level": "junior|mid|senior|staff",
  "domain": "backend|frontend|fullstack|ml|devops|product|design|other",
  "keywords": ["keyword1", "keyword2"],
  "action_verbs_expected": ["built", "led", "optimized"],
  "company_values": ["string"],
  "min_years_experience": 0,
  "tech_stack_mentioned": ["tech1", "tech2"]
}
`;

export const MATCH_PROFILE_PROMPT = (userProfile: object, jdAnalysis: object) => `
You are an ATS resume optimization expert. Compare the candidate profile with the job requirements.

<candidate_profile>
${JSON.stringify(userProfile, null, 2)}
</candidate_profile>

<job_requirements>
${JSON.stringify(jdAnalysis, null, 2)}
</job_requirements>

Return ONLY valid JSON:
{
  "ats_score": 78,
  "matched_keywords": ["React", "Node.js", "PostgreSQL"],
  "missing_keywords": ["Kubernetes", "gRPC"],
  "matched_skills": ["TypeScript", "AWS"],
  "missing_skills": ["Golang"],
  "strengths": ["Strong API experience matches role requirements"],
  "gaps": ["No Kubernetes experience mentioned"],
  "suggestions": [
    {
      "action": "Add Kubernetes to skills section",
      "impact_pct": 8,
      "reason": "Required skill mentioned 3 times in JD"
    }
  ]
}
`;

export const RESUME_GENERATION_PROMPT = (
  userProfile: object,
  jdAnalysis: object,
  matchResult: object,
  companyName: string,
  jobTitle: string
) => `
You are a professional resume writer specializing in ATS-optimized resumes for top tech companies.

Generate a complete, ATS-optimized resume for this candidate applying to ${jobTitle} at ${companyName}.

<candidate_profile>
${JSON.stringify(userProfile, null, 2)}
</candidate_profile>

<job_analysis>
${JSON.stringify(jdAnalysis, null, 2)}
</job_analysis>

<match_analysis>
${JSON.stringify(matchResult, null, 2)}
</match_analysis>

STRICT RULES:
1. Use strong action verbs: Built, Led, Designed, Optimized, Shipped, Reduced, Increased, Automated
2. Quantify every achievement: "reduced latency by 40%", "served 2M+ requests/day"
3. Include matched_keywords naturally in bullets — do NOT keyword stuff
4. Summary must be 2-3 sentences max, tailored to ${jobTitle}
5. Bullets: 1-2 lines each, start with action verb, include metric
6. NO tables, NO columns, NO images — ATS plain text structure
7. Prioritize experiences most relevant to ${companyName}'s domain

Return ONLY valid JSON:
{
  "summary": "string",
  "skills": {
    "technical": ["React", "Node.js"],
    "tools": ["Docker", "AWS"],
    "other": []
  },
  "experience": [
    {
      "job_title": "string",
      "company": "string",
      "location": "string",
      "start_date": "Jan 2022",
      "end_date": "Present",
      "bullets": [
        "Led migration from monolith to microservices, reducing deployment time by 70% and improving system reliability to 99.9% uptime",
        "Built REST APIs handling 2M+ daily requests using Node.js and PostgreSQL"
      ]
    }
  ],
  "projects": [
    {
      "name": "string",
      "tech_stack": "React, Node.js, Redis",
      "description": "Built X achieving Y metric",
      "url": "string|null"
    }
  ],
  "education": [
    {
      "degree": "B.Tech Computer Science",
      "institution": "IIT Bombay",
      "year": "2022",
      "gpa": "8.7/10"
    }
  ]
}
`;

export const COVER_LETTER_PROMPT = (
  userProfile: object,
  jdAnalysis: object,
  resumeContent: object,
  companyName: string,
  jobTitle: string,
  tone: 'formal' | 'modern' | 'aggressive'
) => `
You are an expert cover letter writer. Write a personalized cover letter for ${jobTitle} at ${companyName}.

TONE: ${tone}
- formal: Traditional, structured, respectful, third-person company references
- modern: Confident, concise, conversational yet professional, uses "I" naturally
- aggressive: Bold, direct, makes strong claims, minimal pleasantries, leads with impact

<candidate_profile>
${JSON.stringify(userProfile, null, 2)}
</candidate_profile>

<job_requirements>
${JSON.stringify(jdAnalysis, null, 2)}
</job_requirements>

<resume_highlights>
${JSON.stringify(resumeContent, null, 2)}
</resume_highlights>

RULES:
1. Maximum 3 paragraphs
2. Para 1: Strong opener connecting candidate to ${companyName}'s mission (no "I am writing to apply...")
3. Para 2: 2-3 specific achievements directly relevant to the role, with metrics
4. Para 3: Why ${companyName} specifically, forward-looking close
5. Tone: ${tone}
6. Length: 200-280 words

Return ONLY the plain text cover letter. No JSON. No markdown. No subject line.
`;
