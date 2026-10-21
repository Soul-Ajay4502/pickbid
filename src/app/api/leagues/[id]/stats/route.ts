import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getLeagueScoredLines, getPlayers, getTeams } from '@/lib/store';
import { aggregateLeagueStats } from '@/lib/scoring';

// Batting, bowling and fielding leaderboards built from the league's ball-by-
// ball scorecards. As open as the match list and the match centre it is built
// from. It reads the per-player lines each scorecard caches on save, never the
// event logs, so a season of scored matches stays one light query.
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const league = await getLeague(id);
    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

    const [scored, teams, players] = await Promise.all([getLeagueScoredLines(id), getTeams(id), getPlayers(id)]);
    const stats = aggregateLeagueStats(scored);
    // Card photos for the names on the boards — a guest has none
    const inStats = new Set([...stats.batting, ...stats.bowling, ...stats.fielding].map((r) => r.id));
    const photos = Object.fromEntries(
      players.filter((p) => inStats.has(p.id) && p.photo).map((p) => [p.id, p.photo]),
    );

    return NextResponse.json(
      {
        leagueName: league.name,
        teams: teams.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex })),
        photos,
        ...stats,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=0, must-revalidate',
          // A few seconds behind the last ball is fine for a leaderboard
          'CDN-Cache-Control': 'public, s-maxage=10',
        },
      },
    );
  } catch (error) {
    console.error('Error building league stats:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
