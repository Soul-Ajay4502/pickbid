import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES,
  ScoringError,
  aggregateLeagueStats,
  ballChip,
  bowlerOptions,
  commentary,
  dismissalText,
  matchRowResult,
  nameLookup,
  nextBatterOptions,
  parseEvent,
  parseEvents,
  parseSetup,
  playerMatchLines,
  replay,
  resultText,
  statusText,
  summarizeMatch,
  teamNameLookup,
  tryReplay,
  type BallEvent,
  type MatchSetup,
  type ScoringEvent,
  type ScoringRules,
  type WicketInput,
} from './index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const squad = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, name: `${prefix.toUpperCase()}${i + 1}` }));

/** Team A (a1…) wins the toss and bats; team B (b1…) bowls. */
function setup(rules: Partial<ScoringRules> = {}, sizeA = 11, sizeB = 11): MatchSetup {
  return {
    rules: { ...DEFAULT_RULES, overs: 2, maxOversPerBowler: null, ...rules },
    sides: [
      { teamId: 'A', name: 'Aces', color: '#ff0000', players: squad('a', sizeA), captainId: 'a1', keeperId: 'a2' },
      { teamId: 'B', name: 'Bulls', color: '#0000ff', players: squad('b', sizeB), captainId: 'b1', keeperId: 'b11' },
    ],
    toss: { winnerTeamId: 'A', decision: 'bat' },
  };
}

let seq = 0;
const id = () => `e${++seq}`;

const start = (strikerId: string, nonStrikerId: string, bowlerId: string): ScoringEvent =>
  ({ id: id(), at: 0, type: 'start_innings', strikerId, nonStrikerId, bowlerId });

const ball = (runs: number, more: Partial<Omit<BallEvent, 'id' | 'at' | 'type' | 'runs'>> = {}): ScoringEvent =>
  ({ id: id(), at: 0, type: 'ball', runs, extra: null, ...more });

const four = () => ball(4, { boundary: true });
const six = () => ball(6, { boundary: true });
const wide = (runs = 0) => ball(runs, { extra: 'wd' });
const noBall = (runs = 0, more: Partial<BallEvent> = {}) => ball(runs, { extra: 'nb', ...more });
const out = (wicket: WicketInput, runs = 0, more: Partial<BallEvent> = {}) => ball(runs, { wicket, ...more });
const bowler = (bowlerId: string): ScoringEvent => ({ id: id(), at: 0, type: 'bowler', bowlerId });
const dots = (n: number) => Array.from({ length: n }, () => ball(0));

function rejects(s: MatchSetup, events: ScoringEvent[], pattern: RegExp) {
  assert.throws(() => replay(s, events), (err: unknown) => err instanceof ScoringError && pattern.test(err.message));
}

/** A whole 2-over innings: b1 then b2, with these deliveries. */
function innings(openers: [string, string], bowlers: [string, string], first: ScoringEvent[], second: ScoringEvent[]) {
  return [start(openers[0], openers[1], bowlers[0]), ...first, bowler(bowlers[1]), ...second];
}

// ── Deliveries and strike ────────────────────────────────────────────────────

