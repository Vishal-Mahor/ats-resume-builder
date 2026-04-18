import { z } from 'zod';
import { db } from '@/lib/server/db';
import { buildDefaultPromptTemplates } from '@/lib/server/prompts';

const sectionVisibilitySchema = z.object({
  summary: z.boolean(),
  skills: z.boolean(),
  experience: z.boolean(),
  projects: z.boolean(),
  achievements: z.boolean(),
  education: z.boolean(),
  languages: z.boolean(),
  hobbies: z.boolean(),
});

const promptTemplateSettingSchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  defaultTemplate: z.string().trim().min(1),
  customTemplate: z.string().default(''),
  activeMode: z.enum(['default', 'custom']),
});

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
  resume: z.object({
    formatting: z.object({
      summaryMaxWords: z.number().int().min(10).max(80),
      maxBulletsPerSection: z.number().int().min(1).max(10),
      skillsSeparator: z.enum(['comma', 'bullet']),
      linkStyle: z.enum(['compact', 'full']),
      pageSize: z.enum(['A4', 'Letter']),
      repeatSectionHeadingsOnNewPage: z.boolean(),
      showPageNumbers: z.boolean(),
    }),
    structure: z.object({
      sectionOrder: z.array(z.enum(['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages', 'hobbies'])).min(5).max(8),
      defaultSectionVisibility: sectionVisibilitySchema,
      maxProjects: z.number().int().min(1).max(8),
      maxEducationItems: z.number().int().min(1).max(6),
    }),
    prompts: z.object({
      jdParsing: promptTemplateSettingSchema,
      candidateEvidence: promptTemplateSettingSchema,
      relevanceMapping: promptTemplateSettingSchema,
      experienceRewrite: promptTemplateSettingSchema,
      summaryGeneration: promptTemplateSettingSchema,
      atsEvaluation: promptTemplateSettingSchema,
      finalAssembly: promptTemplateSettingSchema,
      coverLetter: promptTemplateSettingSchema,
    }),
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
  resume_preferences: string;
  resume_structure: string;
  resume_prompt_templates: string;
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
    resume: {
      formatting: {
        summaryMaxWords: 25,
        maxBulletsPerSection: 5,
        skillsSeparator: 'comma' as const,
        linkStyle: 'compact' as const,
        pageSize: 'A4' as const,
        repeatSectionHeadingsOnNewPage: true,
        showPageNumbers: true,
      },
      structure: {
        sectionOrder: ['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages', 'hobbies'] as const,
        defaultSectionVisibility: {
          summary: true,
          skills: true,
          experience: true,
          projects: true,
          achievements: true,
          education: true,
          languages: true,
          hobbies: true,
        },
        maxProjects: 4,
        maxEducationItems: 3,
      },
      prompts: buildDefaultPromptTemplates(),
    },
  };
}

function mapSettingsRow(row?: Partial<SettingsRow> | null) {
  const defaults = getDefaultSettings();
  const resumeFormatting = (row?.resume_preferences as any) || {};
  const resumeStructure = (row?.resume_structure as any) || {};
  const resumePromptTemplates = (row?.resume_prompt_templates as any) || {};

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
    resume: {
      formatting: {
        summaryMaxWords: resumeFormatting.summaryMaxWords ?? defaults.resume.formatting.summaryMaxWords,
        maxBulletsPerSection: resumeFormatting.maxBulletsPerSection ?? defaults.resume.formatting.maxBulletsPerSection,
        skillsSeparator: resumeFormatting.skillsSeparator ?? defaults.resume.formatting.skillsSeparator,
        linkStyle: resumeFormatting.linkStyle ?? defaults.resume.formatting.linkStyle,
        pageSize: resumeFormatting.pageSize ?? defaults.resume.formatting.pageSize,
        repeatSectionHeadingsOnNewPage:
          resumeFormatting.repeatSectionHeadingsOnNewPage ?? defaults.resume.formatting.repeatSectionHeadingsOnNewPage,
        showPageNumbers: resumeFormatting.showPageNumbers ?? defaults.resume.formatting.showPageNumbers,
      },
      structure: {
        sectionOrder: resumeStructure.sectionOrder ?? defaults.resume.structure.sectionOrder,
        defaultSectionVisibility: {
          ...defaults.resume.structure.defaultSectionVisibility,
          ...(resumeStructure.defaultSectionVisibility || {}),
        },
        maxProjects: resumeStructure.maxProjects ?? defaults.resume.structure.maxProjects,
        maxEducationItems: resumeStructure.maxEducationItems ?? defaults.resume.structure.maxEducationItems,
      },
      prompts: {
        ...defaults.resume.prompts,
        ...Object.fromEntries(
          Object.entries(defaults.resume.prompts).map(([key, value]) => [
            key,
            {
              ...value,
              ...(resumePromptTemplates[key] || {}),
              defaultTemplate: resumePromptTemplates[key]?.defaultTemplate || value.defaultTemplate,
            },
          ])
        ),
      },
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
       privacy_keep_resume_history, privacy_allow_ai_reuse, privacy_require_verification,
       resume_preferences, resume_structure, resume_prompt_templates
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
      JSON.stringify(defaults.resume.formatting),
      JSON.stringify(defaults.resume.structure),
      JSON.stringify(defaults.resume.prompts),
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
            privacy_keep_resume_history, privacy_allow_ai_reuse, privacy_require_verification,
            resume_preferences, resume_structure, resume_prompt_templates
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
       privacy_keep_resume_history, privacy_allow_ai_reuse, privacy_require_verification,
       resume_preferences, resume_structure, resume_prompt_templates
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
       resume_preferences=excluded.resume_preferences,
       resume_structure=excluded.resume_structure,
       resume_prompt_templates=excluded.resume_prompt_templates,
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
      JSON.stringify(input.resume.formatting),
      JSON.stringify(input.resume.structure),
      JSON.stringify(input.resume.prompts),
    ]
  );

  return getUserSettings(userId);
}
