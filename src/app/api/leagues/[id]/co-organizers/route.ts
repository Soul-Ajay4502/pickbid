import { NextRequest, NextResponse } from 'next/server';
import { getCoOrganizers, addCoOrganizer, CoOrganizerError } from '@/lib/store';
import { requireLeagueCreator } from '@/lib/leagueAuth';

// Only the creator manages the co-organizer list — co-organizers can never
// add or remove other co-organizers (or themselves).

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status } = await requireLeagueCreator(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    return NextResponse.json(await getCoOrganizers(id));
  } catch (error) {
    console.error('Error listing co-organizers:', error);
    return NextResponse.json({ error: 'Failed to list co-organizers' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, league, userId: creatorId } = await requireLeagueCreator(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const { userId } = await request.json();
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    try {
      const coOrganizer = await addCoOrganizer(league, userId, creatorId);
      return NextResponse.json(coOrganizer, { status: 201 });
    } catch (err) {
      if (err instanceof CoOrganizerError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error adding co-organizer:', error);
    return NextResponse.json({ error: 'Failed to add co-organizer' }, { status: 500 });
  }
}
