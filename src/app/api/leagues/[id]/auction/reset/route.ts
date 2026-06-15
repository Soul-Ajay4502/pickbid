import { NextRequest, NextResponse } from 'next/server';
import { getLeague, resetAuction, clearAuctionLive } from '@/lib/store';
import { auth } from '@/auth';

// Reset the auction — clears every sold player and unsold flag so the creator
// can run it again. Creator-only; pre-assigned icon players keep their team.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const league = await getLeague(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    if (league.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const reset = await resetAuction(id);
    await clearAuctionLive(id); // wipe the live board so spectators see a clean slate
    return NextResponse.json({ success: true, reset });
  } catch (error) {
    console.error('Error resetting auction:', error);
    return NextResponse.json({ error: 'Failed to reset auction' }, { status: 500 });
  }
}
