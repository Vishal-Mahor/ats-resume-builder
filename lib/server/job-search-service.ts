import { z } from 'zod';
import type { ResumeContent } from '@/lib/api';
import { callOpenAI } from './ai';
import { HttpError } from './http';

export type JobSearchFilters = {
  title?: string;
  location?: string;
  skills?: string;
  company?: string;
  source?: string;
  workMode?: string;
  posted?: string;
};

export type LiveJobOpening = {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  description: string;
  postedAt: string;
  workMode: string;
  employmentType: string;
  salary: string;
  applyLink?: string;
  tags: string[];
  responsibilities: string[];
  matchScore?: number;
  matchedKeywords: string[];
  missingKeywords: string[];
};

type SerpApiJob = {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  description?: string;
  share_link?: string;
  source_link?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    salary?: string;
    work_from_home?: boolean;
  };
  job_highlights?: Array<{ title?: string; items?: string[] }>;
  apply_options?: Array<{ title?: string; link?: string }>;
};

type SerpApiResponse = {
  error?: string;
  jobs_results?: SerpApiJob[];
  serpapi_pagination?: {
    next_page_token?: string;
  };
};

type ProviderSearchAttempt = {
  query: string;
  filters: JobSearchFilters;
  applyLocalFilters: boolean;
};

type ProviderJobPage = {
  jobs: LiveJobOpening[];
  nextPageToken?: string;
};

type ProviderPageTokenState = ProviderSearchAttempt & {
  token: string;
  originalFilters: JobSearchFilters;
};

const aiCriteriaSchema = z.object({
  query: z.string().trim().min(2).max(180),
  title: z.string().trim().max(100).optional().default(''),
  skills: z.array(z.string().trim().min(1).max(40)).max(8).optional().default([]),
});

const aiRankingSchema = z.object({
  rankings: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(100),
      matchedKeywords: z.array(z.string()).max(8).default([]),
      missingKeywords: z.array(z.string()).max(8).default([]),
    })
  ),
});

const FILTER_TYPEAHEAD_VALUES: Partial<Record<'title' | 'skills' | 'company' | 'source', string[]>> = {
  title: [
    'Software Engineer',
    'Software Developer',
    'Senior Software Engineer',
    'Backend Software Engineer',
    'Frontend Software Engineer',
    'Full Stack Software Engineer',
    'Data Engineer',
    'DevOps Engineer',
    'Product Manager',
  ],
  skills: [
    'JavaScript',
    'TypeScript',
    'React',
    'Next.js',
    'Node.js',
    'Python',
    'Java',
    'SQL',
    'AWS',
    'Docker',
  ],
  source: ['LinkedIn', 'Glassdoor', 'Naukri', 'Apna', 'Indeed', 'SEEK', 'Workable', 'Greenhouse', 'Wellfound'],
};

const SOURCE_ALIASES: Record<string, string[]> = {
  linkedin: ['linkedin', 'linked in', 'linkedin.com'],
  glassdoor: ['glassdoor', 'glassdoor.com'],
  naukri: ['naukri', 'naukri.com'],
  apna: ['apna', 'apna.co'],
  indeed: ['indeed', 'indeed.com'],
  seek: ['seek', 'seek.com'],
  workable: ['workable', 'workable.com'],
  greenhouse: ['greenhouse', 'greenhouse.io', 'boards.greenhouse.io'],
  wellfound: ['wellfound', 'angel.co'],
};

const DEFAULT_AI_JOB_QUERY = 'Software Engineer';

