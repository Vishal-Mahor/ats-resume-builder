import { NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertOAuthUser } from '@/lib/server/auth-service';
import { handleRouteError } from '@/lib/server/http';

export const runtime = 'nodejs';

const oauthSchema = z.object({
  provider: z.enum(['google', 'github']),
  provider_id: z.string(),
  email: z.string().email(),
  name: z.string().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = oauthSchema.parse(await request.json());
    const result = await upsertOAuthUser({
      provider: body.provider,
      providerId: body.provider_id,
      email: body.email,
      name: body.name,
      avatarUrl: body.avatar_url,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
