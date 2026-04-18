import type { ResumeContent, ResumeSettings, ResumeSkills } from '@/lib/api';

export const DEFAULT_RESUME_FORMATTING = {
  summaryMaxWords: 25,
  maxBulletsPerSection: 5,
  skillsSeparator: 'comma' as const,
  linkStyle: 'compact' as const,
  pageSize: 'A4' as const,
  repeatSectionHeadingsOnNewPage: true,
  showPageNumbers: true,
};

export const A4_PAGE_WIDTH_PX = 794;
export const A4_PAGE_HEIGHT_PX = 1123;
export const LETTER_PAGE_WIDTH_PX = 816;
export const LETTER_PAGE_HEIGHT_PX = 1056;
export const A4_PAGE_PADDING_X = 46;
export const A4_PAGE_PADDING_Y = 40;

export type ResumeMeta = {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
};

export type VisibleResumeContent = ResumeContent & {
  section_visibility: NonNullable<ResumeContent['section_visibility']>;
};

export type ResumeSkillGroup = {
  label: string;
  values: string[];
  type: 'technical' | 'soft';
};

type BaseBlock = {
  key: string;
  sectionKey: keyof NonNullable<ResumeContent['section_visibility']>;
  showSectionTitle: boolean;
};

export type ResumePageBlock =
  | (BaseBlock & { type: 'summary'; text: string })
  | (BaseBlock & { type: 'skills'; groups: ResumeSkillGroup[] })
  | (BaseBlock & { type: 'experience'; item: VisibleResumeContent['experience'][number] })
  | (BaseBlock & { type: 'project'; item: VisibleResumeContent['projects'][number] })
  | (BaseBlock & { type: 'education'; item: VisibleResumeContent['education'][number] })
  | (BaseBlock & { type: 'list'; title: string; items: string[] });

export function getSectionVisibility(content: ResumeContent) {
  return {
    summary: content.section_visibility?.summary ?? true,
    skills: content.section_visibility?.skills ?? true,
    experience: content.section_visibility?.experience ?? true,
    projects: content.section_visibility?.projects ?? true,
    achievements: content.section_visibility?.achievements ?? true,
    education: content.section_visibility?.education ?? true,
    languages: content.section_visibility?.languages ?? true,
    hobbies: content.section_visibility?.hobbies ?? true,
  };
}

export function sanitizeResumeContentForRender(content: ResumeContent, settings?: ResumeSettings): VisibleResumeContent {
  const summaryMaxWords = settings?.formatting.summaryMaxWords ?? DEFAULT_RESUME_FORMATTING.summaryMaxWords;
  const maxBullets = settings?.formatting.maxBulletsPerSection ?? DEFAULT_RESUME_FORMATTING.maxBulletsPerSection;
  const defaultSectionVisibility = settings?.structure.defaultSectionVisibility;

  return {
    ...content,
    summary: compactSummary(content.summary, summaryMaxWords),
    experience: (content.experience || []).map((item) => ({
      ...item,
      bullets: normalizeBullets(item.bullets, maxBullets),
    })),
    projects: (content.projects || []).map((item) => ({
      ...item,
      bullets: normalizeBullets(getProjectBullets(item), maxBullets),
    })),
    education: (content.education || []).map((item) => ({
      ...item,
      bullets: normalizeBullets(item.bullets || buildEducationBullets(item), maxBullets),
    })),
    achievements: normalizeBullets(content.achievements || [], maxBullets),
    languages: normalizeBullets(content.languages || [], maxBullets),
    hobbies: normalizeBullets(content.hobbies || [], maxBullets),
    section_visibility: {
      summary: content.section_visibility?.summary ?? defaultSectionVisibility?.summary ?? true,
      skills: content.section_visibility?.skills ?? defaultSectionVisibility?.skills ?? true,
      experience: content.section_visibility?.experience ?? defaultSectionVisibility?.experience ?? true,
      projects: content.section_visibility?.projects ?? defaultSectionVisibility?.projects ?? true,
      achievements: content.section_visibility?.achievements ?? defaultSectionVisibility?.achievements ?? true,
      education: content.section_visibility?.education ?? defaultSectionVisibility?.education ?? true,
      languages: content.section_visibility?.languages ?? defaultSectionVisibility?.languages ?? true,
      hobbies: content.section_visibility?.hobbies ?? defaultSectionVisibility?.hobbies ?? true,
    },
  };
}

export function compactSummary(value: string, maxWords = DEFAULT_RESUME_FORMATTING.summaryMaxWords) {
  const words = (value || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

export function normalizeBullets(items: string[], maxBullets = DEFAULT_RESUME_FORMATTING.maxBulletsPerSection) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of items) {
    const clean = item.replace(/^\s*[•\-]\s*/, '').replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
  }
  return normalized.slice(0, maxBullets);
}

