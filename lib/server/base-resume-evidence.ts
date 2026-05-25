import type { FullProfile, ResumeContent } from '@/lib/api';
import { normalizeResumeSkills } from '@/lib/skill-taxonomy';

export function buildProfileFromBaseResume(profile: FullProfile, content: ResumeContent): FullProfile {
  const normalizedSkills = normalizeResumeSkills(content.skills);
  const customSkills = (content.skills.categories ?? []).flatMap((category) => category.skills);
  const technicalSkills = customSkills.length
    ? uniqueItems(customSkills)
    : uniqueItems(Object.values(normalizedSkills.technical).flat());
  const softSkills = customSkills.length ? [] : uniqueItems(normalizedSkills.soft);

  return {
    ...profile,
    summary: content.summary ?? '',
    technicalSkills,
    softSkills,
    skills: [...technicalSkills, ...softSkills],
    experiences: (content.experience ?? []).map((experience, index) => ({
      id: `base-exp-${index + 1}`,
      job_title: experience.job_title,
      company: experience.company,
      location: experience.location ?? '',
      start_date: experience.start_date,
      end_date: experience.end_date ?? '',
      is_current: Boolean(experience.is_current),
      bullets: experience.bullets ?? [],
      sort_order: index,
    })),
    projects: (content.projects ?? []).map((project, index) => ({
      id: `base-project-${index + 1}`,
      name: project.name,
      tech_stack: project.tech_stack ?? '',
      description: project.description ?? project.summary ?? (project.bullets ?? []).join(' '),
      url: project.url ?? '',
      sort_order: index,
    })),
    education: (content.education ?? []).map((education, index) => ({
      id: `base-education-${index + 1}`,
      degree: education.degree,
      institution: education.institution,
      year: education.year,
      gpa: education.gpa ?? '',
      sort_order: index,
    })),
    achievements: content.achievements ?? [],
    languages: content.languages ?? [],
    hobbies: content.hobbies ?? [],
  };
}

function uniqueItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const clean = item.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
