import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Redis } from '@upstash/redis';
import { UserModel, LeagueModel, PlayerModel } from '@/lib/models';

type LegacyLeague = {
  id: string; name: string; totalPlayers: number; conductedBy: string;
  creatorId?: string; creatorEmail?: string; creatorToken?: string;
  templateId?: string; logoUrl?: string; createdAt?: string;
};
type LegacyPlayer = {
  id: string; leagueId: string; name: string; photo: string;
  battingType: string; bowlingType: string; role: string;
  isWicketKeeper: boolean; creatorToken: string; createdAt?: string;
};

/**
 * POST /api/migrate
 *
 * Imports existing Redis data into Neon (one-time, idempotent).
 * Run AFTER `npm run db:migrate` has created the tables.
 * Requires the caller to be signed in.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json(
      { error: 'Redis env vars not set — nothing to migrate' },
      { status: 400 }
    );
  }

  const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const [legacyLeagues, legacyPlayers] = await Promise.all([
    redis.get<LegacyLeague[]>('pcs:leagues'),
    redis.get<LegacyPlayer[]>('pcs:players'),
  ]);

  const defaultCreatorId    = session.user.id;
  const defaultCreatorEmail = session.user.email ?? '';
  let leagues = 0;
  let players = 0;

  if (legacyLeagues) {
    for (const ll of legacyLeagues) {
      const creatorId    = ll.creatorId    || defaultCreatorId;
      const creatorEmail = ll.creatorEmail || defaultCreatorEmail;

      await UserModel.findOrCreate({
        where:    { id: creatorId },
        defaults: { id: creatorId, email: creatorEmail },
      });

      const [, created] = await LeagueModel.findOrCreate({
        where:    { id: ll.id },
        defaults: {
          id:           ll.id,
          name:         ll.name,
          totalPlayers: ll.totalPlayers,
          conductedBy:  ll.conductedBy,
          creatorId,
          templateId:   ll.templateId ?? 'classic-green',
          logoUrl:      ll.logoUrl    ?? '',
        },
      });
      if (created) leagues++;
    }
  }

  if (legacyPlayers) {
    for (const p of legacyPlayers) {
      const [, created] = await PlayerModel.findOrCreate({
        where:    { id: p.id },
        defaults: {
          id:             p.id,
          leagueId:       p.leagueId,
          name:           p.name,
          photo:          p.photo          ?? '',
          battingType:    p.battingType,
          bowlingType:    p.bowlingType,
          role:           p.role,
          isWicketKeeper: p.isWicketKeeper ?? false,
          creatorToken:   p.creatorToken,
        },
      });
      if (created) players++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'Data imported from Redis to Neon.',
    migrated: { leagues, players },
  });
}
