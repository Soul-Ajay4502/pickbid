import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTER_LAYOUT,
  POSTER_MOODS,
  POSTER_TEMPLATES,
  buildRounds,
  generateFixtures,
  paginatePoster,
  parsePosterInput,
  posterContentHeight,
  type PosterFormat,
  type PosterMatch,
  generatePossibleMatches,
  getPairKey,
  isGraphical,
  isIsoDate,
  parseFixtureConfig,
  roundDate,
  scheduleFixtures,
  scoreFixture,
  validateFixture,
  type FixtureConfig,
  type FixtureMatch,
  type FixtureResult,
  type PossibleMatch,
} from './index';

/** Teams A, B, C… */
const teams = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

const m = (a: string, b: string): PossibleMatch => ({ teamAId: a, teamBId: b });

function participation(ids: readonly string[], matches: readonly PossibleMatch[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const x of matches) {
    counts[x.teamAId]++;
    counts[x.teamBId]++;
  }
  return counts;
}

function pairCounts(matches: readonly PossibleMatch[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const x of matches) counts.set(getPairKey(x.teamAId, x.teamBId), (counts.get(getPairKey(x.teamAId, x.teamBId)) ?? 0) + 1);
  return counts;
}

/**
 * Asserts a generated fixture is genuinely valid — by `validateFixture` and by
 * re-checking the basics here independently, so a bug shared by the generator
 * and the validator can't hide.
 */
function assertValid(ids: readonly string[], config: FixtureConfig, result: FixtureResult): FixtureMatch[] {
  if (!result.success) assert.fail(`expected a fixture, got ${result.error.code}: ${result.error.message}`);
  const { matches, stats } = result;
  assert.deepEqual(validateFixture(ids, matches, config), { valid: true, errors: [] });

  const known = new Set(ids);
  for (const x of matches) {
    assert.ok(known.has(x.teamAId) && known.has(x.teamBId), 'every match uses registered teams');
    assert.notEqual(x.teamAId, x.teamBId, 'no team plays itself');
  }
  if (config.mode !== 'full_round_robin' && config.rules?.noRematches !== false) {
    for (const [key, count] of pairCounts(matches)) assert.equal(count, 1, `pair ${key} meets once`);
  }

  // Rounds: numbered 1..r in order, and nobody plays twice in one round.
  let round = 1;
  let busy = new Set<string>();
  for (const x of matches) {
    if (x.round !== round) {
      assert.equal(x.round, round + 1, 'rounds are consecutive');
      round = x.round;
      busy = new Set();
    }
    assert.ok(!busy.has(x.teamAId) && !busy.has(x.teamBId), 'a team plays at most once per round');
    busy.add(x.teamAId);
    busy.add(x.teamBId);
  }

  assert.equal(stats.totalMatches, matches.length);
  assert.deepEqual(stats.teamParticipation, participation(ids, matches));
  return matches;
}

function assertImpossible(result: FixtureResult, pattern?: RegExp) {
  if (result.success) assert.fail(`expected an impossible configuration, got ${result.matches.length} matches`);
  assert.equal(result.error.code, 'IMPOSSIBLE_CONFIGURATION');
  if (pattern) assert.match(result.error.message, pattern);
}

describe('pair generation', () => {
  test('6 teams have 15 distinct pairings, none a team against itself', () => {
    const pairs = generatePossibleMatches(teams(6));
    assert.equal(pairs.length, 15);
    assert.equal(new Set(pairs.map((p) => getPairKey(p.teamAId, p.teamBId))).size, 15);
    for (const p of pairs) assert.notEqual(p.teamAId, p.teamBId);
  });

  test('the pair key ignores which side is listed first', () => {
    assert.equal(getPairKey('A', 'B'), getPairKey('B', 'A'));
    assert.notEqual(getPairKey('A', 'B'), getPairKey('A', 'C'));
  });
});

