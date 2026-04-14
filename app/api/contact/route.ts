import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  company: z.string().trim().max(160).optional().default(''),
  subject: z.string().trim().min(4).max(140),
  message: z.string().trim().min(20).max(4000),
});

export async function POST(request: Request) {
  try {
    const body = contactSchema.parse(await request.json());

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM_EMAIL;
    const inbox = process.env.SUPPORT_INBOX_EMAIL || from;

    if (!host || !smtpUser || !pass || !from || !inbox) {
      throw new HttpError(500, 'Contact form is not configured yet. Please try again later.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass },
    });

    const submittedAt = new Date().toISOString();

    await transporter.sendMail({
      from,
      to: inbox,
      replyTo: body.email,
      subject: `[Website Contact] ${body.subject}`,
      text: [
        `Name: ${body.name}`,
        `Email: ${body.email}`,
        `Company: ${body.company || 'Not provided'}`,
        `Submitted at: ${submittedAt}`,
        '',
        body.message,
      ].join('\n'),
      html: `
        <p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(body.company || 'Not provided')}</p>
        <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
        <hr />
        <p style="white-space:pre-wrap;">${escapeHtml(body.message)}</p>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
