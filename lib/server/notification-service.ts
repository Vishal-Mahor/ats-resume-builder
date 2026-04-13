import { db } from '@/lib/server/db';
import { getUserSettings } from '@/lib/server/settings-service';

export type NotificationType = 'product-update' | 'resume-ready' | 'ats-alert' | 'verification-alert';

type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export async function createNotificationForUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const settings = await getUserSettings(input.userId);
  const enabled =
    (input.type === 'product-update' && settings.notifications.productUpdates) ||
    (input.type === 'resume-ready' && settings.notifications.resumeReady) ||
    (input.type === 'ats-alert' && settings.notifications.atsAlerts) ||
    (input.type === 'verification-alert' && settings.notifications.verificationAlerts);

  if (!enabled) {
    return null;
  }

  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1,$2,$3,$4,$5)`,
    [input.userId, input.type, input.title, input.message, JSON.stringify(input.metadata ?? {})]
  );

  await pruneExpiredNotifications(input.userId);
  return true;
}

export async function listRecentNotifications(userId: string, limit = 20) {
  await pruneExpiredNotifications(userId);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const result = await db.query<NotificationRow>(
    `SELECT id, type, title, message, metadata, is_read, created_at
     FROM notifications
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  const unreadCountResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM notifications
     WHERE user_id=$1 AND is_read=0`,
    [userId]
  );

  return {
    items: result.rows,
    unreadCount: Number(unreadCountResult.rows[0]?.count ?? 0),
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await db.query(
    `UPDATE notifications
     SET is_read=1
     WHERE user_id=$1 AND id=$2`,
    [userId, notificationId]
  );
}

export async function markAllNotificationsRead(userId: string) {
  await db.query(
    `UPDATE notifications
     SET is_read=1
     WHERE user_id=$1 AND is_read=0`,
    [userId]
  );
}

async function pruneExpiredNotifications(userId: string) {
  await db.query(
    `DELETE FROM notifications
     WHERE user_id=$1
       AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`,
    [userId]
  );
}