describe('full round robin', () => {
  test('6 teams: 15 matches, 5 each, every pair exactly once, in 5 rounds', () => {
    const config: FixtureConfig = { mode: 'full_round_robin' };
    const matches = assertValid(teams(6), config, generateFixtures(teams(6), config));
    assert.equal(matches.length, 15);
    assert.deepEqual(Object.values(participation(teams(6), matches)), [5, 5, 5, 5, 5, 5]);
    assert.equal(pairCounts(matches).size, 15);
    assert.equal(matches[matches.length - 1].round, 5);
  });

  test('5 teams: 10 matches in 5 rounds, one team resting each round', () => {
    const config: FixtureConfig = { mode: 'full_round_robin' };
    const matches = assertValid(teams(5), config, generateFixtures(teams(5), config));
    assert.equal(matches.length, 10);
    assert.equal(matches[matches.length - 1].round, 5);
  });

  test('home and away: every pair twice, once each way round', () => {
    const config: FixtureConfig = { mode: 'full_round_robin', legs: 2 };
    const matches = assertValid(teams(6), config, generateFixtures(teams(6), config));
    assert.equal(matches.length, 30);
    const directed = new Set(matches.map((x) => `${x.teamAId}>${x.teamBId}`));
    assert.equal(directed.size, 30);
  });

  test('2 teams: a single match', () => {
    const config: FixtureConfig = { mode: 'full_round_robin' };
    const matches = assertValid(['A', 'B'], config, generateFixtures(['A', 'B'], config));
    assert.equal(matches.length, 1);
    assert.equal(getPairKey(matches[0].teamAId, matches[0].teamBId), 'A:B');
  });

  test('home and away cannot also forbid rematches', () => {
    const result = generateFixtures(teams(4), { mode: 'full_round_robin', legs: 2, rules: { noRematches: true } });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'INVALID_CONFIGURATION');
  });

  test('the circle method still gives the public tool its rounds and rests', () => {
    const rounds = buildRounds(teams(5), false);
    assert.equal(rounds.length, 5);
    assert.deepEqual(new Set(rounds.map((r) => r.resting)), new Set(teams(5)));
    for (const r of rounds) assert.equal(r.fixtures.length, 2);
  });
});

describe('matches per team', () => {
  const cases: [teams: number, perTeam: number, total: number][] = [
    [6, 2, 6],
    [6, 3, 9],
    [6, 5, 15],
    [5, 2, 5],
    [4, 1, 2],
    [4, 2, 4],
    [3, 2, 3],
    [8, 3, 12],
    [2, 1, 1],
  ];
  for (const [n, k, total] of cases) {
    test(`${n} teams × ${k} each: ${total} matches, every team exactly ${k}`, () => {
      const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: k };
      const matches = assertValid(teams(n), config, generateFixtures(teams(n), config));
      assert.equal(matches.length, total);
      for (const count of Object.values(participation(teams(n), matches))) assert.equal(count, k);
    });
  }

  test('6 teams × 2 fits in two full rounds, like the round robin would', () => {
    const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 2 };
    const result = generateFixtures(teams(6), config);
    assertValid(teams(6), config, result);
    assert.ok(result.success && result.stats.rounds === 2);
  });

  test('6 teams × 5 each is the full round robin', () => {
    const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 5 };
    const matches = assertValid(teams(6), config, generateFixtures(teams(6), config));
    assert.equal(pairCounts(matches).size, 15);
  });

  test('5 teams × 3 each is impossible: appearances must be even', () => {
    assertImpossible(
      generateFixtures(teams(5), { mode: 'matches_per_team', matchesPerTeam: 3 }),
      /impossible for 5 teams to play exactly 3 matches each.*even/,
    );
  });

  test('6 teams × 6 each needs a rematch, so it is impossible with rematches off', () => {
    assertImpossible(generateFixtures(teams(6), { mode: 'matches_per_team', matchesPerTeam: 6 }), /only 5 possible opponents/);
  });

  test('6 teams × 6 each works with rematches on, spreading repeats evenly', () => {
    const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 6, rules: { noRematches: false } };
    const matches = assertValid(teams(6), config, generateFixtures(teams(6), config));
    assert.equal(matches.length, 18);
    for (const count of pairCounts(matches).values()) assert.ok(count <= 2, 'no pair meets more than twice');
  });

  test('every team count and per-team count: exact when possible, refused when not', () => {
    for (let n = 2; n <= 12; n++) {
      for (let k = 1; k <= n; k++) {
        const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: k };
        const result = generateFixtures(teams(n), config);
        if ((n * k) % 2 === 1 || k > n - 1) {
          assertImpossible(result);
          continue;
        }
        const matches = assertValid(teams(n), config, result);
        assert.equal(matches.length, (n * k) / 2, `${n} teams × ${k}`);
        for (const count of Object.values(participation(teams(n), matches))) assert.equal(count, k);
      }
    }
  });
});

