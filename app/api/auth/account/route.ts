import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteUserAccount } from '@/lib/server/auth-service';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { clearRefreshTokenCookie } from '@/lib/server/auth-cookie';
import { handleRouteError, HttpError } from '@/lib/server/http';

export const runtime = 'nodejs';

const deleteSchema = z.object({
  confirmation: z.string(),
});

export async function DELETE(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = deleteSchema.parse(await request.json());

    if (body.confirmation !== 'DELETE') {
      throw new HttpError(400, 'Type DELETE to confirm account deletion.');
    }

    await deleteUserAccount(userId);
    await clearRefreshTokenCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
