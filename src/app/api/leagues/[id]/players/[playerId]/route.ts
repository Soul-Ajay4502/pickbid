import { NextRequest, NextResponse, after } from 'next/server';
import {
  getLeague, getPlayer, updatePlayer, deletePlayer, cleanupImages,
  assignPlayerToTeam, AuctionRuleError, getTeams, getOfficials,
} from '@/lib/store';
import { notifyPlayerSold } from '@/lib/whatsapp';
import { auth } from '@/auth';
import type { Player } from '@/lib/types';

// Card changes are allowed for the league creator (proven by session) or for
// whoever created the card (proven by the creatorToken minted at creation
// time and kept in that browser's localStorage).
async function canManagePlayer(
  leagueId: string,
  player: Player,
  creatorToken: string | null
): Promise<boolean> {
  if (creatorToken && creatorToken === player.creatorToken) return true;
  const session = await auth();
  if (!session?.user?.id) return false;
  const league = await getLeague(leagueId);
  return !!league && league.creatorId === session.user.id;
}

const UPDATABLE_FIELDS = [
  'name', 'photo', 'battingType', 'bowlingType', 'role', 'isWicketKeeper', 'contactNumber',
  'teamId', 'soldPrice', 'isUnsold', 'isIcon',
  'statsMatches', 'statsRuns', 'statsWickets', 'statsAverage', 'statsSR',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;
    const player = await getPlayer(playerId);
    if (!player || player.leagueId !== id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    // Phone number is records-only — return it only to the league creator or the card's owner
    const token = request.nextUrl.searchParams.get('creatorToken');
    const canManage = await canManagePlayer(id, player, token);
    return NextResponse.json(canManage ? player : { ...player, contactNumber: null });
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
    const player = await getPlayer(playerId);
    if (!player || player.leagueId !== id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const body = await request.json();
    const token = typeof body.creatorToken === 'string' ? body.creatorToken : null;
    if (!(await canManagePlayer(id, player, token))) {
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

    // A player was just sold to a team → WhatsApp them the team, their owner's
    // contact and the winning bid. Done after the response so it never delays or
    // breaks the sale; the team/owner lookups run inside the deferred work too.
    if (isSale) {
      const sold = updated;
      after(async () => {
        try {
          const teamId = sold.teamId!;
          const [teams, officials] = await Promise.all([getTeams(id), getOfficials(id)]);
          const owner =
            officials.find((o) => o.teamId === teamId && /owner/i.test(o.role) && o.contactNumber) ??
            officials.find((o) => o.teamId === teamId && o.contactNumber);
            if(player.contactNumber&&sold.soldPrice&&sold.soldPrice > 0) {
          await notifyPlayerSold({
            playerName: sold.name,
            contactNumber: sold.contactNumber ?? null,
            teamName: teams.find((t) => t.id === teamId)?.name ?? 'your team',
            ownerName: owner?.name ?? null,
            ownerNumber: owner?.contactNumber ?? null,
            soldPrice: sold.soldPrice ?? null,
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
    const player = await getPlayer(playerId);
    if (!player || player.leagueId !== id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const token = request.nextUrl.searchParams.get('creatorToken');
    if (!(await canManagePlayer(id, player, token))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await deletePlayer(playerId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
    }
    await cleanupImages([player.photo]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
