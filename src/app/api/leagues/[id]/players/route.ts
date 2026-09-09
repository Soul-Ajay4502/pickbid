import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, createPlayer, getLeague, canManageLeague, findOrCreateUserIdByEmail, getCreatorOwnedPlayerUserId, hasIdentityProof } from '@/lib/store';
import { stripOrganizerFields } from '@/lib/utils';
import { auth } from '@/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATTING_TYPES = ['Right-Hand Bat', 'Left-Hand Bat'];
const BOWLING_TYPES = [
  'Right-Arm Fast', 'Right-Arm Medium', 'Right-Arm Off-Spin', 'Right-Arm Leg-Spin',
  'Left-Arm Fast', 'Left-Arm Medium', 'Left-Arm Spin', 'N/A',
];
const ROLES = ['Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper Batter'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [players, session, league] = await Promise.all([getPlayers(id), auth(), getLeague(id)]);
    // Phone numbers and payment receipts are records-only — strip them unless
    // the requester runs this league (creator or co-organizer)
    const canManage = !!league && (await canManageLeague(session?.user?.id, league));
    const safe = canManage ? players : players.map(stripOrganizerFields);
    return NextResponse.json(safe);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, league] = await Promise.all([auth(), getLeague(id)]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    // Once registration is closed, only the organizers (creator or
    // co-organizer) can still add cards via Add Player; public
    // self-registration is rejected.
    const isOrganizer = await canManageLeague(session?.user?.id, league);
    if (league.registrationClosed && !isOrganizer) {
      return NextResponse.json({ error: 'Registration is closed for this league' }, { status: 403 });
    }

    const body = await request.json();
    const { name, photo, battingType, bowlingType, role, isWicketKeeper, contactNumber, paymentProofUrl, creatorToken, email, sourcePlayerId } = body;

    if (!name || !battingType || !bowlingType || !role || !creatorToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
      return NextResponse.json({ error: 'Name must be 1–80 characters' }, { status: 400 });
    }
    if (!BATTING_TYPES.includes(battingType) || !BOWLING_TYPES.includes(bowlingType) || !ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid player details' }, { status: 400 });
    }
    if (typeof creatorToken !== 'string' || creatorToken.length < 8 || creatorToken.length > 128) {
      return NextResponse.json({ error: 'Invalid creator token' }, { status: 400 });
    }
    if (photo != null && (typeof photo !== 'string' || photo.length > 1000)) {
      return NextResponse.json({ error: 'Invalid photo URL' }, { status: 400 });
    }
    if (contactNumber != null && (typeof contactNumber !== 'string' || contactNumber.length > 40)) {
      return NextResponse.json({ error: 'Invalid contact number' }, { status: 400 });
    }
    if (paymentProofUrl != null && (typeof paymentProofUrl !== 'string' || paymentProofUrl.length > 1000)) {
      return NextResponse.json({ error: 'Invalid payment proof URL' }, { status: 400 });
    }
    const paymentProof = (typeof paymentProofUrl === 'string' && paymentProofUrl.trim()) || null;

    // Resolve who this player card actually belongs to. An organizer adding
    // cards on other people's behalf must NOT have the card linked to their
    // own account — link it to the named player's own account instead.
    let playerUserId: string | null;
    if (!isOrganizer) {
      // Self-registration: the signed-in user is the player.
      playerUserId = session?.user?.id ?? null;
    } else if (sourcePlayerId != null) {
      // Reusing an existing player picked from search — no duplicate user.
      if (typeof sourcePlayerId !== 'string') {
        return NextResponse.json({ error: 'Invalid source player' }, { status: 400 });
      }
      const reused = await getCreatorOwnedPlayerUserId(session!.user!.id, sourcePlayerId);
      if (reused === undefined) {
        return NextResponse.json({ error: 'Invalid source player' }, { status: 400 });
      }
      playerUserId = reused;
    } else if (typeof email === 'string' && email.trim()) {
      if (!EMAIL_RE.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      playerUserId = await findOrCreateUserIdByEmail(email.trim());
    } else {
      playerUserId = session?.user?.id ?? null;;
    }
    // Leagues that require identity proof only hold *self-registration* to it:
    // the player signs in, so their profile is the one being checked. An
    // organizer adding a card on someone's behalf is not blocked — they chose
    // the requirement and may be collecting documents offline — and the gaps
    // show up on the league's identity register for them to chase.
    if (league.idProofRequired && !isOrganizer && !(await hasIdentityProof(playerUserId))) {
      return NextResponse.json(
        { error: 'This league requires an identity proof. Add one to your profile, then register.' },
        { status: 403 }
      );
    }
    if (league.paymentProofRequired && !isOrganizer && !paymentProof) {
      return NextResponse.json(
        { error: 'This league requires proof of the entry fee. Attach your payment receipt to register.' },
        { status: 403 }
      );
    }

    const player = await createPlayer({
      leagueId: id,
      userId: playerUserId,
      name: name.trim(),
      photo: photo ?? '',
      battingType,
      bowlingType,
      role,
      isWicketKeeper: Boolean(isWicketKeeper),
      contactNumber: (typeof contactNumber === 'string' && contactNumber.trim()) || null,
      paymentProofUrl: paymentProof,
      creatorToken,
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
  }
}
