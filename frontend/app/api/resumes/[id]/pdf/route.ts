import { db } from '@/lib/server/db';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { generateResumePdf } from '@/lib/server/pdf-service';
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
      `SELECT r.*, u.name, u.email, p.phone, p.location, p.linkedin, p.github
       FROM resumes r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN profiles p ON p.user_id = r.user_id
       WHERE r.id=$1 AND r.user_id=$2`,
      [id, userId]
    );

    if (!resume) {
      throw new HttpError(404, 'Resume not found');
    }

    const pdfBuffer = await generateResumePdf(
      {
        name: resume.name,
        email: resume.email,
        phone: resume.phone,
        location: resume.location,
        linkedin: resume.linkedin,
        github: resume.github,
      },
      resume.resume_content
    );

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${resume.company_name}-${resume.job_title}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
