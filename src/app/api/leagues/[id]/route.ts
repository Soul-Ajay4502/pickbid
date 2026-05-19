import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getPlayers, deleteLeague } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const league = getLeague(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const players = getPlayers(id);
    return NextResponse.json({ ...league, players });
  } catch (error) {
    console.error('Error fetching league:', error);
    return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { creatorToken } = await request.json();

    const league = getLeague(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    if (league.creatorToken !== creatorToken) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 403 });
    }

    deleteLeague(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting league:', error);
    return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
  }
}
