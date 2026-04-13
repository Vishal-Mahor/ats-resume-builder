import { createClient, type Client, type InValue } from '@libsql/client';

type QueryResult<T = any> = {
  rows: T[];
  rowCount: number;
  rowsAffected: number;
};

type QueryArg = InValue | undefined;

const JSON_COLUMNS = new Set([
  'achievements',
  'bullets',
  'hobbies',
  'languages',
  'strengths',
  'resume_content',
  'matched_keywords',
  'missing_keywords',
  'suggestions',
  'metadata',
]);

const BOOLEAN_COLUMNS = new Set(['is_current', 'is_read']);
[
  'notifications_product_updates',
  'notifications_resume_ready',
  'notifications_ats_alerts',
  'notifications_verification_alerts',
  'exports_include_cover_letter',
  'privacy_keep_resume_history',
  'privacy_allow_ai_reuse',
  'privacy_require_verification',
].forEach((column) => BOOLEAN_COLUMNS.add(column));

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

async function ensureOptionalColumns(currentClient: Client) {
  const migrationStatements = [
    `CREATE TABLE IF NOT EXISTS verification_codes (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       channel TEXT NOT NULL,
       target TEXT NOT NULL,
       code_hash TEXT NOT NULL,
       expires_at TEXT NOT NULL,
       consumed_at TEXT,
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     )`,
    `CREATE INDEX IF NOT EXISTS idx_verification_codes_user_channel ON verification_codes(user_id, channel, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS resume_templates (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       tag TEXT NOT NULL,
       usage TEXT NOT NULL,
       description TEXT NOT NULL,
       note TEXT NOT NULL,
       strengths TEXT NOT NULL DEFAULT '[]',
       is_active INTEGER NOT NULL DEFAULT 1,
       sort_order INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     )`,
    `CREATE INDEX IF NOT EXISTS idx_resume_templates_active_sort ON resume_templates(is_active, sort_order)`,
    `CREATE TABLE IF NOT EXISTS user_settings (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       workspace_name TEXT NOT NULL DEFAULT 'ATS Resume Builder Workspace',
       default_source_platform TEXT NOT NULL DEFAULT 'manual',
       default_region TEXT NOT NULL DEFAULT 'India',
       verification_requirement TEXT NOT NULL DEFAULT 'optional-before-generation',
       notifications_product_updates INTEGER NOT NULL DEFAULT 1,
       notifications_resume_ready INTEGER NOT NULL DEFAULT 1,
       notifications_ats_alerts INTEGER NOT NULL DEFAULT 1,
       notifications_verification_alerts INTEGER NOT NULL DEFAULT 1,
       exports_default_template TEXT,
       exports_file_style TEXT NOT NULL DEFAULT 'role-company-date',
       exports_include_cover_letter INTEGER NOT NULL DEFAULT 1,
       privacy_keep_resume_history INTEGER NOT NULL DEFAULT 1,
       privacy_allow_ai_reuse INTEGER NOT NULL DEFAULT 1,
       privacy_require_verification INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       UNIQUE(user_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id)`,
    `CREATE TABLE IF NOT EXISTS user_subscriptions (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       plan TEXT NOT NULL DEFAULT 'free',
       period_start TEXT NOT NULL DEFAULT (strftime('%Y-%m-01T00:00:00.000Z', 'now')),
       period_end TEXT NOT NULL DEFAULT (strftime('%Y-%m-01T00:00:00.000Z', 'now', '+1 month')),
       resumes_used_in_period INTEGER NOT NULL DEFAULT 0,
       jd_analyses_used_in_period INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       UNIQUE(user_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id)`,
    `CREATE TABLE IF NOT EXISTS billing_events (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       event_type TEXT NOT NULL,
       plan TEXT,
       usage_type TEXT,
       delta INTEGER NOT NULL DEFAULT 0,
       metadata TEXT NOT NULL DEFAULT '{}',
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     )`,
    `CREATE INDEX IF NOT EXISTS idx_billing_events_user_created ON billing_events(user_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS billing_transactions (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       provider TEXT NOT NULL,
       provider_reference_id TEXT NOT NULL,
       amount_paise INTEGER NOT NULL,
       currency TEXT NOT NULL DEFAULT 'INR',
       status TEXT NOT NULL DEFAULT 'created',
       metadata TEXT NOT NULL DEFAULT '{}',
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       UNIQUE(provider, provider_reference_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_created ON billing_transactions(user_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS notifications (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       type TEXT NOT NULL,
       title TEXT NOT NULL,
       message TEXT NOT NULL,
       metadata TEXT NOT NULL DEFAULT '{}',
       is_read INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)`,
    `ALTER TABLE users ADD COLUMN email_verified_at TEXT`,
    `ALTER TABLE profiles ADD COLUMN phone_verified_at TEXT`,
    `ALTER TABLE profiles ADD COLUMN location_verified_at TEXT`,
    `ALTER TABLE profiles ADD COLUMN achievements TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE profiles ADD COLUMN languages TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE profiles ADD COLUMN hobbies TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE resumes ADD COLUMN source_platform TEXT NOT NULL DEFAULT 'manual'`,
    `ALTER TABLE resumes ADD COLUMN template_id TEXT REFERENCES resume_templates(id)`,
  ];

  for (const statement of migrationStatements) {
    try {
      await currentClient.execute(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes('duplicate column name') ||
        message.includes('already exists') ||
        message.includes('SQL logic error') ||
        message.includes('SQLITE_NOMEM')
      ) {
        if (message.includes('SQLITE_NOMEM')) {
          console.warn('[db init] skipped migration statement due to SQLITE_NOMEM:', statement);
        }
        continue;
      }

      throw error;
    }
  }
}

function getDatabaseUrl() {
  return process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
}

function getClient() {
  if (client) return client;

  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('Missing TURSO_DATABASE_URL');
  }

  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  return client;
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (JSON_COLUMNS.has(key) && typeof value === 'string') {
      try {
        normalized[key] = JSON.parse(value);
        continue;
      } catch {
        normalized[key] = value;
        continue;
      }
    }

    if (BOOLEAN_COLUMNS.has(key) && typeof value === 'number') {
      normalized[key] = value === 1;
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function toSqliteQuery(sql: string, args: QueryArg[]) {
  const expandedArgs: (InValue | null)[] = [];
  const nextSql = sql.replace(/\$(\d+)/g, (_, indexText) => {
    const index = Number(indexText) - 1;
    expandedArgs.push(args[index] ?? null);
    return '?';
  });

  return { sql: nextSql, args: expandedArgs };
}

async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      const currentClient = getClient();
      const initStatements = ['PRAGMA foreign_keys = ON', 'PRAGMA busy_timeout = 5000'];

      for (const statement of initStatements) {
        try {
          await currentClient.execute(statement);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          // Some hosted libSQL providers reject specific PRAGMA statements.
          if (message.includes('SQL not allowed statement')) {
            continue;
          }

          throw error;
        }
      }

      await ensureOptionalColumns(currentClient);
    })();
  }

  return initPromise;
}

export const db = {
  async query<T = any>(sql: string, args: QueryArg[] = []): Promise<QueryResult<T>> {
    await init();
    const sqliteQuery = toSqliteQuery(sql, args);

    const result = await getClient().execute({
      sql: sqliteQuery.sql,
      args: sqliteQuery.args,
    });

    const rows = result.rows.map((row) => normalizeRow(row as Record<string, unknown>)) as T[];
    const rowCount = result.rowsAffected > 0 ? result.rowsAffected : rows.length;

    return {
      rows,
      rowCount,
      rowsAffected: result.rowsAffected,
    };
  },
};