describe('runs and strike', () => {
  test('odd runs change ends, the over end changes them back', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ball(1), ball(0), four(), six(), ball(2), ball(1)]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 14);
    assert.equal(inn.legalBalls, 6);
    assert.equal(s.awaiting, 'bowler');
    // a2 took a single off the last ball to keep strike, then the over ended
    assert.equal(inn.strikerId, 'a2');
    const a1 = inn.batters.find((b) => b.id === 'a1')!;
    const a2 = inn.batters.find((b) => b.id === 'a2')!;
    assert.deepEqual([a1.runs, a1.balls], [1, 1]);
    assert.deepEqual([a2.runs, a2.balls, a2.fours, a2.sixes, a2.dots], [13, 5, 1, 1, 1]);
    const b1 = inn.bowlers[0];
    assert.deepEqual([b1.balls, b1.runs, b1.dots, b1.fours, b1.sixes], [6, 14, 1, 1, 1]);
  });

  test('overthrows to the rope: strike follows the runs run, not the runs scored', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ball(5, { ran: 1 })]);
    assert.equal(s.innings[0].runs, 5);
    assert.equal(s.innings[0].strikerId, 'a2');
    assert.equal(s.innings[0].batters[0].runs, 5);
    assert.equal(s.innings[0].batters[0].fours, 0);
  });

  test('correcting an earlier ball re-derives everything after it', () => {
    const log = [start('a1', 'a2', 'b1'), ball(1), four()];
    const before = replay(setup(), log);
    assert.equal(before.innings[0].batters.find((b) => b.id === 'a2')!.runs, 4);
    // They actually ran two, so a1 kept the strike — and hit the four
    const fixed = [log[0], { ...log[1], id: 'fixed', runs: 2 } as ScoringEvent, log[2]];
    const after = replay(setup(), fixed);
    assert.equal(after.innings[0].batters.find((b) => b.id === 'a1')!.runs, 6);
    assert.equal(after.innings[0].batters.find((b) => b.id === 'a2')!.runs, 0);
    assert.equal(after.innings[0].runs, 6);
  });

  test('a manual swap changes strike', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), { id: id(), at: 0, type: 'swap' }]);
    assert.equal(s.innings[0].strikerId, 'a2');
  });

  test('boundaries must be fours, or sixes off the bat', () => {
    rejects(setup(), [start('a1', 'a2', 'b1'), ball(5, { boundary: true })], /boundary/);
    rejects(setup(), [start('a1', 'a2', 'b1'), ball(6, { extra: 'lb', boundary: true })], /boundary/);
  });

  test('a ball can’t be bowled before the next bowler is chosen', () => {
    rejects(setup(), [start('a1', 'a2', 'b1'), ...dots(7)], /bowler for the next over/);
  });
});

describe('extras', () => {
  test('a wide adds its penalty, is not a ball faced and is bowled again', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), wide(), wide(1)]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 3);
    assert.equal(inn.extras.wd, 3);
    assert.equal(inn.legalBalls, 0);
    assert.equal(inn.batters[0].balls, 0);
    assert.equal(inn.bowlers[0].runs, 3);
    assert.equal(inn.bowlers[0].wides, 2);
    // the single run on the second wide changed ends
    assert.equal(inn.strikerId, 'a2');
  });

  test('five wides to the boundary', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ball(4, { extra: 'wd', boundary: true })]);
    assert.equal(s.innings[0].runs, 5);
    assert.equal(s.innings[0].extras.wd, 5);
    assert.equal(s.innings[0].strikerId, 'a1');
    assert.equal(ballChip(s.innings[0].overs[0].balls[0]), 'Wd+4');
  });

  test('a no-ball hit for four: four to the batter, five to the bowler, then a free hit', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), noBall(4, { boundary: true })]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 5);
    assert.equal(inn.extras.nb, 1);
    assert.deepEqual([inn.batters[0].runs, inn.batters[0].balls, inn.batters[0].fours], [4, 1, 1]);
    assert.equal(inn.bowlers[0].runs, 5);
    assert.equal(inn.legalBalls, 0);
    assert.equal(inn.freeHit, true);
    assert.equal(ballChip(inn.overs[0].balls[0]), 'Nb+4');
  });

  test('byes off a no-ball go down as byes, and only the no-ball is the bowler’s', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), noBall(2, { nbRunsAs: 'bye' })]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 3);
    assert.deepEqual(inn.extras, { b: 2, lb: 0, wd: 0, nb: 1, p: 0 });
    assert.equal(inn.bowlers[0].runs, 1);
    assert.deepEqual([inn.batters[0].runs, inn.batters[0].balls], [0, 1]);
  });

  test('leg byes count to the team, not the bowler or the batter, and rotate strike', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ball(1, { extra: 'lb' })]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 1);
    assert.equal(inn.extras.lb, 1);
    assert.equal(inn.bowlers[0].runs, 0);
    assert.equal(inn.bowlers[0].dots, 1);
    assert.deepEqual([inn.batters[0].runs, inn.batters[0].balls], [0, 1]);
    assert.equal(inn.strikerId, 'a2');
  });

  test('local rules: two-run wides, and no-balls that are not bowled again', () => {
    const s = replay(setup({ wideRuns: 2, noBallReball: false }), [start('a1', 'a2', 'b1'), wide(), noBall()]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 3);
    assert.equal(inn.legalBalls, 1);
  });
});

