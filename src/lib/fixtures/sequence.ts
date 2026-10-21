import type { FixtureRules, PossibleMatch } from './types';
import type { Rng } from './random';
import { getPairKey } from './pairs';

/**
 * Round numbers for matches in play order: a new round starts whenever the next
 * match involves a team already playing in the current one. A round is
 * therefore a set of matches with no team twice — what one day can hold.
 */
export function assignRounds(order: readonly PossibleMatch[]): number[] {
  const rounds: number[] = [];
  let round = 1;
  let busy = new Set<string>();
  for (const m of order) {
    if (busy.has(m.teamAId) || busy.has(m.teamBId)) {
      round++;
      busy = new Set();
    }
    busy.add(m.teamAId);
    busy.add(m.teamBId);
    rounds.push(round);
  }
  return rounds;
}

/**
 * Orders selected pairings into rounds, greedily: each round takes as many
 * matches as it can with no team twice, busiest teams first so nobody is left
 * with a pile of matches at the end. Within a round, the first match avoids the
 * teams that closed the previous one, so no one plays back to back across the
 * break when it can be helped.
 */
export function packRounds(pairs: readonly PossibleMatch[], rng: Rng | null): PossibleMatch[] {
  const pending = pairs.map((m, i) => ({ m, tie: rng ? rng() : i }));
  const load = new Map<string, number>();
  for (const { m } of pending) {
    load.set(m.teamAId, (load.get(m.teamAId) ?? 0) + 1);
    load.set(m.teamBId, (load.get(m.teamBId) ?? 0) + 1);
  }

  const order: PossibleMatch[] = [];
  while (pending.length) {
    pending.sort((x, y) =>
      (load.get(y.m.teamAId)! + load.get(y.m.teamBId)!) - (load.get(x.m.teamAId)! + load.get(x.m.teamBId)!) || x.tie - y.tie,
    );
    const busy = new Set<string>();
    const round: PossibleMatch[] = [];
    for (let i = 0; i < pending.length; ) {
      const { m } = pending[i];
      if (busy.has(m.teamAId) || busy.has(m.teamBId)) { i++; continue; }
      busy.add(m.teamAId);
      busy.add(m.teamBId);
      round.push(m);
      pending.splice(i, 1);
    }
    for (const m of round) {
      load.set(m.teamAId, load.get(m.teamAId)! - 1);
      load.set(m.teamBId, load.get(m.teamBId)! - 1);
    }
    const prev = order[order.length - 1];
    if (prev) {
      const fresh = round.findIndex((m) => ![m.teamAId, m.teamBId].some((t) => t === prev.teamAId || t === prev.teamBId));
      if (fresh > 0) round.unshift(...round.splice(fresh, 1));
    }
    order.push(...round);
  }
  return order;
}

/** Whether an order honours `minRestMatches` and `maxConsecutiveMatches`. */
export function meetsOrderRules(order: readonly PossibleMatch[], rules: FixtureRules): boolean {
  const rest = rules.minRestMatches ?? 0;
  const most = rules.maxConsecutiveMatches ?? Infinity;
  if (!rest && most === Infinity) return true;
  const last = new Map<string, number>();
  const streak = new Map<string, number>();
  for (let pos = 0; pos < order.length; pos++) {
    for (const team of [order[pos].teamAId, order[pos].teamBId]) {
      const prev = last.get(team);
      const gap = prev === undefined ? Infinity : pos - prev - 1;
      if (gap < rest) return false;
      const run = gap === 0 ? streak.get(team)! + 1 : 1;
      if (run > most) return false;
      last.set(team, pos);
      streak.set(team, run);
    }
  }
  return true;
}

export type SequenceOutcome =
  | { status: 'found'; order: PossibleMatch[] }
  | { status: 'exhausted' }
  | { status: 'budget' };

const OUT_OF_STEPS = Symbol('out of steps');

/**
 * Re-orders a fixed set of matches so every team gets its rest. Backtracking:
 * at each slot, try the matches whose teams are both rested enough, the teams
 * with most still to play first (they have the least slack), longest-rested
 * next. Identical pairings are tried once per slot. Exhaustive within the
 * budget, so 'exhausted' proves these matches can't be ordered that way.
 */