export function getProjectBullets(project: VisibleResumeContent['projects'][number] | ResumeContent['projects'][number]) {
  if (project.bullets?.length) return project.bullets;
  if (project.description) return [project.description];
  if (project.summary) return [project.summary];
  return [];
}

function buildEducationBullets(item: ResumeContent['education'][number]) {
  const bullets: string[] = [];
  if (item.institution) bullets.push(item.institution);
  if (item.gpa) bullets.push(`GPA: ${item.gpa}`);
  return bullets;
}

export function getResumeSkillGroups(skills: ResumeSkills | undefined): ResumeSkillGroup[] {
  if (!skills) return [];

  if (Array.isArray(skills.technical)) {
    const groups: ResumeSkillGroup[] = [
      { label: 'Technical', values: skills.technical, type: 'technical' },
      { label: 'Tools', values: skills.tools || [], type: 'technical' },
      { label: 'Other', values: skills.other || [], type: 'technical' },
      { label: 'Soft Skills', values: skills.soft || [], type: 'soft' },
    ];
    return groups.filter((group) => group.values.length > 0);
  }

  const technical = skills.technical || {};
  const groups: ResumeSkillGroup[] = [
    { label: 'Languages', values: technical.languages || technical.programming_languages || [], type: 'technical' },
    { label: 'Backend / Frameworks', values: technical.backend_frameworks || [], type: 'technical' },
    { label: 'AI / GenAI', values: technical.ai_genai || [], type: 'technical' },
    { label: 'Streaming / Messaging', values: technical.streaming_messaging || [], type: 'technical' },
    { label: 'Databases / Storage', values: technical.databases_storage || technical.databases || [], type: 'technical' },
    { label: 'Cloud / Infra', values: technical.cloud_infra || technical.cloud || [], type: 'technical' },
    { label: 'Tools / Platforms', values: technical.tools_platforms || technical.tools || [], type: 'technical' },
    { label: 'Other Technical', values: technical.other || [], type: 'technical' },
    { label: 'Soft Skills', values: skills.soft || [], type: 'soft' },
  ];
  return groups.filter((group) => group.values.length > 0);
}

export function getContactItems(meta: ResumeMeta, settings?: ResumeSettings) {
  const compactLinks = (settings?.formatting.linkStyle ?? DEFAULT_RESUME_FORMATTING.linkStyle) === 'compact';
  const items: Array<{ label: string; href?: string }> = [];
  if (meta.email) items.push({ label: meta.email, href: `mailto:${meta.email}` });
  if (meta.phone) items.push({ label: meta.phone, href: `tel:${meta.phone.replace(/\s+/g, '')}` });
  if (meta.linkedin) items.push({ label: compactLinks ? 'LinkedIn' : meta.linkedin, href: ensureHref(meta.linkedin) });
  if (meta.github) items.push({ label: compactLinks ? 'GitHub' : meta.github, href: ensureHref(meta.github) });
  if (meta.website) items.push({ label: compactLinks ? 'Portfolio' : meta.website, href: ensureHref(meta.website) });
  if (meta.location) items.push({ label: meta.location });
  return items;
}

function ensureHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getPageMetrics(settings?: ResumeSettings) {
  const pageSize = settings?.formatting.pageSize ?? DEFAULT_RESUME_FORMATTING.pageSize;
  const width = pageSize === 'Letter' ? LETTER_PAGE_WIDTH_PX : A4_PAGE_WIDTH_PX;
  const height = pageSize === 'Letter' ? LETTER_PAGE_HEIGHT_PX : A4_PAGE_HEIGHT_PX;
  return {
    width,
    height,
    contentHeight: height - A4_PAGE_PADDING_Y * 2 - 60,
  };
}

export function paginateResume(meta: ResumeMeta, content: ResumeContent, settings?: ResumeSettings) {
  const safeContent = sanitizeResumeContentForRender(content, settings);
  const blocks = buildBlocks(safeContent);
  const metrics = getPageMetrics(settings);
  const pages: ResumePageBlock[][] = [];
  let page: ResumePageBlock[] = [];
  let height = estimateHeaderHeight(meta, settings);

  blocks.forEach((block, index) => {
    const blockHeight = estimateBlockHeight(block);
    if (page.length > 0 && height + blockHeight > metrics.contentHeight) {
      pages.push(page);
      const previous = blocks[index - 1];
      const shouldRepeatTitle =
        (settings?.formatting.repeatSectionHeadingsOnNewPage ?? DEFAULT_RESUME_FORMATTING.repeatSectionHeadingsOnNewPage) &&
        previous &&
        previous.sectionKey === block.sectionKey &&
        !block.showSectionTitle;
      page = [shouldRepeatTitle ? { ...block, showSectionTitle: true } : block];
      height = estimateHeaderHeight(meta, settings) + estimateBlockHeight(page[0]);
    } else {
      page.push(block);
      height += blockHeight;
    }
  });

  if (page.length > 0) pages.push(page);
  return { content: safeContent, pages: pages.length > 0 ? pages : [[]] };
}

