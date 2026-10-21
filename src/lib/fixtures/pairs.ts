import type { PossibleMatch } from './types';

/** One key per matchup whichever side is listed first, so A v B and B v A count as the same pairing. */
export function getPairKey(teamAId: string, teamBId: string): string {
  return [teamAId, teamBId].sort().join(':');
}

/** Every distinct pairing, n·(n−1)/2 of them — never a team against itself, never a pair twice. */
export function generatePossibleMatches(teamIds: readonly string[]): PossibleMatch[] {
  const out: PossibleMatch[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) out.push({ teamAId: teamIds[i], teamBId: teamIds[j] });
  }
  return out;
}

/** How many times each pairing occurs, by `getPairKey`. */
export function countPairings(matches: readonly PossibleMatch[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const key = getPairKey(m.teamAId, m.teamBId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Appearances per team, with every listed team present even at zero. */
export function countParticipation(teamIds: readonly string[], matches: readonly PossibleMatch[]): Map<string, number> {
  const counts = new Map<string, number>(teamIds.map((id) => [id, 0]));
  for (const m of matches) {
    counts.set(m.teamAId, (counts.get(m.teamAId) ?? 0) + 1);
    counts.set(m.teamBId, (counts.get(m.teamBId) ?? 0) + 1);
  }
  return counts;
}