describe('total matches', () => {
  test('6 teams, 8 matches: exactly 8, spread 3/3/3/3/2/2', () => {
    const config: FixtureConfig = { mode: 'total_matches', totalMatches: 8 };
    const matches = assertValid(teams(6), config, generateFixtures(teams(6), config));
    assert.equal(matches.length, 8);
    assert.deepEqual(Object.values(participation(teams(6), matches)).sort(), [2, 2, 3, 3, 3, 3]);
  });

  test('respects minimum and maximum per team', () => {
    const config: FixtureConfig = { mode: 'total_matches', totalMatches: 8, rules: { minMatchesPerTeam: 2, maxMatchesPerTeam: 3 } };
    const matches = assertValid(teams(6), config, generateFixtures(teams(6), config));
    for (const count of Object.values(participation(teams(6), matches))) assert.ok(count >= 2 && count <= 3);
  });

  test('too many matches for the maximum is impossible', () => {
    assertImpossible(
      generateFixtures(teams(6), { mode: 'total_matches', totalMatches: 10, rules: { maxMatchesPerTeam: 3 } }),
      /at most 3 each allow only 18/,
    );
  });

  test('too few matches for the minimum is impossible', () => {
    assertImpossible(
      generateFixtures(teams(6), { mode: 'total_matches', totalMatches: 4, rules: { minMatchesPerTeam: 2 } }),
      /at least 2 each need 12/,
    );
  });

  test('more matches than distinct pairings needs rematches', () => {
    assertImpossible(generateFixtures(teams(4), { mode: 'total_matches', totalMatches: 7 }), /only 6 different pairings/);
    const config: FixtureConfig = { mode: 'total_matches', totalMatches: 7, rules: { noRematches: false } };
    assert.equal(assertValid(teams(4), config, generateFixtures(teams(4), config)).length, 7);
  });

  test('every total from 1 to every pairing: exact count, participation within one', () => {
    for (let n = 2; n <= 10; n++) {
      for (let total = 1; total <= (n * (n - 1)) / 2; total++) {
        const config: FixtureConfig = { mode: 'total_matches', totalMatches: total };
        const matches = assertValid(teams(n), config, generateFixtures(teams(n), config));
        assert.equal(matches.length, total);
        const counts = Object.values(participation(teams(n), matches));
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${n} teams, ${total} matches spread evenly`);
      }
    }
  });
});

describe('custom requirements', () => {
  test('the smallest fixture that meets every minimum', () => {
    const config: FixtureConfig = {
      mode: 'custom',
      teamRequirements: { A: { min: 2, max: 3 }, B: { min: 2, max: 4 }, C: { min: 2, max: 2 } },
      rules: { noRematches: true },
    };
    const matches = assertValid(['A', 'B', 'C'], config, generateFixtures(['A', 'B', 'C'], config));
    assert.equal(matches.length, 3);
    assert.deepEqual(participation(['A', 'B', 'C'], matches), { A: 2, B: 2, C: 2 });
  });

  test('uneven requirements: one team plays everyone, the rest once', () => {
    const config: FixtureConfig = { mode: 'custom', teamRequirements: { A: { min: 3 }, B: { min: 1, max: 1 }, C: { min: 1, max: 1 }, D: { min: 1, max: 1 } } };
    const matches = assertValid(teams(4), config, generateFixtures(teams(4), config));
    assert.deepEqual(participation(teams(4), matches), { A: 3, B: 1, C: 1, D: 1 });
  });

  test('with a total, the extra matches go where the maximums allow', () => {
    const config: FixtureConfig = { mode: 'custom', totalMatches: 6, teamRequirements: { B: { max: 2 }, C: { max: 2 }, D: { max: 2 }, E: { max: 2 } } };
    const matches = assertValid(teams(5), config, generateFixtures(teams(5), config));
    assert.equal(matches.length, 6);
    assert.deepEqual(participation(teams(5), matches), { A: 4, B: 2, C: 2, D: 2, E: 2 });
  });

  test('a total beyond what the maximums allow is refused', () => {
    // A's maximum of 4 is capped at its 3 possible opponents, so 9 appearances at most.
    assertImpossible(
      generateFixtures(teams(4), { mode: 'custom', totalMatches: 5, teamRequirements: { A: { max: 4 }, B: { max: 2 }, C: { max: 2 }, D: { max: 2 } } }),
      /maximums allow only 9/,
    );
  });

  test('requirements no fixture can meet without rematches are refused', () => {
    // A and B each need 3 opponents, but C and D can only play once each.
    const config: FixtureConfig = { mode: 'custom', teamRequirements: { A: { min: 3, max: 3 }, B: { min: 3, max: 3 }, C: { max: 1 }, D: { max: 1 } } };
    assertImpossible(generateFixtures(teams(4), config));
  });

  test('a requirement for a team not in the fixture is invalid', () => {
    const result = generateFixtures(teams(3), { mode: 'custom', teamRequirements: { Z: { min: 1 } } }, { labels: { Z: 'Zebras' } });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, 'INVALID_CONFIGURATION');
      assert.match(result.error.message, /Zebras/);
    }
  });

  test('odd minimums with no room to round up are refused', () => {
    assertImpossible(generateFixtures(teams(3), { mode: 'custom', teamRequirements: { A: { min: 1, max: 1 }, B: { min: 1, max: 1 }, C: { min: 1, max: 1 } } }), /odd/);
  });
});

describe('rest and consecutive rules', () => {
  test('6-team round robin with a match of rest between appearances', () => {
    const config: FixtureConfig = { mode: 'full_round_robin', rules: { minRestMatches: 1 } };
    assertValid(teams(6), config, generateFixtures(teams(6), config));
  });

  test('6 teams × 2 each, never twice in a row', () => {
    const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 2, rules: { maxConsecutiveMatches: 1 } };
    assertValid(teams(6), config, generateFixtures(teams(6), config));
  });

  test('4 teams × 2 each can never avoid a back-to-back, and is refused', () => {
    // The only such fixture is the cycle A–B, B–C, C–D, D–A: after A–B then
    // C–D, every match left involves a team that has just played.
    const result = generateFixtures(teams(4), { mode: 'matches_per_team', matchesPerTeam: 2, rules: { maxConsecutiveMatches: 1 } });
    assert.equal(result.success, false);
  });

  test('with 2 matches allowed in a row, 4 teams × 2 each is fine', () => {
    const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 2, rules: { maxConsecutiveMatches: 2 } };
    assertValid(teams(4), config, generateFixtures(teams(4), config));
  });

  test('3 teams cannot all rest between matches: every pair of matches shares a team', () => {
    assertImpossible(generateFixtures(teams(3), { mode: 'full_round_robin', rules: { minRestMatches: 1 } }));
  });

  test('a rest longer than the fixture allows is refused up front', () => {
    assertImpossible(generateFixtures(teams(4), { mode: 'matches_per_team', matchesPerTeam: 3, rules: { minRestMatches: 3 } }), /needs a fixture of at least/);
  });
});

describe('randomisation', () => {
  const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 3 };

  test('the same seed gives the same fixture', () => {
    const a = generateFixtures(teams(8), config, { randomize: true, seed: 'final-2026' });
    const b = generateFixtures(teams(8), config, { randomize: true, seed: 'final-2026' });
    assertValid(teams(8), config, a);
    assert.deepEqual(a, b);
    assert.ok(a.success && a.seed === 'final-2026');
  });

  test('different seeds explore different fixtures, all valid', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const result = generateFixtures(teams(8), config, { randomize: true, seed: `s${i}` });
      const matches = assertValid(teams(8), config, result);
      seen.add(matches.map((x) => getPairKey(x.teamAId, x.teamBId)).sort().join(','));
    }
    assert.ok(seen.size > 1);
  });

  test('without randomising, output is stable and carries no seed', () => {
    const a = generateFixtures(teams(8), config);
    assert.deepEqual(a, generateFixtures(teams(8), config));
    assert.ok(a.success && a.seed === null);
  });

  test('randomising without a seed still reports one that reproduces it', () => {
    const a = generateFixtures(teams(7), { mode: 'total_matches', totalMatches: 9 }, { randomize: true });
    assert.ok(a.success && typeof a.seed === 'string');
    if (a.success) assert.deepEqual(generateFixtures(teams(7), { mode: 'total_matches', totalMatches: 9 }, { randomize: true, seed: a.seed! }), a);
  });
});

describe('never an invalid fixture', () => {
  test('across many random configurations, every success validates', () => {
    const modes: FixtureConfig['mode'][] = ['full_round_robin', 'matches_per_team', 'total_matches', 'custom'];
    let built = 0;
    for (let i = 0; i < 300; i++) {
      const n = 2 + (i % 11);
      const ids = teams(n);
      const mode = modes[i % 4];
      const config: FixtureConfig = {
        mode,
        legs: mode === 'full_round_robin' ? 1 + (i % 2) : undefined,
        matchesPerTeam: 1 + (i % n),
        totalMatches: 1 + ((i * 7) % 30),
        teamRequirements: mode === 'custom' ? { A: { min: i % 3, max: 2 + (i % 4) } } : undefined,
        rules: { noRematches: i % 5 !== 0 && mode !== 'full_round_robin' ? true : undefined, minRestMatches: i % 7 === 0 ? 1 : undefined },
      };
      const result = generateFixtures(ids, config, { randomize: true, seed: `p${i}` });
      if (result.success) {
        built++;
        assertValid(ids, config, result);
      } else {
        assert.ok(result.error.message.length > 0);
      }
    }
    assert.ok(built > 100, `built ${built} fixtures`);
  });
});

describe('validateFixture', () => {
  const config: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 1 };
  const codes = (teamIds: string[], matches: PossibleMatch[], c: FixtureConfig = config) => {
    const result = validateFixture(teamIds, matches, c);
    return result.valid ? [] : result.errors.map((e) => e.code);
  };

  test('accepts a correct fixture', () => {
    assert.deepEqual(codes(teams(4), [m('A', 'B'), m('C', 'D')]), []);
  });

  test('rejects the same pairing twice, either way round', () => {
    const c: FixtureConfig = { mode: 'total_matches', totalMatches: 2 };
    assert.ok(codes(teams(4), [m('A', 'B'), m('A', 'B')], c).includes('DUPLICATE_PAIRING'));
    assert.ok(codes(teams(4), [m('A', 'B'), m('B', 'A')], c).includes('DUPLICATE_PAIRING'));
  });

  test('allows a repeat when rematches are on', () => {
    assert.deepEqual(codes(teams(4), [m('A', 'B'), m('B', 'A')], { mode: 'total_matches', totalMatches: 2, rules: { noRematches: false } }), []);
  });

  test('rejects a team playing itself', () => {
    assert.ok(codes(teams(2), [m('A', 'A')], { mode: 'total_matches', totalMatches: 1 }).includes('SELF_MATCH'));
  });

  test('rejects a team that is not registered', () => {
    assert.ok(codes(teams(4), [m('A', 'B'), m('C', 'Z')]).includes('UNKNOWN_TEAM'));
  });

  test('rejects uneven participation in exact modes', () => {
    const errs = codes(teams(4), [m('A', 'B'), m('A', 'C')]);
    assert.ok(errs.includes('PARTICIPATION'));
  });

  test('rejects the wrong number of matches', () => {
    assert.ok(codes(teams(6), [m('A', 'B'), m('C', 'D'), m('E', 'F')], { mode: 'matches_per_team', matchesPerTeam: 2 }).includes('MATCH_COUNT'));
  });

  test('rejects a missing pairing in a round robin', () => {
    const errs = codes(teams(3), [m('A', 'B'), m('B', 'C')], { mode: 'full_round_robin' });
    assert.ok(errs.includes('MISSING_PAIRING'));
  });

  test('enforces min and max per team', () => {
    const c: FixtureConfig = { mode: 'total_matches', totalMatches: 3, rules: { minMatchesPerTeam: 1, maxMatchesPerTeam: 2 } };
    assert.ok(codes(teams(4), [m('A', 'B'), m('A', 'C'), m('A', 'D')], c).includes('PARTICIPATION'));
    assert.deepEqual(codes(teams(4), [m('A', 'B'), m('C', 'D'), m('A', 'C')], c), []);
  });

  test('enforces rest and consecutive limits in play order', () => {
    const rest: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 2, rules: { minRestMatches: 1 } };
    assert.ok(codes(teams(4), [m('A', 'B'), m('A', 'C'), m('B', 'D'), m('C', 'D')], rest).includes('REST_LIMIT'));
    const run: FixtureConfig = { mode: 'matches_per_team', matchesPerTeam: 2, rules: { maxConsecutiveMatches: 1 } };
    assert.ok(codes(teams(4), [m('A', 'B'), m('A', 'C'), m('B', 'D'), m('C', 'D')], run).includes('CONSECUTIVE_LIMIT'));
    // Every team rests at least one match between its two.
    const rested = [m('A', 'B'), m('C', 'D'), m('E', 'F'), m('A', 'C'), m('B', 'E'), m('D', 'F')];
    assert.deepEqual(codes(teams(6), rested, rest), []);
  });

  test('flags a configuration no fixture can meet', () => {
    assert.ok(codes(teams(5), [], { mode: 'matches_per_team', matchesPerTeam: 3 }).includes('IMPOSSIBLE_CONFIGURATION'));
  });
});

describe('configuration parsing', () => {
  test('rejects malformed numbers', () => {
    for (const bad of [2.5, -1, 0, '3', Number.NaN]) {
      assert.equal(parseFixtureConfig({ mode: 'matches_per_team', matchesPerTeam: bad }).ok, false, String(bad));
    }
    const result = generateFixtures(teams(4), { mode: 'matches_per_team', matchesPerTeam: 1.5 });
    assert.ok(!result.success && result.error.code === 'INVALID_CONFIGURATION');
  });

  test('rejects an unknown mode and a missing count', () => {
    assert.equal(parseFixtureConfig({ mode: 'knockout' }).ok, false);
    assert.equal(parseFixtureConfig({ mode: 'total_matches' }).ok, false);
  });

  test('drops unknown keys', () => {
    const parsed = parseFixtureConfig({ mode: 'full_round_robin', extra: 1 });
    assert.deepEqual(parsed, { ok: true, config: { mode: 'full_round_robin' } });
  });

  test('needs at least two distinct teams', () => {
    assertImpossible(generateFixtures(['A'], { mode: 'full_round_robin' }));
    const dup = generateFixtures(['A', 'A'], { mode: 'full_round_robin' });
    assert.ok(!dup.success && dup.error.code === 'INVALID_CONFIGURATION');
  });
});

describe('scheduling', () => {
  test('dates every match by its round', () => {
    const result = generateFixtures(teams(4), { mode: 'full_round_robin' });
    assert.ok(result.success);
    if (!result.success) return;
    const dated = scheduleFixtures(result.matches, { startDate: '2026-10-25', daysBetweenRounds: 7 });
    assert.deepEqual([...new Set(dated.map((x) => x.matchDate))], ['2026-10-25', '2026-11-01', '2026-11-08']);
    for (const x of dated) assert.equal(x.matchDate, roundDate('2026-10-25', x.round - 1, 7));
  });

  test('date maths crosses months, years and leap days in UTC', () => {
    assert.equal(roundDate('2026-12-30', 2, 1), '2027-01-01');
    assert.equal(roundDate('2028-02-28', 1, 1), '2028-02-29');
    assert.equal(roundDate('2026-10-25', 5, 0), '2026-10-25');
  });

  test('only real calendar days pass', () => {
    assert.equal(isIsoDate('2026-02-28'), true);
    assert.equal(isIsoDate('2026-02-30'), false);
    assert.equal(isIsoDate('26-1-1'), false);
    assert.equal(isIsoDate(null), false);
  });
});

describe('scoring and graph checks', () => {
  test('a back-to-back appearance scores worse than a rested one', () => {
    const rested = [m('A', 'B'), m('C', 'D'), m('A', 'C'), m('B', 'D')];
    const tired = [m('A', 'B'), m('A', 'C'), m('C', 'D'), m('B', 'D')];
    assert.ok(scoreFixture(rested, teams(4)) < scoreFixture(tired, teams(4)));
  });

  test('Erdős–Gallai recognises which counts a fixture can meet', () => {
    assert.equal(isGraphical([2, 2, 2]), true);
    assert.equal(isGraphical([3, 1, 1, 1]), true);
    assert.equal(isGraphical([3, 3, 1, 1]), false);
    assert.equal(isGraphical([1, 1, 1]), false);
  });
});

describe('fixture poster', () => {
  const toPoster = (result: FixtureResult): PosterMatch[] => {
    assert.ok(result.success);
    if (!result.success) return [];
    const ids = Object.keys(result.stats.teamParticipation);
    return result.matches.map((x) => ({ a: ids.indexOf(x.teamAId), b: ids.indexOf(x.teamBId), round: x.round }));
  };
  const flatten = (pages: ReturnType<typeof paginatePoster>) =>
    pages.flatMap((p) => p.columns.flatMap((c) => c.flatMap((b) => b.matches.map((x) => x.number))));
  const columnHeight = (blocks: ReturnType<typeof paginatePoster>[number]['columns'][number]) =>
    blocks.reduce((h, b) => h + POSTER_LAYOUT.roundHeader + b.matches.length * POSTER_LAYOUT.row, 0);

  test('a small fixture fits one column on one page', () => {
    const pages = paginatePoster(toPoster(generateFixtures(teams(6), { mode: 'matches_per_team', matchesPerTeam: 2 })), 'portrait');
    assert.equal(pages.length, 1);
    assert.equal(pages[0].twoColumn, false);
  });

  test('every match lands exactly once, in order, and no column overflows', () => {
    const formats: PosterFormat[] = ['portrait', 'story', 'square'];
    for (const n of [4, 6, 8, 12, 20]) {
      for (const legs of [1, 2]) {
        const matches = toPoster(generateFixtures(teams(n), { mode: 'full_round_robin', legs }));
        for (const format of formats) {
          const pages = paginatePoster(matches, format);
          assert.deepEqual(flatten(pages), matches.map((_, i) => i + 1), `${n} teams × ${legs} legs, ${format}`);
          for (const page of pages) {
            assert.ok(page.columns.length <= 2);
            for (const column of page.columns) assert.ok(columnHeight(column) <= posterContentHeight(format));
          }
        }
      }
    }
  });

  test('a round that fits a fresh column is never split; a huge one is, marked continued', () => {
    const matches = toPoster(generateFixtures(teams(8), { mode: 'full_round_robin' }));
    for (const page of paginatePoster(matches, 'portrait')) {
      for (const column of page.columns) for (const block of column) assert.equal(block.continued, false);
    }
    const huge: PosterMatch[] = Array.from({ length: 40 }, (_, i) => ({ a: i % 2, b: 1 - (i % 2), round: 1 }));
    const blocks = paginatePoster(huge, 'portrait').flatMap((p) => p.columns.flat());
    assert.ok(blocks.length > 1);
    assert.equal(blocks[0].continued, false);
    assert.ok(blocks.slice(1).every((b) => b.continued));
  });

  test('every template is complete, unique, and reachable from a filter', () => {
    assert.equal(new Set(POSTER_TEMPLATES.map((t) => t.id)).size, POSTER_TEMPLATES.length);
    for (const mood of POSTER_MOODS.filter((m) => m.id !== 'all')) {
      assert.ok(POSTER_TEMPLATES.some((t) => t.mood === mood.id), `no ${mood.id} template`);
    }
    for (const t of POSTER_TEMPLATES) {
      assert.ok(t.display.family && t.display.charWidth > 0.3 && t.display.charWidth < 1, t.id);
      assert.equal(t.swatch.length, 3, t.id);
      assert.ok(parsePosterInput({ template: t.id, format: 'square', teams: [{ name: 'A' }, { name: 'B' }], matches: [{ a: 0, b: 1, round: 1 }] }).ok, t.id);
    }
  });

  test('poster requests are validated and capped', () => {
    const base = { template: 'royal', format: 'portrait', title: '  Kerala   League ', teams: [{ name: 'A' }, { name: 'B', color: '#22c55e' }], matches: [{ a: 0, b: 1, round: 1 }] };
    const ok = parsePosterInput(base);
    assert.ok(ok.ok && ok.input.title === 'Kerala League' && ok.input.page === 1 && ok.input.teams[1].color === '#22c55e');
    assert.equal(parsePosterInput({ ...base, template: 'neon' }).ok, false);
    assert.equal(parsePosterInput({ ...base, format: 'banner' }).ok, false);
    assert.equal(parsePosterInput({ ...base, matches: [{ a: 0, b: 5, round: 1 }] }).ok, false);
    assert.equal(parsePosterInput({ ...base, matches: [{ a: 1, b: 1, round: 1 }] }).ok, false);
    assert.equal(parsePosterInput({ ...base, matches: [{ a: 0, b: 1, round: 1, date: '2026-02-30' }] }).ok, false);
    assert.equal(parsePosterInput({ ...base, matches: Array.from({ length: 501 }, () => ({ a: 0, b: 1, round: 1 })) }).ok, false);
    const badColor = parsePosterInput({ ...base, teams: [{ name: 'A', color: 'red;}' }, { name: 'B' }] });
    assert.ok(badColor.ok && badColor.input.teams[0].color === null);
  });
});
