-- ============================================================
-- ATS Resume Builder AI — Turso / SQLite Schema
-- ============================================================

PRAGMA foreign_keys = ON;

-- ─── Users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  email_verified_at TEXT,
  avatar_url    TEXT,
  provider      TEXT NOT NULL DEFAULT 'email',
  provider_id   TEXT,
  password_hash TEXT,
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

-- ─── User Profiles (reusable across all resumes) ──────────
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone       TEXT,
  phone_verified_at TEXT,
  location    TEXT,
  location_verified_at TEXT,
  linkedin    TEXT,
  github      TEXT,
  website     TEXT,
  summary     TEXT,
  achievements TEXT NOT NULL DEFAULT '[]',
  languages   TEXT NOT NULL DEFAULT '[]',
  hobbies     TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id)
);

-- ─── Education ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS education (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree      TEXT NOT NULL,
  institution TEXT NOT NULL,
  field       TEXT,
  year        TEXT,
  gpa         TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_education_user ON education(user_id);

-- ─── Work Experience ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiences (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title    TEXT NOT NULL,
  company      TEXT NOT NULL,
  location     TEXT,
  start_date   TEXT NOT NULL,
  end_date     TEXT,
  is_current   INTEGER NOT NULL DEFAULT 0,
  bullets      TEXT NOT NULL DEFAULT '[]',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_experiences_user ON experiences(user_id);

-- ─── Projects ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  tech_stack  TEXT,
  url         TEXT,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- ─── Skills ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT DEFAULT 'technical',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);

-- ─── Verification Codes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_codes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,
  target      TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_channel ON verification_codes(user_id, channel, created_at DESC);

-- ─── Resume Templates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  tag           TEXT NOT NULL,
  usage         TEXT NOT NULL,
  description   TEXT NOT NULL,
  note          TEXT NOT NULL,
  strengths     TEXT NOT NULL DEFAULT '[]',
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_resume_templates_active_sort ON resume_templates(is_active, sort_order);

-- ─── User Settings ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id                                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id                            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_name                     TEXT NOT NULL DEFAULT 'ATS Resume Builder Workspace',
  default_source_platform            TEXT NOT NULL DEFAULT 'manual',
  default_region                     TEXT NOT NULL DEFAULT 'India',
  verification_requirement           TEXT NOT NULL DEFAULT 'optional-before-generation',
  notifications_product_updates      INTEGER NOT NULL DEFAULT 1,
  notifications_resume_ready         INTEGER NOT NULL DEFAULT 1,
  notifications_ats_alerts           INTEGER NOT NULL DEFAULT 1,
  notifications_verification_alerts  INTEGER NOT NULL DEFAULT 1,
  exports_default_template           TEXT,
  exports_file_style                 TEXT NOT NULL DEFAULT 'role-company-date',
  exports_include_cover_letter       INTEGER NOT NULL DEFAULT 1,
  privacy_keep_resume_history        INTEGER NOT NULL DEFAULT 1,
  privacy_allow_ai_reuse             INTEGER NOT NULL DEFAULT 1,
  privacy_require_verification       INTEGER NOT NULL DEFAULT 0,
  created_at                         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ─── Notifications ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ─── Resume History ───────────────────────────────────────
-- NOTE: raw JD is intentionally NOT stored here (privacy)
CREATE TABLE IF NOT EXISTS resumes (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id       TEXT REFERENCES resume_templates(id),
  company_name      TEXT NOT NULL,
  job_title         TEXT NOT NULL,
  resume_content    TEXT NOT NULL,
  resume_html       TEXT,
  cover_letter      TEXT,
  cover_letter_tone TEXT DEFAULT 'formal',
  source_platform   TEXT NOT NULL DEFAULT 'manual',
  ats_score         INTEGER,
  matched_keywords  TEXT DEFAULT '[]',
  missing_keywords  TEXT DEFAULT '[]',
  suggestions       TEXT DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'draft',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_company ON resumes(user_id, company_name);