describe('free hit', () => {
  test('only a run out (or the like) can dismiss on a free hit', () => {
    const base = [start('a1', 'a2', 'b1'), noBall()];
    rejects(setup(), [...base, out({ kind: 'caught', outId: 'a1', fielderId: 'b3', nextBatterId: 'a3' })], /free hit/);
    rejects(setup(), [...base, out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' })], /free hit/);
    const s = replay(setup(), [...base, out({ kind: 'run_out', outId: 'a2', fielderId: 'b4', nextBatterId: 'a3' }, 1)]);
    assert.equal(s.innings[0].wickets, 1);
  });

  test('a wide keeps the free hit alive, a legal ball uses it up', () => {
    const s1 = replay(setup(), [start('a1', 'a2', 'b1'), noBall(), wide()]);
    assert.equal(s1.innings[0].freeHit, true);
    const s2 = replay(setup(), [start('a1', 'a2', 'b1'), noBall(), wide(), ball(0)]);
    assert.equal(s2.innings[0].freeHit, false);
  });

  test('no free hits when the league plays without them', () => {
    const s = replay(setup({ freeHit: false }), [start('a1', 'a2', 'b1'), noBall()]);
    assert.equal(s.innings[0].freeHit, false);
  });
});

// ── Wickets ──────────────────────────────────────────────────────────────────

describe('wickets', () => {
  test('caught: the new batter takes strike, the catcher and bowler are credited', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), out({ kind: 'caught', outId: 'a1', fielderId: 'b5', nextBatterId: 'a3' })]);
    const inn = s.innings[0];
    assert.equal(inn.wickets, 1);
    assert.equal(inn.strikerId, 'a3');
    assert.equal(inn.bowlers[0].wickets, 1);
    const a1 = inn.batters[0];
    assert.equal(dismissalText(a1.dismissal, nameLookup(s)), 'c B5 b B1');
    assert.deepEqual(inn.fallOfWickets, [{ wicket: 1, runs: 0, batterId: 'a1', over: '0.1' }]);
  });

  test('caught and bowled reads as c & b', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), out({ kind: 'caught', outId: 'a1', fielderId: 'b1', nextBatterId: 'a3' })]);
    assert.equal(dismissalText(s.innings[0].batters[0].dismissal, nameLookup(s)), 'c & b B1');
  });

  test('out off the last ball of the over: the new batter ends up at the non-striker’s end', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ...dots(5), out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' })]);
    assert.equal(s.innings[0].strikerId, 'a2');
    assert.equal(s.innings[0].nonStrikerId, 'a3');
  });

  test('stumped defaults the fielder to the keeper; it is allowed off a wide', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), out({ kind: 'stumped', outId: 'a1', nextBatterId: 'a3' }, 0, { extra: 'wd' })]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 1);
    assert.equal(inn.legalBalls, 0);
    assert.equal(dismissalText(inn.batters[0].dismissal, nameLookup(s)), 'st B11 b B1');
  });

  test('a run out keeps the runs completed and puts the newcomer where the scorer says', () => {
    // One run completed, then the non-striker — now at the striker's end — is run out going for two
    const s = replay(setup(), [
      start('a1', 'a2', 'b1'),
      out({ kind: 'run_out', outId: 'a2', fielderId: 'b6', nextBatterId: 'a3', nextOnStrike: true }, 1),
    ]);
    const inn = s.innings[0];
    assert.equal(inn.runs, 1);
    assert.equal(inn.batters[0].runs, 1);
    assert.equal(inn.bowlers[0].wickets, 0);
    assert.equal(inn.strikerId, 'a3');
    assert.equal(inn.nonStrikerId, 'a1');
    assert.equal(dismissalText(inn.batters[1].dismissal, nameLookup(s)), 'run out (B6)');
  });

  test('impossible dismissals are refused', () => {
    const base = [start('a1', 'a2', 'b1')];
    rejects(setup(), [...base, out({ kind: 'bowled', outId: 'a2', nextBatterId: 'a3' })], /Only the striker/);
    rejects(setup(), [...base, out({ kind: 'caught', outId: 'a1', nextBatterId: 'a3' }, 2)], /No runs/);
    rejects(setup(), [...base, out({ kind: 'lbw', outId: 'a1', nextBatterId: 'a3' }, 0, { extra: 'wd' })], /wide/);
    rejects(setup(), [...base, out({ kind: 'caught', outId: 'a1', nextBatterId: 'a3' }, 0, { extra: 'nb' })], /no-ball/);
    rejects(setup(), [...base, out({ kind: 'bowled', outId: 'a1' })], /next batter/);
    rejects(setup(), [...base, out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a2' })], /can't come in/);
    rejects(setup(), [...base, out({ kind: 'run_out', outId: 'a1', nextBatterId: 'a3' }, 4, { boundary: true })], /boundary/);
  });

  test('retired hurt is not a wicket and the batter can come back', () => {
    const s = replay(setup(), [
      start('a1', 'a2', 'b1'),
      ball(2),
      { id: id(), at: 0, type: 'dismiss', kind: 'retired_hurt', batterId: 'a1', nextBatterId: 'a3' },
      out({ kind: 'bowled', outId: 'a3', nextBatterId: 'a1' }),
    ]);
    const inn = s.innings[0];
    assert.equal(inn.wickets, 1);
    const a1 = inn.batters.find((b) => b.id === 'a1')!;
    assert.equal(a1.status, 'batting');
    assert.equal(a1.runs, 2);
    assert.equal(inn.strikerId, 'a1');
  });

  test('backing up too far: the non-striker run out before the ball is bowled', () => {
    const s = replay(setup(), [
      start('a1', 'a2', 'b1'),
      { id: id(), at: 0, type: 'dismiss', kind: 'run_out', batterId: 'a2', nextBatterId: 'a3' },
    ]);
    const inn = s.innings[0];
    assert.equal(inn.wickets, 1);
    assert.equal(inn.legalBalls, 0);
    assert.equal(inn.bowlers[0].wickets, 0);
    assert.equal(dismissalText(inn.batters[1].dismissal, nameLookup(s)), 'run out (B1)');
    rejects(setup(), [start('a1', 'a2', 'b1'), { id: id(), at: 0, type: 'dismiss', kind: 'run_out', batterId: 'a1', nextBatterId: 'a3' }], /non-striker/);
  });

  test('timed out only applies to a batter yet to face', () => {
    rejects(setup(), [start('a1', 'a2', 'b1'), ball(0), { id: id(), at: 0, type: 'dismiss', kind: 'timed_out', batterId: 'a1', nextBatterId: 'a3' }], /yet to face/);
    const s = replay(setup(), [start('a1', 'a2', 'b1'), { id: id(), at: 0, type: 'dismiss', kind: 'timed_out', batterId: 'a2', nextBatterId: 'a3' }]);
    assert.equal(s.innings[0].wickets, 1);
  });

  test('a retired-hurt batter unable to return lets the innings close', () => {
    const events: ScoringEvent[] = [
      start('a1', 'a2', 'b1'),
      { id: id(), at: 0, type: 'dismiss', kind: 'retired_hurt', batterId: 'a1', nextBatterId: 'a3' },
      out({ kind: 'bowled', outId: 'a3' }),
    ];
    const s = replay(setup({}, 3), events);
    assert.equal(s.innings[0].complete, true);
    assert.equal(s.innings[0].endReason, 'all_out');
    assert.equal(s.innings[0].wickets, 1);
  });
});

