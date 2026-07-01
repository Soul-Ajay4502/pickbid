import { NextResponse } from 'next/server';
import { getTopBids } from '@/lib/store';

// Public, always fresh — the board reflects sales as they happen.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bids = await getTopBids(20);
    return NextResponse.json(bids, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching global leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
