'use client';
// ============================================================
// ATSPanel — Keyword match score + suggestions sidebar
// ============================================================
import React from 'react';
import type { Suggestion } from '@/lib/api';

interface ATSPanelProps {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
  companyName?: string;
  jobTitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  onAddKeyword?: (keyword: string) => void;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22d3ee' : score >= 60 ? '#fbbf24' : '#fb7185';

  return (
    <div className="relative w-24 h-24 mx-auto mb-4">
      <svg className="-rotate-90" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="44" cy="44" r={radius} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold leading-none" style={{ fontFamily: 'var(--font-sans)', color }}>
          {score}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-widest text-[var(--text-dim)]">ATS Score</span>
      </div>
    </div>
  );
}

function KeywordTag({ label, variant }: { label: string; variant: 'match' | 'miss' }) {
  const cls = variant === 'match'
    ? 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
    : 'border border-rose-400/20 bg-rose-400/10 text-rose-100';
  return (
    <span className={`inline-flex rounded-[10px] px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function ATSPanel({
  score, matchedKeywords, missingKeywords, suggestions, companyName, jobTitle,
  refreshing = false,
  onRefresh,
  onAddKeyword,
}: ATSPanelProps) {
  return (
    <aside className="flex w-64 min-w-[256px] flex-col overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="flex-shrink-0 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">ATS Intelligence</p>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-[10px] border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          ) : null}
        </div>
        {companyName && (
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">
            {companyName}{jobTitle ? ` · ${jobTitle}` : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <ScoreRing score={score} />

        {/* Matched */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Matched Keywords ({matchedKeywords.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {matchedKeywords.map(kw => (
              <KeywordTag key={kw} label={kw} variant="match" />
            ))}
          </div>
        </div>

        {/* Missing */}
        {missingKeywords.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-rose-400" />
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                Missing Keywords ({missingKeywords.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingKeywords.map(kw => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => onAddKeyword?.(kw)}
                  disabled={!onAddKeyword}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-rose-400/20 bg-rose-400/10 px-2 py-0.5 text-[11px] font-medium text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-default disabled:hover:bg-rose-400/10"
                >
                  {kw}
                  {onAddKeyword ? <span className="text-[10px] font-semibold">+</span> : null}
                </button>
              ))}
            </div>
            {onAddKeyword ? (
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-dim)]">
                Click a missing keyword to add it into the skills form and recheck ATS fit.
              </p>
            ) : null}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">Suggestions</p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-[10px] border-l-2 border-cyan-400 bg-cyan-400/10 px-2.5 py-2 text-[11.5px] text-cyan-100"
                >
                  <strong>+{s.impact_pct}%</strong> — {s.action}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
