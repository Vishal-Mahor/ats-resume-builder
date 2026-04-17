'use client';
// ============================================================
// ResumePreview — ATS-clean live preview (print-ready HTML)
// ============================================================
import React from 'react';
import type { ResumeContent, ResumeSkills } from '@/lib/api';

interface ResumePreviewProps {
  meta: { name: string; email: string; phone?: string; location?: string; linkedin?: string; github?: string };
  content: ResumeContent;
}

export default function ResumePreview({ meta, content }: ResumePreviewProps) {
  const contact = [meta.email, meta.phone, meta.linkedin, meta.github, meta.location]
    .filter(Boolean).join(' | ');

  const skillGroups = getSkillGroups(content.skills);
  const technicalSkillGroups = skillGroups.filter((group) => group.type === 'technical' && group.values.length > 0);
  const softSkillGroup = skillGroups.find((group) => group.type === 'soft' && group.values.length > 0);

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
          <p style={{ fontSize: '10.5pt', marginBottom: 4 }}>{compactSummaryForDisplay(content.summary)}</p>
        </>
      )}

      {/* Skills */}
      {technicalSkillGroups.length > 0 && (
        <>
          <SectionTitle>Skills</SectionTitle>
          <div style={{ fontSize: '10pt', marginBottom: 4 }}>
            {technicalSkillGroups.map((group) => (
              <p key={group.label} style={{ marginBottom: 3 }}>
                <strong>{group.label}:</strong> {group.values.join(' • ')}
              </p>
            ))}
            {softSkillGroup ? (
              <p style={{ marginBottom: 0 }}>
                <strong>{softSkillGroup.label}:</strong> {softSkillGroup.values.join(' • ')}
              </p>
            ) : null}
          </div>
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
                <span style={{ fontSize: '9.5pt', color: '#444', whiteSpace: 'nowrap', marginLeft: 8 }}>{formatDateRange(exp.start_date, exp.end_date, exp.is_current)}</span>
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
              {p.summary ? (
                <div style={{ fontSize: '10pt', color: '#444', marginBottom: 3 }}>{p.summary}</div>
              ) : null}
              <ul style={{ paddingLeft: 14, margin: 0 }}>
                {getProjectBullets(p).map((bullet, bulletIndex) => (
                  <li key={bulletIndex} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {/* Achievements */}
      {content.achievements?.length ? (
        <>
          <SectionTitle>Achievements</SectionTitle>
          <ul style={{ paddingLeft: 14, margin: 0 }}>
            {content.achievements.map((item, index) => (
              <li key={index} style={{ fontSize: '10.5pt', marginBottom: 2 }}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Education */}
      {content.education?.length > 0 && (
        <>
          <SectionTitle>Education</SectionTitle>
          {content.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
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

      {/* Languages */}
      {content.languages?.length ? (
        <>
          <SectionTitle>Languages</SectionTitle>
          <p style={{ fontSize: '10pt', marginBottom: 4 }}>{content.languages.join(', ')}</p>
        </>
      ) : null}

      {/* Hobbies */}
      {content.hobbies?.length ? (
        <>
          <SectionTitle>Hobbies</SectionTitle>
          <p style={{ fontSize: '10pt', marginBottom: 4 }}>{content.hobbies.join(', ')}</p>
        </>
      ) : null}
    </div>
  );
}

function getSkillGroups(skills: ResumeSkills | undefined) {
  if (!skills) return [];

  if (Array.isArray(skills.technical)) {
    return [
      { label: 'Technical', values: skills.technical, type: 'technical' as const },
      { label: 'Tools', values: skills.tools || [], type: 'technical' as const },
      { label: 'Other', values: skills.other || [], type: 'technical' as const },
      { label: 'Soft Skills', values: skills.soft || [], type: 'soft' as const },
    ].filter((group) => group.values.length > 0);
  }

  const technical = skills.technical || {};
  return [
    { label: 'Languages', values: technical.languages || technical.programming_languages || [], type: 'technical' as const },
    { label: 'Backend / Frameworks', values: technical.backend_frameworks || technical.frameworks || [], type: 'technical' as const },
    { label: 'AI / GenAI', values: technical.ai_genai || [], type: 'technical' as const },
    { label: 'Streaming / Messaging', values: technical.streaming_messaging || [], type: 'technical' as const },
    { label: 'Databases / Storage', values: technical.databases_storage || technical.databases || [], type: 'technical' as const },
    { label: 'Cloud / Infra', values: technical.cloud_infra || technical.cloud || [], type: 'technical' as const },
    { label: 'Tools / Platforms', values: technical.tools_platforms || technical.tools || [], type: 'technical' as const },
    { label: 'Other Technical', values: technical.other || [], type: 'technical' as const },
    { label: 'Soft Skills', values: skills.soft || [], type: 'soft' as const },
  ].filter((group) => group.values.length > 0);
}

function compactSummaryForDisplay(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 110) return value.trim();
  return `${words.slice(0, 110).join(' ')}...`;
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

function formatDateRange(startDate?: string, endDate?: string, isCurrent?: boolean) {
  const start = formatMonthValue(startDate);
  const end = isCurrent ? 'Present' : formatMonthValue(endDate);
  return `${start || 'N/A'} - ${end || 'N/A'}`;
}

function formatMonthValue(value?: string) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [year, month] = trimmed.split('-');
    return new Date(`${year}-${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  return trimmed;
}