// ── Bowling restrictions ─────────────────────────────────────────────────────

describe('bowlers', () => {
  test('nobody bowls consecutive overs', () => {
    rejects(setup(), [start('a1', 'a2', 'b1'), ...dots(6), bowler('b1')], /previous over/);
  });

  test('the per-bowler quota is enforced', () => {
    const s = setup({ overs: 3, maxOversPerBowler: 1 });
    rejects(s, [start('a1', 'a2', 'b1'), ...dots(6), bowler('b2'), ...dots(6), bowler('b1')], /bowled 1 over/);
  });

  test('a bowler can be replaced mid-over, and a split over is no maiden', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ...dots(3), bowler('b2'), ...dots(3)]);
    const inn = s.innings[0];
    assert.deepEqual(inn.overs[0].bowlerIds, ['b1', 'b2']);
    assert.equal(inn.bowlers.find((b) => b.id === 'b1')!.balls, 3);
    assert.equal(inn.bowlers.find((b) => b.id === 'b2')!.balls, 3);
    assert.equal(inn.bowlers.every((b) => b.maidens === 0), true);
    // neither of them may bowl the next over
    const options = bowlerOptions(s);
    assert.ok(options.find((o) => o.player.id === 'b1')!.blocked);
    assert.ok(options.find((o) => o.player.id === 'b2')!.blocked);
    assert.equal(options.find((o) => o.player.id === 'b3')!.blocked, null);
  });

  test('a maiden is an over with nothing off the bat, wides or no-balls', () => {
    const maiden = replay(setup(), [start('a1', 'a2', 'b1'), ...dots(5), ball(1, { extra: 'lb' })]);
    assert.equal(maiden.innings[0].bowlers[0].maidens, 1);
    const spoiled = replay(setup(), [start('a1', 'a2', 'b1'), ...dots(5), wide(), ball(0)]);
    assert.equal(spoiled.innings[0].bowlers[0].maidens, 0);
  });
});

