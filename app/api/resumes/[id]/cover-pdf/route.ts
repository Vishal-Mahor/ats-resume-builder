import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { generateCoverLetterPdf } from '@/lib/server/pdf-service';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await context.params;
    const {
      rows: [resume],
    } = await db.query(
      `SELECT r.*, u.name, u.email, p.phone, p.location
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
        'Content-Disposition': `attachment; filename="${resume.company_name}-CoverLetter.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
