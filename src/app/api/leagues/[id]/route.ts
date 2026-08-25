import { NextRequest, NextResponse } from 'next/server';
import { getLeague, getPlayers, getTeams, getOfficials, getCoOrganizers, hasPublishedLedger, updateLeague, setCertificatesReleased, deleteLeague, cleanupImages } from '@/lib/store';
import { requireLeagueManager, requireLeagueCreator } from '@/lib/leagueAuth';
import { isAdmin } from '@/lib/adminAuth';
import { auth } from '@/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, league, platformAdmin] = await Promise.all([auth(), getLeague(id), isAdmin()]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const [players, teams, officials, coOrganizers, ledgerPublished] = await Promise.all([
      getPlayers(id), getTeams(id), getOfficials(id), getCoOrganizers(id), hasPublishedLedger(id),
    ]);
    const userId = session?.user?.id;
    const isCreator = userId === league.creatorId;
    // Creator or co-organizer — either can manage the league and run its
    // auction. The owner console is folded in here so the owner opening a
    // league from `/admin` gets the full organizer view of it; `isCreator`
    // stays strictly true-creator, so the creator-only actions don't move.
    const canManage = isCreator || platformAdmin || (!!userId && coOrganizers.some((c) => c.userId === userId));
    // Whether the requester has joined: matched by userId stamped at join time,
    // so it stays consistent across devices (unlike the old localStorage check)
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
    // Contact numbers are for the organisers' records only — never expose them
    // to anyone who isn't running this league (creator or co-organizer)
    const safePlayers = canManage ? withIconTeam : withIconTeam.map((p) => ({ ...p, contactNumber: null }));
    const safeOfficials = canManage ? officials : officials.map((o) => ({ ...o, contactNumber: null }));
    // Co-organizer names/photos are public (they're shown as badges), but their
    // emails are only the creator's business — they power the manage list
    const safeCoOrganizers = (isCreator || platformAdmin)
      ? coOrganizers
      : coOrganizers.map((c) => ({ ...c, email: null }));
    // isCreator/canManage/hasJoined first, before the (potentially large) players
    // array, so they're easy to find in the response rather than buried after it
    // Only whether a *published* ledger exists — the sheet itself, and the
    // existence of any draft, stay behind /api/leagues/[id]/ledger
    return NextResponse.json({ ...safeLeague, isCreator, canManage, hasJoined, ledgerPublished, coOrganizers: safeCoOrganizers, players: safePlayers, teams, officials: safeOfficials });
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
    // League settings are shared management — co-organizers may edit them too
    const { error, status } = await requireLeagueManager(id);
    if (error) return NextResponse.json({ error }, { status });
    const body = await request.json();
    const allowed = ['templateId', 'isPublic', 'joinCode', 'name', 'conductedBy', 'totalPlayers', 'logoUrl', 'registrationClosed'];
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    let updated = await updateLeague(id, patch);
    // Certificates aren't a plain column write: the client sends a boolean and
    // the store stamps (or clears) the issue date printed on every certificate
    if (typeof body.certificatesReleased === 'boolean') {
      updated = await setCertificatesReleased(id, body.certificatesReleased);
    }
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
    // Deleting a league is creator-only — co-organizers never get this
    const { error, status, league } = await requireLeagueCreator(id);
    if (error !== null) return NextResponse.json({ error }, { status });
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