// ── Innings and results ──────────────────────────────────────────────────────

describe('innings end', () => {
  test('all out closes the innings; the side has one batter fewer than players', () => {
    const s = replay(setup({}, 3), [
      start('a1', 'a2', 'b1'),
      out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' }),
      out({ kind: 'bowled', outId: 'a3' }),
    ]);
    assert.equal(s.innings[0].endReason, 'all_out');
    assert.equal(s.phase, 'break');
    assert.equal(s.awaiting, 'start_innings');
    assert.equal(s.innings[0].batters.find((b) => b.id === 'a2')!.status, 'not_out');
  });

  test('last man standing: the survivor bats on alone and keeps strike', () => {
    const s = replay(setup({ lastManStanding: true }, 3), [
      start('a1', 'a2', 'b1'),
      out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' }),
      out({ kind: 'bowled', outId: 'a3' }),
      ball(1),
      ball(3),
    ]);
    const inn = s.innings[0];
    assert.equal(inn.complete, false);
    assert.equal(inn.strikerId, 'a2');
    assert.equal(inn.nonStrikerId, null);
    assert.equal(inn.runs, 4);
    const done = replay(setup({ lastManStanding: true }, 3), [
      start('a1', 'a2', 'b1'),
      out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' }),
      out({ kind: 'bowled', outId: 'a3' }),
      out({ kind: 'bowled', outId: 'a2' }),
    ]);
    assert.equal(done.innings[0].endReason, 'all_out');
    assert.equal(done.innings[0].wickets, 3);
  });

  test('a late arrival gives the batting side another wicket', () => {
    const s = replay(setup({}, 3), [
      start('a1', 'a2', 'b1'),
      { id: id(), at: 0, type: 'add_player', teamId: 'A', player: { id: 'guest:z', name: 'Zed' } },
      out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' }),
      out({ kind: 'bowled', outId: 'a3', nextBatterId: 'guest:z' }),
    ]);
    assert.equal(s.innings[0].complete, false);
    assert.equal(s.innings[0].maxWickets, 3);
  });

  test('the overs running out closes the innings and sets the target', () => {
    const s = replay(setup(), innings(['a1', 'a2'], ['b1', 'b2'], [four(), ...dots(5)], dots(6)));
    assert.equal(s.innings[0].endReason, 'overs');
    assert.equal(s.phase, 'break');
    assert.match(statusText(s), /Bulls need 5 runs to win/);
  });
});

