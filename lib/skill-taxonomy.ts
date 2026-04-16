import type { ResumeSkills } from '@/lib/api';

type NormalizedTechnicalSkills = {
  programming_languages: string[];
  frameworks: string[];
  cloud: string[];
  databases: string[];
  tools: string[];
  other: string[];
};

export type NormalizedResumeSkills = {
  technical: NormalizedTechnicalSkills;
  soft: string[];
};

const PROGRAMMING_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'python',
  'java',
  'golang',
  'go',
  'ruby',
  'php',
  'c',
  'c++',
  'c#',
  'rust',
  'scala',
  'kotlin',
  'swift',
  'r',
  'sql',
  'bash',
  'shell',
]);

const FRAMEWORKS = new Set([
  'react',
  'next.js',
  'nextjs',
  'node.js',
  'nodejs',
  'express',
  'nestjs',
  'fastapi',
  'django',
  'flask',
  'spring',
  'spring boot',
  'angular',
  'vue',
  'laravel',
  'langchain',
  'langgraph',
  'tensorflow',
  'pytorch',
]);

const CLOUD = new Set([
  'aws',
  'azure',
  'gcp',
  'google cloud',
  'cloudflare',
  'vercel',
  'kubernetes',
  'ecs',
  'eks',
  'lambda',
  's3',
  'ec2',
  'docker',
  'terraform',
]);

const DATABASES = new Set([
  'postgresql',
  'postgres',
  'mysql',
  'mongodb',
  'redis',
  'dynamodb',
  'sqlite',
  'oracle',
  'cassandra',
  'elasticsearch',
  'pgvector',
  'chromadb',
  'bigquery',
]);

const TOOLS = new Set([
  'git',
  'github',
  'gitlab',
  'jira',
  'figma',
  'postman',
  'jenkins',
  'airflow',
  'tableau',
  'power bi',
  'powerbi',
  'linux',
  'datadog',
  'grafana',
  'prometheus',
  'snowflake',
  'hadoop',
  'spark',
  'kafka',
]);

const SOFT_SKILLS = new Set([
  'communication',
  'leadership',
  'mentoring',
  'collaboration',
  'stakeholder management',
  'problem solving',
  'ownership',
  'teamwork',
  'adaptability',
  'presentation',
  'critical thinking',
  'cross-functional collaboration',
]);

export function normalizeResumeSkills(skills: ResumeSkills): NormalizedResumeSkills {
  if (Array.isArray(skills.technical)) {
    return {
      technical: {
        programming_languages: [...skills.technical],
        frameworks: [],
        cloud: [],
        databases: [],
        tools: [...(skills.tools || [])],
        other: [...(skills.other || [])],
      },
      soft: [...(skills.soft || [])],
    };
  }

  const technical = skills.technical || {};
  return {
    technical: {
      programming_languages: [...(technical.programming_languages || [])],
      frameworks: [...(technical.frameworks || [])],
      cloud: [...(technical.cloud || [])],
      databases: [...(technical.databases || [])],
      tools: [...(technical.tools || [])],
      other: [...(technical.other || [])],
    },
    soft: [...(skills.soft || [])],
  };
}

export function classifySkillKeyword(skill: string): keyof NormalizedTechnicalSkills | 'soft' {
  const normalized = skill.trim().toLowerCase();

  if (SOFT_SKILLS.has(normalized)) return 'soft';
  if (PROGRAMMING_LANGUAGES.has(normalized)) return 'programming_languages';
  if (FRAMEWORKS.has(normalized)) return 'frameworks';
  if (CLOUD.has(normalized)) return 'cloud';
  if (DATABASES.has(normalized)) return 'databases';
  if (TOOLS.has(normalized)) return 'tools';
  return 'other';
}

export function addSkillToResumeSkills(skills: ResumeSkills, skill: string): ResumeSkills {
  const normalizedSkills = normalizeResumeSkills(skills);
  const bucket = classifySkillKeyword(skill);
  const cleanSkill = skill.trim();

  if (!cleanSkill) {
    return skills;
  }

  if (bucket === 'soft') {
    if (!normalizedSkills.soft.some((entry) => entry.toLowerCase() === cleanSkill.toLowerCase())) {
      normalizedSkills.soft.push(cleanSkill);
    }
  } else if (!normalizedSkills.technical[bucket].some((entry) => entry.toLowerCase() === cleanSkill.toLowerCase())) {
    normalizedSkills.technical[bucket].push(cleanSkill);
  }

  return normalizedSkills;
}

export function removeSkillFromResumeSkills(
  skills: ResumeSkills,
  skill: string,
  group: keyof NormalizedTechnicalSkills | 'soft'
): ResumeSkills {
  const normalizedSkills = normalizeResumeSkills(skills);
  const matcher = (entry: string) => entry.toLowerCase() !== skill.toLowerCase();

  if (group === 'soft') {
    normalizedSkills.soft = normalizedSkills.soft.filter(matcher);
  } else {
    normalizedSkills.technical[group] = normalizedSkills.technical[group].filter(matcher);
  }

  return normalizedSkills;
}
