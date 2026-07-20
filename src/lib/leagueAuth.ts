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
import { getLeague, canManageLeague } from './store';
import type { League } from './types';

export type LeagueAuthResult =
  | { error: string; status: 401 | 403 | 404; league: null; userId: null }
  | { error: null; status: 200; league: League; userId: string };

async function resolve(
  leagueId: string,
  allowed: (userId: string, league: League) => Promise<boolean> | boolean,
  forbiddenMessage: string
): Promise<LeagueAuthResult> {
  const [session, league] = await Promise.all([auth(), getLeague(leagueId)]);
  const userId = session?.user?.id;
  if (!userId) return { error: 'Unauthorised', status: 401, league: null, userId: null };
  if (!league) return { error: 'League not found', status: 404, league: null, userId: null };
  if (!(await allowed(userId, league))) {
    return { error: forbiddenMessage, status: 403, league: null, userId: null };
  }
  return { error: null, status: 200, league, userId };
}

/** Creator or co-organizer — the shared gate for league-management endpoints. */
export function requireLeagueManager(leagueId: string): Promise<LeagueAuthResult> {
  return resolve(
    leagueId,
    (userId, league) => canManageLeague(userId, league),
    'Only the league organizers can do this'
  );
}

/** Creator only — deleting the league, managing co-organizers. */
export function requireLeagueCreator(leagueId: string): Promise<LeagueAuthResult> {
  return resolve(
    leagueId,
    (userId, league) => userId === league.creatorId,
    'Only the league creator can do this'
  );
}
