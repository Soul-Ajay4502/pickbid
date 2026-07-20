import { NextRequest, NextResponse } from 'next/server';
import { resetAuction, clearAuctionLive } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

// Reset the auction — clears every sold player and unsold flag so it can be
// run again. Organizers only; pre-assigned icon players keep their team.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error) return NextResponse.json({ error }, { status });
    const reset = await resetAuction(id);
    await clearAuctionLive(id); // wipe the live board so spectators see a clean slate
    return NextResponse.json({ success: true, reset });
  } catch (error) {
    console.error('Error resetting auction:', error);
    return NextResponse.json({ error: 'Failed to reset auction' }, { status: 500 });
  }
}
