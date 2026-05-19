import { NextRequest, NextResponse } from 'next/server';
import { getLeagues, createLeague } from '@/lib/store';

export async function GET() {
  try {
    const leagues = await getLeagues();
    return NextResponse.json(leagues);
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, totalPlayers, conductedBy, creatorToken, templateId, logoUrl } = body;

    if (!name || !totalPlayers || !conductedBy || !creatorToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const league = await createLeague({
      name,
      totalPlayers: Number(totalPlayers),
      conductedBy,
      creatorToken,
      templateId: templateId ?? 'classic-green',
      logoUrl: logoUrl ?? '',
    });

    return NextResponse.json(league, { status: 201 });
  } catch (error) {
    console.error('Error creating league:', error);
    return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
  }
}
