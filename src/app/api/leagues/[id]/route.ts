import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, updateLeague, setCertificatesReleased, deleteLeague, cleanupImages, AuctionRuleError } from '@/lib/store';
import { validSquadRange } from '@/lib/auctionRules';
import { getLeagueView } from '@/lib/leagueView';
import { requireLeagueManager, requireLeagueCreator } from '@/lib/leagueAuth';
import { isAdmin } from '@/lib/adminAuth';
import { auth } from '@/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, platformAdmin] = await Promise.all([auth(), isAdmin()]);
    // Visibility rules (roster trimming, organizer-only fields, co-organizer
    // emails) live in `getLeagueView`, shared with the server-rendered page.
    const view = await getLeagueView(id, { userId: session?.user?.id, platformAdmin });
    if (!view) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (error) {
    console.error('Error fetching league:', error);
    return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // League settings are shared management — co-organizers may edit them too
    const { error, status, league } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });
    const body = await request.json();
    const allowed = ['templateId', 'isPublic', 'joinCode', 'name', 'conductedBy', 'totalPlayers', 'logoUrl', 'registrationClosed', 'idProofRequired', 'paymentProofRequired', 'rosterVisibleToPlayers', 'playersCanDeleteCards'];
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    if ('minSquadSize' in body || 'maxSquadSize' in body) {
      const min = body.minSquadSize === undefined ? league.minSquadSize : body.minSquadSize;
      const max = body.maxSquadSize === undefined ? league.maxSquadSize : body.maxSquadSize;
      if (!validSquadRange(min, max)) {
        return NextResponse.json({ error: 'Squad sizes must be whole numbers: 11 ≤ minimum ≤ maximum ≤ 100' }, { status: 400 });
      }
      patch.minSquadSize = min;
      patch.maxSquadSize = max;
    }
    // The auction's base price: whole rupees, or null to switch the reserve
    // rule off. `assignPlayerToTeam` trusts this number, so it is clamped here.
    if ('basePrice' in body) {
      if (body.basePrice === null) {
        patch.basePrice = null;
      } else {
        const basePrice = Number(body.basePrice);
        if (!Number.isInteger(basePrice) || basePrice < 0 || basePrice > 1_000_000_000) {
          return NextResponse.json({ error: 'Base price must be a whole number of rupees' }, { status: 400 });
        }
        patch.basePrice = basePrice;
      }
    }
    let updated = await updateLeague(id, patch);
    // Certificates aren't a plain column write: the client sends a boolean and
    // the store stamps (or clears) the issue date printed on every certificate
    if (typeof body.certificatesReleased === 'boolean') {
      updated = await setCertificatesReleased(id, body.certificatesReleased);
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuctionRuleError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Error updating league:', error);
    return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Deleting a league is creator-only — co-organizers never get this
    const { error, status, league } = await requireLeagueCreator(id);
    if (error !== null) return NextResponse.json({ error }, { status });
    // Collect image URLs before the cascade delete wipes the player rows
    const players = await getPlayers(id);
    const imageUrls = [league.logoUrl, ...players.flatMap((p) => [p.photo, p.paymentProofUrl])];
    await deleteLeague(id);
    // After the delete, anything still referenced (e.g. a photo shared with a
    // user profile or another league) survives; the rest is removed from Cloudinary
    await cleanupImages(imageUrls);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting league:', error);
    return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
  }
}
