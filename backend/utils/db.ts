// ============================================================
// Database — Turso/libSQL client with a small pg-like wrapper
// ============================================================
import { createClient, type InValue } from '@libsql/client';

type QueryResult<T = any> = {
  rows: T[];
  rowCount: number;
  rowsAffected: number;
};

type QueryArg = InValue | undefined;

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  throw new Error('Missing TURSO_DATABASE_URL');
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const JSON_COLUMNS = new Set([
  'bullets',
  'resume_content',
  'matched_keywords',
  'missing_keywords',
  'suggestions',
]);

const BOOLEAN_COLUMNS = new Set(['is_current']);

let initPromise: Promise<void> | null = null;

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

function toSqlitePlaceholders(sql: string) {
  return sql.replace(/\$\d+/g, '?');
}

async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      await client.execute('PRAGMA foreign_keys = ON');
      await client.execute('PRAGMA busy_timeout = 5000');
    })();
  }

  return initPromise;
}

export const db = {
  async query<T = any>(sql: string, args: QueryArg[] = []): Promise<QueryResult<T>> {
    await init();

    const result = await client.execute({
      sql: toSqlitePlaceholders(sql),
      args: args.map((arg) => arg ?? null),
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