export async function searchLiveJobs(input: {
  query?: string;
  filters: JobSearchFilters;
  aiResume?: { title: string; content: ResumeContent };
  pageToken?: string;
}) {
  assertProviderConfigured();
  const criteria = input.aiResume
    ? await buildAiCriteriaSafe(input.aiResume, input.query, input.filters)
    : { query: input.query?.trim() || input.filters.title?.trim() || 'jobs', title: '', skills: [] as string[] };
  const mergedFilters = input.aiResume
    ? {
        ...input.filters,
        title: input.filters.title || criteria.title || inferRoleQuery(criteria.query),
        skills: input.filters.skills,
      }
    : input.filters;

  const page = input.aiResume
    ? await fetchAiProviderJobs(criteria.query, mergedFilters, input.pageToken)
    : await fetchProviderJobs(criteria.query, mergedFilters, input.pageToken);
  const scoredJobs = input.aiResume ? await scoreJobsAgainstResumeSafe(page.jobs, input.aiResume, criteria.skills) : page.jobs;

  return {
    jobs: scoredJobs,
    nextPageToken: page.nextPageToken,
    aiCriteria: input.aiResume
      ? {
          query: criteria.query,
          skills: criteria.skills,
        }
      : undefined,
    provider: 'Google Jobs via SerpApi',
  };
}

async function buildAiCriteriaSafe(
  resume: { title: string; content: ResumeContent },
  query: string | undefined,
  filters: JobSearchFilters
) {
  try {
    return await buildAiCriteria(resume, query, filters);
  } catch {
    return buildDeterministicAiCriteria(resume, query, filters);
  }
}

async function fetchAiProviderJobs(query: string, filters: JobSearchFilters, pageToken?: string) {
  const page = await fetchProviderJobs(query, filters, pageToken);
  if (page.jobs.length || pageToken) return page;

  const broadQuery = inferBroadRoleQuery(query) || inferBroadRoleQuery(filters.title || '') || DEFAULT_AI_JOB_QUERY;
  return fetchProviderJobs(broadQuery, {});
}

export async function suggestLiveJobValues(input: {
  type: 'title' | 'skills' | 'company' | 'source';
  query: string;
  filters: JobSearchFilters;
}) {
  const localValues = FILTER_TYPEAHEAD_VALUES[input.type] ?? [];
  let liveValues: string[] = [];

  if (process.env.SERPAPI_API_KEY) {
    try {
      const page = await fetchProviderJobs(input.query, {
        ...input.filters,
        [input.type]: input.query,
      });
      liveValues = page.jobs.flatMap((job) => {
        if (input.type === 'title') return [job.title];
        if (input.type === 'company') return [job.company];
        if (input.type === 'source') return [job.source];
        return job.tags;
      });
    } catch {
      // Keep typeahead usable when the upstream provider is temporarily unavailable.
    }
  }

  return Array.from(new Set([...liveValues, ...localValues]))
    .filter((value) => value.toLowerCase().includes(input.query.toLowerCase()))
    .slice(0, 5);
}

async function fetchProviderJobs(query: string, filters: JobSearchFilters, pageToken?: string): Promise<ProviderJobPage> {
  const apiKey = assertProviderConfigured();
  if (pageToken) {
    return fetchProviderJobsFromPageToken(apiKey, pageToken);
  }

  const attempts = buildProviderSearchAttempts(query, filters);
  let lastProviderError = '';

  for (const attempt of attempts) {
    const { jobs, error, nextPageToken } = await fetchProviderJobsOnce(apiKey, attempt.query, attempt.filters);
    if (error) {
      if (isNoResultsProviderError(error)) {
        lastProviderError = error;
        continue;
      }
      throw new HttpError(502, error);
    }

    const filteredJobs = attempt.applyLocalFilters ? applyResponseFilters(jobs, filters) : [];
    const displayJobs = filteredJobs.length ? filteredJobs : jobs;
    if (displayJobs.length) {
      return {
        jobs: displayJobs.slice(0, 25),
        nextPageToken: nextPageToken
          ? encodeProviderPageToken({
              ...attempt,
              token: nextPageToken,
              originalFilters: filters,
            })
          : undefined,
      };
    }
  }

  if (lastProviderError) {
    return { jobs: [] };
  }

  return { jobs: [] };
}

