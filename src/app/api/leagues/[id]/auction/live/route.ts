import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getAuctionLive, setAuctionLive } from '@/lib/store';
import { auth } from '@/auth';
import type { LiveAuctionState, Player } from '@/lib/types';

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

// Creator-only — the auction control page broadcasts on every transition.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const league = await getLeague(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    if (league.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    };

    await setAuctionLive(id, state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error writing live auction state:', error);
    return NextResponse.json({ error: 'Failed to write live state' }, { status: 500 });
  }
}
