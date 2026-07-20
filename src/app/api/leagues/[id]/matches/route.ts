import { NextRequest, NextResponse } from 'next/server';
import { getMatches, createMatch, deleteMatch } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matches = await getMatches(id);
  return NextResponse.json(matches);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireLeagueManager(id);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const { team1Id, team2Id, team1Score, team2Score, winnerTeamId, matchDate } = body;
  if (!team1Id || !team2Id) return NextResponse.json({ error: 'team1Id and team2Id required' }, { status: 400 });

  const match = await createMatch({ leagueId: id, team1Id, team2Id, team1Score, team2Score, winnerTeamId, matchDate });
  return NextResponse.json(match, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireLeagueManager(id);
  if (error) return NextResponse.json({ error }, { status });

  const { matchId } = await request.json();
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  await deleteMatch(matchId);
  return NextResponse.json({ success: true });
}
