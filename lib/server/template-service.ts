import { db } from '@/lib/server/db';
import { RESUME_TEMPLATES, type ResumeTemplate } from '@/lib/templates';

type TemplateRow = ResumeTemplate & {
  is_active: boolean | number;
  sort_order: number;
};

let seedPromise: Promise<void> | null = null;

async function seedTemplatesIfNeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      for (const [index, template] of RESUME_TEMPLATES.entries()) {
        await db.query(
          `INSERT INTO resume_templates
             (id, name, tag, usage, description, note, strengths, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name,
             tag=excluded.tag,
             usage=excluded.usage,
             description=excluded.description,
             note=excluded.note,
             strengths=excluded.strengths,
             updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
          [
            template.id,
            template.name,
            template.tag,
            template.usage,
            template.description,
            template.note,
            JSON.stringify(template.strengths),
            index,
          ]
        );
      }
    })().finally(() => {
      seedPromise = null;
    });
  }

  return seedPromise;
}

function normalizeTemplate(row: TemplateRow): ResumeTemplate {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    usage: row.usage,
    description: row.description,
    note: row.note,
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
  };
}

export async function listResumeTemplates() {
  await seedTemplatesIfNeeded();
  const { rows } = await db.query<TemplateRow>(
    `SELECT id, name, tag, usage, description, note, strengths, is_active, sort_order
     FROM resume_templates
     WHERE is_active = 1
     ORDER BY sort_order ASC, name ASC`
  );

  return rows.map(normalizeTemplate);
}

export async function getResumeTemplateById(id: string) {
  await seedTemplatesIfNeeded();
  const {
    rows: [template],
  } = await db.query<TemplateRow>(
    `SELECT id, name, tag, usage, description, note, strengths, is_active, sort_order
     FROM resume_templates
     WHERE id=$1 AND is_active = 1`,
    [id]
  );

  return template ? normalizeTemplate(template) : null;
}
