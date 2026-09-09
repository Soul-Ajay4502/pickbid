// The league's document register — identity proofs and entry-fee receipts.
//
// Strictly organizer-grade: the response carries links to players' identity
// documents and payment screenshots, so it is gated on `requireLeagueManager`
// and marked `private, no-store`. There is deliberately no member-readable
// variant of this endpoint — unlike the ledger, nothing here is ever shared
// with players or spectators, and neither document may reach a card, poster
// or PDF.

import { NextRequest, NextResponse } from 'next/server';
import { getLeagueDocuments } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';
import type { LeagueDocumentsResponse } from '@/lib/types';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, league } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status, headers: PRIVATE });

    const players = await getLeagueDocuments(id);
    return NextResponse.json<LeagueDocumentsResponse>(
      {
        leagueName: league.name,
        idRequired: league.idProofRequired,
        paymentRequired: league.paymentProofRequired,
        players,
      },
      { headers: PRIVATE }
    );
  } catch (error) {
    console.error('Error fetching league documents:', error);
    return NextResponse.json({ error: 'Failed to fetch league documents' }, { status: 500, headers: PRIVATE });
  }
}
