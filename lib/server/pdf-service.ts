import puppeteer from 'puppeteer';

export interface ResumeContent {
  summary: string;
  skills: {
    technical:
      | string[]
      | {
          programming_languages?: string[];
          frameworks?: string[];
          cloud?: string[];
          databases?: string[];
          tools?: string[];
          other?: string[];
        };
    tools?: string[];
    other?: string[];
    soft?: string[];
  };
  experience: Array<{
    job_title: string;
    company: string;
    location?: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }>;
  projects: Array<{ name: string; tech_stack: string; description?: string; summary?: string; bullets?: string[]; url?: string }>;
  education: Array<{ degree: string; institution: string; year: string; gpa?: string; bullets?: string[] }>;
}

export interface UserMeta {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
}

function buildResumeHtml(meta: UserMeta, content: ResumeContent) {
  const skillGroups = getSkillGroups(content.skills);

  const experienceHtml = content.experience
    .map(
      (experience) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${experience.job_title}</span>
        <span class="entry-date">${experience.start_date} – ${experience.end_date}</span>
      </div>
      <div class="entry-sub">${experience.company}${experience.location ? `, ${experience.location}` : ''}</div>
      <ul>
        ${experience.bullets.map((bullet) => `<li>${bullet}</li>`).join('\n')}
      </ul>
    </div>
  `
    )
    .join('');

  const projectsHtml = content.projects
    .map(
      (project) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${project.name}</span>
        <span class="entry-sub-inline">${project.tech_stack}</span>
      </div>
      ${project.summary ? `<div class="entry-sub">${project.summary}</div>` : ''}
      <ul>${getProjectBullets(project).map((bullet) => `<li>${bullet}</li>`).join('')}</ul>
    </div>
  `
    )
    .join('');

  const educationHtml = content.education
    .map(
      (entry) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${entry.degree}</span>
        <span class="entry-date">${entry.year}</span>
      </div>
      <div class="entry-sub">${entry.institution}${entry.gpa ? ` | GPA: ${entry.gpa}` : ''}</div>
      ${entry.bullets?.length ? `<ul>${entry.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}</ul>` : ''}
    </div>
  `
    )
    .join('');

  const contact = [meta.email, meta.phone, meta.linkedin, meta.github, meta.location]
    .filter(Boolean)
    .join(' | ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #111;
    line-height: 1.4;
    padding: 0.75in;
  }
  h1.name {
    font-family: Arial, sans-serif;
    font-size: 20pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 4px;
  }
  .contact {
    text-align: center;
    font-size: 9.5pt;
    color: #333;
    margin-bottom: 14px;
    border-bottom: 1.5pt solid #111;
    padding-bottom: 8px;
  }
  .section-title {
    font-family: Arial, sans-serif;
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 0.75pt solid #999;
    padding-bottom: 2px;
    margin: 12px 0 5px;
  }
  .summary { font-size: 10.5pt; line-height: 1.5; }
  .skills-line { font-size: 10pt; }
  .entry { margin-bottom: 8px; }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .entry-title { font-weight: bold; font-size: 10.5pt; font-family: Arial, sans-serif; }
  .entry-date { font-size: 9.5pt; color: #444; white-space: nowrap; }
  .entry-sub { font-size: 10pt; color: #333; margin-bottom: 3px; }
  .entry-sub-inline { font-size: 9.5pt; color: #555; font-style: italic; }
  ul { padding-left: 14px; margin-top: 3px; }
  li { font-size: 10.5pt; margin-bottom: 2px; }
</style>
</head>
<body>
  <h1 class="name">${meta.name}</h1>
  <div class="contact">${contact}</div>

  <div class="section-title">Summary</div>
  <p class="summary">${content.summary}</p>

  <div class="section-title">Skills</div>
  ${skillGroups.map((group) => `<p class="skills-line"><strong>${group.label}:</strong> ${group.values.join(' • ')}</p>`).join('')}

  <div class="section-title">Experience</div>
  ${experienceHtml}

  <div class="section-title">Projects</div>
  ${projectsHtml}

  <div class="section-title">Education</div>
  ${educationHtml}
</body>
</html>`;
}

function getSkillGroups(skills: ResumeContent['skills']) {
  if (Array.isArray(skills.technical)) {
    return [
      { label: 'Technical', values: skills.technical },
      { label: 'Tools', values: skills.tools || [] },
      { label: 'Other', values: skills.other || [] },
      { label: 'Soft Skills', values: skills.soft || [] },
    ].filter((group) => group.values.length > 0);
  }

  const technical = skills.technical || {};
  return [
    { label: 'Programming Languages', values: technical.programming_languages || [] },
    { label: 'Frameworks', values: technical.frameworks || [] },
    { label: 'Cloud', values: technical.cloud || [] },
    { label: 'Databases', values: technical.databases || [] },
    { label: 'Tools', values: technical.tools || [] },
    { label: 'Other Technical', values: technical.other || [] },
    { label: 'Soft Skills', values: skills.soft || [] },
  ].filter((group) => group.values.length > 0);
}

function getProjectBullets(project: ResumeContent['projects'][number]) {
  if (project.bullets?.length) {
    return project.bullets;
  }

  if (project.description) {
    return [project.description];
  }

  if (project.summary) {
    return [project.summary];
  }

  return [];
}

export async function generateResumePdf(meta: UserMeta, content: ResumeContent) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildResumeHtml(meta, content), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateCoverLetterPdf(
  meta: UserMeta,
  coverLetter: string,
  companyName: string,
  jobTitle: string
) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const paragraphs = coverLetter
    .split('\n\n')
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.6; padding: 1in; }
  .header { margin-bottom: 32px; }
  .name { font-size: 16pt; font-weight: bold; }
  .contact { font-size: 9.5pt; color: #555; margin-top: 4px; }
  .date { margin: 24px 0 16px; }
  .to { margin-bottom: 24px; }
  p { margin-bottom: 14px; }
  .sign { margin-top: 28px; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">${meta.name}</div>
    <div class="contact">${[meta.email, meta.phone, meta.location].filter(Boolean).join(' | ')}</div>
  </div>
  <div class="date">${today}</div>
  <div class="to">
    <strong>Hiring Team</strong><br>
    ${companyName}
  </div>
  <p><strong>Re: ${jobTitle}</strong></p>
  ${paragraphs}
  <div class="sign">
    Sincerely,<br><br>
    <strong>${meta.name}</strong>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'Letter', printBackground: false });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
