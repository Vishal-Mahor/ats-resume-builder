import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type NominatimResult = {
  display_name?: string;
  place_id?: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    country?: string;
  };
  name?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';
  const scope = searchParams.get('scope')?.trim() || 'city-country';

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const isCountrySearch = scope === 'country';
    const upstream = await fetch(
      isCountrySearch
        ? `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&featureType=country&q=${encodeURIComponent(query)}`
        : `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ATS-Resume-Builder/1.0',
        },
        cache: 'no-store',
      }
    );

    if (!upstream.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await upstream.json()) as NominatimResult[];

    const seen = new Set<string>();
    const results = isCountrySearch
      ? data
          .map((item, index) => {
            const label = item.address?.country || item.display_name?.split(',')[0]?.trim() || item.name;

            if (!label) {
              return null;
            }

            if (seen.has(label)) {
              return null;
            }
            seen.add(label);

            return {
              id: String(item.place_id ?? `${label}-${index}`),
              label,
            };
          })
          .filter((item): item is { id: string; label: string } => Boolean(item))
      : data
          .map((item, index) => {
            const city =
              item.address?.city ||
              item.address?.town ||
              item.address?.village ||
              item.address?.municipality ||
              item.address?.hamlet;
            const country = item.address?.country;

            if (!city || !country) {
              return null;
            }

            const label = `${city}, ${country}`;
            if (seen.has(label)) {
              return null;
            }
            seen.add(label);

            return {
              id: String(item.place_id ?? `${label}-${index}`),
              label,
            };
          })
          .filter((item): item is { id: string; label: string } => Boolean(item));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
