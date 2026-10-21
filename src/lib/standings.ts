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
  /**
   * Net run rate across the team's ball-by-ball scored results, or null if it
   * has none — a hand-entered score line is free text and can't be trusted to
   * carry overs.
   */
  nrr: number | null;
}

interface RunRateTotals {
  runsFor: number;
  oversFaced: number;
  runsAgainst: number;
  oversBowled: number;
}

/**
 * Adds one scored result to the NRR totals. As in the playing conditions: only
 * matches with a result count (no abandonments or walkovers), super overs are
 * left out, and a side bowled out is charged its full quota of overs.
 */
function addRunRates(totals: Map<string, RunRateTotals>, m: Match): void {
  const s = m.scoring;
  if (!s || s.phase !== 'completed' || !s.result) return;
  if (s.result.kind !== 'won' && s.result.kind !== 'tie') return;
  const main = s.innings.filter((i) => !i.superOver);
  if (main.length !== 2) return;
  for (const inn of main) {
    const opponent = main.find((i) => i !== inn)!.teamId;
    const overs = (inn.allOut ? inn.maxBalls : inn.balls) / s.ballsPerOver;
    const bat = totals.get(inn.teamId);
    const bowl = totals.get(opponent);
    if (!bat || !bowl) return;
    bat.runsFor += inn.runs;
    bat.oversFaced += overs;
    bowl.runsAgainst += inn.runs;
    bowl.oversBowled += overs;
  }
}

/**
 * Builds the points table from recorded matches: 2 points for a win, 1 each for
 * a tie or no-result, 0 for a loss. Ordered by points, then net run rate, then
 * wins.
 *
 * A match with no scores and no winner is treated as not yet played and is
 * skipped, which is how a fixture list can be published before any of it has
 * been played. A match being scored live has neither until it finishes.
 *
 * Shared between the organizers' matches screen and the public league page so
 * the two can never show different tables for the same league.
 */
export function calcStandings(teams: Team[], matches: Match[]): Standing[] {
  const map: Record<string, Standing> = {};
  const rates = new Map<string, RunRateTotals>();
  teams.forEach((t) => {
    map[t.id] = { team: t, played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: null };
    rates.set(t.id, { runsFor: 0, oversFaced: 0, runsAgainst: 0, oversBowled: 0 });
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
    addRunRates(rates, m);
  });

  for (const [teamId, r] of rates) {
    if (r.oversFaced > 0 && r.oversBowled > 0) {
      map[teamId].nrr = Math.round((r.runsFor / r.oversFaced - r.runsAgainst / r.oversBowled) * 1000) / 1000;
    }
  }

  return Object.values(map).sort(
    (a, b) => b.points - a.points || (b.nrr ?? 0) - (a.nrr ?? 0) || b.won - a.won
  );
}

/** "+1.234", "-0.500" — NRR as tables print it. */
export function formatNrr(nrr: number | null): string {
  if (nrr === null) return '—';
  return `${nrr > 0 ? '+' : ''}${nrr.toFixed(3)}`;
}
