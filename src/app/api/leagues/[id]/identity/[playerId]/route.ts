// Marking one player's entry fee as received — organizers only.
//
// This is deliberately its own endpoint rather than another field on the player
// PATCH: that handler also answers to a card's anonymous `creatorToken`, so a
// player holding their own card could tick themselves paid. The flag is the
// organizer's confirmation that money actually arrived, which makes
// `requireLeagueManager` the only acceptable gate — and, like the rest of the
// register, the response is `private, no-store`.

import { NextRequest, NextResponse } from 'next/server';
import { setPlayerPaymentReceived } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status, headers: PRIVATE });

    const body = await request.json();
    const paymentReceived = body?.paymentReceived;
    if (typeof paymentReceived !== 'boolean') {
      return NextResponse.json(
        { error: 'paymentReceived must be true or false' },
        { status: 400, headers: PRIVATE }
      );
    }

    // Scoped to this league inside the store, so a card id from another league
    // reads as "not here" rather than quietly flipping someone else's roster.
    const updated = await setPlayerPaymentReceived(id, playerId, paymentReceived);
    if (!updated) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404, headers: PRIVATE });
    }

    return NextResponse.json({ playerId, paymentReceived }, { headers: PRIVATE });
  } catch (error) {
    console.error('Error updating player payment status:', error);
    return NextResponse.json(
      { error: 'Failed to update payment status' },
      { status: 500, headers: PRIVATE }
    );
  }
}
