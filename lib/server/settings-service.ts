import { z } from 'zod';
import { db } from '@/lib/server/db';

export const userSettingsInputSchema = z.object({
  workspaceName: z.string().trim().min(1).max(120),
  defaultSourcePlatform: z.enum(['linkedin', 'indeed', 'naukri', 'manual']),
  defaultRegion: z.string().trim().min(1).max(120),
  verificationRequirement: z.enum([
    'optional-before-generation',
    'required-before-export',
    'required-before-generation',
  ]),
  notifications: z.object({
    productUpdates: z.boolean(),
    resumeReady: z.boolean(),
    atsAlerts: z.boolean(),
    verificationAlerts: z.boolean(),
  }),
  exports: z.object({
    defaultTemplate: z.string().trim().min(1).max(80),
    fileStyle: z.enum(['role-company-date', 'company-role', 'candidate-role']),
    includeCoverLetter: z.boolean(),
  }),
  privacy: z.object({
    keepResumeHistory: z.boolean(),
    allowAiReuse: z.boolean(),
    requireVerificationBeforeExport: z.boolean(),
  }),
});

type SettingsRow = {
  workspace_name: string;
  default_source_platform: 'linkedin' | 'indeed' | 'naukri' | 'manual';
  default_region: string;
  verification_requirement: 'optional-before-generation' | 'required-before-export' | 'required-before-generation';
  notifications_product_updates: boolean;
  notifications_resume_ready: boolean;
  notifications_ats_alerts: boolean;
  notifications_verification_alerts: boolean;
  exports_default_template: string | null;
  exports_file_style: 'role-company-date' | 'company-role' | 'candidate-role';
  exports_include_cover_letter: boolean;
  privacy_keep_resume_history: boolean;
  privacy_allow_ai_reuse: boolean;
  privacy_require_verification: boolean;
};

function getDefaultSettings() {
  return {
    workspaceName: 'ATS Resume Builder Workspace',
    defaultSourcePlatform: 'manual' as const,
    defaultRegion: 'India',
    verificationRequirement: 'optional-before-generation' as const,
    notifications: {
      productUpdates: true,
      resumeReady: true,
      atsAlerts: true,
      verificationAlerts: true,
    },
    exports: {
      defaultTemplate: 'clarity',
      fileStyle: 'role-company-date' as const,
      includeCoverLetter: true,
    },
    privacy: {
      keepResumeHistory: true,
      allowAiReuse: true,
      requireVerificationBeforeExport: false,
    },
  };
}

function mapSettingsRow(row?: Partial<SettingsRow> | null) {
  const defaults = getDefaultSettings();
  return {
    workspaceName: row?.workspace_name ?? defaults.workspaceName,
    defaultSourcePlatform: row?.default_source_platform ?? defaults.defaultSourcePlatform,
    defaultRegion: row?.default_region ?? defaults.defaultRegion,
    verificationRequirement: row?.verification_requirement ?? defaults.verificationRequirement,
    notifications: {
      productUpdates: row?.notifications_product_updates ?? defaults.notifications.productUpdates,
      resumeReady: row?.notifications_resume_ready ?? defaults.notifications.resumeReady,
      atsAlerts: row?.notifications_ats_alerts ?? defaults.notifications.atsAlerts,
      verificationAlerts: row?.notifications_verification_alerts ?? defaults.notifications.verificationAlerts,
    },
    exports: {
      defaultTemplate: row?.exports_default_template ?? defaults.exports.defaultTemplate,
      fileStyle: row?.exports_file_style ?? defaults.exports.fileStyle,
      includeCoverLetter: row?.exports_include_cover_letter ?? defaults.exports.includeCoverLetter,
    },
    privacy: {
      keepResumeHistory: row?.privacy_keep_resume_history ?? defaults.privacy.keepResumeHistory,
      allowAiReuse: row?.privacy_allow_ai_reuse ?? defaults.privacy.allowAiReuse,
      requireVerificationBeforeExport: row?.privacy_require_verification ?? defaults.privacy.requireVerificationBeforeExport,
    },
  };
}

