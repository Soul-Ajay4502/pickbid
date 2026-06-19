import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getPlayers, getTeams, getOfficials, updateLeague, deleteLeague, cleanupImages } from '@/lib/store';
import { auth } from '@/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, league] = await Promise.all([auth(), getLeague(id)]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const [players, teams, officials] = await Promise.all([getPlayers(id), getTeams(id), getOfficials(id)]);
    const isCreator = session?.user?.id === league.creatorId;
    // Whether the requester has joined: matched by userId stamped at join time,
    // so it stays consistent across devices (unlike the old localStorage check)
    const userId = session?.user?.id;
    const hasJoined = !!userId && players.some((p) => p.userId === userId);
    const { creatorId, ...safeLeague } = league;
    // Resolve each icon player to the team they're pre-assigned to, so cards can show the badge
    const teamById = new Map(teams.map((tm) => [tm.id, tm]));
    const withIconTeam = players.map((p) => {
      const team = p.isIcon && p.teamId ? teamById.get(p.teamId) : null;
      return {
        ...p,
        iconOfTeam: team ? { id: team.id, name: team.name, colorHex: team.colorHex } : null,
      };
    });
    // Contact numbers are for the organiser's records only — never expose them to non-creators
    const safePlayers = isCreator ? withIconTeam : withIconTeam.map((p) => ({ ...p, contactNumber: null }));
    const safeOfficials = isCreator ? officials : officials.map((o) => ({ ...o, contactNumber: null }));
    return NextResponse.json({ ...safeLeague, players: safePlayers, teams, officials: safeOfficials, isCreator, hasJoined });
  } catch (error) {
    console.error('Error fetching league:', error);
    return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await request.json();
    const allowed = ['templateId', 'isPublic', 'joinCode', 'name', 'conductedBy', 'totalPlayers', 'logoUrl'];
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    const updated = await updateLeague(id, patch);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating league:', error);
    return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
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
    // Collect image URLs before the cascade delete wipes the player rows
    const players = await getPlayers(id);
    const imageUrls = [league.logoUrl, ...players.map((p) => p.photo)];
    await deleteLeague(id);
    // After the delete, anything still referenced (e.g. a photo shared with a
    // user profile or another league) survives; the rest is removed from Cloudinary
    await cleanupImages(imageUrls);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting league:', error);
    return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
  }
}
