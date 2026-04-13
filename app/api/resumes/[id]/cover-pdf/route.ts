import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { generateCoverLetterPdf } from '@/lib/server/pdf-service';
import { handleRouteError, HttpError } from '@/lib/server/http';
import { getUserSettings } from '@/lib/server/settings-service';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const userSettings = await getUserSettings(userId);
    const { id } = await context.params;
    const {
      rows: [resume],
    } = await db.query(
      `SELECT r.*, u.name, u.email, u.email_verified_at, p.phone, p.phone_verified_at, p.location
       FROM resumes r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE r.id=$1 AND r.user_id=$2`,
      [id, userId]
    );

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    if (!resume.cover_letter) {
      throw new HttpError(404, 'No cover letter');
    }

    if (
      (userSettings.verificationRequirement === 'required-before-export' ||
        userSettings.privacy.requireVerificationBeforeExport) &&
      !(resume.email_verified_at && resume.phone_verified_at)
    ) {
      throw new HttpError(403, 'Verify both your email and phone number before exporting PDFs.');
    }

    const pdfBuffer = await generateCoverLetterPdf(
      {
        name: resume.name,
        email: resume.email,
        phone: resume.phone,
        location: resume.location,
      },
      resume.cover_letter,
      resume.company_name,
      resume.job_title
    );

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildCoverFileName(userSettings.exports.fileStyle, resume.company_name, resume.job_title)}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function buildCoverFileName(
  fileStyle: 'role-company-date' | 'company-role' | 'candidate-role',
  companyName: string,
  jobTitle: string
) {
  const dateLabel = new Date().toISOString().slice(0, 10);

  switch (fileStyle) {
    case 'company-role':
      return `${slugify(companyName)}-${slugify(jobTitle)}-cover-letter`;
    case 'candidate-role':
      return `cover-letter-${slugify(jobTitle)}`;
    case 'role-company-date':
    default:
      return `${slugify(jobTitle)}-${slugify(companyName)}-${dateLabel}-cover-letter`;
  }
}

function slugify(value?: string) {
  return (value || 'cover-letter')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'cover-letter';
}