async function fetchProviderJobsFromPageToken(apiKey: string, pageToken: string): Promise<ProviderJobPage> {
  const state = decodeProviderPageToken(pageToken);
  const { jobs, error, nextPageToken } = await fetchProviderJobsOnce(apiKey, state.query, state.filters, state.token);

  if (error) {
    if (isNoResultsProviderError(error)) return { jobs: [] };
    throw new HttpError(502, error);
  }

  const filteredJobs = state.applyLocalFilters ? applyResponseFilters(jobs, state.originalFilters) : [];
  const displayJobs = filteredJobs.length ? filteredJobs : jobs;

  return {
    jobs: displayJobs.slice(0, 25),
    nextPageToken: nextPageToken
      ? encodeProviderPageToken({
          ...state,
          token: nextPageToken,
        })
      : undefined,
  };
}

async function fetchProviderJobsOnce(apiKey: string, query: string, filters: JobSearchFilters, pageToken?: string) {
  const upstreamQuery = buildProviderQuery(query, filters);
  const params = new URLSearchParams({
    engine: 'google_jobs',
    api_key: apiKey,
    q: upstreamQuery,
    hl: 'en',
    gl: inferCountryCode(filters.location),
    output: 'json',
  });

  if (filters.location?.trim()) {
    params.set('location', filters.location.trim());
  }

  if (filters.workMode?.toLowerCase().includes('remote')) {
    params.set('ltype', '1');
  }

  if (pageToken) {
    params.set('next_page_token', pageToken);
  }

  const upstream = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { cache: 'no-store' });
  const payload = (await upstream.json().catch(() => ({}))) as SerpApiResponse;
  if (!upstream.ok || payload.error) {
    return { jobs: [] as LiveJobOpening[], error: payload.error || 'The live job provider could not complete this search.' };
  }

  const jobs = (payload.jobs_results ?? []).map(mapProviderJob).filter((job): job is LiveJobOpening => Boolean(job));
  return { jobs, nextPageToken: payload.serpapi_pagination?.next_page_token };
}

function assertProviderConfigured() {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'Live job search is not configured. Add SERPAPI_API_KEY to enable listings from indexed job boards.');
  }
  return apiKey;
}

async function buildAiCriteria(
  resume: { title: string; content: ResumeContent },
  query: string | undefined,
  filters: JobSearchFilters
) {
  const raw = await callOpenAI(
    `You generate concise live job-search criteria from a resume. Return ONLY JSON:
{"query":"string","title":"string","skills":["string"]}

Rules:
- Search for roles supported by explicit resume evidence.
- Keep query suitable for a job-board search box, under 12 words.
- Include at most 6 concrete technologies or role keywords.
- Respect the user's typed query and filters when provided.

User query: ${query?.trim() || 'none'}
User filters: ${JSON.stringify(filters)}
Resume title: ${resume.title}
Resume content: ${JSON.stringify(resume.content).slice(0, 7000)}`,
    true
  );

  return aiCriteriaSchema.parse(JSON.parse(raw));
}

function buildDeterministicAiCriteria(
  resume: { title: string; content: ResumeContent },
  query: string | undefined,
  filters: JobSearchFilters
) {
  const resumeText = JSON.stringify(resume.content);
  const skills = extractTags(resumeText).slice(0, 6);
  const roleQuery =
    query?.trim() ||
    filters.title?.trim() ||
    inferRoleQuery(resume.title) ||
    inferBroadRoleQuery(resume.title) ||
    DEFAULT_AI_JOB_QUERY;

  return {
    query: roleQuery,
    title: filters.title?.trim() || inferRoleQuery(roleQuery) || inferBroadRoleQuery(roleQuery),
    skills,
  };
}

