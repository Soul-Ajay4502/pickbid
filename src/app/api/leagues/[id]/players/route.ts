import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, createPlayer, getLeague, canManageLeague, findOrCreateUserIdByEmail, getCreatorOwnedPlayerUserId, hasIdentityProof, findDuplicatePlayer } from '@/lib/store';
import { stripOrganizerFields, visibleRoster } from '@/lib/utils';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/adminAuth';

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
    const [players, session, league, platformAdmin] = await Promise.all([getPlayers(id), auth(), getLeague(id), isAdmin()]);
    // Phone numbers and payment receipts are records-only — strip them unless
    // the requester runs this league (creator or co-organizer)
    // The owner console counts as managing — it has no Auth.js user for
    // `canManageLeague` to recognise, so it is checked by name, as in the league GET.
    const canManage = !!league && (platformAdmin || (await canManageLeague(session?.user?.id, league)));
    // Same closed-roster rule the league GET applies — a player gets their own
    // cards and the icon signings, nothing else.
    const rosterHidden = !!league && !canManage && !league.rosterVisibleToPlayers;
    const roster = rosterHidden ? visibleRoster(players, session?.user?.id) : players;
    const safe = canManage ? roster : roster.map(stripOrganizerFields);
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
    const [session, league, platformAdmin] = await Promise.all([auth(), getLeague(id), isAdmin()]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    // Once registration is closed, only the organizers (creator or
    // co-organizer) can still add cards via Add Player; public
    // self-registration is rejected.
    // The owner console manages every league but has no Auth.js user, so it is
    // recognised by name here, exactly as in the GET above.
    const isOrganizer = platformAdmin || (await canManageLeague(session?.user?.id, league));
    if (league.registrationClosed && !isOrganizer) {
      return NextResponse.json({ error: 'Registration is closed for this league' }, { status: 403 });
    }

    const body = await request.json();
    const { name, photo, battingType, bowlingType, role, isWicketKeeper, contactNumber, paymentProofUrl, creatorToken, email, sourcePlayerId, confirmDuplicate } = body;

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
    // No card without a photo — a player joining and an organizer adding one
    // alike, so the form, Join and Add from Accounts all answer to it here.
    // (The spreadsheet import has its own endpoint: a sheet can't carry photos.)
    if (typeof photo !== 'string' || !photo.trim()) {
      return NextResponse.json(
        { error: 'A player photo is required. Add a photo, then try again.' },
        { status: 400 }
      );
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
      // Reuse is scoped to the signed-in creator's own past cards; the owner
      // console has no such history to draw on.
      const reused = session?.user?.id
        ? await getCreatorOwnedPlayerUserId(session.user.id, sourcePlayerId)
        : undefined;
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

    // The same person registering twice — a double tap, a second device, an
    // organizer re-adding someone who already joined — is the commonest way a
    // roster goes wrong, and it is only discovered on auction night. So a card
    // matching one already here on phone number or name is held back with a
    // 409 until the caller repeats the request with `confirmDuplicate`: a
    // warning to confirm, not a ban, because namesakes and shared family
    // phones are real. The existing card's name goes only to organizers; a
    // stranger with the join link shouldn't learn whose number is on the roster.
    if (confirmDuplicate !== true) {
      const duplicate = await findDuplicatePlayer(id, name.trim(), typeof contactNumber === 'string' ? contactNumber : null);
      if (duplicate) {
        const error = duplicate.reason === 'phone'
          ? isOrganizer
            ? `${duplicate.name} is already in this league with this phone number.`
            : 'A player with this phone number is already in this league.'
          : `A player named ${duplicate.name} is already in this league.`;
        return NextResponse.json({ error, duplicate: duplicate.reason }, { status: 409 });
      }
    }

    const player = await createPlayer({
      leagueId: id,
      userId: playerUserId,
      name: name.trim(),
      photo: photo.trim(),
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
