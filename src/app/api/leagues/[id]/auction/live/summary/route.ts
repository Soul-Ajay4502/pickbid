import { NextRequest, NextResponse } from 'next/server';
import { getAuctionLiveSummary } from '@/lib/store';

// Polled by the league page every 30s so its LIVE banner appears and clears
// without a reload, which the full league payload is far too heavy for.
export const dynamic = 'force-dynamic';

// Public, exactly like the watch screen it advertises: that an auction is
// running is already visible to anyone holding the link. The summary carries no
// players, purses or contact numbers — only phase, round and sold counts.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const live = await getAuctionLiveSummary(id);
    return NextResponse.json({ live }, {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        // Same trick as the board itself, with a longer beat: a LIVE banner
        // that lags five seconds costs nobody anything.
        'CDN-Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    console.error('Error reading live auction summary:', error);
    return NextResponse.json({ error: 'Failed to read live summary' }, { status: 500 });
  }
}