/** Aces make 10 in their 2 overs; returns the log so far. */
function firstInnings(): ScoringEvent[] {
  return innings(['a1', 'a2'], ['b1', 'b2'], [four(), ...dots(5)], [six(), ...dots(5)]);
}

describe('results', () => {
  test('a chase that gets there wins by wickets, with balls to spare', () => {
    const s = replay(setup(), [...firstInnings(), start('b1', 'b2', 'a1'), six(), four(), ball(1)]);
    assert.equal(s.phase, 'completed');
    assert.equal(s.innings[1].endReason, 'target');
    assert.deepEqual(s.result, { kind: 'won', winnerTeamId: 'B', by: 'wickets', margin: 10, ballsLeft: 9, superOver: false, revised: false });
    assert.equal(resultText(s.result, teamNameLookup(s)), 'Bulls won by 10 wickets (9 balls left)');
  });

  test('a chase that falls short loses by runs', () => {
    const s = replay(setup(), [...firstInnings(), ...innings(['b1', 'b2'], ['a1', 'a2'], [four(), ...dots(5)], dots(6))]);
    assert.equal(resultText(s.result, teamNameLookup(s)), 'Aces won by 6 runs');
    assert.deepEqual(matchRowResult(s), { team1Score: '10/0 (2)', team2Score: '4/0 (2)', winnerTeamId: 'A' });
  });

  test('a tie, then a super over opened by the side that batted second', () => {
    const tie = [...firstInnings(), ...innings(['b1', 'b2'], ['a1', 'a2'], [four(), ...dots(5)], [six(), ...dots(5)])];
    const tied = replay(setup(), tie);
    assert.deepEqual(tied.result, { kind: 'tie', superOver: false });
    assert.equal(matchRowResult(tied)!.winnerTeamId, null);

    const so = [...tie, { id: id(), at: 0, type: 'super_over' } as ScoringEvent, start('b3', 'b4', 'a5')];
    const live = replay(setup(), so);
    assert.equal(live.innings[2].battingTeamId, 'B');
    assert.equal(live.innings[2].maxOvers, 1);
    assert.equal(live.innings[2].maxWickets, 2);

    const done = replay(setup(), [...so, six(), ...dots(5), start('a3', 'a4', 'b5'), four(), ...dots(5)]);
    assert.equal(resultText(done.result, teamNameLookup(done)), 'Bulls won the Super Over');
    // super overs stay off the scoreline and out of player stats
    assert.deepEqual(matchRowResult(done), { team1Score: '10/0 (2)', team2Score: '10/0 (2)', winnerTeamId: 'B' });
    assert.equal(playerMatchLines(done).find((l) => l.id === 'b3')!.batted, false);
  });

  test('a super over is only for a tie', () => {
    const won = [...firstInnings(), start('b1', 'b2', 'a1'), six(), four(), ball(1)];
    rejects(setup(), [...won, { id: id(), at: 0, type: 'super_over' }], /tied/);
  });

  test('rain: a revised target and overs for the chase', () => {
    const s = replay(setup({ overs: 3 }), [
      start('a1', 'a2', 'b1'), four(), ...dots(5), bowler('b2'), six(), ...dots(5), bowler('b3'), ...dots(6),
      { id: id(), at: 0, type: 'revise', overs: 1, target: 8 },
      start('b1', 'b2', 'a1'), six(), ...dots(5),
    ]);
    assert.equal(s.innings[1].maxOvers, 1);
    assert.equal(s.innings[1].target, 8);
    assert.equal(resultText(s.result, teamNameLookup(s)), 'Aces won by 1 run — revised target');
  });

  test('cutting the overs to those already bowled ends the innings', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), ...dots(6), { id: id(), at: 0, type: 'revise', overs: 1 }]);
    assert.equal(s.innings[0].complete, true);
    assert.equal(s.innings[0].endReason, 'overs');
    assert.equal(s.innings[0].maxOvers, 1);
  });

  test('fielding-side penalty runs are added to their innings, and lift the target', () => {
    const s = replay(setup(), [...firstInnings(), start('b1', 'b2', 'a1'), { id: id(), at: 0, type: 'penalty', runs: 5, to: 'fielding' }]);
    assert.equal(s.innings[0].runs, 15);
    assert.equal(s.innings[1].target, 16);
  });

  test('penalty runs to the batting side can win the match', () => {
    const s = replay(setup(), [...firstInnings(), start('b1', 'b2', 'a1'), six(), { id: id(), at: 0, type: 'penalty', runs: 5, to: 'batting' }]);
    assert.equal(s.innings[1].runs, 11);
    assert.equal(s.innings[1].extras.p, 5);
    assert.equal(s.phase, 'completed');
  });

  test('a declaration closes the innings early', () => {
    const s = replay(setup(), [start('a1', 'a2', 'b1'), six(), { id: id(), at: 0, type: 'end_innings', reason: 'declared' }]);
    assert.equal(s.innings[0].endReason, 'declared');
    assert.equal(s.phase, 'break');
  });

  test('abandoned before a ball is still a played fixture', () => {
    const s = replay(setup(), [{ id: id(), at: 0, type: 'end_match', result: 'abandoned', note: 'rain' }]);
    assert.equal(resultText(s.result, teamNameLookup(s)), 'Match abandoned — rain');
    assert.deepEqual(matchRowResult(s), { team1Score: 'Abandoned', team2Score: 'Abandoned', winnerTeamId: null });
  });

  test('a walkover awards the match', () => {
    const s = replay(setup(), [{ id: id(), at: 0, type: 'end_match', result: 'awarded', winnerTeamId: 'B', note: 'Aces conceded' }]);
    assert.equal(resultText(s.result, teamNameLookup(s)), 'Bulls awarded the match — Aces conceded');
    assert.equal(matchRowResult(s)!.winnerTeamId, 'B');
  });

  test('nothing but player of the match after the result', () => {
    const done = [...firstInnings(), start('b1', 'b2', 'a1'), six(), four(), ball(1)];
    rejects(setup(), [...done, ball(0)], /match is over/);
    const s = replay(setup(), [...done, { id: id(), at: 0, type: 'potm', playerId: 'b1' }]);
    assert.equal(summarizeMatch(s).playerOfMatch?.name, 'B1');
  });
});

