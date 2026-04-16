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
  const color = score >= 80 ? '#1a6b4a' : score >= 60 ? '#b85c00' : '#c0392b';

  return (
    <div className="relative w-24 h-24 mx-auto mb-4">
      <svg className="-rotate-90" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#e5e4de" strokeWidth="7" />
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
        <span className="text-2xl font-light leading-none" style={{ fontFamily: 'serif', color }}>
          {score}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">ATS Score</span>
      </div>
    </div>
  );
}

function KeywordTag({ label, variant }: { label: string; variant: 'match' | 'miss' }) {
  const cls = variant === 'match'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-red-50 text-red-700';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
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
    <aside className="w-64 min-w-[256px] bg-white border-l border-gray-100 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-gray-800">ATS Intelligence</p>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          ) : null}
        </div>
        {companyName && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">
            {companyName}{jobTitle ? ` · ${jobTitle}` : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <ScoreRing score={score} />

        {/* Matched */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-gray-600">
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
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-gray-600">
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
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-default disabled:hover:bg-red-50"
                >
                  {kw}
                  {onAddKeyword ? <span className="text-[10px] font-semibold">+</span> : null}
                </button>
              ))}
            </div>
            {onAddKeyword ? (
              <p className="mt-2 text-[10px] leading-4 text-gray-400">
                Click a missing keyword to add it into the skills form and recheck ATS fit.
              </p>
            ) : null}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-2">Suggestions</p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="text-[11.5px] text-amber-800 bg-amber-50 border-l-2 border-amber-400 px-2.5 py-2 rounded-r"
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