async function scoreJobsAgainstResume(jobs: LiveJobOpening[], resume: { title: string; content: ResumeContent }) {
  if (!jobs.length) return jobs;

  const raw = await callOpenAI(
    `Rank live jobs against grounded resume evidence. Return ONLY JSON:
{"rankings":[{"id":"string","score":0,"matchedKeywords":["string"],"missingKeywords":["string"]}]}

Rules:
- Use a 0-100 score.
- Never claim a match for skills not in the resume.
- Provide at most 5 matched and 5 missing keywords for each job.

Resume title: ${resume.title}
Resume content: ${JSON.stringify(resume.content).slice(0, 6500)}
Jobs: ${JSON.stringify(
      jobs.slice(0, 10).map((job) => ({ id: job.id, title: job.title, description: job.description.slice(0, 1200), tags: job.tags }))
    )}`,
    true
  );
  const ranking = aiRankingSchema.parse(JSON.parse(raw));
  const byId = new Map(ranking.rankings.map((item) => [item.id, item]));
  const deterministicScores = new Map(scoreJobsDeterministically(jobs, resume, []).map((job) => [job.id, job]));

  return jobs
    .map((job) => {
      const fit = byId.get(job.id);
      if (fit) {
        return { ...job, matchScore: Math.round(fit.score), matchedKeywords: fit.matchedKeywords, missingKeywords: fit.missingKeywords };
      }

      return deterministicScores.get(job.id) ?? job;
    })
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0));
}

async function scoreJobsAgainstResumeSafe(jobs: LiveJobOpening[], resume: { title: string; content: ResumeContent }, criteriaSkills: string[]) {
  if (!jobs.length) return jobs;

  try {
    return await scoreJobsAgainstResume(jobs, resume);
  } catch {
    return scoreJobsDeterministically(jobs, resume, criteriaSkills);
  }
}

function scoreJobsDeterministically(jobs: LiveJobOpening[], resume: { title: string; content: ResumeContent }, criteriaSkills: string[]) {
  const resumeText = JSON.stringify(resume.content).toLowerCase();
  const resumeKeywords = new Set([
    ...extractTags(resumeText),
    ...criteriaSkills,
  ].map((item) => item.trim()).filter(Boolean));

  return jobs
    .map((job) => {
      const jobText = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase();
      const matchedKeywords = Array.from(resumeKeywords)
        .filter((keyword) => jobText.includes(keyword.toLowerCase()))
        .slice(0, 5);
      const missingKeywords = Array.from(resumeKeywords)
        .filter((keyword) => !jobText.includes(keyword.toLowerCase()))
        .slice(0, 5);
      const titleBoost = inferBroadRoleQuery(job.title) === inferBroadRoleQuery(resume.title) ? 25 : 0;
      const matchScore = Math.min(95, Math.max(35, titleBoost + matchedKeywords.length * 12));

      return {
        ...job,
        matchScore,
        matchedKeywords,
        missingKeywords,
      };
    })
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0));
}

