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
      request<{ sent: boolean; requiresEmailVerification: boolean }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    confirmRegistrationOtp: (email: string, code: string) =>
      request<{ accessToken: string; user: User }>('/api/auth/register/confirm-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
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
    sendEmailOtp: () => request<{ sent: boolean }>('/api/profile/send-email-otp', { method: 'POST' }),
    confirmEmailOtp: (code: string) =>
      request<FullProfile>('/api/profile/confirm-email-otp', { method: 'POST', body: JSON.stringify({ code }) }),
    sendPhoneOtp: () => request<{ sent: boolean }>('/api/profile/send-phone-otp', { method: 'POST' }),
    confirmPhoneOtp: (code: string) =>
      request<FullProfile>('/api/profile/confirm-phone-otp', { method: 'POST', body: JSON.stringify({ code }) }),
  },

  settings: {
    get: () => request<UserSettings>('/api/settings'),
    update: (data: UserSettings) =>
      request<UserSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  billing: {
    get: () => request<BillingSnapshot>('/api/billing'),
    updatePlan: (plan: 'free' | 'plus') =>
      request<BillingSnapshot>('/api/billing', {
        method: 'PUT',
        body: JSON.stringify({ plan }),
      }),
    createPlusCheckout: () =>
      request<{ checkoutUrl: string; paymentLinkId: string; amountPaise: number }>('/api/billing/checkout-plus', {
        method: 'POST',
      }),
    confirmPlusPayment: (paymentLinkId: string) =>
      request<BillingSnapshot>('/api/billing/confirm-plus', {
        method: 'POST',
        body: JSON.stringify({ paymentLinkId }),
      }),
  },

  templates: {
    list: () => request<ResumeTemplate[]>('/api/templates'),
  },

  support: {
    submit: (data: SupportRequestInput) =>
      request<{ sent: boolean }>('/api/support', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  notifications: {
    list: (limit = 20) => request<NotificationListResponse>(`/api/notifications?limit=${limit}`),
    markRead: (notificationId: string) =>
      request<NotificationListResponse>('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-read', notificationId }),
      }),
    markAllRead: () =>
      request<NotificationListResponse>('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark-all-read' }),
      }),
  },

  // ─── Resumes ────────────────────────────────────────────
  resumes: {
    list:   () => request<ResumeSummary[]>('/api/resumes'),
    stats:  () => request<ResumeStats>('/api/resumes/stats'),
    get:    (id: string) => request<Resume>(`/api/resumes/${id}`),
    update: (id: string, data: Partial<Resume>) =>
      request<Resume>(`/api/resumes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    refreshAts: (id: string, resumeContent: ResumeContent) =>
      request<AtsRefreshResult>(`/api/resumes/${id}/ats-refresh`, {
        method: 'POST',
        body: JSON.stringify({ resume_content: resumeContent }),
      }),
    aiImprove: (id: string, payload: { resume_content: ResumeContent; focus_text?: string }) =>
      request<AiImproveResult>(`/api/resumes/${id}/ai-improve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
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
  name?: string;
  email?: string;
  email_verified_at?: string | null;
  phone?: string; location?: string; linkedin?: string; github?: string;
  website?: string; summary?: string;
  phone_verified_at?: string | null;
  location_verified_at?: string | null;
  achievements?: string[];
  languages?: string[];
  hobbies?: string[];
  technicalSkills?: string[];
  softSkills?: string[];
  skills: string[];
  experiences: Experience[];
  projects: Project[];
  education: Education[];
}

export interface UserSettings {
  workspaceName: string;
  defaultSourcePlatform: 'linkedin' | 'indeed' | 'naukri' | 'manual';
  defaultRegion: string;
  verificationRequirement: 'optional-before-generation' | 'required-before-export' | 'required-before-generation';
  notifications: {
    productUpdates: boolean;
    resumeReady: boolean;
    atsAlerts: boolean;
    verificationAlerts: boolean;
  };
  exports: {
    defaultTemplate: string;
    fileStyle: 'role-company-date' | 'company-role' | 'candidate-role';
    includeCoverLetter: boolean;
  };
  privacy: {
    keepResumeHistory: boolean;
    allowAiReuse: boolean;
    requireVerificationBeforeExport: boolean;
  };
  resume: ResumeSettings;
}

export type ResumePromptSection =
  | 'jdParsing'
  | 'candidateEvidence'
  | 'relevanceMapping'
  | 'experienceRewrite'
  | 'summaryGeneration'
  | 'atsEvaluation'
  | 'finalAssembly'
  | 'coverLetter';

export interface ResumePromptTemplateSetting {
  label: string;
  description: string;
  defaultTemplate: string;
  customTemplate: string;
  activeMode: 'default' | 'custom';
}

export interface ResumeSettings {
  formatting: {
    summaryMaxWords: number;
    maxBulletsPerSection: number;
    skillsSeparator: 'comma' | 'bullet';
    linkStyle: 'compact' | 'full';
    pageSize: 'A4' | 'Letter';
    repeatSectionHeadingsOnNewPage: boolean;
    showPageNumbers: boolean;
  };
  structure: {
    sectionOrder: Array<'summary' | 'skills' | 'experience' | 'projects' | 'achievements' | 'education' | 'languages' | 'hobbies'>;
    defaultSectionVisibility: {
      summary: boolean;
      skills: boolean;
      experience: boolean;
      projects: boolean;
      achievements: boolean;
      education: boolean;
      languages: boolean;
      hobbies: boolean;
    };
    maxProjects: number;
    maxEducationItems: number;
  };
  prompts: Record<ResumePromptSection, ResumePromptTemplateSetting>;
}

export interface Experience {
  id?: string; job_title: string; company: string; location?: string;
  start_date: string; end_date?: string; is_current: boolean; bullets: string[];
  sort_order?: number;
}

export interface Project {
  id?: string; name: string; tech_stack?: string; url?: string; description: string;
  sort_order?: number;
}

export interface Education {
  id?: string; degree: string; institution: string; field?: string;
  year: string; gpa?: string; sort_order?: number;
}

export interface ResumeSummary {
  id: string; company_name: string; job_title: string; ats_score: number;
  source_platform?: string; template_id?: string; status: string; created_at: string;
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
  analysis_snapshot?: ResumeAnalysisSnapshot;
}

export interface ResumeAnalysisSnapshot {
  jdParse: unknown;
  candidateSnapshot: unknown;
  candidateEvidence: unknown;
  mappings: unknown;
}

export interface DashboardSummary {
  templateCount: number;
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
  skills: ResumeSkills;
  section_visibility?: {
    summary?: boolean;
    skills?: boolean;
    experience?: boolean;
    projects?: boolean;
    achievements?: boolean;
    education?: boolean;
    languages?: boolean;
    hobbies?: boolean;
  };
  experience: Array<{
    job_title: string; company: string; location?: string;
    start_date: string; end_date?: string; is_current?: boolean; bullets: string[];
  }>;
  projects: Array<{
    name: string;
    tech_stack: string;
    description?: string;
    summary?: string;
    bullets?: string[];
    url?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    gpa?: string;
    bullets?: string[];
  }>;
  achievements?: string[];
  languages?: string[];
  hobbies?: string[];
}

export interface ResumeSkills {
  technical:
    | string[]
    | {
        programming_languages?: string[];
        backend_frameworks?: string[];
        ai_genai?: string[];
        streaming_messaging?: string[];
        databases_storage?: string[];
        cloud_infra?: string[];
        cloud?: string[];
        databases?: string[];
        tools?: string[];
        tools_platforms?: string[];
        languages?: string[];
        other?: string[];
      };
  tools?: string[];
  other?: string[];
  soft?: string[];
}

export interface ResumeTemplate {
  id: string;
  name: string;
  tag: string;
  usage: string;
  description: string;
  note: string;
  strengths: string[];
}

export interface NotificationItem {
  id: string;
  type: 'product-update' | 'resume-ready' | 'ats-alert' | 'verification-alert';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export type SupportCategory =
  | 'feature-request'
  | 'suggestion'
  | 'bug-report'
  | 'billing'
  | 'account'
  | 'other';

export interface SupportRequestInput {
  category: SupportCategory;
  subject: string;
  message: string;
}

export interface BillingSnapshot {
  plan: 'free' | 'plus';
  periodStart: string;
  periodEnd: string;
  usage: {
    resumesUsed: number;
    jdAnalysesUsed: number;
    resumesLimit: number;
    jdAnalysesLimit: number;
  };
  plans: {
    free: {
      resumesPerMonth: number;
      jdAnalysesPerMonth: number;
    };
    plus: {
      resumesPerMonth: number;
      jdAnalysesPerMonth: number;
    };
  };
  events: Array<{
    id: string;
    eventType: string;
    plan?: 'free' | 'plus';
    usageType?: 'resume' | 'jd-analysis';
    delta: number;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    provider: string;
    referenceId: string;
    amountPaise: number;
    currency: string;
    status: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface Suggestion {
  action: string; impact_pct: number; reason: string;
}

export interface AtsRefreshResult {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
}

export interface AiImproveResult {
  resume_content: ResumeContent;
  ats_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: Suggestion[];
}

export interface GeneratePayload {
  company_name: string; job_title: string;
  template_id: string;
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
