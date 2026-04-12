import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  throw new Error('Missing TURSO_DATABASE_URL');
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const rawSchema = await fs.readFile(schemaPath, 'utf8');
const statements = rawSchema
  .split(/;\s*\n/g)
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await client.execute(statement);
}

console.log(`Applied ${statements.length} schema statements to ${url}`);
