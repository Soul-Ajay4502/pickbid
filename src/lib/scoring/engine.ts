import {
  LIMITS, ScoringError, allowedDismissals, countsInOver, creditsBowler, scoresNoRuns, strikerOnly,
} from './rules';
import { oversText } from './format';
import { SUB_FIELDER } from './types';
import type {
  BallEvent, BallRecord, BatterState, BowlerState, CreaseDismissal, InningsState, LineupPlayer,
  MatchResult, MatchSetup, MatchState, OverState, ScoringEvent,
} from './types';

// The scoring engine. `replay` folds an event log into the match state, and is
// the only way state is ever produced — the scorer's screen, the server's write
// check and every spectator run this same function over the same log, so they
// cannot disagree about a score.
//
// Internally it mutates one fresh state object per replay; nothing outside this
// file ever sees a half-applied event.

function fail(message: string): never {
  throw new ScoringError(message);
}

export function initialState(setup: MatchSetup): MatchState {
  return {
    setup,
    squads: {
      [setup.sides[0].teamId]: [...setup.sides[0].players],
      [setup.sides[1].teamId]: [...setup.sides[1].players],
    },
    innings: [],
    phase: 'pre',
    awaiting: 'start_innings',
    result: null,
    playerOfMatchId: null,
    pendingRevision: null,
    pendingPenalty: {},
    superOvers: 0,
    eventCount: 0,
  };
}

/**
 * The match as the log leaves it. Throws a `ScoringError` naming the first
 * event the laws (or the match's rules) don't allow.
 */
export function replay(setup: MatchSetup, events: readonly ScoringEvent[]): MatchState {
  const state = initialState(setup);
  for (let i = 0; i < events.length; i++) {
    try {
      apply(state, events[i]);
    } catch (err) {
      if (err instanceof ScoringError) throw new ScoringError(err.message, i);
      throw err;
    }
    state.eventCount = i + 1;
  }
  return state;
}

/** `replay` that reports instead of throwing — for screens checking a move. */
export function tryReplay(
  setup: MatchSetup,
  events: readonly ScoringEvent[],
): { ok: true; state: MatchState } | { ok: false; error: string; eventIndex: number } {
  try {
    return { ok: true, state: replay(setup, events) };
  } catch (err) {
    if (err instanceof ScoringError) return { ok: false, error: err.message, eventIndex: err.eventIndex };
    throw err;
  }
}

// ── Lookups ──────────────────────────────────────────────────────────────────

function otherTeam(s: MatchState, teamId: string): string {
  const [a, b] = s.setup.sides;
  return a.teamId === teamId ? b.teamId : a.teamId;
}

function teamName(s: MatchState, teamId: string): string {
  return s.setup.sides.find((x) => x.teamId === teamId)?.name ?? 'this team';
}

function squadOf(s: MatchState, teamId: string): LineupPlayer[] {
  return s.squads[teamId] ?? [];
}

function requirePlayer(s: MatchState, teamId: string, id: string | null | undefined, what: string): LineupPlayer {
  const p = id ? squadOf(s, teamId).find((x) => x.id === id) : undefined;
  if (!p) fail(`${what} isn't in the ${teamName(s, teamId)} squad`);
  return p;
}

function keeperOf(s: MatchState, teamId: string): string | null {
  return s.setup.sides.find((x) => x.teamId === teamId)?.keeperId ?? null;
}

/** The innings being played, or a ScoringError. */
function liveInnings(s: MatchState): InningsState {
  const inn = s.innings[s.innings.length - 1];
  if (s.phase !== 'live' || !inn || inn.complete) fail('No innings is in progress');
  return inn;
}

/** The innings in progress, if any. */
export function currentInnings(s: MatchState): InningsState | null {
  const inn = s.innings[s.innings.length - 1];
  return inn && !inn.complete && s.phase === 'live' ? inn : null;
}

function maxWicketsFor(s: MatchState, inn: Pick<InningsState, 'battingTeamId' | 'superOver'>): number {
  const n = squadOf(s, inn.battingTeamId).length;
  if (inn.superOver) return Math.max(1, Math.min(2, n - 1));
  return Math.max(1, s.setup.rules.lastManStanding ? n : n - 1);
}