async function ensureSettingsRow(userId: string) {
  const defaults = getDefaultSettings();
  await db.query(
    `INSERT INTO user_settings (
       user_id, workspace_name, default_source_platform, default_region, verification_requirement,
       notifications_product_updates, notifications_resume_ready, notifications_ats_alerts, notifications_verification_alerts,
       exports_default_template, exports_file_style, exports_include_cover_letter,
       privacy_keep_resume_history, privacy_allow_ai_reuse, privacy_require_verification
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT(user_id) DO NOTHING`,
    [
      userId,
      defaults.workspaceName,
      defaults.defaultSourcePlatform,
      defaults.defaultRegion,
      defaults.verificationRequirement,
      defaults.notifications.productUpdates,
      defaults.notifications.resumeReady,
      defaults.notifications.atsAlerts,
      defaults.notifications.verificationAlerts,
      defaults.exports.defaultTemplate,
      defaults.exports.fileStyle,
      defaults.exports.includeCoverLetter,
      defaults.privacy.keepResumeHistory,
      defaults.privacy.allowAiReuse,
      defaults.privacy.requireVerificationBeforeExport,
    ]
  );
}

export async function getUserSettings(userId: string) {
  await ensureSettingsRow(userId);
  const {
    rows: [row],
  } = await db.query<SettingsRow>(
    `SELECT workspace_name, default_source_platform, default_region, verification_requirement,
            notifications_product_updates, notifications_resume_ready, notifications_ats_alerts, notifications_verification_alerts,
            exports_default_template, exports_file_style, exports_include_cover_letter,
            privacy_keep_resume_history, privacy_allow_ai_reuse, privacy_require_verification
     FROM user_settings
     WHERE user_id=$1`,
    [userId]
  );

  return mapSettingsRow(row);
}

export async function upsertUserSettings(userId: string, input: z.infer<typeof userSettingsInputSchema>) {
  await db.query(
    `INSERT INTO user_settings (
       user_id, workspace_name, default_source_platform, default_region, verification_requirement,
       notifications_product_updates, notifications_resume_ready, notifications_ats_alerts, notifications_verification_alerts,
       exports_default_template, exports_file_style, exports_include_cover_letter,
       privacy_keep_resume_history, privacy_allow_ai_reuse, privacy_require_verification
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT(user_id) DO UPDATE SET
       workspace_name=excluded.workspace_name,
       default_source_platform=excluded.default_source_platform,
       default_region=excluded.default_region,
       verification_requirement=excluded.verification_requirement,
       notifications_product_updates=excluded.notifications_product_updates,
       notifications_resume_ready=excluded.notifications_resume_ready,
       notifications_ats_alerts=excluded.notifications_ats_alerts,
       notifications_verification_alerts=excluded.notifications_verification_alerts,
       exports_default_template=excluded.exports_default_template,
       exports_file_style=excluded.exports_file_style,
       exports_include_cover_letter=excluded.exports_include_cover_letter,
       privacy_keep_resume_history=excluded.privacy_keep_resume_history,
       privacy_allow_ai_reuse=excluded.privacy_allow_ai_reuse,
       privacy_require_verification=excluded.privacy_require_verification,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [
      userId,
      input.workspaceName,
      input.defaultSourcePlatform,
      input.defaultRegion,
      input.verificationRequirement,
      input.notifications.productUpdates,
      input.notifications.resumeReady,
      input.notifications.atsAlerts,
      input.notifications.verificationAlerts,
      input.exports.defaultTemplate,
      input.exports.fileStyle,
      input.exports.includeCoverLetter,
      input.privacy.keepResumeHistory,
      input.privacy.allowAiReuse,
      input.privacy.requireVerificationBeforeExport,
    ]
  );

  return getUserSettings(userId);
}
