import { NextRequest, NextResponse } from 'next/server';
import { getLeagueByJoinCode } from '@/lib/store';

export async function POST(request: NextRequest) {
  const { code } = await request.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code required' }, { status: 400 });
  }
  const league = await getLeagueByJoinCode(code.trim().toUpperCase());
  if (!league) return NextResponse.json({ error: 'Invalid join code' }, { status: 404 });
  return NextResponse.json({ leagueId: league.id, name: league.name });
}