function buildBlocks(content: VisibleResumeContent): ResumePageBlock[] {
  const blocks: ResumePageBlock[] = [];
  const skillGroups = getResumeSkillGroups(content.skills);
  const achievements = content.achievements || [];
  const languages = content.languages || [];
  const hobbies = content.hobbies || [];

  if (content.section_visibility.summary && content.summary) {
    blocks.push({ key: 'summary', type: 'summary', sectionKey: 'summary', showSectionTitle: true, text: content.summary });
  }

  if (content.section_visibility.skills && skillGroups.length > 0) {
    blocks.push({ key: 'skills', type: 'skills', sectionKey: 'skills', showSectionTitle: true, groups: skillGroups });
  }

  if (content.section_visibility.experience) {
    content.experience.forEach((item, index) => {
      blocks.push({
        key: `experience-${index}`,
        type: 'experience',
        sectionKey: 'experience',
        showSectionTitle: index === 0,
        item,
      });
    });
  }

  if (content.section_visibility.projects) {
    content.projects.forEach((item, index) => {
      blocks.push({
        key: `project-${index}`,
        type: 'project',
        sectionKey: 'projects',
        showSectionTitle: index === 0,
        item,
      });
    });
  }

  if (content.section_visibility.achievements && achievements.length > 0) {
    blocks.push({
      key: 'achievements',
      type: 'list',
      sectionKey: 'achievements',
      showSectionTitle: true,
      title: 'Achievements',
      items: achievements,
    });
  }

  if (content.section_visibility.education) {
    content.education.forEach((item, index) => {
      blocks.push({
        key: `education-${index}`,
        type: 'education',
        sectionKey: 'education',
        showSectionTitle: index === 0,
        item,
      });
    });
  }

  if (content.section_visibility.languages && languages.length > 0) {
    blocks.push({
      key: 'languages',
      type: 'list',
      sectionKey: 'languages',
      showSectionTitle: true,
      title: 'Languages',
      items: languages,
    });
  }

  if (content.section_visibility.hobbies && hobbies.length > 0) {
    blocks.push({
      key: 'hobbies',
      type: 'list',
      sectionKey: 'hobbies',
      showSectionTitle: true,
      title: 'Hobbies',
      items: hobbies,
    });
  }

  return blocks;
}

function estimateHeaderHeight(meta: ResumeMeta, settings?: ResumeSettings) {
  return 70 + Math.ceil(getContactItems(meta, settings).length / 3) * 16;
}

function estimateBlockHeight(block: ResumePageBlock) {
  if (block.type === 'summary') {
    return 28 + estimateLineCount(block.text, 92) * 18;
  }
  if (block.type === 'skills') {
    const textLength = block.groups.reduce((sum, group) => sum + `${group.label}: ${group.values.join(', ')}`.length, 0);
    return 28 + Math.ceil(block.groups.length * 14) + estimateLineCount(String(textLength), 120) * 8 + 20;
  }
  if (block.type === 'experience') {
    const bullets = block.item.bullets.reduce((sum, bullet) => sum + estimateLineCount(bullet, 88), 0);
    return (block.showSectionTitle ? 24 : 0) + 42 + bullets * 18;
  }
  if (block.type === 'project') {
    const bullets = getProjectBullets(block.item).reduce((sum, bullet) => sum + estimateLineCount(bullet, 88), 0);
    return (block.showSectionTitle ? 24 : 0) + 38 + bullets * 18;
  }
  if (block.type === 'education') {
    const bullets = (block.item.bullets || []).reduce((sum, bullet) => sum + estimateLineCount(bullet, 88), 0);
    return (block.showSectionTitle ? 24 : 0) + 34 + Math.max(1, bullets) * 18;
  }
  return 28 + block.items.reduce((sum, item) => sum + estimateLineCount(item, 88) * 18, 0);
}

function estimateLineCount(text: string, charsPerLine: number) {
  return Math.max(1, Math.ceil((text || '').length / charsPerLine));
}

export function formatDateRange(startDate?: string, endDate?: string, isCurrent?: boolean) {
  const start = formatMonthValue(startDate);
  const end = isCurrent ? 'Present' : formatMonthValue(endDate);
  return `${start || 'N/A'} - ${end || 'N/A'}`;
}

export function formatMonthValue(value?: string) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [year, month] = trimmed.split('-');
    return new Date(`${year}-${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  return trimmed;
}
