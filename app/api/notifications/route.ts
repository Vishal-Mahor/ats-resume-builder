import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUserId } from '@/lib/server/auth-token';
import { handleRouteError } from '@/lib/server/http';
import {
  listRecentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/server/notification-service';

export const runtime = 'nodejs';

const notificationsActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark-read'),
    notificationId: z.string().min(1),
  }),
  z.object({
    action: z.literal('mark-all-read'),
  }),
]);

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? 20);
    const payload = await listRecentNotifications(userId, limit);
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    const body = notificationsActionSchema.parse(await request.json());

    if (body.action === 'mark-read') {
      await markNotificationRead(userId, body.notificationId);
    } else {
      await markAllNotificationsRead(userId);
    }

    const payload = await listRecentNotifications(userId, 20);
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
