import type { FixtureConfig, FixtureError } from './types';

/**
 * What a fixture has to deliver, reduced to numbers: exactly how many matches
 * each team plays. Every mode resolves to this, which is what lets one search
 * serve them all — a new format only needs to say how its targets are set.
 */
export interface ParticipationPlan {
  /** Exact appearances per team, aligned with the `teamIds` passed in. */
  targets: number[];
  totalMatches: number;
  /** Most times one pair may meet: 1 without rematches, `legs` in a round robin, otherwise unbounded. */
  maxPairMeetings: number;
}

export type PlanResult = { ok: true; plan: ParticipationPlan } | { ok: false; error: FixtureError };

const impossible = (message: string): PlanResult => ({ ok: false, error: { code: 'IMPOSSIBLE_CONFIGURATION', message } });
const invalid = (message: string): PlanResult => ({ ok: false, error: { code: 'INVALID_CONFIGURATION', message } });

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Whether pairs are limited to one meeting. A round robin says so through `legs` instead. */
export function forbidsRematches(config: FixtureConfig): boolean {
  return config.mode !== 'full_round_robin' && (config.rules?.noRematches ?? true);
}

/**
 * Erdős–Gallai: can these appearance counts be met with every pair meeting at
 * most once? Exact, so a "no" here is a proof that no fixture exists.
 */
export function isGraphical(degrees: readonly number[]): boolean {
  const d = [...degrees].sort((a, b) => b - a);
  const n = d.length;
  let sum = 0;
  for (const x of d) {
    if (x < 0 || x > n - 1) return false;
    sum += x;
  }
  if (sum % 2 === 1) return false;
  let left = 0;
  for (let k = 1; k <= n; k++) {
    left += d[k - 1];
    let right = k * (k - 1);
    for (let i = k; i < n; i++) right += Math.min(d[i], k);
    if (left > right) return false;
  }
  return true;
}

/**
 * The most even counts within each team's bounds that add up to `total`: start
 * everyone at their minimum and hand out the rest one at a time to whoever has
 * fewest, earlier teams first on ties. The most even split is also the easiest
 * to realise — if it fails Erdős–Gallai, every other split within the bounds
 * does too — so checking this one answer is enough to prove impossibility.
 */
function spreadEvenly(lo: readonly number[], hi: readonly number[], total: number): number[] {
  const d = [...lo];
  let left = total - lo.reduce((s, x) => s + x, 0);
  while (left > 0) {
    let pick = -1;
    for (let i = 0; i < d.length; i++) {
      if (d[i] < hi[i] && (pick < 0 || d[i] < d[pick])) pick = i;
    }
    if (pick < 0) break; // the caller has already checked there's room
    d[pick]++;
    left--;
  }
  return d;
}

/**
 * Resolves a config into exact per-team targets, or explains why it can't be
 * met. Every error from here is proven from the numbers alone — nothing is
 * rejected because a search happened to give up.
 *
 * Where counts are uneven (`total_matches`, `custom`), the extra matches go to
 * the teams earliest in `teamIds`, so the caller's order — shuffled or not —
 * decides who they are.
 */
