import { NextRequest, NextResponse } from 'next/server';
import { getAuctionLive, setAuctionLive } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';
import type { LiveAuctionState, Player, PlayerRole } from '@/lib/types';

// Spectators poll this often — never cache, always read the latest blob.
export const dynamic = 'force-dynamic';

function stripContact<T extends Player | null>(p: T): T {
  return (p ? { ...p, contactNumber: null } : p) as T;
}

// Public — anyone with the watch link mirrors the auction in real time.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const state = await getAuctionLive(id);
    return NextResponse.json({ state }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error reading live auction state:', error);
    return NextResponse.json({ error: 'Failed to read live state' }, { status: 500 });
  }
}

// Organizers only (creator or co-organizer) — the auction control page
// broadcasts on every transition. Checked per request, so removing a
// co-organizer cuts off their broadcasts immediately.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, league } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const body = (await request.json()) as Partial<LiveAuctionState>;
    if (!body || typeof body.phase !== 'string') {
      return NextResponse.json({ error: 'Invalid live state' }, { status: 400 });
    }

    // Contact numbers are records-only — never let them reach the public board.
    const state: LiveAuctionState = {
      v: Number(body.v) || 0,
      phase: body.phase,
      updatedAt: Number(body.updatedAt) || 0,
      league: body.league ?? { name: league.name, conductedBy: league.conductedBy, logoUrl: league.logoUrl, templateId: league.templateId },
      current: stripContact(body.current ?? null),
      lastSold: body.lastSold
        ? { ...body.lastSold, player: stripContact(body.lastSold.player) }
        : null,
      progress: body.progress ?? { sold: 0, total: 0, unsold: 0, left: 0, round: 1 },
      purses: body.purses ?? [],
      // Mapped field by field for the same reason as `stripContact` above: a
      // fatter player object must not ride onto the public board through here.
      remaining: (Array.isArray(body.remaining) ? body.remaining : []).map((p) => ({
        name: String(p?.name ?? ''),
        role: p?.role as PlayerRole,
        isUnsold: !!p?.isUnsold,
      })),
    };

    await setAuctionLive(id, state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error writing live auction state:', error);
    return NextResponse.json({ error: 'Failed to write live state' }, { status: 500 });
  }
}
