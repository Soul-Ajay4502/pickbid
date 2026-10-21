import { isGraphical } from './plan';

export type SelectOutcome =
  | { status: 'found'; pairs: [number, number][] }
  /** Searched every option: no pairing meets these targets under this meeting cap. */
  | { status: 'exhausted' }
  /** Gave up at the step budget without an answer either way. */
  | { status: 'budget' };

const OUT_OF_STEPS = Symbol('out of steps');

/**
 * Picks which pairs play so that team i plays exactly `targets[i]` matches and
 * no pair meets more than `maxPairMeetings` times. Returns index pairs.
 *
 * Backtracking in the shape of Havel–Hakimi: take the team with the most
 * matches still to place, give it all of them at once — partners with the most
 * still to place first — and move on; that team is then finished and never
 * revisited. With one meeting per pair the first path down this tree is
 * exactly Havel–Hakimi, which is guaranteed to succeed whenever the targets
 * pass Erdős–Gallai, so the backtracking only earns its keep under tighter
 * constraints. It is exhaustive: each set of partners is tried once, so
 * 'exhausted' is a proof, not a guess.
 *
 * `rank` breaks ties (lower first), which is how a shuffled team order turns
 * into a different, equally valid fixture.
 */
export function selectPairings(
  targets: readonly number[],
  maxPairMeetings: number,
  rank: readonly number[],
  maxSteps = 50_000,
): SelectOutcome {
  const n = targets.length;
  const remaining = [...targets];
  const met = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const pairs: [number, number][] = [];
  let steps = 0;

  const room = (u: number, v: number) => Math.min(maxPairMeetings - met[u][v], remaining[v]);

  // Necessary for the teams still unfinished: each must fit into what its
  // possible partners can still absorb, and with one meeting per pair the
  // counts must still pass Erdős–Gallai.
  function stillFeasible(): boolean {
    for (let u = 0; u < n; u++) {
      if (!remaining[u]) continue;
      let capacity = 0;
      for (let v = 0; v < n; v++) if (v !== u && remaining[v]) capacity += room(u, v);
      if (capacity < remaining[u]) return false;
    }
    return maxPairMeetings !== 1 || isGraphical(remaining.filter((x) => x > 0));
  }

  function solve(): boolean {
    if (++steps > maxSteps) throw OUT_OF_STEPS;
    let pivot = -1;
    for (let i = 0; i < n; i++) {
      if (!remaining[i]) continue;
      if (pivot < 0 || remaining[i] > remaining[pivot] || (remaining[i] === remaining[pivot] && rank[i] < rank[pivot])) pivot = i;
    }
    if (pivot < 0) return true;

    const partners: number[] = [];
    for (let j = 0; j < n; j++) if (j !== pivot && remaining[j] && met[pivot][j] < maxPairMeetings) partners.push(j);
    // One meeting per pair: busiest partners first, which is Havel–Hakimi.
    // With rematches allowed, least-met first, so repeat meetings spread out.
    partners.sort((a, b) =>
      maxPairMeetings === 1
        ? remaining[b] - remaining[a] || rank[a] - rank[b]
        : met[pivot][a] - met[pivot][b] || remaining[b] - remaining[a] || rank[a] - rank[b],
    );
    return assign(pivot, partners, 0, remaining[pivot]);
  }

  // Gives `pivot` `need` more matches from partners[idx..], trying every split.
  function assign(pivot: number, partners: number[], idx: number, need: number): boolean {
    if (++steps > maxSteps) throw OUT_OF_STEPS;
    if (need === 0) return stillFeasible() && solve();
    let capacity = 0;
    for (let i = idx; i < partners.length; i++) capacity += room(pivot, partners[i]);
    if (capacity < need) return false;

    const j = partners[idx];
    // Fill the preferred partner first, then fall back to fewer meetings with it.
    for (let take = Math.min(room(pivot, j), need); take >= 0; take--) {
      for (let k = 0; k < take; k++) {
        met[pivot][j]++; met[j][pivot]++; remaining[pivot]--; remaining[j]--;
        pairs.push([pivot, j]);
      }
      if (assign(pivot, partners, idx + 1, need - take)) return true;
      for (let k = 0; k < take; k++) {
        met[pivot][j]--; met[j][pivot]--; remaining[pivot]++; remaining[j]++;
        pairs.pop();
      }
    }
    return false;
  }

  try {
    return solve() ? { status: 'found', pairs: [...pairs] } : { status: 'exhausted' };
  } catch (e) {
    if (e === OUT_OF_STEPS) return { status: 'budget' };
    throw e;
  }
}