export function sequenceWithRules(
  matches: readonly PossibleMatch[],
  rules: FixtureRules,
  rng: Rng | null,
  maxSteps = 100_000,
): SequenceOutcome {
  const rest = rules.minRestMatches ?? 0;
  const most = rules.maxConsecutiveMatches ?? Infinity;
  const total = matches.length;
  const ties = matches.map((_, i) => (rng ? rng() : i));
  const used = new Array<boolean>(total).fill(false);
  const order: PossibleMatch[] = [];
  const last = new Map<string, number>();
  const streak = new Map<string, number>();
  const left = new Map<string, number>();
  for (const m of matches) {
    left.set(m.teamAId, (left.get(m.teamAId) ?? 0) + 1);
    left.set(m.teamBId, (left.get(m.teamBId) ?? 0) + 1);
  }
  let steps = 0;

  const gapBefore = (team: string, pos: number) => {
    const prev = last.get(team);
    return prev === undefined ? Infinity : pos - prev - 1;
  };
  const fits = (team: string, pos: number) => {
    const gap = gapBefore(team, pos);
    if (gap < rest) return false;
    return gap > 0 || streak.get(team)! + 1 <= most;
  };

  function place(pos: number): boolean {
    if (++steps > maxSteps) throw OUT_OF_STEPS;
    if (pos === total) return true;

    // Every team still to play must fit its remaining matches into the slots left.
    for (const [team, count] of left) {
      if (!count) continue;
      const prev = last.get(team);
      const earliest = prev === undefined ? pos : Math.max(pos, prev + rest + 1);
      if (earliest + (count - 1) * (rest + 1) > total - 1) return false;
    }

    const candidates: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < total; i++) {
      if (used[i]) continue;
      const { teamAId: a, teamBId: b } = matches[i];
      const key = getPairKey(a, b);
      if (seen.has(key) || !fits(a, pos) || !fits(b, pos)) continue;
      seen.add(key);
      candidates.push(i);
    }
    const urgency = (i: number) => left.get(matches[i].teamAId)! + left.get(matches[i].teamBId)!;
    const rested = (i: number) => Math.min(gapBefore(matches[i].teamAId, pos), gapBefore(matches[i].teamBId, pos));
    candidates.sort((x, y) => urgency(y) - urgency(x) || rested(y) - rested(x) || ties[x] - ties[y]);

    for (const i of candidates) {
      const m = matches[i];
      const saved = [m.teamAId, m.teamBId].map((t) => [t, last.get(t), streak.get(t)] as const);
      used[i] = true;
      order.push(m);
      for (const t of [m.teamAId, m.teamBId]) {
        streak.set(t, gapBefore(t, pos) === 0 ? streak.get(t)! + 1 : 1);
        last.set(t, pos);
        left.set(t, left.get(t)! - 1);
      }
      if (place(pos + 1)) return true;
      used[i] = false;
      order.pop();
      for (const [t, prevLast, prevStreak] of saved) {
        if (prevLast === undefined) last.delete(t); else last.set(t, prevLast);
        if (prevStreak === undefined) streak.delete(t); else streak.set(t, prevStreak);
        left.set(t, left.get(t)! + 1);
      }
    }
    return false;
  }

  try {
    return place(0) ? { status: 'found', order: [...order] } : { status: 'exhausted' };
  } catch (e) {
    if (e === OUT_OF_STEPS) return { status: 'budget' };
    throw e;
  }
}

/**
 * Chooses the nominal home side of each match, in play order, giving it to
 * whichever team has had fewer home matches so far. Order and pairings are
 * untouched; only who is listed first changes.
 */
export function balanceHomeAway(order: readonly PossibleMatch[]): PossibleMatch[] {
  const home = new Map<string, number>();
  const away = new Map<string, number>();
  const lean = (t: string) => (home.get(t) ?? 0) - (away.get(t) ?? 0);
  return order.map((m) => {
    const [h, a] = lean(m.teamAId) <= lean(m.teamBId) ? [m.teamAId, m.teamBId] : [m.teamBId, m.teamAId];
    home.set(h, (home.get(h) ?? 0) + 1);
    away.set(a, (away.get(a) ?? 0) + 1);
    return { teamAId: h, teamBId: a };
  });
}
