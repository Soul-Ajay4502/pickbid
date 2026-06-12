import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getTeams, createTeam, updateTeam, deleteTeam } from '@/lib/store';
import { auth } from '@/auth';

async function getCreatorSession(leagueId: string) {
  const [session, league] = await Promise.all([auth(), getLeague(leagueId)]);
  if (!session?.user?.id) return { error: 'Unauthorised', status: 401, league: null };
  if (!league) return { error: 'League not found', status: 404, league: null };
  if (league.creatorId !== session.user.id) return { error: 'Forbidden', status: 403, league: null };
  return { error: null, status: 200, league };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teams = await getTeams(id);
  return NextResponse.json(teams);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await getCreatorSession(id);
  if (error) return NextResponse.json({ error }, { status });

  const { name, colorHex, budget, maxPlayers } = await request.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const squadSize = parseInt(maxPlayers, 10);
  if (maxPlayers !== undefined && (isNaN(squadSize) || squadSize < 1 || squadSize > 100)) {
    return NextResponse.json({ error: 'maxPlayers must be between 1 and 100' }, { status: 400 });
  }

  const team = await createTeam({
    leagueId: id,
    name,
    colorHex: colorHex ?? '#22c55e',
    budget: budget ?? 10000000,
    maxPlayers: isNaN(squadSize) ? 11 : squadSize,
  });
  return NextResponse.json(team, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await getCreatorSession(id);
  if (error) return NextResponse.json({ error }, { status });

  const { teamId, name, colorHex, budget, maxPlayers } = await request.json();
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  const team = await updateTeam(teamId, { name, colorHex, budget, maxPlayers });
  return NextResponse.json(team);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await getCreatorSession(id);
  if (error) return NextResponse.json({ error }, { status });

  const { teamId } = await request.json();
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  await deleteTeam(teamId);
  return NextResponse.json({ success: true });
}
