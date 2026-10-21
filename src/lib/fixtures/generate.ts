import type { FixtureConfig, FixtureErrorCode, FixtureMatch, FixtureResult, GenerateOptions, PossibleMatch } from './types';
import { parseFixtureConfig } from './config';
import { countParticipation } from './pairs';
import { planParticipation } from './plan';
import { randomSeed, seededRandom, shuffled, type Rng } from './random';
import { buildRounds } from './roundRobin';
import { scoreFixture } from './score';
import { selectPairings } from './select';
import { assignRounds, balanceHomeAway, meetsOrderRules, packRounds, sequenceWithRules } from './sequence';
import { validateFixture } from './validate';

const fail = (code: FixtureErrorCode, message: string): FixtureResult => ({ success: false, error: { code, message } });

type Candidate = { order: PossibleMatch[]; oriented: boolean };

/**
 * Walks the circle-method rounds keeping every match both teams still need.
 * When targets are even across an even number of teams this is just the first
 * k rounds — whole rounds, every team playing in each — which is as good as a
 * fixture gets. Elsewhere it may strand a team short, and is then dropped.
 */
function roundRobinPrefix(order: readonly string[], targets: readonly number[], maxPairMeetings: number): PossibleMatch[] | null {
  const need = new Map(order.map((id, i) => [id, targets[i]]));
  const legs = maxPairMeetings === 1 ? 1 : Math.ceil(Math.max(...targets) / (order.length - 1));
  const rounds = buildRounds(order, false);
  const out: PossibleMatch[] = [];
  for (let leg = 0; leg < legs; leg++) {
    for (const round of rounds) {
      for (const f of round.fixtures) {
        const [a, b] = leg % 2 ? [f.away, f.home] : [f.home, f.away];
        if (!need.get(a) || !need.get(b)) continue;
        out.push({ teamAId: a, teamBId: b });
        need.set(a, need.get(a)! - 1);
        need.set(b, need.get(b)! - 1);
      }
    }
  }
  return [...need.values()].every((x) => x === 0) ? out : null;
}

/**
 * Builds a fixture for these teams, or explains why it can't.
 *
 * 1. Parse the config and plan exact per-team targets; impossible configs fail
 *    here with a reason, before any search.
 * 2. For each attempt, order the teams (shuffled when randomising) and build
 *    candidates: a round-robin prefix where one fits, and a Havel–Hakimi
 *    pairing search. A full round robin is the circle method directly.
 * 3. Order each candidate into rounds; if rest rules are set and the order
 *    breaks them, re-sequence it under the rules.
 * 4. Validate every candidate with `validateFixture` and keep the valid one with
 *    the lowest `scoreFixture`. Nothing invalid is ever returned.
 *
 * Without `randomize` the same input always gives the same fixture: extra
 * attempts still run, from fixed seeds.
 */
export function generateFixtures(
  teamIds: readonly string[],
  config: FixtureConfig,
  options: GenerateOptions = {},
): FixtureResult {
  const parsed = parseFixtureConfig(config);
  if (!parsed.ok) return fail('INVALID_CONFIGURATION', parsed.message);
  const cfg = parsed.config;
  const { labels } = options;

  const planned = planParticipation(teamIds, cfg, labels);
  if (!planned.ok) return { success: false, error: planned.error };

  const n = teamIds.length;
  const rules = cfg.rules ?? {};
  const orderRules = !!rules.minRestMatches || rules.maxConsecutiveMatches !== undefined;
  const seed = options.randomize ? options.seed || randomSeed() : null;
  const attempts = Math.min(50, Math.max(1, Math.floor(options.attempts ?? 8)));
  // When every pairing is forced, exhausting the orderings of the one possible
  // set of matches proves the rest rules can't be met.
  const pairingsForced =
    cfg.mode === 'full_round_robin' ||
    (planned.plan.maxPairMeetings === 1 && planned.plan.totalMatches === (n * (n - 1)) / 2);

  let best: { order: PossibleMatch[]; score: number } | null = null;
  let gaveUp = false;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng: Rng | null =
      seed !== null ? seededRandom(`${seed}:${attempt}`) : attempt === 0 ? null : seededRandom(`fixtures:${attempt}`);
    const order = rng ? shuffled(teamIds, rng) : [...teamIds];
    const candidates: Candidate[] = [];

    if (cfg.mode === 'full_round_robin') {
      const rounds = buildRounds(order, (cfg.legs ?? 1) === 2);
      candidates.push({ order: rounds.flatMap((r) => r.fixtures.map((f) => ({ teamAId: f.home, teamBId: f.away }))), oriented: true });
    } else {
      // Feasibility doesn't depend on order, but who gets an uneven split's
      // extra matches does — so plan again for this order.
      const plan = planParticipation(order, cfg, labels);
      if (!plan.ok) return { success: false, error: plan.error };
      const { targets, maxPairMeetings } = plan.plan;

      const prefix = roundRobinPrefix(order, targets, maxPairMeetings);
      if (prefix) candidates.push({ order: prefix, oriented: false });

      // With rematches allowed, cap how often a pair may meet at the lowest
      // level that works, so repeat meetings spread instead of piling up.
      const most = Math.max(...targets);
      const caps = Number.isFinite(maxPairMeetings)
        ? [maxPairMeetings]
        : Array.from({ length: most - Math.ceil(most / (n - 1)) + 1 }, (_, i) => Math.ceil(most / (n - 1)) + i);
      const rank = order.map((_, i) => i);
      for (const cap of caps) {
        const found = selectPairings(targets, cap, rank);
        if (found.status === 'budget') gaveUp = true;
        if (found.status !== 'found') continue;
        const pairs = found.pairs.map(([a, b]) => ({ teamAId: order[a], teamBId: order[b] }));
        candidates.push({ order: packRounds(pairs, rng), oriented: false });
        break;
      }
    }

    for (const candidate of candidates) {
      let sequence = candidate.order;
      if (orderRules && !meetsOrderRules(sequence, rules)) {
        const arranged = sequenceWithRules(sequence, rules, rng);
        if (arranged.status === 'budget') gaveUp = true;
        if (arranged.status !== 'found') continue;
        sequence = arranged.order;
      }
      if (!candidate.oriented) sequence = balanceHomeAway(sequence);
      if (!validateFixture(teamIds, sequence, cfg, labels).valid) continue;
      const score = scoreFixture(sequence, teamIds);
      if (!best || score < best.score) best = { order: sequence, score };
    }
  }

  if (!best) {
    if (orderRules && pairingsForced && !gaveUp) {
      return fail('IMPOSSIBLE_CONFIGURATION', 'No order of these matches gives every team the rest the rules ask for.');
    }
    return fail(
      'NO_VALID_FIXTURE',
      orderRules
        ? "Couldn't find an order of matches that gives every team the rest the rules ask for. Try a shorter rest or allowing more matches in a row."
        : "Couldn't build a fixture for these settings. Try again, or relax a rule.",
    );
  }

  const rounds = assignRounds(best.order);
  const matches: FixtureMatch[] = best.order.map((m, i) => ({ ...m, round: rounds[i] }));
  return {
    success: true,
    matches,
    stats: {
      totalMatches: matches.length,
      rounds: rounds.length ? rounds[rounds.length - 1] : 0,
      teamParticipation: Object.fromEntries(countParticipation(teamIds, matches)),
    },
    score: best.score,
    seed,
  };
}
