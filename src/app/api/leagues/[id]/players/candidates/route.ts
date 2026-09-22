import { NextRequest, NextResponse } from 'next/server';
import { searchUserCandidatesForLeague } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

// Organizers only — the accounts an organizer can add to this league as
// players, matched by name, email or phone. Anyone already on the roster is
// filtered out in the store, so this never offers a duplicate.
//
// Sibling of `users/search` next door but a different question, hence a
// different route: that one finds people to *help run* the league and is
// creator-only, this one finds people to *play in* it. Results carry contact
// numbers and emails because they become the new card, which is why this is
// gated on `requireLeagueManager` and marked `private, no-store`.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return NextResponse.json([]);

    const candidates = await searchUserCandidatesForLeague(id, q);
    return NextResponse.json(candidates, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error searching player candidates:', error);
    return NextResponse.json({ error: 'Failed to search accounts' }, { status: 500 });
  }
}