function findBatter(inn: InningsState, id: string): BatterState {
  const b = inn.batters.find((x) => x.id === id);
  if (!b) fail("That batter hasn't come in");
  return b;
}

function bowlerOf(s: MatchState, inn: InningsState, id: string): BowlerState {
  let b = inn.bowlers.find((x) => x.id === id);
  if (!b) {
    const p = requirePlayer(s, inn.bowlingTeamId, id, 'That bowler');
    b = { id, name: p.name, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0, dots: 0, fours: 0, sixes: 0 };
    inn.bowlers.push(b);
  }
  return b;
}

/** Squad members who could walk in now: yet to bat, or retired hurt. */
function candidates(s: MatchState, inn: InningsState): LineupPlayer[] {
  return squadOf(s, inn.battingTeamId).filter((p) => {
    if (p.id === inn.strikerId || p.id === inn.nonStrikerId) return false;
    const b = inn.batters.find((x) => x.id === p.id);
    return !b || b.status === 'retired_hurt';
  });
}

/** Who may come in next, for the scorer's picker. */
export function nextBatterOptions(s: MatchState): LineupPlayer[] {
  const inn = currentInnings(s);
  return inn ? candidates(s, inn) : [];
}

function overIndex(inn: InningsState, ballsPerOver: number): number {
  return Math.floor(inn.legalBalls / ballsPerOver);
}

/** Bowlers of the over before the one being bowled (or about to be). */
function previousOverBowlers(inn: InningsState, ballsPerOver: number): string[] {
  const idx = overIndex(inn, ballsPerOver);
  return inn.overs.find((o) => o.index === idx - 1)?.bowlerIds ?? [];
}

export interface BowlerOption {
  player: LineupPlayer;
  /** Why they can't bowl now, or null if they can. */
  blocked: string | null;
  figures: BowlerState | null;
}

/** The fielding squad with who may bowl the next ball, for the scorer's picker. */
export function bowlerOptions(s: MatchState): BowlerOption[] {
  const inn = currentInnings(s);
  if (!inn) return [];
  return squadOf(s, inn.bowlingTeamId).map((player) => ({
    player,
    blocked: bowlerBlocked(s, inn, player.id),
    figures: inn.bowlers.find((b) => b.id === player.id) ?? null,
  }));
}

function bowlerBlocked(s: MatchState, inn: InningsState, id: string): string | null {
  const { ballsPerOver: bpo, maxOversPerBowler: quota } = s.setup.rules;
  if (previousOverBowlers(inn, bpo).includes(id)) return 'Bowled the previous over';
  const figures = inn.bowlers.find((b) => b.id === id);
  if (quota !== null && !inn.superOver && figures && figures.balls >= quota * bpo) {
    return `Has bowled ${quota} over${quota === 1 ? '' : 's'}`;
  }
  if (s.awaiting === 'ball' && inn.bowlerId === id) return 'Already bowling';
  return null;
}

// ── Crease bookkeeping ───────────────────────────────────────────────────────

