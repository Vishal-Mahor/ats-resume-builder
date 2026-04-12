-- ============================================================
-- ATS Resume Builder AI — Turso / SQLite Schema
-- ============================================================

PRAGMA foreign_keys = ON;

-- ─── Users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
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
  location    TEXT,
  linkedin    TEXT,
  github      TEXT,
  website     TEXT,
  summary     TEXT,
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

-- ─── Resume History ───────────────────────────────────────
-- NOTE: raw JD is intentionally NOT stored here (privacy)
CREATE TABLE IF NOT EXISTS resumes (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  job_title         TEXT NOT NULL,
  resume_content    TEXT NOT NULL,
  resume_html       TEXT,
  cover_letter      TEXT,
  cover_letter_tone TEXT DEFAULT 'formal',
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
