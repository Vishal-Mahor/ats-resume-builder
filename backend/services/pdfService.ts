// ============================================================
// PDF Generation Service — Puppeteer
// Generates ATS-friendly, clean single-column PDF resumes
// ============================================================
import puppeteer from 'puppeteer';

export interface ResumeContent {
  summary:    string;
  skills:     { technical: string[]; tools: string[]; other: string[] };
  experience: Array<{
    job_title: string; company: string; location?: string;
    start_date: string; end_date: string; bullets: string[];
  }>;
  projects:   Array<{ name: string; tech_stack: string; description: string; url?: string }>;
  education:  Array<{ degree: string; institution: string; year: string; gpa?: string }>;
}

export interface UserMeta {
  name: string; email: string; phone?: string;
  location?: string; linkedin?: string; github?: string;
}

// ─── Build ATS-clean HTML ─────────────────────────────────
function buildResumeHtml(meta: UserMeta, content: ResumeContent): string {
  const skills = [
    ...content.skills.technical,
    ...content.skills.tools,
    ...content.skills.other,
  ].join(' • ');

  const experienceHtml = content.experience.map(exp => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${exp.job_title}</span>
        <span class="entry-date">${exp.start_date} – ${exp.end_date}</span>
      </div>
      <div class="entry-sub">${exp.company}${exp.location ? ', ' + exp.location : ''}</div>
      <ul>
        ${exp.bullets.map(b => `<li>${b}</li>`).join('\n')}
      </ul>
    </div>
  `).join('');

  const projectsHtml = content.projects.map(p => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${p.name}</span>
        <span class="entry-sub-inline">${p.tech_stack}</span>
      </div>
      <ul><li>${p.description}</li></ul>
    </div>
  `).join('');

  const eduHtml = content.education.map(e => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${e.degree}</span>
        <span class="entry-date">${e.year}</span>
      </div>
      <div class="entry-sub">${e.institution}${e.gpa ? ' | GPA: ' + e.gpa : ''}</div>
    </div>
  `).join('');

  const contact = [meta.email, meta.phone, meta.linkedin, meta.github, meta.location]
    .filter(Boolean).join(' | ');

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
    padding: 0.75in 0.75in;
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
  <p class="skills-line">${skills}</p>

  <div class="section-title">Experience</div>
  ${experienceHtml}

  <div class="section-title">Projects</div>
  ${projectsHtml}

  <div class="section-title">Education</div>
  ${eduHtml}
</body>
</html>`;
}

// ─── Generate PDF Buffer ──────────────────────────────────
export async function generateResumePdf(
  meta: UserMeta,
  content: ResumeContent
): Promise<Buffer> {
  const html = buildResumeHtml(meta, content);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, // CSS handles margins
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Generate Cover Letter PDF ────────────────────────────
export async function generateCoverLetterPdf(
  meta: UserMeta,
  coverLetter: string,
  companyName: string,
  jobTitle: string
): Promise<Buffer> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const paragraphs = coverLetter.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.6; padding: 1in 1in; }
  .header { margin-bottom: 32px; }
  .name { font-size: 16pt; font-weight: bold; }
  .contact { font-size: 9.5pt; color: #555; margin-top: 4px; }
  .date { margin: 24px 0 16px; }
  .to { margin-bottom: 24px; }
  p { margin-bottom: 14px; }
  .sign { margin-top: 28px; }
</style>
</head><body>
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
</body></html>`;

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
