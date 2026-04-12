// ============================================================
// API Client — lib/api.ts
// ============================================================
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ats_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
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
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      request<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    me: () => request<User>('/api/auth/me'),
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
    pdfUrl:      (id: string) => `${BASE}/api/resumes/${id}/pdf`,
    coverPdfUrl: (id: string) => `${BASE}/api/resumes/${id}/cover-pdf`,
  },

  // ─── Generate ───────────────────────────────────────────
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
  status: string; created_at: string;
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
  job_description: string; cover_letter_tone: 'formal' | 'modern' | 'aggressive';
}

export interface GenerateResult {
  resume_id: string; resume_content: ResumeContent; cover_letter: string;
  ats_score: number; matched_keywords: string[]; missing_keywords: string[];
  suggestions: Suggestion[]; created_at: string;
}
