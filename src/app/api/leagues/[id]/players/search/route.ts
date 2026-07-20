import { NextRequest, NextResponse } from 'next/server';
import { searchPlayersByCreator } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

// Organizers only. Results always come from leagues the *requester* created
// (searchPlayersByCreator keys on their own id), so a co-organizer can reuse
// their own player history here but never browse someone else's.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, userId } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return NextResponse.json([]);

    const players = await searchPlayersByCreator(userId, q, id);
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error searching players:', error);
    return NextResponse.json({ error: 'Failed to search players' }, { status: 500 });
  }
}
