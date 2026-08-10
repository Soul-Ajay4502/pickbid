import type { Match, Team } from './types';

/**
 * A team's row in the points table. `team` is the full team so callers can show
 * its colour without a second lookup.
 */
export interface Standing {
  team: Team;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
}

/**
 * Builds the points table from recorded matches: 2 points for a win, 1 each for
 * a tie or no-result, 0 for a loss. Ordered by points, then wins.
 *
 * A match with no scores and no winner is treated as not yet played and is
 * skipped, which is how a fixture list can be published before any of it has
 * been played.
 *
 * Shared between the organizers' matches screen and the public league page so
 * the two can never show different tables for the same league.
 */
export function calcStandings(teams: Team[], matches: Match[]): Standing[] {
  const map: Record<string, Standing> = {};
  teams.forEach((t) => {
    map[t.id] = { team: t, played: 0, won: 0, lost: 0, tied: 0, points: 0 };
  });

  matches.forEach((m) => {
    if (!m.team1Score && !m.team2Score && !m.winnerTeamId) return; // unplayed
    const t1 = map[m.team1Id];
    const t2 = map[m.team2Id];
    if (!t1 || !t2) return;
    t1.played++;
    t2.played++;
    if (!m.winnerTeamId) {
      // no-result / tie
      t1.tied++;
      t2.tied++;
      t1.points++;
      t2.points++;
    } else if (m.winnerTeamId === m.team1Id) {
      t1.won++;
      t1.points += 2;
      t2.lost++;
    } else {
      t2.won++;
      t2.points += 2;
      t1.lost++;
    }
  });

  return Object.values(map).sort((a, b) => b.points - a.points || b.won - a.won);
}
