import { NextRequest, NextResponse } from 'next/server';
import { resetAuction, clearAuctionLive, recordAuctionChange, getUserDisplayName } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

// Reset the auction — clears every sold player and unsold flag so it can be
// run again. Organizers only; pre-assigned icon players keep their team.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, userId, isPlatformAdmin } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });
    const reset = await resetAuction(id);
    await clearAuctionLive(id); // wipe the live board so spectators see a clean slate
    // A reset wipes every result at once, so it is the one log line that most
    // needs a name beside it. Best-effort, like every other log write.
    try {
      await recordAuctionChange({
        leagueId: id, action: 'reset', source: 'other',
        playerId: null, playerName: `${reset} player${reset === 1 ? '' : 's'}`,
        fromTeamName: null, toTeamName: null, fromPrice: null, toPrice: null,
        // `requireLeagueManager` reports the creator's id for the owner console
        actorId: isPlatformAdmin ? null : userId,
        actorName: isPlatformAdmin ? 'Platform owner' : await getUserDisplayName(userId),
      });
    } catch (err) {
      console.error('[auction-log] could not record reset:', err);
    }
    return NextResponse.json({ success: true, reset });
  } catch (error) {
    console.error('Error resetting auction:', error);
    return NextResponse.json({ error: 'Failed to reset auction' }, { status: 500 });
  }
}
