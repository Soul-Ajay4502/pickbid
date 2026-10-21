import type { FixtureConfig, FixtureIssue, FixtureValidation, PossibleMatch } from './types';
import { parseFixtureConfig } from './config';
import { countPairings, countParticipation, generatePossibleMatches, getPairKey } from './pairs';
import { forbidsRematches, planParticipation, plural } from './plan';

/**
 * Checks a fixture — matches in play order — against the teams and the config,
 * independently of how it was built. The generator runs every candidate through
 * this before returning it, and the save endpoint runs a client's fixture
 * through it against the league's real teams, so an invalid fixture can't be
 * produced or stored by either path.
 *
 * Reports every problem it finds rather than the first, each in words a league
 * organiser can act on. `labels` maps team ids to display names.
 */
export function validateFixture(
  teams: readonly string[],
  matches: readonly PossibleMatch[],
  config: FixtureConfig,
  labels?: Record<string, string>,
): FixtureValidation {
  const name = (id: string) => labels?.[id] ?? id;
  const errors: FixtureIssue[] = [];

  const parsed = parseFixtureConfig(config);
  if (!parsed.ok) return { valid: false, errors: [{ code: 'INVALID_CONFIGURATION', message: parsed.message }] };
  const cfg = parsed.config;
  const plan = planParticipation(teams, cfg, labels);
  if (!plan.ok) {
    const code = plan.error.code === 'INVALID_CONFIGURATION' ? 'INVALID_CONFIGURATION' : 'IMPOSSIBLE_CONFIGURATION';
    errors.push({ code, message: plan.error.message });
  }

  const known = new Set(teams);
  matches.forEach((m, i) => {
    for (const id of [m.teamAId, m.teamBId]) {
      if (!known.has(id)) errors.push({ code: 'UNKNOWN_TEAM', message: `Match ${i + 1} includes a team that isn't in this fixture (${name(id)}).` });
    }
    if (m.teamAId === m.teamBId) errors.push({ code: 'SELF_MATCH', message: `Match ${i + 1} has ${name(m.teamAId)} playing itself.` });
  });

  const pairCounts = countPairings(matches);
  const participation = countParticipation(teams, matches);
  const rules = cfg.rules ?? {};
  const n = teams.length;

  const expectCount = (expected: number) => {
    if (matches.length !== expected) {
      errors.push({ code: 'MATCH_COUNT', message: `Expected ${plural(expected, 'match', 'matches')}, found ${matches.length}.` });
    }
  };
  const expectEach = (expected: number) => {
    for (const id of teams) {
      const played = participation.get(id) ?? 0;
      if (played !== expected) {
        errors.push({ code: 'PARTICIPATION', message: `${name(id)} plays ${played} matches; every team should play exactly ${expected}.` });
      }
    }
  };

  switch (cfg.mode) {
    case 'full_round_robin': {
      const legs = cfg.legs ?? 1;
      expectCount((legs * n * (n - 1)) / 2);
      expectEach(legs * (n - 1));
      for (const p of generatePossibleMatches(teams)) {
        const met = pairCounts.get(getPairKey(p.teamAId, p.teamBId)) ?? 0;
        if (met < legs) {
          errors.push({ code: 'MISSING_PAIRING', message: `${name(p.teamAId)} and ${name(p.teamBId)} meet ${met} times; a ${legs === 2 ? 'home-and-away' : 'single'} round robin needs ${legs}.` });
        } else if (met > legs) {
          errors.push({ code: 'DUPLICATE_PAIRING', message: `${name(p.teamAId)} and ${name(p.teamBId)} meet ${met} times; a ${legs === 2 ? 'home-and-away' : 'single'} round robin needs ${legs}.` });
        }
      }
      break;
    }
    case 'matches_per_team': {
      const k = cfg.matchesPerTeam!;
      // An odd n·k has no valid fixture at all; the plan error above says why.
      if ((n * k) % 2 === 0) expectCount((n * k) / 2);
      expectEach(k);
      break;
    }
    case 'total_matches': {
      expectCount(cfg.totalMatches!);
      break;
    }
    case 'custom': {
      if (cfg.totalMatches !== undefined) expectCount(cfg.totalMatches);
      for (const id of teams) {
        const req = cfg.teamRequirements?.[id] ?? {};
        const played = participation.get(id) ?? 0;
        const min = req.min ?? rules.minMatchesPerTeam;
        const max = req.max ?? rules.maxMatchesPerTeam;
        if (min !== undefined && played < min) errors.push({ code: 'PARTICIPATION', message: `${name(id)} plays ${played} matches, below its minimum of ${min}.` });
        if (max !== undefined && played > max) errors.push({ code: 'PARTICIPATION', message: `${name(id)} plays ${played} matches, above its maximum of ${max}.` });
      }
      break;
    }
  }

  // The rules' own bounds — custom applies them per team above.
  if (cfg.mode !== 'custom') {
    for (const id of teams) {
      const played = participation.get(id) ?? 0;
      if (rules.minMatchesPerTeam !== undefined && played < rules.minMatchesPerTeam) {
        errors.push({ code: 'PARTICIPATION', message: `${name(id)} plays ${played} matches, below the minimum of ${rules.minMatchesPerTeam}.` });
      }
      if (rules.maxMatchesPerTeam !== undefined && played > rules.maxMatchesPerTeam) {
        errors.push({ code: 'PARTICIPATION', message: `${name(id)} plays ${played} matches, above the maximum of ${rules.maxMatchesPerTeam}.` });
      }
    }
  }

  if (forbidsRematches(cfg)) {
    const reported = new Set<string>();
    for (const m of matches) {
      const key = getPairKey(m.teamAId, m.teamBId);
      const met = pairCounts.get(key)!;
      if (met < 2 || reported.has(key)) continue;
      reported.add(key);
      errors.push({ code: 'DUPLICATE_PAIRING', message: `${name(m.teamAId)} and ${name(m.teamBId)} meet ${met} times, but rematches are off.` });
    }
  }

  // Ordering rules, walked in play order.
  const rest = rules.minRestMatches ?? 0;
  const most = rules.maxConsecutiveMatches;
  if (rest || most !== undefined) {
    const last = new Map<string, number>();
    const streak = new Map<string, number>();
    const flagged = new Set<string>();
    matches.forEach((m, pos) => {
      for (const id of [m.teamAId, m.teamBId]) {
        const prev = last.get(id);
        const gap = prev === undefined ? Infinity : pos - prev - 1;
        const run = gap === 0 ? streak.get(id)! + 1 : 1;
        if (gap < rest && !flagged.has(`rest:${id}`)) {
          flagged.add(`rest:${id}`);
          errors.push({ code: 'REST_LIMIT', message: `${name(id)} plays matches ${prev! + 1} and ${pos + 1} with ${plural(gap, 'match', 'matches')} between; the rule asks for ${rest}.` });
        }
        if (most !== undefined && run > most && !flagged.has(`run:${id}`)) {
          flagged.add(`run:${id}`);
          errors.push({ code: 'CONSECUTIVE_LIMIT', message: `${name(id)} plays ${run} matches in a row by match ${pos + 1}; the rule allows ${most}.` });
        }
        last.set(id, pos);
        streak.set(id, run);
      }
    });
  }

  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}
