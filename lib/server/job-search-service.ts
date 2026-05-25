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
  source: ['LinkedIn', 'Indeed', 'Glassdoor', 'Naukri', 'SEEK', 'Workable', 'Wellfound'],
};

export async function searchLiveJobs(input: {
  query?: string;
  filters: JobSearchFilters;
  aiResume?: { title: string; content: ResumeContent };
}) {
  assertProviderConfigured();
  const criteria = input.aiResume
    ? await buildAiCriteria(input.aiResume, input.query, input.filters)
    : { query: input.query?.trim() || input.filters.title?.trim() || 'jobs', title: '', skills: [] as string[] };
  const mergedFilters = input.aiResume
    ? {
        ...input.filters,
        title: input.filters.title || criteria.title,
        skills: input.filters.skills || criteria.skills.join(', '),
      }
    : input.filters;

  const jobs = await fetchProviderJobs(criteria.query, mergedFilters);
  const scoredJobs = input.aiResume ? await scoreJobsAgainstResume(jobs, input.aiResume) : jobs;

  return {
    jobs: scoredJobs,
    aiCriteria: input.aiResume
      ? {
          query: criteria.query,
          skills: criteria.skills,
        }
      : undefined,
    provider: 'Google Jobs via SerpApi',
  };
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
      const jobs = await fetchProviderJobs(input.query, {
        ...input.filters,
        [input.type]: input.query,
      });
      liveValues = jobs.flatMap((job) => {
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

async function fetchProviderJobs(query: string, filters: JobSearchFilters) {
  const apiKey = assertProviderConfigured();

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

  const upstream = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { cache: 'no-store' });
  const payload = (await upstream.json().catch(() => ({}))) as SerpApiResponse;
  if (!upstream.ok || payload.error) {
    throw new HttpError(502, payload.error || 'The live job provider could not complete this search.');
  }

  const jobs = (payload.jobs_results ?? []).map(mapProviderJob).filter((job): job is LiveJobOpening => Boolean(job));
  return applyResponseFilters(jobs, filters).slice(0, 25);
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

  return jobs
    .map((job) => {
      const fit = byId.get(job.id);
      return fit
        ? { ...job, matchScore: Math.round(fit.score), matchedKeywords: fit.matchedKeywords, missingKeywords: fit.missingKeywords }
        : job;
    })
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0));
}

function mapProviderJob(job: SerpApiJob): LiveJobOpening | null {
  if (!job.job_id || !job.title || !job.company_name) return null;

  const highlights = job.job_highlights?.flatMap((item) => item.items ?? []) ?? [];
  const description = job.description?.trim() || highlights.join(' ') || 'Open the source listing for complete job details.';
  const source = (job.via || job.apply_options?.[0]?.title || 'Job source').replace(/^via\s+/i, '');
  const workMode = job.detected_extensions?.work_from_home ? 'Remote' : findWorkMode(job.extensions ?? []);

  return {
    id: job.job_id,
    title: job.title,
    company: job.company_name,
    location: job.location || 'Location not listed',
    source,
    description,
    postedAt: job.detected_extensions?.posted_at || findPostedLabel(job.extensions ?? []),
    workMode,
    employmentType: job.detected_extensions?.schedule_type || findSchedule(job.extensions ?? []),
    salary: job.detected_extensions?.salary || findSalary(job.extensions ?? []),
    applyLink: job.apply_options?.[0]?.link || job.share_link,
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
    filters.workMode?.trim(),
  ]
    .filter(Boolean)
    .join(' ');
}

function applyResponseFilters(jobs: LiveJobOpening[], filters: JobSearchFilters) {
  return jobs.filter((job) => {
    const sourceMatch = !filters.source || job.source.toLowerCase().includes(filters.source.toLowerCase());
    const workModeMatch = !filters.workMode || job.workMode.toLowerCase().includes(filters.workMode.toLowerCase());
    const postedMatch = !filters.posted || withinAgeFilter(job.postedAt, filters.posted);
    return sourceMatch && workModeMatch && postedMatch;
  });
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