export function planParticipation(
  teamIds: readonly string[],
  config: FixtureConfig,
  labels?: Record<string, string>,
): PlanResult {
  const name = (id: string) => labels?.[id] ?? id;
  const n = teamIds.length;
  if (new Set(teamIds).size !== n) return invalid('Every team must be listed once.');
  if (n < 2) return impossible('A fixture needs at least two teams.');

  const rules = config.rules ?? {};
  const noRematches = forbidsRematches(config);
  const distinctPairs = (n * (n - 1)) / 2;
  const capPerTeam = noRematches ? n - 1 : Infinity;
  let targets: number[];
  let maxPairMeetings = noRematches ? 1 : Infinity;

  switch (config.mode) {
    case 'full_round_robin': {
      const legs = config.legs ?? 1;
      if (legs > 1 && rules.noRematches === true) {
        return invalid("A home-and-away round robin plays every pair twice, so it can't also rule out rematches.");
      }
      targets = teamIds.map(() => legs * (n - 1));
      maxPairMeetings = legs;
      break;
    }

    case 'matches_per_team': {
      const k = config.matchesPerTeam;
      if (k === undefined) return invalid('Enter how many matches each team plays.');
      if ((n * k) % 2 === 1) {
        return impossible(
          `It is impossible for ${n} teams to play exactly ${k} matches each, because the total number of ` +
          `team appearances must be even — ${n} × ${k} = ${n * k}, and every match uses two.`,
        );
      }
      if (k > capPerTeam) {
        return impossible(
          `With ${n} teams, each team has only ${plural(n - 1, 'possible opponent')}, ` +
          `so none can play ${k} matches without a rematch.`,
        );
      }
      targets = teamIds.map(() => k);
      break;
    }

    case 'total_matches': {
      const total = config.totalMatches;
      if (total === undefined) return invalid('Enter the total number of matches.');
      if (noRematches && total > distinctPairs) {
        return impossible(`${n} teams have only ${distinctPairs} different pairings, so ${total} matches would need a rematch.`);
      }
      const lo = rules.minMatchesPerTeam ?? 0;
      const hi = Math.min(rules.maxMatchesPerTeam ?? Infinity, capPerTeam);
      if (lo > hi) {
        return impossible(`Without rematches a team can play at most ${n - 1} matches, below the minimum of ${lo}.`);
      }
      if (2 * total < n * lo) {
        return impossible(
          `${total} matches give ${2 * total} team appearances, but ${n} teams playing at least ${lo} each ` +
          `need ${n * lo} — at least ${Math.ceil((n * lo) / 2)} matches.`,
        );
      }
      if (2 * total > n * hi) {
        return impossible(
          `${total} matches give ${2 * total} team appearances, but ${n} teams playing at most ${hi} each ` +
          `allow only ${n * hi} — at most ${Math.floor((n * hi) / 2)} matches.`,
        );
      }
      targets = spreadEvenly(teamIds.map(() => lo), teamIds.map(() => hi), 2 * total);
      break;
    }

    case 'custom': {
      const reqs = config.teamRequirements ?? {};
      const known = new Set(teamIds);
      for (const id of Object.keys(reqs)) {
        if (!known.has(id)) return invalid(`There is a requirement for a team that isn't in this fixture (${name(id)}).`);
      }
      const lo: number[] = [];
      const hi: number[] = [];
      for (const id of teamIds) {
        const req = reqs[id] ?? {};
        const min = req.min ?? rules.minMatchesPerTeam ?? 0;
        const askedMax = req.max ?? rules.maxMatchesPerTeam ?? Infinity;
        const max = Math.min(askedMax, capPerTeam);
        if (min > askedMax) return impossible(`${name(id)}'s minimum of ${min} matches is above its maximum of ${askedMax}.`);
        if (min > max) {
          return impossible(`${name(id)} needs at least ${min} matches but has only ${plural(n - 1, 'possible opponent')} without rematches.`);
        }
        lo.push(min);
        hi.push(max);
      }
      const sumLo = lo.reduce((s, x) => s + x, 0);
      const sumHi = hi.reduce((s, x) => s + x, 0);
      if (config.totalMatches === undefined && sumLo === 0) {
        return invalid('Give at least one team a minimum number of matches, or set a total.');
      }
      // Without a total, build the smallest fixture that meets every minimum.
      const total = config.totalMatches ?? Math.ceil(sumLo / 2);
      if (noRematches && total > distinctPairs) {
        return impossible(`${n} teams have only ${distinctPairs} different pairings, so ${total} matches would need a rematch.`);
      }
      if (2 * total < sumLo) {
        return impossible(`${total} matches give ${2 * total} team appearances, but the teams' minimums add up to ${sumLo}.`);
      }
      if (2 * total > sumHi) {
        return impossible(
          config.totalMatches === undefined
            ? `The teams' minimums add up to ${sumLo} appearances — an odd number, and every match uses two — ` +
              `but no team has room for one more.`
            : `${total} matches give ${2 * total} team appearances, but the teams' maximums allow only ${sumHi}.`,
        );
      }
      targets = spreadEvenly(lo, hi, 2 * total);
      break;
    }
  }

  // The rules' bounds still apply when the mode fixes every count exactly.
  if (config.mode === 'full_round_robin' || config.mode === 'matches_per_team') {
    const each = targets[0];
    if (rules.minMatchesPerTeam !== undefined && each < rules.minMatchesPerTeam) {
      return impossible(`Every team plays exactly ${each} matches, below the minimum of ${rules.minMatchesPerTeam}.`);
    }
    if (rules.maxMatchesPerTeam !== undefined && each > rules.maxMatchesPerTeam) {
      return impossible(`Every team plays exactly ${each} matches, above the maximum of ${rules.maxMatchesPerTeam}.`);
    }
  }

  const appearances = targets.reduce((s, x) => s + x, 0);
  const totalMatches = appearances / 2;

  if (maxPairMeetings === 1 && !isGraphical(targets)) {
    return impossible(
      'No fixture without rematches can give every team its required number of matches — ' +
      'some teams need more opponents than the others can supply.',
    );
  }
  if (maxPairMeetings > 1) {
    // With rematches allowed, the only limit is that nobody needs more matches
    // than all the other teams' appearances put together.
    const top = targets.indexOf(Math.max(...targets));
    if (targets[top] > appearances - targets[top]) {
      return impossible(
        `${name(teamIds[top])} needs ${targets[top]} matches, but the other teams have only ` +
        `${appearances - targets[top]} appearances between them.`,
      );
    }
  }

  // Necessary conditions for the ordering rules — cheap, and they catch the
  // hopeless cases before the sequencer goes looking.
  if (rules.minRestMatches) {
    const rest = rules.minRestMatches;
    for (let i = 0; i < n; i++) {
      const needed = (targets[i] - 1) * (rest + 1) + 1;
      if (targets[i] > 1 && needed > totalMatches) {
        return impossible(
          `With ${plural(rest, 'match', 'matches')} of rest between appearances, ${name(teamIds[i])} playing ` +
          `${targets[i]} matches needs a fixture of at least ${needed} matches; this one has ${totalMatches}.`,
        );
      }
    }
  }
  if (rules.maxConsecutiveMatches) {
    const most = rules.maxConsecutiveMatches;
    for (let i = 0; i < n; i++) {
      // Its appearances split into at most (other matches + 1) runs of `most` each.
      if (targets[i] > most * (totalMatches - targets[i] + 1)) {
        return impossible(
          `${name(teamIds[i])} plays ${targets[i]} of the ${totalMatches} matches, so it can't avoid ` +
          `playing more than ${plural(most, 'match', 'matches')} in a row.`,
        );
      }
    }
  }

  return { ok: true, plan: { targets, totalMatches, maxPairMeetings } };
}
