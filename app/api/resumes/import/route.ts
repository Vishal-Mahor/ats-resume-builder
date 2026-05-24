import { NextResponse } from 'next/server';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { createDraftResume, createResumeContentFromText } from '@/lib/server/resume-draft-service';

export const runtime = 'nodejs';
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export async function GET() {
  return NextResponse.json(
    { error: 'Resume import expects a POST request with multipart form data.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const form = await readImportForm(request);
    const resumeName = String(form.get('resume_name') || '').trim();
    const jobTitle = String(form.get('job_title') || '').trim();
    const templateId = String(form.get('template_id') || '').trim();
    const file = form.get('file');

    if (!resumeName || !jobTitle || !templateId) {
      throw new HttpError(400, 'Resume name, role, and template are required.');
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, 'Upload a resume file to import.');
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw new HttpError(413, 'Resume file is too large. Upload a file under 10MB.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractResumeText(buffer, file.name, file.type);
    if (text.trim().length < 40) {
      throw new HttpError(400, 'We could not read enough text from this resume. Try a PDF, DOCX, or TXT file.');
    }

    const resume = await createDraftResume({
      userId,
      resumeName,
      jobTitle,
      templateId,
      sourcePlatform: 'manual',
      content: createResumeContentFromText(text, jobTitle),
    });

    return NextResponse.json(resume, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readImportForm(request: Request) {
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, 'Upload the resume as multipart form data.');
  }
}

async function extractResumeText(buffer: Buffer, fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();

  if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) {
    let parser: { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } | null = null;
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } catch {
      throw new HttpError(400, 'We could not read this PDF. Try exporting it as text-based PDF, DOCX, or TXT.');
    } finally {
      await parser?.destroy().catch(() => undefined);
    }
  }

  if (
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('msword') ||
    lowerName.endsWith('.docx')
  ) {
    try {
      const mammoth = await import('mammoth');
      const extractor = mammoth.extractRawText ?? mammoth.default.extractRawText;
      const result = await extractor({ buffer });
      return result.value;
    } catch {
      throw new HttpError(400, 'We could not read this document. Try a DOCX, text-based PDF, or TXT file.');
    }
  }

  if (mimeType.includes('text') || lowerName.endsWith('.txt')) {
    return buffer.toString('utf8');
  }

  throw new HttpError(400, 'Unsupported resume file type. Upload a PDF, DOCX, or TXT file.');
}
