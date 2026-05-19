import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, createPlayer, getLeague } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const players = await getPlayers(id);
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const league = await getLeague(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, photo, battingType, bowlingType, role, isWicketKeeper, creatorToken } = body;

    if (!name || !battingType || !bowlingType || !role || !creatorToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const player = await createPlayer({
      leagueId: id,
      name,
      photo: photo ?? '',
      battingType,
      bowlingType,
      role,
      isWicketKeeper: Boolean(isWicketKeeper),
      creatorToken,
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
  }
}
