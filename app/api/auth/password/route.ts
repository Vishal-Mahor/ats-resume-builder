import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changePassword } from '@/lib/server/auth-service';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

const passwordSchema = z.object({
  password: z.string().min(8),
});

export async function PUT(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = passwordSchema.parse(await request.json());
    await changePassword(userId, body.password);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
