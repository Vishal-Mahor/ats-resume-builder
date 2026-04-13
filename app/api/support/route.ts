import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { db } from '@/lib/server/db';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

const supportRequestSchema = z.object({
  category: z.enum(['feature-request', 'suggestion', 'bug-report', 'billing', 'account', 'other']),
  subject: z.string().trim().min(4).max(140),
  message: z.string().trim().min(20).max(4000),
});

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = supportRequestSchema.parse(await request.json());

    const {
      rows: [user],
    } = await db.query<{ name?: string | null; email: string }>(
      'SELECT name, email FROM users WHERE id=$1',
      [userId]
    );

    if (!user?.email) {
      throw new HttpError(400, 'Authenticated user email not found.');
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM_EMAIL;
    const inbox = process.env.SUPPORT_INBOX_EMAIL || from;

    if (!host || !smtpUser || !pass || !from || !inbox) {
      throw new HttpError(500, 'Missing SMTP configuration for support inbox delivery.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass },
    });

    const categoryLabel = body.category.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    const requestTime = new Date().toISOString();

    await transporter.sendMail({
      from,
      to: inbox,
      replyTo: user.email,
      subject: `[Support:${categoryLabel}] ${body.subject}`,
      text: [
        `Support category: ${categoryLabel}`,
        `User: ${user.name || 'Unknown'} (${user.email})`,
        `User ID: ${userId}`,
        `Submitted at: ${requestTime}`,
        '',
        body.message,
      ].join('\n'),
      html: `
        <p><strong>Support category:</strong> ${categoryLabel}</p>
        <p><strong>User:</strong> ${escapeHtml(user.name || 'Unknown')} (${escapeHtml(user.email)})</p>
        <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
        <p><strong>Submitted at:</strong> ${escapeHtml(requestTime)}</p>
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
