ALTER TABLE users ADD COLUMN email_verified_at TEXT;

ALTER TABLE profiles ADD COLUMN phone_verified_at TEXT;
ALTER TABLE profiles ADD COLUMN location_verified_at TEXT;
ALTER TABLE profiles ADD COLUMN achievements TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN languages TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN hobbies TEXT NOT NULL DEFAULT '[]';

UPDATE skills
SET category = 'technical'
WHERE category IS NULL OR trim(category) = '';

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

CREATE INDEX IF NOT EXISTS idx_verification_codes_user_channel
ON verification_codes(user_id, channel, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_resume_templates_active_sort
ON resume_templates(is_active, sort_order);

ALTER TABLE resumes ADD COLUMN template_id TEXT REFERENCES resume_templates(id);

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

CREATE INDEX IF NOT EXISTS idx_user_settings_user
ON user_settings(user_id);
