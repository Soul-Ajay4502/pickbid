/**
 * Round-robin rounds by the circle method: fix one team and rotate the rest,
 * which guarantees every team plays every other exactly once and — crucially
 * for a one-day tournament — plays at most once per round.
 *
 * With an odd number of teams a "bye" placeholder is added, so each round leaves
 * exactly one team resting instead of producing an invalid fixture.
 *
 * Generic over the team value: the engine runs it on team ids, and the result
 * reads in round order, which is what makes a full round robin schedule well.
 */

export type Fixture<T> = { home: T; away: T };
export type FixtureRound<T> = { label: string; fixtures: Fixture<T>[]; resting: T | null };

// The rotation runs on indices into `teams`, so the bye can be an index no team
// has — nothing a team name or id could ever collide with.
const BYE = -1;

export function buildRounds<T>(teams: readonly T[], doubleLeg: boolean): FixtureRound<T>[] {
  if (teams.length < 2) return [];

  // Odd team counts need a phantom opponent so the pairing stays even.
  const roster = teams.map((_, i) => i);
  if (roster.length % 2 === 1) roster.push(BYE);
  const half = roster.length / 2;
  const rotating = roster.slice(1);
  const rounds: FixtureRound<T>[] = [];

  for (let r = 0; r < roster.length - 1; r++) {
    const lineup = [roster[0], ...rotating];
    const fixtures: Fixture<T>[] = [];
    let resting: T | null = null;

    for (let i = 0; i < half; i++) {
      const a = lineup[i];
      const b = lineup[lineup.length - 1 - i];
      if (a === BYE) { resting = teams[b]; continue; }
      if (b === BYE) { resting = teams[a]; continue; }
      // Alternate which side is listed first each round so the same team isn't
      // always nominally "home".
      fixtures.push(r % 2 === 0 ? { home: teams[a], away: teams[b] } : { home: teams[b], away: teams[a] });
    }

    rounds.push({ label: `Round ${r + 1}`, fixtures, resting });
    rotating.unshift(rotating.pop()!);
  }

  if (!doubleLeg) return rounds;

  // Second leg: same pairings with the sides swapped, numbered on from the first.
  const secondLeg: FixtureRound<T>[] = rounds.map((round, i) => ({
    label: `Round ${rounds.length + i + 1}`,
    fixtures: round.fixtures.map((f) => ({ home: f.away, away: f.home })),
    resting: round.resting,
  }));

  return [...rounds, ...secondLeg];
}