function mapProviderJob(job: SerpApiJob): LiveJobOpening | null {
  if (!job.title || !job.company_name) return null;

  const highlights = job.job_highlights?.flatMap((item) => item.items ?? []) ?? [];
  const description = job.description?.trim() || highlights.join(' ') || 'Open the source listing for complete job details.';
  const source = (job.via || job.apply_options?.[0]?.title || 'Job source').replace(/^via\s+/i, '');
  const workMode = job.detected_extensions?.work_from_home ? 'Remote' : findWorkMode(job.extensions ?? []);
  const applyLink = job.apply_options?.[0]?.link || job.source_link || job.share_link;

  return {
    id: job.job_id || `${job.company_name}-${job.title}-${job.location || 'unknown'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: job.title,
    company: job.company_name,
    location: job.location || 'Location not listed',
    source,
    description,
    postedAt: job.detected_extensions?.posted_at || findPostedLabel(job.extensions ?? []),
    workMode,
    employmentType: job.detected_extensions?.schedule_type || findSchedule(job.extensions ?? []),
    salary: job.detected_extensions?.salary || findSalary(job.extensions ?? []),
    applyLink,
    tags: extractTags(`${job.title} ${description}`),
    responsibilities: highlights.slice(0, 5),
    matchedKeywords: [],
    missingKeywords: [],
  };
}

function buildProviderQuery(query: string, filters: JobSearchFilters) {
  return [
    filters.title?.trim() || query.trim() || 'jobs',
    filters.skills?.trim(),
    filters.company?.trim() ? `at ${filters.company.trim()}` : '',
    filters.source?.trim() ? `${filters.source.trim()} jobs` : '',
    filters.workMode?.trim(),
  ]
    .filter(Boolean)
    .join(' ');
}

function buildProviderSearchAttempts(query: string, filters: JobSearchFilters): ProviderSearchAttempt[] {
  const attempts: ProviderSearchAttempt[] = [];
  const relaxedFilters = compactFilters({
    ...filters,
    source: undefined,
    workMode: undefined,
    posted: undefined,
  });
  const roleOnlyFilters = compactFilters({
    ...relaxedFilters,
    skills: undefined,
  });
  const noLocationFilters = compactFilters({
    ...roleOnlyFilters,
    location: undefined,
  });
  const broadFilters = compactFilters({
    ...noLocationFilters,
    title: undefined,
    company: undefined,
  });
  const simplifiedQuery = simplifyProviderQuery(query, filters);
  const roleQuery = inferRoleQuery(query) || simplifiedQuery;
  const broadRoleQuery = inferBroadRoleQuery(query) || inferBroadRoleQuery(filters.title || '') || 'Software Engineer';

  addProviderSearchAttempt(attempts, { query, filters, applyLocalFilters: true });
  addProviderSearchAttempt(attempts, { query: simplifiedQuery, filters: relaxedFilters, applyLocalFilters: true });
  addProviderSearchAttempt(attempts, { query: roleQuery, filters: roleOnlyFilters, applyLocalFilters: true });
  addProviderSearchAttempt(attempts, { query: roleQuery, filters: noLocationFilters, applyLocalFilters: false });
  addProviderSearchAttempt(attempts, { query: broadRoleQuery, filters: broadFilters, applyLocalFilters: false });

  return attempts;
}

function addProviderSearchAttempt(attempts: ProviderSearchAttempt[], attempt: ProviderSearchAttempt) {
  const key = JSON.stringify({
    query: attempt.query.trim().toLowerCase(),
    filters: compactFilters(attempt.filters),
    applyLocalFilters: attempt.applyLocalFilters,
  });
  const exists = attempts.some(
    (item) =>
      JSON.stringify({
        query: item.query.trim().toLowerCase(),
        filters: compactFilters(item.filters),
        applyLocalFilters: item.applyLocalFilters,
      }) === key
  );
  if (!exists) attempts.push(attempt);
}

function encodeProviderPageToken(state: ProviderPageTokenState) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

function decodeProviderPageToken(token: string): ProviderPageTokenState {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as ProviderPageTokenState;
    if (!decoded.token || !decoded.query || typeof decoded.applyLocalFilters !== 'boolean') {
      throw new Error('Invalid token');
    }
    return decoded;
  } catch {
    throw new HttpError(400, 'Invalid job pagination token.');
  }
}

function simplifyProviderQuery(query: string, filters: JobSearchFilters) {
  const title = filters.title?.trim();
  if (title) return title;

  const cleanQuery = query.trim();
  if (!cleanQuery) return 'software engineer';

  const words = cleanQuery.split(/\s+/).filter(Boolean);
  return words.length > 4 ? words.slice(0, 4).join(' ') : cleanQuery;
}

function inferRoleQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return '';

  const rolePatterns: Array<[RegExp, string]> = [
    [/\bbackend\b.*\bsoftware engineer\b|\bsoftware engineer\b.*\bbackend\b/, 'Backend Software Engineer'],
    [/\bfrontend\b.*\bsoftware engineer\b|\bsoftware engineer\b.*\bfrontend\b/, 'Frontend Software Engineer'],
    [/\bfull[ -]?stack\b.*\bsoftware engineer\b|\bsoftware engineer\b.*\bfull[ -]?stack\b/, 'Full Stack Software Engineer'],
    [/\bsoftware engineer\b/, 'Software Engineer'],
    [/\bsoftware developer\b/, 'Software Developer'],
    [/\bdata engineer\b/, 'Data Engineer'],
    [/\bdevops engineer\b/, 'DevOps Engineer'],
    [/\bmachine learning engineer\b|\bml engineer\b/, 'Machine Learning Engineer'],
    [/\bproduct manager\b/, 'Product Manager'],
  ];

  return rolePatterns.find(([pattern]) => pattern.test(normalized))?.[1] ?? '';
}

function inferBroadRoleQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return '';
  if (/\bsoftware engineer\b|\bbackend\b|\bfrontend\b|\bfull[ -]?stack\b|\bdeveloper\b/.test(normalized)) return 'Software Engineer';
  if (/\bdata\b/.test(normalized)) return 'Data Engineer';
  if (/\bdevops\b|\bsite reliability\b|\bsre\b/.test(normalized)) return 'DevOps Engineer';
  if (/\bmachine learning\b|\bml\b|\bai\b/.test(normalized)) return 'Machine Learning Engineer';
  if (/\bproduct\b/.test(normalized)) return 'Product Manager';
  return '';
}

function compactFilters(filters: JobSearchFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value?.trim())) as JobSearchFilters;
}

function isNoResultsProviderError(error: string) {
  return /hasn'?t returned any results|no results|did not return any results/i.test(error);
}

function applyResponseFilters(jobs: LiveJobOpening[], filters: JobSearchFilters) {
  return jobs.filter((job) => {
    const sourceMatch = !filters.source || matchesSource(job, filters.source);
    const workModeMatch = !filters.workMode || job.workMode.toLowerCase().includes(filters.workMode.toLowerCase());
    const postedMatch = !filters.posted || withinAgeFilter(job.postedAt, filters.posted);
    return sourceMatch && workModeMatch && postedMatch;
  });
}

function matchesSource(job: LiveJobOpening, sourceFilter: string) {
  const normalizedSource = sourceFilter.trim().toLowerCase();
  const normalizedKey = normalizedSource.replace(/\s+/g, '');
  const aliases =
    SOURCE_ALIASES[normalizedKey] ??
    Object.values(SOURCE_ALIASES).find((items) => items.some((alias) => alias === normalizedSource || alias === normalizedKey)) ??
    [normalizedSource];
  const haystack = [job.source, job.applyLink ?? ''].join(' ').toLowerCase();
  return aliases.some((alias) => haystack.includes(alias));
}

function inferCountryCode(location?: string) {
  if (!location) return 'in';
  if (/united states|usa|new york|san francisco/i.test(location)) return 'us';
  if (/australia|sydney|melbourne/i.test(location)) return 'au';
  if (/united kingdom|london|uk/i.test(location)) return 'uk';
  return 'in';
}

function withinAgeFilter(postedAt: string, filter: string) {
  const days = filter.match(/\d+/)?.[0];
  if (!days) return true;
  const maximumDays = Number(days);
  const value = Number(postedAt.match(/\d+/)?.[0] ?? 0);
  if (/hour|today/i.test(postedAt)) return true;
  return /day/i.test(postedAt) ? value <= maximumDays : true;
}

function findWorkMode(extensions: string[]) {
  return extensions.find((item) => /remote|work from home|hybrid|on-site/i.test(item)) || 'Not specified';
}

function findPostedLabel(extensions: string[]) {
  return extensions.find((item) => /ago|today|day/i.test(item)) || 'Recently posted';
}

function findSchedule(extensions: string[]) {
  return extensions.find((item) => /full.?time|part.?time|contract|intern/i.test(item)) || 'Not specified';
}

function findSalary(extensions: string[]) {
  return extensions.find((item) => /[$₹]|INR|USD|per year|per hour/i.test(item)) || 'Salary not listed';
}

function extractTags(value: string) {
  const terms = [
    'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Java', 'Go', 'Golang', 'SQL',
    'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'Kafka', 'FastAPI', 'Spring Boot',
  ];
  return terms.filter((term) => value.toLowerCase().includes(term.toLowerCase())).slice(0, 10);
}
