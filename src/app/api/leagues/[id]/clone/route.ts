import { NextRequest, NextResponse } from 'next/server';
import { getLeague, cloneLeague, canManageLeague } from '@/lib/store';
import { parsePickPreference } from '@/lib/types';
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
    const { name, conductedBy, totalPlayers, templateId, logoUrl, pickPreference, includeTeams, includePlayers, includeOfficials, preserveAuctionResults } = body;

    const parsedPickPreference = parsePickPreference(pickPreference);
    if (pickPreference !== undefined && parsedPickPreference === undefined) {
      return NextResponse.json({ error: 'Invalid pick preference' }, { status: 400 });
    }

    const overrides = {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(conductedBy !== undefined && { conductedBy: String(conductedBy).trim() }),
      ...(totalPlayers !== undefined && { totalPlayers: Number(totalPlayers) }),
      ...(templateId !== undefined && { templateId }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(pickPreference !== undefined && { pickPreference: parsedPickPreference }),
    };

    const clone = await cloneLeague(id, session.user.id, session.user.email, overrides, {
      includeTeams,
      includePlayers,
      includeOfficials,
      preserveAuctionResults: Boolean(preserveAuctionResults),
      // Contact numbers are the organisers' private records — only carry them
      // over when the person cloning runs the source league (creator or
      // co-organizer; they can already see these numbers there)
      copyContactNumbers: await canManageLeague(session.user.id, source),
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    console.error('Error cloning league:', error);
    return NextResponse.json({ error: 'Failed to clone league' }, { status: 500 });
  }
}
