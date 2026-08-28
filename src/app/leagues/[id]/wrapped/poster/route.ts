// GET /leagues/[id]/wrapped/poster — the Auction Wrapped summary as a fixed
// 1080×1350 PNG. Ungated like the wrapped page itself: it shows only what the
// live spectator screen already broadcast (names, teams, winning bids).

import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getPlayers, getTeams } from '@/lib/store';
import { computeWrapped } from '@/lib/recap';
import { renderWrappedPoster } from './poster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const league = await getLeague(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const [players, teams] = await Promise.all([getPlayers(id), getTeams(id)]);
    // computeWrapped only reads players/teams/createdAt; contact numbers never
    // leave this handler
    const stats = computeWrapped({
      ...league,
      players,
      teams,
      officials: [],
      isCreator: false,
      canManage: false,
      coOrganizers: [],
      hasJoined: false,
      ledgerPublished: false,
      liveAuction: null,
    });
    if (stats.soldPlayers.length === 0) {
      return NextResponse.json({ error: 'Nothing to wrap yet' }, { status: 404 });
    }
    return await renderWrappedPoster(league, stats);
  } catch (error) {
    console.error('Error rendering wrapped poster:', error);
    return NextResponse.json({ error: 'Failed to render poster' }, { status: 500 });
  }
}
