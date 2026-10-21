import type { PossibleMatch } from './types';
import { countPairings, countParticipation } from './pairs';
import { assignRounds } from './sequence';

/**
 * How a valid fixture compares with another for the same teams — lower is
 * better. Only ever used to choose between fixtures that already pass
 * `validateFixture`: validity first, polish second.
 *
 * Weights, roughly in order of what a league notices:
 * - 20 per match of spread between the busiest and the idlest team
 * - 4 per round beyond the fewest possible (rounds are what become match days)
 * - 3 per back-to-back appearance, 1 per appearance with a single match of rest
 * - 2 per repeat meeting beyond spreading rematches evenly
 * - 1 per match a team is home-heavy or away-heavy
 *
 * There is no venue data yet; a venue-balance term belongs here when there is.
 */
export function scoreFixture(matches: readonly PossibleMatch[], teamIds: readonly string[]): number {
  if (!matches.length) return 0;
  const n = teamIds.length;
  const participation = [...countParticipation(teamIds, matches).values()];
  const spread = Math.max(...participation) - Math.min(...participation);

  const rounds = assignRounds(matches);
  const fewestRounds = Math.max(Math.max(...participation), Math.ceil(matches.length / Math.max(1, Math.floor(n / 2))));
  const extraRounds = rounds[rounds.length - 1] - fewestRounds;

  let backToBack = 0;
  let shortRest = 0;
  const last = new Map<string, number>();
  const home = new Map<string, number>();
  matches.forEach((m, pos) => {
    for (const id of [m.teamAId, m.teamBId]) {
      const prev = last.get(id);
      if (prev === pos - 1) backToBack++;
      else if (prev === pos - 2) shortRest++;
      last.set(id, pos);
    }
    home.set(m.teamAId, (home.get(m.teamAId) ?? 0) + 1);
  });

  // Sum of squared meetings is smallest when repeats are spread evenly; measure
  // it against that floor so a fixture with no rematches scores zero here.
  const meetings = [...countPairings(matches).values()];
  const possiblePairs = Math.max(1, (n * (n - 1)) / 2);
  const base = Math.floor(matches.length / possiblePairs);
  const over = matches.length % possiblePairs;
  const floor = (possiblePairs - over) * base * base + over * (base + 1) * (base + 1);
  const repeats = meetings.reduce((s, c) => s + c * c, 0) - floor;

  let homeAway = 0;
  teamIds.forEach((id, i) => {
    const h = home.get(id) ?? 0;
    homeAway += Math.max(0, Math.abs(2 * h - participation[i]) - 1);
  });

  return spread * 20 + extraRounds * 4 + backToBack * 3 + shortRest + repeats * 2 + homeAway;
}
