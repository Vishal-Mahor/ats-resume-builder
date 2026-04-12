'use client';
// ============================================================
// ResumePreview — ATS-clean live preview (print-ready HTML)
// ============================================================
import React from 'react';
import type { ResumeContent } from '@/lib/api';

interface ResumePreviewProps {
  meta: { name: string; email: string; phone?: string; location?: string; linkedin?: string; github?: string };
  content: ResumeContent;
}

export default function ResumePreview({ meta, content }: ResumePreviewProps) {
  const contact = [meta.email, meta.phone, meta.linkedin, meta.github, meta.location]
    .filter(Boolean).join(' | ');

  const allSkills = [
    ...(content.skills?.technical || []),
    ...(content.skills?.tools || []),
    ...(content.skills?.other || []),
  ];

  return (
    <div
      style={{
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '11pt',
        color: '#111',
        lineHeight: '1.45',
        padding: '40px 48px',
        background: '#fff',
        minHeight: '900px',
        maxWidth: '700px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <h1 style={{ fontFamily: 'Arial, sans-serif', fontSize: '20pt', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
        {meta.name}
      </h1>
      <div style={{ textAlign: 'center', fontSize: '9.5pt', color: '#444', borderBottom: '1.5pt solid #111', paddingBottom: 10, marginBottom: 14 }}>
        {contact}
      </div>

      {/* Summary */}
      {content.summary && (
        <>
          <SectionTitle>Summary</SectionTitle>
          <p style={{ fontSize: '10.5pt', marginBottom: 4 }}>{content.summary}</p>
        </>
      )}

      {/* Skills */}
      {allSkills.length > 0 && (
        <>
          <SectionTitle>Skills</SectionTitle>
          <p style={{ fontSize: '10pt', marginBottom: 4 }}>{allSkills.join(' • ')}</p>
        </>
      )}

      {/* Experience */}
      {content.experience?.length > 0 && (
        <>
          <SectionTitle>Experience</SectionTitle>
          {content.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Arial', fontSize: '10.5pt', fontWeight: 700 }}>{exp.job_title}</span>
                <span style={{ fontSize: '9.5pt', color: '#444', whiteSpace: 'nowrap', marginLeft: 8 }}>{exp.start_date} – {exp.end_date}</span>
              </div>
              <div style={{ fontSize: '10pt', color: '#444', marginBottom: 3 }}>
                {exp.company}{exp.location ? `, ${exp.location}` : ''}
              </div>
              <ul style={{ paddingLeft: 14, margin: 0 }}>
                {exp.bullets.map((b, j) => (
                  <li key={j} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {content.projects?.length > 0 && (
        <>
          <SectionTitle>Projects</SectionTitle>
          {content.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Arial', fontSize: '10.5pt', fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: '9.5pt', color: '#666', fontStyle: 'italic' }}>{p.tech_stack}</span>
              </div>
              <ul style={{ paddingLeft: 14, margin: 0 }}>
                <li style={{ fontSize: '10.5pt', marginBottom: 2 }}>{p.description}</li>
              </ul>
            </div>
          ))}
        </>
      )}

      {/* Education */}
      {content.education?.length > 0 && (
        <>
          <SectionTitle>Education</SectionTitle>
          {content.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Arial', fontSize: '10.5pt', fontWeight: 700 }}>{e.degree}</span>
                <span style={{ fontSize: '9.5pt', color: '#444' }}>{e.year}</span>
              </div>
              <div style={{ fontSize: '10pt', color: '#444' }}>
                {e.institution}{e.gpa ? ` | GPA: ${e.gpa}` : ''}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '9.5pt',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      borderBottom: '0.75pt solid #999',
      paddingBottom: 2,
      margin: '12px 0 5px',
    }}>
      {children}
    </div>
  );
}
