import { NextRequest, NextResponse } from 'next/server';
import {
  getLeague, canManageLeague, isLeagueMember, hasPublishedLedger, getLeagueNavCounts,
} from '@/lib/store';
import { isAdmin } from '@/lib/adminAuth';
import { auth } from '@/auth';
import type { LeagueNavSummary } from '@/lib/types';

// Everything the league sidebar needs to draw itself, and nothing else.
//
// The sidebar renders on *every* league screen, so it can't reuse
// `/api/leagues/[id]` — that payload carries the whole roster (~100 KB of
// player cards) and the sub-pages already fetch it for their own reasons.
// Loading it a second time per navigation, just to decide which links to show,
// would double the cost of the feature. Same reasoning as `can-manage`, which
// exists for exactly this on the watch screen.
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, league, platformAdmin] = await Promise.all([auth(), getLeague(id), isAdmin()]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const userId = session?.user?.id;
    // Same three tiers as the league GET, re-checked per request so a revoked
    // co-organizer loses the management group immediately. `isCreator` stays
    // strictly true-creator: Delete and Co-Organizers never move to the owner.
    const isCreator = userId === league.creatorId;
    const canManage = platformAdmin || (await canManageLeague(userId, league));
    const [isMember, ledgerPublished, counts] = await Promise.all([
      isLeagueMember(userId, league),
      hasPublishedLedger(id),
      getLeagueNavCounts(id),
    ]);

    const summary: LeagueNavSummary = {
      id: league.id,
      name: league.name,
      isPublic: league.isPublic,
      joinCode: league.joinCode,
      templateId: league.templateId,
      certificatesReleasedAt: league.certificatesReleasedAt,
      rosterVisibleToPlayers: league.rosterVisibleToPlayers,
      playersCanDeleteCards: league.playersCanDeleteCards,
      isCreator,
      canManage,
      isMember,
      ledgerPublished,
      playerCount: counts.players,
      hasAuctionData: counts.hasAuctionData,
    };
    // Every field here is answered per caller — this must never reach a shared
    // cache, or one visitor's management links would be served to the next.
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching league nav summary:', error);
    return NextResponse.json({ error: 'Failed to load league navigation' }, { status: 500 });
  }
}
