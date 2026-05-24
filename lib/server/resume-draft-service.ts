import { db } from '@/lib/server/db';
import type { FullProfile, ResumeContent, ResumeSkills } from '@/lib/api';

type DraftInput = {
  userId: string;
  resumeName: string;
  jobTitle: string;
  templateId: string;
  sourcePlatform?: string;
  content?: ResumeContent;
};

export async function createDraftResume(input: DraftInput) {
  const content = input.content ?? createBlankResumeContent(input.jobTitle);
  const {
    rows: [resume],
  } = await db.query(
    `INSERT INTO resumes
       (user_id, template_id, company_name, job_title, source_platform, resume_content, cover_letter, cover_letter_tone,
        ats_score, matched_keywords, missing_keywords, suggestions, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, company_name, job_title, source_platform, template_id, ats_score, status, created_at, updated_at, resume_content`,
    [
      input.userId,
      input.templateId,
      input.resumeName,
      input.jobTitle,
      input.sourcePlatform ?? 'manual',
      JSON.stringify(content),
      '',
      'modern',
      0,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      'base',
    ]
  );

  return resume;
}

export function createBlankResumeContent(jobTitle = ''): ResumeContent {
  return {
    summary: '',
    skills: createEmptySkills(),
    section_visibility: {
      summary: true,
      skills: true,
      experience: true,
      projects: true,
      achievements: true,
      education: true,
      languages: true,
      hobbies: true,
    },
    experience: [
      {
        job_title: jobTitle,
        company: '',
        location: '',
        start_date: '',
        end_date: '',
        is_current: false,
        bullets: [''],
      },
    ],
    projects: [{ name: '', tech_stack: '', summary: '', description: '', bullets: [''], url: '' }],
    education: [{ degree: '', institution: '', year: '', gpa: '', bullets: [''] }],
    achievements: [],
    languages: [],
    hobbies: [],
  };
}

export function createResumeContentFromProfile(profile: FullProfile, jobTitle = ''): ResumeContent {
  return {
    ...createBlankResumeContent(jobTitle),
    summary: profile.summary ?? '',
    skills: createEmptySkills(),
    experience: profile.experiences.length
      ? profile.experiences.map((item) => ({
          job_title: item.job_title,
          company: item.company,
          location: item.location ?? '',
          start_date: item.start_date,
          end_date: item.end_date ?? '',
          is_current: item.is_current,
          bullets: item.bullets.length ? item.bullets : [''],
        }))
      : createBlankResumeContent(jobTitle).experience,
    projects: profile.projects.length
      ? profile.projects.map((item) => ({
          name: item.name,
          tech_stack: item.tech_stack ?? '',
          description: item.description,
          summary: item.description,
          bullets: item.description ? [item.description] : [''],
          url: item.url ?? '',
        }))
      : createBlankResumeContent(jobTitle).projects,
    education: profile.education.length
      ? profile.education.map((item) => ({
          degree: item.degree,
          institution: item.institution,
          year: item.year,
          gpa: item.gpa ?? '',
          bullets: item.field ? [item.field] : [],
        }))
      : createBlankResumeContent(jobTitle).education,
    achievements: profile.achievements ?? [],
    languages: profile.languages ?? [],
    hobbies: profile.hobbies ?? [],
  };
}

export function createResumeContentFromText(text: string, fallbackJobTitle = ''): ResumeContent {
  const lines = normalizeTextLines(text);
  const sections = splitIntoSections(lines);
  const summary = getFirstSectionText(sections, ['summary', 'profile', 'objective']) || lines.slice(1, 4).join(' ');
  const skills = parseSkills(getFirstSectionText(sections, ['skills', 'technical skills', 'core skills']));
  const experienceLines = getSectionLines(sections, ['experience', 'work experience', 'professional experience', 'employment']);
  const projectLines = getSectionLines(sections, ['projects', 'project experience']);
  const educationLines = getSectionLines(sections, ['education', 'academic']);

  return {
    ...createBlankResumeContent(fallbackJobTitle),
    summary,
    skills,
    experience: experienceLines.length ? parseExperience(experienceLines, fallbackJobTitle) : createBlankResumeContent(fallbackJobTitle).experience,
    projects: projectLines.length ? parseProjects(projectLines) : createBlankResumeContent(fallbackJobTitle).projects,
    education: educationLines.length ? parseEducation(educationLines) : createBlankResumeContent(fallbackJobTitle).education,
    achievements: getSectionLines(sections, ['achievements', 'awards']).slice(0, 6),
    languages: parseCommaList(getFirstSectionText(sections, ['languages'])),
  };
}

function createEmptySkills(): ResumeSkills {
  return {
    categories: [],
    technical: [],
    tools: [],
    other: [],
    soft: [],
  };
}

function normalizeTextLines(text: string) {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

function splitIntoSections(lines: string[]) {
  const sections = new Map<string, string[]>();
  let current = 'header';

  for (const line of lines) {
    const key = normalizeHeading(line);
    if (isKnownHeading(key)) {
      current = key;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.set(current, [...(sections.get(current) ?? []), line]);
  }

  return sections;
}

function normalizeHeading(value: string) {
  return value.toLowerCase().replace(/[:\-]/g, '').trim();
}

function isKnownHeading(value: string) {
  return [
    'summary',
    'profile',
    'objective',
    'skills',
    'technical skills',
    'core skills',
    'experience',
    'work experience',
    'professional experience',
    'employment',
    'projects',
    'project experience',
    'education',
    'academic',
    'achievements',
    'awards',
    'languages',
  ].includes(value);
}

function getSectionLines(sections: Map<string, string[]>, names: string[]) {
  for (const name of names) {
    const values = sections.get(name);
    if (values?.length) return values;
  }
  return [];
}

function getFirstSectionText(sections: Map<string, string[]>, names: string[]) {
  return getSectionLines(sections, names).join(' ').trim();
}

function parseSkills(value: string): ResumeSkills {
  const items = parseCommaList(value).slice(0, 36);
  return {
    technical: items,
    tools: [],
    other: [],
    soft: [],
  };
}

function parseCommaList(value: string) {
  return value
    .split(/[,|•]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseExperience(lines: string[], fallbackJobTitle: string) {
  const bullets = lines.filter((line) => line.length > 18).slice(0, 5);
  const headline = lines[0] ?? '';
  return [
    {
      job_title: fallbackJobTitle || headline,
      company: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      bullets: bullets.length ? bullets : [''],
    },
  ];
}

function parseProjects(lines: string[]) {
  const [name = '', ...rest] = lines;
  return [
    {
      name,
      tech_stack: '',
      description: rest.join(' '),
      summary: rest.slice(0, 2).join(' '),
      bullets: rest.length ? rest.slice(0, 4) : [''],
      url: '',
    },
  ];
}

function parseEducation(lines: string[]) {
  return [
    {
      degree: lines[0] ?? '',
      institution: lines[1] ?? '',
      year: '',
      gpa: '',
      bullets: lines.slice(2, 5),
    },
  ];
}
