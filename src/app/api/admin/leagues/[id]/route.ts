import { NextRequest, NextResponse } from 'next/server';
import {
  getLeague, updateLeague, deleteLeague, setCertificatesReleased,
  resetAuction, clearAuctionLive,
} from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * Owner overrides on a single league. Unlike the organizer-facing PATCH at
 * `api/leagues/[id]`, this bypasses `requireLeagueManager` entirely — the owner
 * can act on any league without being its creator or a co-organizer.
 *
 * Body takes one action at a time:
 *   { isPublic }              — publish / unpublish
 *   { registrationClosed }    — open / close player registration
 *   { certificatesReleased }  — release / withdraw participation certificates
 *   { action: 'reset-auction' }   — clear every sale and unsold flag
 *   { action: 'clear-live' }      — drop the live spectator broadcast
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, status } = await requireAdmin();
    if (error) return NextResponse.json({ error }, { status });

    const { id } = await params;
    const league = await getLeague(id);
    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

    const body = await request.json();

    if (body.action === 'reset-auction') {
      const reset = await resetAuction(id);
      await clearAuctionLive(id);
      return NextResponse.json({ ok: true, reset });
    }

    if (body.action === 'clear-live') {
      await clearAuctionLive(id);
      return NextResponse.json({ ok: true });
    }

    // Certificates aren't a plain column write — the store stamps the issue
    // date that gets printed on every certificate, so it has its own setter.
    if (typeof body.certificatesReleased === 'boolean') {
      const updated = await setCertificatesReleased(id, body.certificatesReleased);
      return NextResponse.json({ ok: true, league: updated });
    }

    const patch: Record<string, boolean> = {};
    if (typeof body.isPublic === 'boolean') patch.isPublic = body.isPublic;
    if (typeof body.registrationClosed === 'boolean') patch.registrationClosed = body.registrationClosed;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No supported field in request' }, { status: 400 });
    }

    const updated = await updateLeague(id, patch);
    return NextResponse.json({ ok: true, league: updated });
  } catch (error) {
    console.error('Admin league update failed:', error);
    return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
  }
}

/**
 * Hard-delete any league on the platform. Irreversible: players, teams,
 * matches, officials, sponsors and the ledger all go with it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, status } = await requireAdmin();
    if (error) return NextResponse.json({ error }, { status });

    const { id } = await params;
    const deleted = await deleteLeague(id);
    if (!deleted) return NextResponse.json({ error: 'League not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin league delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
  }
}
