import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, createPlayer, getLeague } from '@/lib/store';
import { auth } from '@/auth';

const BATTING_TYPES = ['Right-Hand Bat', 'Left-Hand Bat'];
const BOWLING_TYPES = [
  'Right-Arm Fast', 'Right-Arm Medium', 'Right-Arm Off-Spin', 'Right-Arm Leg-Spin',
  'Left-Arm Fast', 'Left-Arm Medium', 'Left-Arm Spin', 'N/A',
];
const ROLES = ['Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper Batter'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [players, session, league] = await Promise.all([getPlayers(id), auth(), getLeague(id)]);
    // Phone numbers are records-only — strip them unless the requester is the league creator
    const isCreator = !!session?.user?.id && league?.creatorId === session.user.id;
    const safe = isCreator ? players : players.map((p) => ({ ...p, contactNumber: null }));
    return NextResponse.json(safe);
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
    const [session, league] = await Promise.all([auth(), getLeague(id)]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    // Once the creator closes registration, only they can still add cards
    // (via Add Player); public self-registration is rejected.
    const isCreator = !!session?.user?.id && league.creatorId === session.user.id;
    if (league.registrationClosed && !isCreator) {
      return NextResponse.json({ error: 'Registration is closed for this league' }, { status: 403 });
    }

    const body = await request.json();
    const { name, photo, battingType, bowlingType, role, isWicketKeeper, contactNumber, creatorToken } = body;

    if (!name || !battingType || !bowlingType || !role || !creatorToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
      return NextResponse.json({ error: 'Name must be 1–80 characters' }, { status: 400 });
    }
    if (!BATTING_TYPES.includes(battingType) || !BOWLING_TYPES.includes(bowlingType) || !ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid player details' }, { status: 400 });
    }
    if (typeof creatorToken !== 'string' || creatorToken.length < 8 || creatorToken.length > 128) {
      return NextResponse.json({ error: 'Invalid creator token' }, { status: 400 });
    }
    if (photo != null && (typeof photo !== 'string' || photo.length > 1000)) {
      return NextResponse.json({ error: 'Invalid photo URL' }, { status: 400 });
    }
    if (contactNumber != null && (typeof contactNumber !== 'string' || contactNumber.length > 40)) {
      return NextResponse.json({ error: 'Invalid contact number' }, { status: 400 });
    }

    const player = await createPlayer({
      leagueId: id,
      userId: session?.user?.id ?? null,
      name: name.trim(),
      photo: photo ?? '',
      battingType,
      bowlingType,
      role,
      isWicketKeeper: Boolean(isWicketKeeper),
      contactNumber: (typeof contactNumber === 'string' && contactNumber.trim()) || null,
      creatorToken,
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
  }
}
