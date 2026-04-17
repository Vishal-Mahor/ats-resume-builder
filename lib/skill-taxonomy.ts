import type { ResumeSkills } from '@/lib/api';

type NormalizedTechnicalSkills = {
  languages: string[];
  backend_frameworks: string[];
  ai_genai: string[];
  streaming_messaging: string[];
  databases_storage: string[];
  cloud_infra: string[];
  tools_platforms: string[];
  other: string[];
};

export type NormalizedResumeSkills = {
  technical: NormalizedTechnicalSkills;
  soft: string[];
};

const PROGRAMMING_LANGUAGES = new Set([
  'languages',
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

const BACKEND_FRAMEWORKS = new Set([
  'backend',
  'frameworks',
  'react',
  'next.js',
  'nextjs',
  'node.js',
  'nodejs',
  'node',
  'express',
  'nestjs',
  'fastapi',
  'django',
  'flask',
  'spring',
  'spring boot',
  'microservices',
  'rest api',
  'rest apis',
  'graphql',
  'angular',
  'vue',
  'laravel',
]);

const AI_GENAI = new Set([
  'ai',
  'genai',
  'llm',
  'rag',
  'langchain',
  'langgraph',
  'agentic ai',
  'a2a protocol',
  'vector db',
  'vector database',
  'vectordb',
  'chromadb',
  'pinecone',
  'openai',
  'huggingface',
  'tensorflow',
  'pytorch',
]);

const STREAMING_MESSAGING = new Set([
  'kafka',
  'nats',
  'nats kv',
  'rabbitmq',
  'sqs',
  'sns',
  'eventbridge',
  'pubsub',
]);

const DATABASES_STORAGE = new Set([
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
  'snowflake',
  'vector db',
]);

const CLOUD_INFRA = new Set([
  'aws',
  'aws lambda',
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
  'iam',
  'cloudformation',
  'docker',
  'terraform',
  'jenkins',
  'argo',
  'ci/cd',
  'cicd',
]);

const TOOLS_PLATFORMS = new Set([
  'tools',
  'platforms',
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
  'hadoop',
  'spark',
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
        languages: [...skills.technical],
        backend_frameworks: [],
        ai_genai: [],
        streaming_messaging: [],
        databases_storage: [],
        cloud_infra: [],
        tools_platforms: [...(skills.tools || [])],
        other: [...(skills.other || [])],
      },
      soft: [...(skills.soft || [])],
    };
  }

  const technical = skills.technical || {};
  return {
    technical: {
      languages: [...(technical.languages || technical.programming_languages || [])],
      backend_frameworks: [...(technical.backend_frameworks || technical.frameworks || [])],
      ai_genai: [...(technical.ai_genai || [])],
      streaming_messaging: [...(technical.streaming_messaging || [])],
      databases_storage: [...(technical.databases_storage || technical.databases || [])],
      cloud_infra: [...(technical.cloud_infra || technical.cloud || [])],
      tools_platforms: [...(technical.tools_platforms || technical.tools || [])],
      other: [...(technical.other || [])],
    },
    soft: [...(skills.soft || [])],
  };
}

function canonicalizeSkill(skill: string) {
  const normalized = skill.trim().toLowerCase();
  if (normalized === 'k8s') return 'Kubernetes';
  if (normalized === 'node') return 'Node.js';
  if (normalized === 'postgres') return 'PostgreSQL';
  if (normalized === 'powerbi') return 'Power BI';
  if (normalized === 'vector database' || normalized === 'vectordb') return 'Vector DB';
  if (normalized === 'cicd') return 'CI/CD';
  return skill.trim();
}

export function classifySkillKeyword(skill: string): keyof NormalizedTechnicalSkills | 'soft' {
  const normalized = canonicalizeSkill(skill).toLowerCase();
  if (SOFT_SKILLS.has(normalized)) return 'soft';
  if (PROGRAMMING_LANGUAGES.has(normalized)) return 'languages';
  if (BACKEND_FRAMEWORKS.has(normalized)) return 'backend_frameworks';
  if (AI_GENAI.has(normalized)) return 'ai_genai';
  if (STREAMING_MESSAGING.has(normalized)) return 'streaming_messaging';
  if (DATABASES_STORAGE.has(normalized)) return 'databases_storage';
  if (CLOUD_INFRA.has(normalized)) return 'cloud_infra';
  if (TOOLS_PLATFORMS.has(normalized)) return 'tools_platforms';
  return 'other';
}

export function addSkillToResumeSkills(skills: ResumeSkills, skill: string): ResumeSkills {
  const normalizedSkills = normalizeResumeSkills(skills);
  const bucket = classifySkillKeyword(skill);
  const cleanSkill = canonicalizeSkill(skill);

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

  dedupeTechnicalSkills(normalizedSkills);

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

  dedupeTechnicalSkills(normalizedSkills);

  return normalizedSkills;
}

function dedupeTechnicalSkills(skills: NormalizedResumeSkills) {
  const seen = new Set<string>();
  const keys: Array<keyof NormalizedTechnicalSkills> = [
    'languages',
    'backend_frameworks',
    'ai_genai',
    'streaming_messaging',
    'databases_storage',
    'cloud_infra',
    'tools_platforms',
    'other',
  ];

  for (const key of keys) {
    const deduped: string[] = [];
    for (const item of skills.technical[key]) {
      const normalized = item.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      deduped.push(item.trim());
    }
    skills.technical[key] = deduped;
  }
}
