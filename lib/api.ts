// ============================================================
// API Client — lib/api.ts
// ============================================================
const ACCESS_TOKEN_STORAGE_KEY = 'ats_access_token';
let refreshPromise: Promise<string | null> | null = null;

function getApiBase() {
  return '';
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export async function refreshAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        setAuthToken(null);
        return null;
      }

      const data = await res.json();
      const nextToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
      setAuthToken(nextToken);
      return nextToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (storedToken) {
    return storedToken;
  }

  return refreshAuthToken();
}

function getFileNameFromHeaders(headers: Headers, fallback: string) {
  const disposition = headers.get('content-disposition');
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

async function downloadFile(path: string, fallbackName: string) {
  const token = await getToken();
  if (!token) {
    throw new Error('Please sign in again to download this file.');
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = getFileNameFromHeaders(res.headers, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOnAuthFailure = true
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && retryOnAuthFailure) {
    const refreshedToken = await refreshAuthToken();

    if (refreshedToken) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────
export const api = {
  auth: {
    login:    (email: string, password: string) =>
      request<{ accessToken: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      request<{ accessToken: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    me: () => request<User>('/api/auth/me'),
    logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }, false),
  },

  dashboard: {
    summary: () => request<DashboardSummary>('/api/dashboard/summary'),
  },

  // ─── Profile ────────────────────────────────────────────
  profile: {
    get:    () => request<FullProfile>('/api/profile'),
    update: (data: Partial<FullProfile>) =>
      request<FullProfile>('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ─── Resumes ────────────────────────────────────────────
  resumes: {
    list:   () => request<ResumeSummary[]>('/api/resumes'),
    stats:  () => request<ResumeStats>('/api/resumes/stats'),
    get:    (id: string) => request<Resume>(`/api/resumes/${id}`),
    update: (id: string, data: Partial<Resume>) =>
      request<Resume>(`/api/resumes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/resumes/${id}`, { method: 'DELETE' }),
    downloadPdf:      (id: string) => downloadFile(`/api/resumes/${id}/pdf`, `resume-${id}.pdf`),
    downloadCoverPdf: (id: string) => downloadFile(`/api/resumes/${id}/cover-pdf`, `cover-letter-${id}.pdf`),
  },

  // ─── Generate ───────────────────────────────────────────
  jdAnalysis: (payload: JDAnalysisInput) =>
    request<JDAnalysisResult>('/api/jd-analysis', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  generate: (payload: GeneratePayload) =>
    request<GenerateResult>('/api/generate-resume', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── Types ────────────────────────────────────────────────
export interface User {
  id: string; email: string; name: string; avatar_url?: string; plan: string;
}

export interface FullProfile {
  phone?: string; location?: string; linkedin?: string; github?: string;
  website?: string; summary?: string;
  skills: string[];
  experiences: Experience[];
  projects: Project[];
  education: Education[];
}

export interface Experience {
  id?: string; job_title: string; company: string; location?: string;
  start_date: string; end_date: string; is_current: boolean; bullets: string[];
}

export interface Project {
  id?: string; name: string; tech_stack: string; url?: string; description: string;
}

export interface Education {
  id?: string; degree: string; institution: string; field?: string;
  year: string; gpa?: string;
}

export interface ResumeSummary {
  id: string; company_name: string; job_title: string; ats_score: number;
  source_platform?: string; status: string; created_at: string;
}

export interface ResumeStats {
  total_resumes: number; companies_targeted: number;
  avg_ats_score: number; best_score: number;
}

export interface Resume extends ResumeSummary {
  resume_content: ResumeContent;
  cover_letter: string; cover_letter_tone: string;
  matched_keywords: string[]; missing_keywords: string[];
  suggestions: Suggestion[];
}

export interface DashboardSummary {
  stats: Array<{
    label: string;
    value: number;
    delta: string;
    helper: string;
    trend: 'up' | 'steady' | 'down';
  }>;
  quickActions: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
  }>;
  recentResumes: ResumeSummary[];
  atsInsights: {
    averageKeywordMatch: number;
    topMissingKeywords: string[];
    recommendations: Suggestion[];
    profileCompletion: number;
    profileStrength: string;
  };
  trend: Array<{
    label: string;
    score: number;
  }>;
  nextSteps: string[];
}

export interface ResumeContent {
  summary: string;
  skills: { technical: string[]; tools: string[]; other: string[] };
  experience: Array<{
    job_title: string; company: string; location?: string;
    start_date: string; end_date: string; bullets: string[];
  }>;
  projects: Array<{ name: string; tech_stack: string; description: string; url?: string }>;
  education: Array<{ degree: string; institution: string; year: string; gpa?: string }>;
}

export interface Suggestion {
  action: string; impact_pct: number; reason: string;
}

export interface GeneratePayload {
  company_name: string; job_title: string;
  source_platform?: 'linkedin' | 'indeed' | 'naukri' | 'manual';
  job_description: string; cover_letter_tone: 'formal' | 'modern' | 'aggressive';
}

export interface GenerateResult {
  resume_id: string; resume_content: ResumeContent; cover_letter: string;
  source_platform?: string;
  ats_score: number; matched_keywords: string[]; missing_keywords: string[];
  suggestions: Suggestion[]; created_at: string;
}

export interface JDAnalysisInput {
  job_description: string;
}

export interface JDAnalysisResult {
  extractedRole: string;
  seniorityLevel: string;
  domain: string;
  yearsExperience: number;
  requiredSkills: string[];
  preferredSkills: string[];
  keywords: string[];
  techStack: string[];
  responsibilities: string[];
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  gaps: string[];
  suggestions: Suggestion[];
  atsScore: number;
  profileMatchLabel: string;
}
