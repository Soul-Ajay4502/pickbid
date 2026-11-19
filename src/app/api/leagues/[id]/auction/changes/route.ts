import { NextRequest, NextResponse } from 'next/server';
import { getAuctionChanges } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

// The auction change log — who sold, moved, repriced or removed which player,
// and when.
//
// Organizers only, and `private, no-store`: it names the organizer behind each
// change, which is the point of it for the people running the league and
// nobody else's business. There is no public or member-readable variant; the
// results themselves are already public on the team pages.
const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status, headers: PRIVATE });
    return NextResponse.json({ changes: await getAuctionChanges(id) }, { headers: PRIVATE });
  } catch (error) {
    console.error('Error reading auction change log:', error);
    return NextResponse.json({ error: 'Failed to read the change log' }, { status: 500, headers: PRIVATE });
  }
}
