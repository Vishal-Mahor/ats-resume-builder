'use client';
import React from 'react';
import type { ResumeContent, ResumeSettings } from '@/lib/api';
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
                <a key={`${pageIndex}-${item.label}`} href={item.href} target="_blank" rel="noreferrer" style={{ color: '#444', textDecoration: 'none' }}>
                  {item.label}
                </a>
              ) : (
                <span key={`${pageIndex}-${item.label}`}>{item.label}</span>
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
                      <span style={{ fontSize: '9.5pt', color: '#666', fontStyle: 'italic' }}>{block.item.tech_stack}</span>
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
