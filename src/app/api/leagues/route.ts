import { NextRequest, NextResponse } from 'next/server';
import { getLeaguesByCreator, getLeaguesJoinedByUser, getLeaguesCoOrganizedByUser, createLeague } from '@/lib/store';
import { parsePickPreference } from '@/lib/types';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const [created, joinedRaw, coOrganizing] = await Promise.all([
      getLeaguesByCreator(session.user.id),
      getLeaguesJoinedByUser(session.user.id),
      getLeaguesCoOrganizedByUser(session.user.id),
    ]);
    // A co-organizer who also has a player card would show up twice — the
    // management role is the more meaningful listing, so it wins
    const coOrganizingIds = new Set(coOrganizing.map((l) => l.id));
    const joined = joinedRaw.filter((l) => !coOrganizingIds.has(l.id));
    return NextResponse.json({ created, coOrganizing, joined });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const { name, totalPlayers, conductedBy, templateId, logoUrl, pickPreference } = body;

    if (!name || !totalPlayers || !conductedBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedPickPreference = parsePickPreference(pickPreference);
    if (parsedPickPreference === undefined) {
      return NextResponse.json({ error: 'Invalid pick preference' }, { status: 400 });
    }

    const league = await createLeague({
      name,
      totalPlayers: Number(totalPlayers),
      conductedBy,
      creatorId: session.user.id,
      creatorEmail: session.user.email,
      templateId: templateId ?? 'classic-green',
      logoUrl: logoUrl ?? '',
      pickPreference: parsedPickPreference,
    });

    return NextResponse.json(league, { status: 201 });
  } catch (error) {
    console.error('Error creating league:', error);
    return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
  }
}
