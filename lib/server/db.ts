import { createClient, type Client, type InValue } from '@libsql/client';

type QueryResult<T = any> = {
  rows: T[];
  rowCount: number;
  rowsAffected: number;
};

type QueryArg = InValue | undefined;

const JSON_COLUMNS = new Set([
  'bullets',
  'resume_content',
  'matched_keywords',
  'missing_keywords',
  'suggestions',
]);

const BOOLEAN_COLUMNS = new Set(['is_current']);

let client: Client | null = null;
let initPromise: Promise<void> | null = null;

async function ensureOptionalColumns(currentClient: Client) {
  const migrationStatements = [
    `ALTER TABLE resumes ADD COLUMN source_platform TEXT NOT NULL DEFAULT 'manual'`,
  ];

  for (const statement of migrationStatements) {
    try {
      await currentClient.execute(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes('duplicate column name') ||
        message.includes('already exists') ||
        message.includes('SQL logic error')
      ) {
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

function toSqlitePlaceholders(sql: string) {
  return sql.replace(/\$\d+/g, '?');
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

    const result = await getClient().execute({
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
