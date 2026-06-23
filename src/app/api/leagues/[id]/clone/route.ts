import { NextRequest, NextResponse } from 'next/server';
import { getLeague, cloneLeague } from '@/lib/store';
import { auth } from '@/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const source = await getLeague(id);
    if (!source) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, conductedBy, totalPlayers, templateId, logoUrl, includeTeams, includePlayers, includeOfficials } = body;

    const overrides = {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(conductedBy !== undefined && { conductedBy: String(conductedBy).trim() }),
      ...(totalPlayers !== undefined && { totalPlayers: Number(totalPlayers) }),
      ...(templateId !== undefined && { templateId }),
      ...(logoUrl !== undefined && { logoUrl }),
    };

    const clone = await cloneLeague(id, session.user.id, session.user.email, overrides, {
      includeTeams,
      includePlayers,
      includeOfficials,
      // Contact numbers are the organiser's private records — only carry them
      // over when the person cloning owns the source league
      copyContactNumbers: source.creatorId === session.user.id,
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    console.error('Error cloning league:', error);
    return NextResponse.json({ error: 'Failed to clone league' }, { status: 500 });
  }
}