function swapEnds(inn: InningsState): void {
  if (!inn.strikerId || !inn.nonStrikerId) return;
  [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
}

function bringIn(s: MatchState, inn: InningsState, id: string): void {
  const existing = inn.batters.find((b) => b.id === id);
  if (existing) {
    if (existing.status !== 'retired_hurt') fail(`${existing.name} has already batted`);
    existing.status = 'batting';
    existing.dismissal = null;
    return;
  }
  const p = requirePlayer(s, inn.battingTeamId, id, 'That batter');
  inn.batters.push({
    id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, status: 'batting', dismissal: null,
  });
}

function currentPartnership(inn: InningsState) {
  const last = inn.partnerships[inn.partnerships.length - 1];
  return last && last.endedBy === null ? last : null;
}

function startPartnership(inn: InningsState): void {
  const a = inn.strikerId ?? inn.nonStrikerId;
  if (!a) return;
  const b = inn.strikerId && inn.nonStrikerId ? inn.nonStrikerId : null;
  inn.partnerships.push({ batterIds: [a, b], runs: 0, balls: 0, endedBy: null });
}

function endPartnership(inn: InningsState, why: 'wicket' | 'retired' | 'innings' | 'joined'): void {
  const p = currentPartnership(inn);
  if (p) p.endedBy = why;
}

function vacate(inn: InningsState, id: string): 'striker' | 'nonStriker' {
  if (inn.strikerId === id) { inn.strikerId = null; return 'striker'; }
  inn.nonStrikerId = null;
  return 'nonStriker';
}

/**
 * Puts `nextId` where a departing batter stood. Without one, the innings can
 * only go on if nobody is left to come in and last man standing lets the
 * survivor carry on alone; otherwise it is over.
 */
function fillVacancy(
  s: MatchState,
  inn: InningsState,
  vacated: 'striker' | 'nonStriker',
  nextId: string | null | undefined,
): 'filled' | 'alone' | 'closed' {
  const options = candidates(s, inn);
  if (nextId) {
    if (!options.some((p) => p.id === nextId)) fail("That batter can't come in now");
    bringIn(s, inn, nextId);
    if (vacated === 'striker') inn.strikerId = nextId;
    else inn.nonStrikerId = nextId;
    // A lone batter who had the crease to themselves sits at the striker's
    // end; the newcomer joins them at the other.
    if (!inn.strikerId) [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, null];
    startPartnership(inn);
    return 'filled';
  }
  // A retired-hurt batter who can't return is the scorer's call to make, so
  // only someone yet to bat makes naming the next batter compulsory.
  const freshOptions = options.filter((p) => !inn.batters.some((b) => b.id === p.id));
  if (freshOptions.length > 0) fail('Choose the next batter');
  const survivor = inn.strikerId ?? inn.nonStrikerId;
  if (s.setup.rules.lastManStanding && survivor && !inn.superOver) {
    inn.strikerId = survivor;
    inn.nonStrikerId = null;
    startPartnership(inn);
    return 'alone';
  }
  return 'closed';
}

/** Puts `id` on strike or off it, as the scorer said. */
function placeOnStrike(inn: InningsState, id: string, onStrike: boolean | undefined): void {
  if (onStrike === undefined) return;
  if ((inn.strikerId === id) !== onStrike) swapEnds(inn);
}

function validFielder(s: MatchState, inn: InningsState, id: string | null | undefined): string | null {
  if (!id) return null;
  if (id === SUB_FIELDER) return id;
  requirePlayer(s, inn.bowlingTeamId, id, 'That fielder');
  return id;
}

// ── Innings end ──────────────────────────────────────────────────────────────

function finishInnings(inn: InningsState, reason: NonNullable<InningsState['endReason']>): void {
  inn.complete = true;
  inn.endReason = reason;
  inn.freeHit = false;
  for (const b of inn.batters) if (b.status === 'batting') b.status = 'not_out';
  endPartnership(inn, 'innings');
}

function pairResult(s: MatchState, first: InningsState, second: InningsState): MatchResult {
  const target = second.target ?? first.runs + 1;
  const superOver = second.superOver;
  if (second.runs >= target) {
    return {
      kind: 'won', winnerTeamId: second.battingTeamId, by: 'wickets',
      margin: second.maxWickets - second.wickets,
      ballsLeft: second.maxOvers * s.setup.rules.ballsPerOver - second.legalBalls,
      superOver, revised: second.targetRevised,
    };
  }
  if (second.runs === target - 1) return { kind: 'tie', superOver };
  return {
    kind: 'won', winnerTeamId: first.battingTeamId, by: 'runs', margin: target - 1 - second.runs,
    ballsLeft: null, superOver, revised: second.targetRevised,
  };
}

function closeInnings(s: MatchState, inn: InningsState, reason: NonNullable<InningsState['endReason']>): void {
  finishInnings(inn, reason);
  if (inn.index % 2 === 0) {
    s.phase = 'break';
    s.awaiting = 'start_innings';
    return;
  }
  s.result = pairResult(s, s.innings[inn.index - 1], inn);
  s.phase = 'completed';
  s.awaiting = 'none';
}

/** Closes the innings if the target, the wickets or the overs have run out. */
function closeIfDone(s: MatchState, inn: InningsState): boolean {
  const bpo = s.setup.rules.ballsPerOver;
  if (inn.target !== null && inn.runs >= inn.target) closeInnings(s, inn, 'target');
  else if (inn.wickets >= inn.maxWickets) closeInnings(s, inn, 'all_out');
  else if (inn.legalBalls >= inn.maxOvers * bpo) closeInnings(s, inn, 'overs');
  else return false;
  return true;
}

// ── Events ───────────────────────────────────────────────────────────────────

function apply(s: MatchState, e: ScoringEvent): void {
  if (s.phase === 'completed') {
    // A tie can still go to a super over (which checks for itself) or be
    // settled by the organizer; otherwise only the award is left to make.
    const tied = s.result?.kind === 'tie';
    const allowed = e.type === 'potm' || e.type === 'super_over' || (tied && e.type === 'end_match');
    if (!allowed) fail('The match is over');
  }
  switch (e.type) {
    case 'start_innings': return startInnings(s, e);
    case 'ball': return ball(s, e);
    case 'bowler': return setBowler(s, e.bowlerId);
    case 'dismiss': return dismiss(s, e.kind, e.batterId, e.fielderId, e.nextBatterId, e.nextOnStrike);
    case 'next_batter': return nextBatter(s, e.batterId, e.onStrike);
    case 'swap': {
      const inn = liveInnings(s);
      if (!inn.strikerId || !inn.nonStrikerId) fail('There is only one batter at the crease');
      swapEnds(inn);
      return;
    }
    case 'penalty': return penalty(s, e.runs, e.to);
    case 'add_player': return addPlayer(s, e.teamId, e.player);
    case 'revise': return revise(s, e.overs ?? null, e.target ?? null);
    case 'end_innings': {
      const inn = liveInnings(s);
      closeInnings(s, inn, e.reason);
      return;
    }
    case 'super_over': {
      if (s.phase !== 'completed' || s.result?.kind !== 'tie') fail('A super over is only for a tied match');
      s.superOvers++;
      s.result = null;
      s.pendingRevision = null;
      s.phase = 'break';
      s.awaiting = 'start_innings';
      return;
    }
    case 'end_match': return endMatch(s, e.result, e.winnerTeamId ?? null, e.note ?? null);
    case 'potm': {
      if (s.phase !== 'completed') fail('Player of the match is picked once the match is over');
      if (e.playerId) {
        const known = Object.values(s.squads).some((sq) => sq.some((p) => p.id === e.playerId));
        if (!known) fail("That player isn't in either squad");
      }
      s.playerOfMatchId = e.playerId;
      return;
    }
  }
}

function nextBattingTeam(s: MatchState): string {
  const index = s.innings.length;
  if (index === 0) {
    const { winnerTeamId, decision } = s.setup.toss;
    return decision === 'bat' ? winnerTeamId : otherTeam(s, winnerTeamId);
  }
  if (index % 2 === 1) return s.innings[index - 1].bowlingTeamId;
  // A super over is opened by the side that batted second in the tie
  return s.innings[index - 1].battingTeamId;
}

/** The innings `start_innings` would begin next, for the scorer's start screen. */
export function upcomingInnings(s: MatchState): {
  index: number;
  battingTeamId: string;
  bowlingTeamId: string;
  superOver: boolean;
  overs: number;
  target: number | null;
} | null {
  if (s.phase !== 'pre' && s.phase !== 'break') return null;
  const index = s.innings.length;
  const battingTeamId = nextBattingTeam(s);
  const previous = s.innings[index - 1];
  const superOver = index >= 2;
  const overs = superOver ? 1 : s.pendingRevision?.overs ?? (index === 1 ? previous.maxOvers : s.setup.rules.overs);
  const target = index % 2 === 1 ? s.pendingRevision?.target ?? previous.runs + 1 : null;
  return { index, battingTeamId, bowlingTeamId: otherTeam(s, battingTeamId), superOver, overs, target };
}

function startInnings(s: MatchState, e: Extract<ScoringEvent, { type: 'start_innings' }>): void {
  if (s.phase === 'live') fail('An innings is already in progress');
  const index = s.innings.length;
  const superOver = index >= 2;
  const battingTeamId = nextBattingTeam(s);
  const bowlingTeamId = otherTeam(s, battingTeamId);

  requirePlayer(s, battingTeamId, e.strikerId, 'The striker');
  if (!e.nonStrikerId) fail('Choose both opening batters');
  requirePlayer(s, battingTeamId, e.nonStrikerId, 'The non-striker');
  if (e.nonStrikerId === e.strikerId) fail('The two openers must be different players');
  requirePlayer(s, bowlingTeamId, e.bowlerId, 'The bowler');

  const revision = s.pendingRevision;
  s.pendingRevision = null;
  const previous = s.innings[index - 1];
  const maxOvers = superOver
    ? 1
    : revision?.overs ?? (index === 1 ? previous.maxOvers : s.setup.rules.overs);

  let target: number | null = null;
  let targetRevised = false;
  if (index % 2 === 1) {
    if (revision?.target) {
      target = revision.target;
      targetRevised = true;
    } else {
      target = previous.runs + 1;
    }
  }

  const inn: InningsState = {
    index, battingTeamId, bowlingTeamId, superOver, maxOvers,
    maxWickets: 0, target, targetRevised,
    runs: 0, wickets: 0, legalBalls: 0,
    extras: { b: 0, lb: 0, wd: 0, nb: 0, p: 0 },
    batters: [], bowlers: [],
    strikerId: e.strikerId, nonStrikerId: e.nonStrikerId, bowlerId: e.bowlerId,
    overs: [], fallOfWickets: [], partnerships: [],
    freeHit: false, complete: false, endReason: null,
  };
  inn.maxWickets = maxWicketsFor(s, inn);
  bringIn(s, inn, e.strikerId);
  bringIn(s, inn, e.nonStrikerId);
  bowlerOf(s, inn, e.bowlerId);
  startPartnership(inn);

  // Penalty runs awarded to this side while it was fielding
  const carried = s.pendingPenalty[battingTeamId];
  if (carried) {
    inn.runs += carried;
    inn.extras.p += carried;
    delete s.pendingPenalty[battingTeamId];
  }

  s.innings.push(inn);
  s.phase = 'live';
  s.awaiting = 'ball';
}

function ball(s: MatchState, e: BallEvent): void {
  const inn = liveInnings(s);
  if (s.awaiting === 'bowler') fail('Choose the bowler for the next over first');
  const rules = s.setup.rules;
  const bpo = rules.ballsPerOver;
  const strikerId = inn.strikerId;
  const bowlerId = inn.bowlerId;
  if (!strikerId) fail('Nobody is on strike');
  if (!bowlerId) fail('Choose a bowler first');

  const extra = e.extra ?? null;
  const runs = e.runs;
  if (!Number.isInteger(runs) || runs < 0 || runs > LIMITS.runsPerBall) {
    fail(`Runs off one ball must be between 0 and ${LIMITS.runsPerBall}`);
  }
  if (extra === 'b' || extra === 'lb') {
    if (runs === 0 && !e.wicket) fail(extra === 'b' ? 'A bye needs at least one run' : 'A leg bye needs at least one run');
  }
  const nbRunsAs = extra === 'nb' ? (e.nbRunsAs ?? 'bat') : null;
  const offBat = extra === null || nbRunsAs === 'bat';

  let boundary: 4 | 6 | null = null;
  if (e.boundary) {
    if (runs === 4) boundary = 4;
    else if (runs === 6 && offBat) boundary = 6;
    else fail('A boundary is a four, or a six off the bat');
  }
  const ran = boundary ? 0 : e.ran ?? runs;
  if (!Number.isInteger(ran) || ran < 0 || ran > runs) fail("Runs run can't be more than the runs scored");

  const freeHit = inn.freeHit;
  const wicket = e.wicket ?? null;
  let fielderId: string | null = null;
  if (wicket) {
    if (!allowedDismissals(extra, freeHit).includes(wicket.kind)) {
      fail(freeHit
        ? "On a free hit the batter can only be run out (or out obstructing the field, or hitting the ball twice)"
        : `A batter can't be out that way off ${extra === 'wd' ? 'a wide' : extra === 'nb' ? 'a no-ball' : extra ? 'a bye' : 'this ball'}`);
    }
    if (wicket.outId !== strikerId && wicket.outId !== inn.nonStrikerId) fail("That batter isn't at the crease");
    if (strikerOnly(wicket.kind) && wicket.outId !== strikerId) fail('Only the striker can be out that way');
    if (scoresNoRuns(wicket.kind) && runs > 0) fail('No runs count off a ball the batter is out like that');
    if (boundary) fail('The ball is dead once it reaches the boundary');
    fielderId = validFielder(s, inn, wicket.fielderId);
    if (wicket.kind === 'stumped' && !fielderId) fielderId = keeperOf(s, inn.bowlingTeamId);
  }

  const counts = countsInOver(extra, rules);
  const penalty = extra === 'wd' ? rules.wideRuns : extra === 'nb' ? rules.noBallRuns : 0;
  const total = penalty + runs;
  const batRuns = offBat ? runs : 0;
  const bowlerRuns = extra === 'wd' ? total : extra === 'nb' ? penalty + batRuns : batRuns;
  const faced = extra !== 'wd';

  const idx = overIndex(inn, bpo);
  let over: OverState | undefined = inn.overs[inn.overs.length - 1];
  if (!over || over.index !== idx) {
    over = { index: idx, bowlerIds: [], balls: [], runs: 0, wickets: 0, legal: 0 };
    inn.overs.push(over);
  }
  if (!over.bowlerIds.includes(bowlerId)) over.bowlerIds.push(bowlerId);

  const striker = findBatter(inn, strikerId);
  if (faced) {
    striker.balls++;
    if (batRuns === 0) striker.dots++;
  }
  striker.runs += batRuns;
  if (offBat && boundary === 4) striker.fours++;
  if (offBat && boundary === 6) striker.sixes++;

  const bowler = bowlerOf(s, inn, bowlerId);
  if (counts) bowler.balls++;
  bowler.runs += bowlerRuns;
  if (extra === 'wd') bowler.wides++;
  if (extra === 'nb') bowler.noBalls++;
  if (counts && bowlerRuns === 0) bowler.dots++;
  if (offBat && boundary === 4) bowler.fours++;
  if (offBat && boundary === 6) bowler.sixes++;

  if (extra === 'wd') inn.extras.wd += total;
  if (extra === 'nb') {
    inn.extras.nb += penalty;
    if (nbRunsAs === 'bye') inn.extras.b += runs;
    if (nbRunsAs === 'legbye') inn.extras.lb += runs;
  }
  if (extra === 'b') inn.extras.b += runs;
  if (extra === 'lb') inn.extras.lb += runs;
  inn.runs += total;
  if (counts) inn.legalBalls++;

  const record: BallRecord = {
    eventId: e.id,
    label: `${over.index}.${over.legal + 1}`,
    over: over.index,
    strikerId,
    nonStrikerId: inn.nonStrikerId,
    bowlerId,
    total, batRuns, extra, penalty, extraRuns: total - batRuns, bowlerRuns, nbRunsAs, boundary,
    countsInOver: counts,
    freeHit,
    wicket: wicket ? { kind: wicket.kind, outId: wicket.outId, fielderId } : null,
  };
  over.balls.push(record);
  over.runs += total;
  if (counts) over.legal++;

  const stand = currentPartnership(inn);
  if (stand) {
    stand.runs += total;
    if (faced) stand.balls++;
  }

  // Ends change with every odd run actually run
  if (ran % 2 === 1) swapEnds(inn);

  let vacated: 'striker' | 'nonStriker' | null = null;
  if (wicket) {
    const out = findBatter(inn, wicket.outId);
    const credited = creditsBowler(wicket.kind);
    out.status = 'out';
    out.dismissal = { kind: wicket.kind, bowlerId: credited ? bowlerId : null, fielderId };
    if (credited) bowler.wickets++;
    inn.wickets++;
    over.wickets++;
    inn.fallOfWickets.push({
      wicket: inn.wickets, runs: inn.runs, batterId: out.id, over: oversText(inn.legalBalls, bpo),
    });
    endPartnership(inn, 'wicket');
    vacated = vacate(inn, out.id);
  }

  const overDone = counts && over.legal === bpo;
  if (overDone && over.bowlerIds.length === 1 && over.balls.every((b) => b.bowlerRuns === 0)) {
    bowler.maidens++;
  }

  if (extra === 'nb') inn.freeHit = rules.freeHit;
  else if (extra !== 'wd') inn.freeHit = false;

  if (closeIfDone(s, inn)) return;

  let newBatterId: string | null = null;
  if (vacated && wicket) {
    const filled = fillVacancy(s, inn, vacated, wicket.nextBatterId);
    if (filled === 'closed') {
      closeInnings(s, inn, 'all_out');
      return;
    }
    if (filled === 'filled') newBatterId = wicket.nextBatterId ?? null;
  }

  if (overDone) {
    swapEnds(inn);
    inn.bowlerId = null;
    s.awaiting = 'bowler';
  }

  // Only run outs and obstruction leave the ends open to question; after the
  // others the newcomer is where the law puts them.
  if (newBatterId && wicket && !strikerOnly(wicket.kind)) placeOnStrike(inn, newBatterId, wicket.nextOnStrike);
}

function setBowler(s: MatchState, bowlerId: string): void {
  const inn = liveInnings(s);
  const player = requirePlayer(s, inn.bowlingTeamId, bowlerId, 'That bowler');
  const blocked = bowlerBlocked(s, inn, bowlerId);
  if (blocked) fail(`${player.name} can't bowl now — ${blocked.toLowerCase()}`);
  bowlerOf(s, inn, bowlerId);
  inn.bowlerId = bowlerId;
  s.awaiting = 'ball';
}

function dismiss(
  s: MatchState,
  kind: CreaseDismissal,
  batterId: string,
  fielder: string | null | undefined,
  nextBatterId: string | null | undefined,
  nextOnStrike: boolean | undefined,
): void {
  const inn = liveInnings(s);
  if (batterId !== inn.strikerId && batterId !== inn.nonStrikerId) fail("That batter isn't at the crease");
  const batter = findBatter(inn, batterId);
  const bpo = s.setup.rules.ballsPerOver;

  if (kind === 'retired_hurt') {
    batter.status = 'retired_hurt';
    batter.dismissal = { kind: 'retired_hurt', bowlerId: null, fielderId: null };
    endPartnership(inn, 'retired');
  } else {
    let fielderId: string | null = null;
    if (kind === 'run_out') {
      // Backing up too far: the bowler runs out the non-striker before bowling
      if (batterId !== inn.nonStrikerId) fail('Only the non-striker can be run out backing up');
      if (s.awaiting !== 'ball' || !inn.bowlerId) fail('Choose the bowler first');
      fielderId = validFielder(s, inn, fielder) ?? inn.bowlerId;
    }
    if (kind === 'timed_out' && batter.balls > 0) fail('Only a batter yet to face can be timed out');
    batter.status = 'out';
    batter.dismissal = { kind, bowlerId: null, fielderId };
    inn.wickets++;
    inn.fallOfWickets.push({
      wicket: inn.wickets, runs: inn.runs, batterId, over: oversText(inn.legalBalls, bpo),
    });
    endPartnership(inn, 'wicket');
  }

  const vacated = vacate(inn, batterId);
  if (closeIfDone(s, inn)) return;
  const filled = fillVacancy(s, inn, vacated, nextBatterId);
  if (filled === 'closed') {
    closeInnings(s, inn, 'all_out');
    return;
  }
  if (filled === 'filled' && nextBatterId) placeOnStrike(inn, nextBatterId, nextOnStrike);
}

function nextBatter(s: MatchState, batterId: string, onStrike: boolean | undefined): void {
  const inn = liveInnings(s);
  if (inn.strikerId && inn.nonStrikerId) fail('Both batters are already in');
  if (!candidates(s, inn).some((p) => p.id === batterId)) fail("That batter can't come in now");
  endPartnership(inn, 'joined');
  bringIn(s, inn, batterId);
  if (!inn.strikerId) inn.strikerId = batterId;
  else inn.nonStrikerId = batterId;
  startPartnership(inn);
  placeOnStrike(inn, batterId, onStrike);
}

function penalty(s: MatchState, runs: number, to: 'batting' | 'fielding'): void {
  const inn = liveInnings(s);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) fail('Penalty runs must be between 1 and 10');
  if (to === 'batting') {
    inn.runs += runs;
    inn.extras.p += runs;
    closeIfDone(s, inn);
    return;
  }
  // Awarded to the fielding side: onto its innings if it has batted in this
  // pair, otherwise carried to the start of the innings it is about to bat.
  if (inn.index % 2 === 1) {
    const prev = s.innings[inn.index - 1];
    prev.runs += runs;
    prev.extras.p += runs;
    if (!inn.targetRevised) inn.target = prev.runs + 1;
  } else {
    s.pendingPenalty[inn.bowlingTeamId] = (s.pendingPenalty[inn.bowlingTeamId] ?? 0) + runs;
  }
}

