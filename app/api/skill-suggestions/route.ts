import { NextResponse } from 'next/server';
import { isLikelyTechSkill } from '@/lib/tech-skill-guardrails';

export const runtime = 'nodejs';

type EscoSuggestion = {
  searchHit?: string;
  title?: string;
  preferredLabel?: string | Record<string, string>;
  uri?: string;
};

type EscoPayload = {
  _embedded?: {
    results?: EscoSuggestion[];
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const upstream = await fetch(
      `https://ec.europa.eu/esco/api/suggest2?text=${encodeURIComponent(query)}&language=en&type=skill&limit=20`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }
    );

    if (!upstream.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await upstream.json()) as EscoPayload;
    const seen = new Set<string>();
    const results =
      data._embedded?.results
        ?.map((item) => cleanSkillLabel(getEscoSkillLabel(item)))
        .filter((label): label is string => {
          if (!label) return false;
          if (!isLikelyTechSkill(label)) return false;
          const normalized = label.toLowerCase();
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        })
        .slice(0, 5) ?? [];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

function getEscoSkillLabel(item: EscoSuggestion) {
  if (typeof item.preferredLabel === 'string') return item.preferredLabel;
  return item.preferredLabel?.en || item.searchHit || item.title || '';
}

function cleanSkillLabel(label: string) {
  return label.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
