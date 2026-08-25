// Shared route-handler authorization for league management.
//
// Two tiers:
//   requireLeagueManager — creator OR co-organizer. Every management endpoint
//     (auction control, players, teams, matches, officials, sponsors, league
//     settings) gates on this, and checks it on *every* request so removing a
//     co-organizer revokes their access immediately, not on next page load.
//   requireLeagueCreator — creator only. Reserved for deleting the league and
//     managing the co-organizer list itself.
//
// Server-only: pulls in `auth()` and the Sequelize store, so import it solely
// from route handlers / server code.

import { auth } from '@/auth';
import { isAdmin } from './adminAuth';
import { getLeague, canManageLeague } from './store';
import type { League } from './types';

export type LeagueAuthResult =
  | { error: string; status: 401 | 403 | 404; league: null; userId: null; isPlatformAdmin: false }
  | { error: null; status: 200; league: League; userId: string; isPlatformAdmin: boolean };

async function resolve(
  leagueId: string,
  allowed: (userId: string, league: League) => Promise<boolean> | boolean,
  forbiddenMessage: string,
  /** Whether an owner-console session satisfies this gate on its own. */
  adminMayPass: boolean
): Promise<LeagueAuthResult> {
  const [session, league, platformAdmin] = await Promise.all([
    auth(),
    getLeague(leagueId),
    adminMayPass ? isAdmin() : Promise.resolve(false),
  ]);
  const userId = session?.user?.id;
  // The owner console carries no Auth.js session, so it has to clear the
  // no-session gate too — but only for tiers it's allowed to satisfy.
  if (!userId && !platformAdmin) {
    return { error: 'Unauthorised', status: 401, league: null, userId: null, isPlatformAdmin: false };
  }
  if (!league) {
    return { error: 'League not found', status: 404, league: null, userId: null, isPlatformAdmin: false };
  }
  if (platformAdmin) {
    // The owner acts in the context of whoever created the league: the two
    // handlers that read `userId` off this result use it for the creator's own
    // player-search history and for ledger attribution, and the creator is the
    // right answer for both. `isPlatformAdmin` is there for anything that ever
    // needs to tell the two apart.
    return { error: null, status: 200, league, userId: league.creatorId, isPlatformAdmin: true };
  }
  if (!(await allowed(userId!, league))) {
    return { error: forbiddenMessage, status: 403, league: null, userId: null, isPlatformAdmin: false };
  }
  return { error: null, status: 200, league, userId: userId!, isPlatformAdmin: false };
}

/**
 * Creator or co-organizer — the shared gate for league-management endpoints.
 * A signed-in owner-console session also passes, so the owner can open any
 * league's management pages and see them in full.
 */
export function requireLeagueManager(leagueId: string): Promise<LeagueAuthResult> {
  return resolve(
    leagueId,
    (userId, league) => canManageLeague(userId, league),
    'Only the league organizers can do this',
    true
  );
}

/**
 * Creator only — deleting the league, managing co-organizers. The owner console
 * deliberately does *not* satisfy this one: reassigning someone else's
 * co-organizers stays with the real creator, and the owner already has league
 * deletion of its own at `api/admin/leagues/[id]`.
 */
export function requireLeagueCreator(leagueId: string): Promise<LeagueAuthResult> {
  return resolve(
    leagueId,
    (userId, league) => userId === league.creatorId,
    'Only the league creator can do this',
    false
  );
}