// ── Derived views ────────────────────────────────────────────────────────────

describe('summaries and stats', () => {
  test('the live summary names the chase', () => {
    const s = replay(setup(), [...firstInnings(), start('b1', 'b2', 'a1'), four()]);
    const sum = summarizeMatch(s);
    assert.equal(sum.phase, 'live');
    assert.deepEqual(sum.live, { battingTeamId: 'B', score: '4/0', overs: '0.1', target: 11 });
    assert.equal(sum.statusText, 'Bulls need 7 runs from 11 balls');
    assert.equal(matchRowResult(s), null);
  });

  test('commentary reads naturally', () => {
    const s = replay(setup(), [
      start('a1', 'a2', 'b1'), six(),
      out({ kind: 'caught', outId: 'a1', fielderId: 'b3', nextBatterId: 'a3' }),
      noBall(4, { boundary: true }), ball(2, { extra: 'lb' }),
    ]);
    const names = nameLookup(s);
    const balls = s.innings[0].overs[0].balls;
    assert.equal(commentary(balls[0], names), 'B1 to A1, SIX');
    assert.equal(commentary(balls[1], names, s.innings[0].batters[0].dismissal), 'B1 to A1, OUT! A1 c B3 b B1');
    assert.equal(commentary(balls[2], names), 'B1 to A3, no ball, FOUR');
    assert.equal(commentary(balls[3], names), 'Free hit — B1 to A3, 2 leg byes');
    assert.deepEqual(balls.map(ballChip), ['6', 'W', 'Nb+4', '2Lb']);
    assert.deepEqual(balls.map((b) => b.label), ['0.1', '0.2', '0.3', '0.3']);
  });

  test('player lines and league aggregates', () => {
    const s = replay(setup(), [
      ...innings(['a1', 'a2'], ['b1', 'b2'], [four(), out({ kind: 'caught', outId: 'a1', fielderId: 'b3', nextBatterId: 'a3' }), ...dots(4)], dots(6)),
      start('b1', 'b2', 'a1'), six(),
    ]);
    const lines = playerMatchLines(s);
    const a1 = lines.find((l) => l.id === 'a1')!;
    assert.deepEqual([a1.runs, a1.balls, a1.out, a1.fours], [4, 2, true, 1]);
    assert.equal(lines.find((l) => l.id === 'b3')!.catches, 1);
    assert.equal(lines.find((l) => l.id === 'b1')!.wickets, 1);

    const stats = aggregateLeagueStats([{ ballsPerOver: 6, lines }, { ballsPerOver: 6, lines }]);
    const top = stats.batting.find((b) => b.id === 'a1')!;
    assert.deepEqual([top.innings, top.runs, top.average, top.strikeRate], [2, 8, 4, 200]);
    const b1 = stats.bowling.find((b) => b.id === 'b1')!;
    assert.deepEqual([b1.wickets, b1.overs, b1.economy, b1.best], [2, '2', 4, { wickets: 1, runs: 4 }]);
    assert.equal(stats.fielding[0].id, 'b3');
  });

  test('next-batter options leave out who is in or out', () => {
    const s = replay(setup({}, 4), [start('a1', 'a2', 'b1'), out({ kind: 'bowled', outId: 'a1', nextBatterId: 'a3' })]);
    assert.deepEqual(nextBatterOptions(s).map((p) => p.id), ['a4']);
  });
});