function addPlayer(s: MatchState, teamId: string, player: LineupPlayer): void {
  if (!s.setup.sides.some((x) => x.teamId === teamId)) fail('That team isn\'t playing this match');
  const known = Object.values(s.squads).some((sq) => sq.some((p) => p.id === player.id));
  if (known) fail(`${player.name} is already in a squad`);
  const squad = squadOf(s, teamId);
  if (squad.length >= LIMITS.squad.max) fail(`A squad can have at most ${LIMITS.squad.max} players`);
  s.squads[teamId] = [...squad, player];
  for (const inn of s.innings) if (!inn.complete && inn.battingTeamId === teamId) inn.maxWickets = maxWicketsFor(s, inn);
}

function revise(s: MatchState, overs: number | null, target: number | null): void {
  if (overs === null && target === null) fail('Nothing to revise');
  if (overs !== null && (!Number.isInteger(overs) || overs < LIMITS.overs.min || overs > LIMITS.overs.max)) {
    fail(`Overs must be between ${LIMITS.overs.min} and ${LIMITS.overs.max}`);
  }
  if (target !== null && (!Number.isInteger(target) || target < 1 || target > 2000)) fail('That target is out of range');
  const bpo = s.setup.rules.ballsPerOver;

  if (s.phase === 'live') {
    const inn = liveInnings(s);
    if (inn.superOver) fail("A super over can't be revised");
    if (overs !== null) {
      if (overs * bpo < inn.legalBalls) fail('More overs than that have already been bowled');
      inn.maxOvers = overs;
    }
    if (target !== null) {
      if (inn.index % 2 === 0) fail('Only the side batting second has a target');
      inn.target = target;
      inn.targetRevised = true;
    }
    // Cut to exactly the overs already bowled, this closes the innings
    closeIfDone(s, inn);
    return;
  }
  if (s.phase === 'pre' || s.phase === 'break') {
    const next = s.innings.length;
    if (next >= 2) fail("A super over can't be revised");
    if (target !== null && next % 2 === 0) fail('Only the side batting second has a target');
    s.pendingRevision = {
      overs: overs ?? s.pendingRevision?.overs ?? null,
      target: target ?? s.pendingRevision?.target ?? null,
    };
    return;
  }
  fail('The match is over');
}

function endMatch(
  s: MatchState,
  result: 'abandoned' | 'no_result' | 'awarded',
  winnerTeamId: string | null,
  note: string | null,
): void {
  const inn = s.innings[s.innings.length - 1];
  if (inn && !inn.complete) finishInnings(inn, 'match_ended');
  if (result === 'awarded') {
    if (!winnerTeamId || !s.setup.sides.some((x) => x.teamId === winnerTeamId)) fail('Choose which team the match is awarded to');
    s.result = { kind: 'awarded', winnerTeamId, note };
  } else {
    s.result = { kind: result, note };
  }
  s.pendingRevision = null;
  s.phase = 'completed';
  s.awaiting = 'none';
}
