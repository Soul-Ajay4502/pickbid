import { NextRequest, NextResponse } from 'next/server';
import { getTeams, getPlayers, createTeam, updateTeam, deleteTeam } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

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
  try {
    const { id } = await params;
    const { error, status, league } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });
    const { name, colorHex, budget, maxPlayers } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const squadSize = maxPlayers === undefined ? 11 : Number(maxPlayers);
    if (!Number.isInteger(squadSize) || squadSize < 1 || squadSize > 100) {
      return NextResponse.json({ error: 'maxPlayers must be a whole number between 1 and 100' }, { status: 400 });
    }

    const team = await createTeam({
      leagueId: id,
      name,
      colorHex: colorHex ?? '#22c55e',
      budget: budget ?? 10000000,
      maxPlayers: league.maxSquadSize ?? squadSize,
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status, league } = await requireLeagueManager(id);
  if (error !== null) return NextResponse.json({ error }, { status });

  try {
    const { teamId, name, colorHex, budget, maxPlayers } = await request.json();
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    const [teams, players] = await Promise.all([getTeams(id), getPlayers(id)]);
    const current = teams.find((t) => t.id === teamId);
    if (!current) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const patch: { name?: string; colorHex?: string; budget?: number; maxPlayers?: number } = {};
    if (typeof name === 'string') {
      const trimmed = name.trim().slice(0, 80);
      if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 });
      patch.name = trimmed;
    }
    if (typeof colorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(colorHex)) patch.colorHex = colorHex;

    // The purse and the squad size are the auction's rules for this team, so
    // they can change only while the auction still has someone to sell — once
    // every player has a team, the results stand on the numbers they were
    // bought under. Neither may drop below what the team has already used.
    const squad = players.filter((p) => p.teamId === teamId);
    const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    const playersLeft = players.some((p) => !p.teamId);
    if (budget !== undefined && Number(budget) !== current.budget) {
      const next = Number(budget);
      if (!Number.isInteger(next) || next < 1 || next > 2_000_000_000) {
        return NextResponse.json({ error: 'Budget must be a whole number of rupees' }, { status: 400 });
      }
      if (!playersLeft) return NextResponse.json({ error: 'The budget can’t change once no players are left for auction' }, { status: 409 });
      if (next < spent) return NextResponse.json({ error: `${current.name} has already spent more than that` }, { status: 409 });
      patch.budget = next;
    }
    if (maxPlayers !== undefined && Number(maxPlayers) !== current.maxPlayers) {
      if (league.maxSquadSize !== null) {
        return NextResponse.json({ error: 'Squad limits are shared — edit Manage → Squad Limits instead' }, { status: 409 });
      }
      const next = Number(maxPlayers);
      if (!Number.isInteger(next) || next < 1 || next > 100) {
        return NextResponse.json({ error: 'Players per team must be between 1 and 100' }, { status: 400 });
      }
      if (!playersLeft) return NextResponse.json({ error: 'The squad size can’t change once no players are left for auction' }, { status: 409 });
      if (next < squad.length) return NextResponse.json({ error: `${current.name} already has ${squad.length} players` }, { status: 409 });
      patch.maxPlayers = next;
    }

    const team = await updateTeam(teamId, patch);
    return NextResponse.json(team);
  } catch (err) {
    console.error('Error updating team:', err);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireLeagueManager(id);
  if (error) return NextResponse.json({ error }, { status });

  const { teamId } = await request.json();
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  await deleteTeam(teamId);
  return NextResponse.json({ success: true });
}
