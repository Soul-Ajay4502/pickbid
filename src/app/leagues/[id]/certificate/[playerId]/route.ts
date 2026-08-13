// GET /leagues/[id]/certificate/[playerId] — a player's participation
// certificate as a PNG.
//
// Unlike /wrapped/poster this is NOT public. A certificate carries a named
// individual's participation record, so it's served only to the player it
// belongs to or to an organizer of that league — and only once the organizers
// have released certificates for the league. Everything else is a 404, which
// also keeps an unreleased league from leaking that it exists.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCertificateForPlayer, getLeague, canManageLeague } from '@/lib/store';
import { renderCertificate } from './certificate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const result = await getCertificateForPlayer(id, playerId);
    if (!result) {
      return NextResponse.json({ error: 'Certificate not available' }, { status: 404 });
    }

    // The player themselves, or an organizer handing certificates out
    const isOwnCard = result.playerUserId === userId;
    if (!isOwnCard) {
      const league = await getLeague(id);
      if (!league || !(await canManageLeague(userId, league))) {
        return NextResponse.json({ error: 'Not your certificate' }, { status: 403 });
      }
    }

    return await renderCertificate(result.certificate);
  } catch (error) {
    console.error('Error rendering certificate:', error);
    return NextResponse.json({ error: 'Failed to render certificate' }, { status: 500 });
  }
}
