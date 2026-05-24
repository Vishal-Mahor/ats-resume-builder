'use client';
import React from 'react';
import type { ResumeContent, ResumeSettings } from '@/lib/api';
import {
  A4_PAGE_PADDING_X,
  A4_PAGE_PADDING_Y,
  DEFAULT_RESUME_FORMATTING,
  ensureHref,
  type ResumeContactIcon,
  type ResumeMeta,
  formatDateRange,
  getContactItems,
  getPageMetrics,
  paginateResume,
} from '@/lib/resume-render';

interface ResumePreviewProps {
  meta: ResumeMeta;
  content: ResumeContent;
  settings?: ResumeSettings;
}

export default function ResumePreview({ meta, content, settings }: ResumePreviewProps) {
  const { pages } = paginateResume(meta, content, settings);
  const contactItems = getContactItems(meta, settings);
  const pageMetrics = getPageMetrics(settings);
  const skillsSeparator = settings?.formatting.skillsSeparator ?? DEFAULT_RESUME_FORMATTING.skillsSeparator;
  const showPageNumbers = settings?.formatting.showPageNumbers ?? DEFAULT_RESUME_FORMATTING.showPageNumbers;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {pages.map((pageBlocks, pageIndex) => (
        <div
          key={`resume-page-${pageIndex}`}
          style={{
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '11pt',
            color: '#111',
            lineHeight: '1.45',
            padding: `${A4_PAGE_PADDING_Y}px ${A4_PAGE_PADDING_X}px`,
            background: '#fff',
            width: '100%',
            maxWidth: `${pageMetrics.width}px`,
            minHeight: `${pageMetrics.height}px`,
            height: `${pageMetrics.height}px`,
            margin: '0 auto',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <h1 style={{ fontFamily: 'Arial, sans-serif', fontSize: '20pt', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
            {meta.name}
          </h1>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              fontSize: '9.5pt',
              color: '#444',
              borderBottom: '1.5pt solid #111',
              paddingBottom: 10,
              marginBottom: 14,
            }}
          >
            {contactItems.map((item) =>
              item.href ? (
                <a
                  key={`${pageIndex}-${item.label}`}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#444', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {item.icon ? <ContactIcon icon={item.icon} /> : null}
                  {item.label}
                </a>
              ) : (
                <span key={`${pageIndex}-${item.label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {item.icon ? <ContactIcon icon={item.icon} /> : null}
                  {item.label}
                </span>
              )
            )}
          </div>

          {pageBlocks.map((block) => {
            if (block.type === 'summary') {
              return (
                <React.Fragment key={block.key}>
                  {block.showSectionTitle ? <SectionTitle>Summary</SectionTitle> : null}
                  <p style={{ fontSize: '10.5pt', marginBottom: 4 }}>{block.text}</p>
                </React.Fragment>
              );
            }

            if (block.type === 'skills') {
              return (
                <React.Fragment key={block.key}>
                  {block.showSectionTitle ? <SectionTitle>Skills</SectionTitle> : null}
                  <div style={{ fontSize: '10pt', marginBottom: 4 }}>
                    {block.groups.map((group) => (
                      <p key={group.label} style={{ marginBottom: 3 }}>
                        <strong>{group.label}:</strong> {group.values.join(skillsSeparator === 'comma' ? ', ' : ' • ')}
                      </p>
                    ))}
                  </div>
                </React.Fragment>
              );
            }

            if (block.type === 'experience') {
              return (
                <React.Fragment key={block.key}>
                  {block.showSectionTitle ? <SectionTitle>Experience</SectionTitle> : null}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Arial', fontSize: '10.5pt', fontWeight: 700 }}>{block.item.job_title}</span>
                      <span style={{ fontSize: '9.5pt', color: '#444', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {formatDateRange(block.item.start_date, block.item.end_date, block.item.is_current)}
                      </span>
                    </div>
                    <div style={{ fontSize: '10pt', color: '#444', marginBottom: 3 }}>
                      {block.item.company}{block.item.location ? `, ${block.item.location}` : ''}
                    </div>
                    <ul style={{ paddingLeft: 14, margin: 0, listStyleType: 'disc' }}>
                      {block.item.bullets.map((bullet, index) => (
                        <li key={index} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                </React.Fragment>
              );
            }

            if (block.type === 'project') {
              return (
                <React.Fragment key={block.key}>
                  {block.showSectionTitle ? <SectionTitle>Projects</SectionTitle> : null}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Arial', fontSize: '10.5pt', fontWeight: 700 }}>{block.item.name}</span>
                      <span style={{ fontSize: '9.5pt', color: '#666', fontStyle: 'italic', textAlign: 'right', marginLeft: 8 }}>
                        {block.item.tech_stack}
                        {block.item.url ? (
                          <>
                            {block.item.tech_stack ? ' | ' : ''}
                            <a href={ensureHref(block.item.url)} target="_blank" rel="noreferrer" style={{ color: '#444', textDecoration: 'none' }}>
                              {block.item.url}
                            </a>
                          </>
                        ) : null}
                      </span>
                    </div>
                    {block.item.summary ? (
                      <div style={{ fontSize: '10pt', color: '#444', marginBottom: 3 }}>{block.item.summary}</div>
                    ) : null}
                    <ul style={{ paddingLeft: 14, margin: 0, listStyleType: 'disc' }}>
                      {(block.item.bullets || []).map((bullet, index) => (
                        <li key={index} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                </React.Fragment>
              );
            }

            if (block.type === 'education') {
              return (
                <React.Fragment key={block.key}>
                  {block.showSectionTitle ? <SectionTitle>Education</SectionTitle> : null}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Arial', fontSize: '10.5pt', fontWeight: 700 }}>{block.item.degree}</span>
                      <span style={{ fontSize: '9.5pt', color: '#444' }}>{block.item.year}</span>
                    </div>
                    <ul style={{ paddingLeft: 14, margin: '3px 0 0', listStyleType: 'disc' }}>
                      {(block.item.bullets || []).map((bullet, index) => (
                        <li key={index} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={block.key}>
                {block.showSectionTitle ? <SectionTitle>{block.title}</SectionTitle> : null}
                <ul style={{ paddingLeft: 14, margin: 0, listStyleType: 'disc' }}>
                  {block.items.map((item, index) => (
                    <li key={index} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{item}</li>
                  ))}
                </ul>
              </React.Fragment>
            );
          })}

          {pages.length > 1 && showPageNumbers ? (
            <div
              style={{
                position: 'absolute',
                right: 28,
                bottom: 18,
                fontFamily: 'Arial, sans-serif',
                fontSize: '8.5pt',
                color: '#7a7a7a',
              }}
            >
              Page {pageIndex + 1}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '9.5pt',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        borderBottom: '0.75pt solid #999',
        paddingBottom: 2,
        margin: '12px 0 5px',
      }}
    >
      {children}
    </div>
  );
}

function ContactIcon({ icon }: { icon: ResumeContactIcon }) {
  if (icon === 'email') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    );
  }

  if (icon === 'phone') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.05 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.31 1.85.53 2.81.66A2 2 0 0 1 22 16.92Z" />
      </svg>
    );
  }

  if (icon === 'location') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }

  if (icon === 'github') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.1-1.46-1.1-1.46-.91-.62.06-.61.06-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.01c.85 0 1.7.11 2.5.34 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
      </svg>
    );
  }

  if (icon === 'linkedin') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
        <path d="M5.34 8.96H2.67V21h2.67V8.96ZM4 3a1.55 1.55 0 1 0 0 3.1A1.55 1.55 0 0 0 4 3Zm17.33 11.1c0-3.23-1.72-5.36-4.51-5.36-1.3 0-2.24.72-2.63 1.4h-.04V8.96h-2.56V21h2.67v-5.96c0-1.57.3-3.08 2.24-3.08 1.9 0 1.93 1.78 1.93 3.18V21h2.67v-6.9h.23Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20" />
      <path d="M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
  );
}
