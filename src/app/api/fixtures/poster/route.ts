// POST /api/fixtures/poster — renders one page of a fixture as a PNG.
//
// Anonymous on purpose: the public fixture-generator tool has no session, and
// the matches screen posts its preview here before anything is saved. It reads
// no database and stores nothing — the poster is built only from the body,
// which `parsePosterInput` caps (teams, matches, text lengths) before any
// rendering work happens.

import { NextRequest, NextResponse } from 'next/server';
import { paginatePoster, parsePosterInput } from '@/lib/fixtures';
import { renderFixturePoster } from './poster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 500 matches by team index is a few tens of KB; anything far bigger isn't a poster.
const MAX_BODY_BYTES = 200_000;

export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Fixture is too large for a poster' }, { status: 413 });

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Fixture is too large for a poster' }, { status: 413 });
    let raw: unknown = null;
    try { raw = JSON.parse(text); } catch { /* reported below */ }

    const parsed = parsePosterInput(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

    const pages = paginatePoster(parsed.input.matches, parsed.input.format);
    if (parsed.input.page > pages.length) {
      return NextResponse.json({ error: `This fixture has ${pages.length} page${pages.length === 1 ? '' : 's'}` }, { status: 400 });
    }
    return await renderFixturePoster(parsed.input, pages);
  } catch (error) {
    console.error('Error rendering fixture poster:', error);
    return NextResponse.json({ error: 'Failed to render poster' }, { status: 500 });
  }
}
