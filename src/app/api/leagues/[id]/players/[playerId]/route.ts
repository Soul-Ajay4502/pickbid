import { NextRequest, NextResponse, after } from 'next/server';
import {
  getLeague, getPlayer, updatePlayer, deletePlayer, cleanupImages,
  assignPlayerToTeam, AuctionRuleError, canManageLeague, getTeams, getOfficials,
} from '@/lib/store';
import { notifyPlayerSold } from '@/lib/whatsapp';
import { isAdmin } from '@/lib/adminAuth';
import { auth } from '@/auth';
import type { League, Player } from '@/lib/types';
import { stripOrganizerFields } from '@/lib/utils';

/**
 * Who the caller is, relative to one player card. Resolved once per request
 * because the league's own switches — `rosterVisibleToPlayers`,
 * `playersCanDeleteCards` — decide what each of these two identities is worth,
 * so neither can be answered by a bare boolean any more.
 */
interface CardAccess {
  /** Holds the card's `creatorToken` — the anonymous proof minted at creation. */
  isCardOwner: boolean;
  /**
   * Runs this league: creator, co-organizer, or the platform owner. Re-checked
   * on every request, so a removed co-organizer loses access instantly.
   */
  isOrganizer: boolean;
  /** The signed-in account, when there is one. */
  viewerUserId: string | null;
}

async function resolveCardAccess(
  league: League,
  player: Player,
  creatorToken: string | null
): Promise<CardAccess> {
  const [session, platformAdmin] = await Promise.all([auth(), isAdmin()]);
  const viewerUserId = session?.user?.id ?? null;
  return {
    isCardOwner: !!creatorToken && creatorToken === player.creatorToken,
    isOrganizer: platformAdmin || (await canManageLeague(viewerUserId, league)),
    viewerUserId,
  };
}

/** Editing a card: unchanged by either switch — organizers or the card's holder. */
const canEditCard = (a: CardAccess) => a.isCardOwner || a.isOrganizer;

const UPDATABLE_FIELDS = [
  'name', 'photo', 'battingType', 'bowlingType', 'role', 'isWicketKeeper', 'contactNumber', 'paymentProofUrl',
  'teamId', 'soldPrice', 'isUnsold', 'isIcon',
  'statsMatches', 'statsRuns', 'statsWickets', 'statsAverage', 'statsSR',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const [player, league] = await Promise.all([getPlayer(playerId), getLeague(id)]);
    if (!player || !league || player.leagueId !== id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    const token = request.nextUrl.searchParams.get('creatorToken');
    const access = await resolveCardAccess(league, player, token);
    // Closed roster: someone else's card is not just redacted, it's withheld —
    // a 404 matching the one a non-existent card gets, so this endpoint can't be
    // walked to confirm who is in the league. Icons stay visible (they're
    // announced signings) and so does the viewer's own card.
    const ownCard = !!access.viewerUserId && player.userId === access.viewerUserId;
    if (!canEditCard(access) && !league.rosterVisibleToPlayers && !player.isIcon && !ownCard) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    // Phone number and payment receipt are records-only — return them only to
    // the league organizers or the card's own holder
    return NextResponse.json(canEditCard(access) ? player : stripOrganizerFields(player));
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const [player, league] = await Promise.all([getPlayer(playerId), getLeague(id)]);
    if (!player || !league || player.leagueId !== id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const body = await request.json();
    const token = typeof body.creatorToken === 'string' ? body.creatorToken : null;
    // A locked-down roster never blocks *editing* — a player keeps control of
    // their own photo, stats and details whatever the organizer has switched off
    if (!canEditCard(await resolveCardAccess(league, player, token))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) =>
        (UPDATABLE_FIELDS as readonly string[]).includes(k)
      )
    ) as Partial<Player>;

    let updated: Player | null;
    let isSale = false;
    if (typeof patch.teamId === 'string' && patch.teamId) {
      // Assigning to a team — enforce squad-size/budget rules atomically
      const soldPrice = patch.soldPrice == null ? null : Number(patch.soldPrice);
      if (soldPrice != null && (!Number.isFinite(soldPrice) || soldPrice < 0)) {
        return NextResponse.json({ error: 'Invalid sold price' }, { status: 400 });
      }
      const rest = { ...patch };
      delete rest.teamId;
      delete rest.soldPrice;
      try {
        updated = await assignPlayerToTeam(playerId, patch.teamId, soldPrice, rest);
        isSale = true;
      } catch (err) {
        if (err instanceof AuctionRuleError) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
      }
    } else {
      updated = await updatePlayer(playerId, patch);
    }

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
    }
    // Photo replaced or removed → drop the old Cloudinary asset if nothing else uses it
    if (typeof patch.photo === 'string' && patch.photo !== player.photo) {
      await cleanupImages([player.photo]);
    }
    // Same for a replaced receipt — nothing else ever points at it
    if (typeof patch.paymentProofUrl === 'string' && patch.paymentProofUrl !== player.paymentProofUrl) {
      await cleanupImages([player.paymentProofUrl]);
    }

    // A player was just sold to a team → WhatsApp them the team, their owner's
    // contact and the winning bid. Done after the response so it never delays or
    // breaks the sale; the team/owner lookups run inside the deferred work too.
    if (isSale) {
      const sold = updated;
      after(async () => {
        try {
          const teamId = sold.teamId!;
          const [teams, officials, league] = await Promise.all([
            getTeams(id), getOfficials(id), getLeague(id),
          ]);
          const owner =
            officials.find((o) => o.teamId === teamId && /owner/i.test(o.role) && o.contactNumber) ??
            officials.find((o) => o.teamId === teamId && o.contactNumber);
          const soldDate = new Date().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
          });
            if(player.contactNumber&&sold.soldPrice&&sold.soldPrice > 0) {
          await notifyPlayerSold({
            playerName: sold.name,
            contactNumber: sold.contactNumber ?? null,
            teamName: teams.find((t) => t.id === teamId)?.name ?? 'your team',
            ownerName: owner?.name ?? null,
            ownerNumber: owner?.contactNumber ?? null,
            soldPrice: sold.soldPrice ?? null,
            leagueName: league?.name ?? null,
            soldDate,
          });
        }
        } catch (err) {
          console.error('[whatsapp] player-sold notification failed:', err);
        }
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const [player, league] = await Promise.all([getPlayer(playerId), getLeague(id)]);
    if (!player || !league || player.leagueId !== id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const token = request.nextUrl.searchParams.get('creatorToken');
    const access = await resolveCardAccess(league, player, token);
    // With `playersCanDeleteCards` off, holding the card's creatorToken stops
    // being enough: only the league's organizers can withdraw a card. Distinct
    // message from a plain Forbidden so the holder knows it's the league's rule
    // rather than a lost token.
    if (!access.isOrganizer && access.isCardOwner && !league.playersCanDeleteCards) {
      return NextResponse.json(
        { error: 'The organizers have turned off player card deletion for this league. Ask them to remove it.' },
        { status: 403 }
      );
    }
    if (!access.isOrganizer && !access.isCardOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await deletePlayer(playerId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
    }
    await cleanupImages([player.photo, player.paymentProofUrl]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