// ── Parsing and replay errors ────────────────────────────────────────────────

describe('parsing', () => {
  test('events are rebuilt field by field', () => {
    const e = parseEvent({ id: 'x', at: 5, type: 'ball', runs: '2', extra: null, sneaky: true });
    assert.deepEqual(e, { id: 'x', at: 5, type: 'ball', runs: 2, extra: null, wicket: null });
    assert.throws(() => parseEvent({ id: 'x', type: 'ball', runs: 99 }), ScoringError);
    assert.throws(() => parseEvent({ id: 'x', type: 'teleport' }), ScoringError);
    assert.throws(() => parseEvents([{ id: 'x', type: 'swap' }, { id: 'x', type: 'swap' }]), /twice/);
  });

  test('setups need two distinct sides and a valid toss', () => {
    const good = setup();
    assert.deepEqual(parseSetup(JSON.parse(JSON.stringify(good))).toss, good.toss);
    const twice = { ...good, sides: [good.sides[0], { ...good.sides[1], players: [...good.sides[1].players, { id: 'a1', name: 'A1' }] }] };
    assert.throws(() => parseSetup(twice), /both squads/);
    assert.throws(() => parseSetup({ ...good, toss: { winnerTeamId: 'Z', decision: 'bat' } }), /toss winner/);
    assert.throws(() => parseSetup({ ...good, sides: [{ ...good.sides[0], players: [{ id: 'a1', name: 'A1' }] }, good.sides[1]] }), /at least 2/);
  });

  test('a replay names the event it stopped at', () => {
    const r = tryReplay(setup(), [start('a1', 'a2', 'b1'), ball(0), out({ kind: 'bowled', outId: 'a2', nextBatterId: 'a3' })]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.eventIndex, 2);
  });
});
