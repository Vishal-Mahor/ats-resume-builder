import puppeteer from 'puppeteer';
import {
  A4_PAGE_PADDING_X,
  A4_PAGE_PADDING_Y,
  DEFAULT_RESUME_FORMATTING,
  type ResumeMeta,
  formatDateRange,
  getContactItems,
  getPageMetrics,
  paginateResume,
} from '@/lib/resume-render';
import type { ResumeContent, ResumeSettings } from '@/lib/api';

export type UserMeta = ResumeMeta;

function buildResumeHtml(meta: UserMeta, content: ResumeContent, settings?: ResumeSettings) {
  const { pages } = paginateResume(meta, content, settings);
  const contactItems = getContactItems(meta, settings);
  const pageMetrics = getPageMetrics(settings);
  const skillsSeparator = settings?.formatting.skillsSeparator ?? DEFAULT_RESUME_FORMATTING.skillsSeparator;
  const showPageNumbers = settings?.formatting.showPageNumbers ?? DEFAULT_RESUME_FORMATTING.showPageNumbers;
  const pageSize = settings?.formatting.pageSize ?? DEFAULT_RESUME_FORMATTING.pageSize;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${pageSize}; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #dfe7f6;
    font-family: 'Times New Roman', Times, serif;
    color: #111;
  }
  .page {
    width: ${pageMetrics.width}px;
    min-height: ${pageMetrics.height}px;
    height: ${pageMetrics.height}px;
    padding: ${A4_PAGE_PADDING_Y}px ${A4_PAGE_PADDING_X}px;
    margin: 0 auto 24px;
    background: #fff;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; margin-bottom: 0; }
  h1.name {
    font-family: Arial, sans-serif;
    font-size: 20pt;
    font-weight: bold;
    text-align: center;
    margin: 0 0 4px;
  }
  .contact {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    font-size: 9.5pt;
    color: #444;
    border-bottom: 1.5pt solid #111;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .contact a { color: #444; text-decoration: none; }
  .section-title {
    font-family: Arial, sans-serif;
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 0.75pt solid #999;
    padding-bottom: 2px;
    margin: 12px 0 5px;
  }
  p.summary, p.skills-line, p.project-summary {
    font-size: 10.5pt;
    line-height: 1.45;
    margin: 0 0 4px;
  }
  .skills-line { font-size: 10pt; }
  .entry { margin-bottom: 8px; }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .entry-title {
    font-family: Arial, sans-serif;
    font-size: 10.5pt;
    font-weight: 700;
  }
  .entry-date {
    font-size: 9.5pt;
    color: #444;
    white-space: nowrap;
  }
  .entry-sub {
    font-size: 10pt;
    color: #444;
    margin-bottom: 3px;
  }
  .entry-sub-inline {
    font-size: 9.5pt;
    color: #666;
    font-style: italic;
  }
  ul {
    margin: 0;
    padding-left: 14px;
    list-style-type: disc;
  }
  li {
    font-size: 10.5pt;
    margin-bottom: 2px;
  }
  .page-number {
    position: absolute;
    right: 28px;
    bottom: 18px;
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    color: #7a7a7a;
  }
</style>
</head>
<body>
${pages.map((blocks, pageIndex) => `
  <div class="page">
    <h1 class="name">${escapeHtml(meta.name)}</h1>
    <div class="contact">
      ${contactItems.map((item) => item.href
        ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
        : `<span>${escapeHtml(item.label)}</span>`).join('')}
    </div>
    ${blocks.map((block) => {
      if (block.type === 'summary') {
        return `
          ${block.showSectionTitle ? `<div class="section-title">Summary</div>` : ''}
          <p class="summary">${escapeHtml(block.text)}</p>
        `;
      }
      if (block.type === 'skills') {
        return `
          ${block.showSectionTitle ? `<div class="section-title">Skills</div>` : ''}
          ${block.groups.map((group) => `<p class="skills-line"><strong>${escapeHtml(group.label)}:</strong> ${escapeHtml(group.values.join(skillsSeparator === 'comma' ? ', ' : ' • '))}</p>`).join('')}
        `;
      }
      if (block.type === 'experience') {
        return `
          ${block.showSectionTitle ? `<div class="section-title">Experience</div>` : ''}
          <div class="entry">
            <div class="entry-header">
              <span class="entry-title">${escapeHtml(block.item.job_title)}</span>
              <span class="entry-date">${escapeHtml(formatDateRange(block.item.start_date, block.item.end_date, block.item.is_current))}</span>
            </div>
            <div class="entry-sub">${escapeHtml(block.item.company)}${block.item.location ? `, ${escapeHtml(block.item.location)}` : ''}</div>
            <ul>${block.item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>
          </div>
        `;
      }
      if (block.type === 'project') {
        return `
          ${block.showSectionTitle ? `<div class="section-title">Projects</div>` : ''}
          <div class="entry">
            <div class="entry-header">
              <span class="entry-title">${escapeHtml(block.item.name)}</span>
              <span class="entry-sub-inline">${escapeHtml(block.item.tech_stack)}</span>
            </div>
            ${block.item.summary ? `<p class="project-summary">${escapeHtml(block.item.summary)}</p>` : ''}
            <ul>${(block.item.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>
          </div>
        `;
      }
      if (block.type === 'education') {
        return `
          ${block.showSectionTitle ? `<div class="section-title">Education</div>` : ''}
          <div class="entry">
            <div class="entry-header">
              <span class="entry-title">${escapeHtml(block.item.degree)}</span>
              <span class="entry-date">${escapeHtml(block.item.year)}</span>
            </div>
            <ul>${(block.item.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>
          </div>
        `;
      }
      return `
        ${block.showSectionTitle ? `<div class="section-title">${escapeHtml(block.title)}</div>` : ''}
        <ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      `;
    }).join('')}
    ${pages.length > 1 && showPageNumbers ? `<div class="page-number">Page ${pageIndex + 1}</div>` : ''}
  </div>
`).join('')}
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function generateResumePdf(meta: UserMeta, content: ResumeContent, settings?: ResumeSettings) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildResumeHtml(meta, content, settings), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: settings?.formatting.pageSize ?? 'A4',
      printBackground: true,
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
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.6; margin: 0; padding: 24mm 18mm; }
  .header { margin-bottom: 32px; }
  .name { font-size: 16pt; font-weight: bold; }
  .contact { font-size: 9.5pt; color: #555; margin-top: 4px; }
  .date { margin-bottom: 28px; }
  .subject { font-weight: bold; margin-bottom: 18px; }
  p { margin: 0 0 14px; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">${escapeHtml(meta.name)}</div>
    <div class="contact">${escapeHtml(meta.email)}${meta.phone ? ` | ${escapeHtml(meta.phone)}` : ''}${meta.location ? ` | ${escapeHtml(meta.location)}` : ''}</div>
  </div>
  <div class="date">${escapeHtml(today)}</div>
  <div class="subject">Application for ${escapeHtml(jobTitle)} at ${escapeHtml(companyName)}</div>
  ${paragraphs}
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
