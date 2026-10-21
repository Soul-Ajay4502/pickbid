import { DEFAULT_RULES, LIMITS, ScoringError, defaultBowlerQuota } from './rules';
import type {
  CreaseDismissal, DeliveryDismissal, Extra, LineupPlayer, MatchSetup, ScoringEvent, ScoringRules, SideSetup,
} from './types';

// Shape checks for setups and events arriving from a request body. Everything
// is rebuilt field by field, so an unexpected property can never ride into the
// stored log; the engine then judges whether the moves are legal.

function fail(message: string): never {
  throw new ScoringError(message);
}

type Raw = Record<string, unknown>;

function obj(v: unknown, what: string): Raw {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${what} is missing`);
  return v as Raw;
}

function str(v: unknown, what: string, max = 64): string {
  if (typeof v !== 'string' || !v.trim()) fail(`${what} is missing`);
  const s = v.trim();
  if (s.length > max) fail(`${what} is too long`);
  return s;
}

function optStr(v: unknown, what: string, max = 64): string | null {
  return v === null || v === undefined || v === '' ? null : str(v, what, max);
}

function int(v: unknown, what: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    fail(`${what} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function optBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], what: string): T {
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v)) fail(`${what} isn't valid`);
  return v as T;
}

const EXTRAS: readonly Extra[] = ['wd', 'nb', 'b', 'lb'];
const DELIVERY_OUTS: readonly DeliveryDismissal[] = [
  'bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'run_out', 'obstructing_field', 'hit_ball_twice',
];
const CREASE_OUTS: readonly CreaseDismissal[] = ['retired_hurt', 'retired_out', 'timed_out', 'run_out'];

export function parseRules(raw: unknown): ScoringRules {
  const r = obj(raw ?? {}, 'Match rules');
  const overs = r.overs === undefined ? DEFAULT_RULES.overs : int(r.overs, 'Overs', LIMITS.overs.min, LIMITS.overs.max);
  const quota = r.maxOversPerBowler === null
    ? null
    : r.maxOversPerBowler === undefined
      ? defaultBowlerQuota(overs)
      : int(r.maxOversPerBowler, 'Overs per bowler', 1, overs);
  return {
    overs,
    ballsPerOver: r.ballsPerOver === undefined
      ? DEFAULT_RULES.ballsPerOver
      : int(r.ballsPerOver, 'Balls per over', LIMITS.ballsPerOver.min, LIMITS.ballsPerOver.max),
    wideRuns: r.wideRuns === undefined
      ? DEFAULT_RULES.wideRuns
      : int(r.wideRuns, 'Runs for a wide', LIMITS.penaltyRuns.min, LIMITS.penaltyRuns.max),
    noBallRuns: r.noBallRuns === undefined
      ? DEFAULT_RULES.noBallRuns
      : int(r.noBallRuns, 'Runs for a no-ball', LIMITS.penaltyRuns.min, LIMITS.penaltyRuns.max),
    wideReball: bool(r.wideReball, DEFAULT_RULES.wideReball),
    noBallReball: bool(r.noBallReball, DEFAULT_RULES.noBallReball),
    freeHit: bool(r.freeHit, DEFAULT_RULES.freeHit),
    lastManStanding: bool(r.lastManStanding, DEFAULT_RULES.lastManStanding),
    maxOversPerBowler: quota,
  };
}

export function parseLineupPlayer(raw: unknown): LineupPlayer {
  const p = obj(raw, 'A player');
  return { id: str(p.id, 'Player id'), name: str(p.name, 'Player name', 80) };
}

function parseSide(raw: unknown, label: string): SideSetup {
  const s = obj(raw, label);
  if (!Array.isArray(s.players)) fail(`${label} has no squad`);
  const players = s.players.map(parseLineupPlayer);
  if (players.length < LIMITS.squad.min) fail(`${label} needs at least ${LIMITS.squad.min} players`);
  if (players.length > LIMITS.squad.max) fail(`${label} can have at most ${LIMITS.squad.max} players`);
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) fail(`${label} lists a player twice`);
  const captainId = optStr(s.captainId, 'Captain');
  const keeperId = optStr(s.keeperId, 'Wicketkeeper');
  if (captainId && !ids.has(captainId)) fail(`${label}'s captain isn't in the squad`);
  if (keeperId && !ids.has(keeperId)) fail(`${label}'s wicketkeeper isn't in the squad`);
  const color = typeof s.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(s.color) ? s.color : '#22c55e';
  return {
    teamId: str(s.teamId, `${label}'s team`),
    name: str(s.name, `${label}'s name`, 80),
    color,
    players,
    captainId,
    keeperId,
  };
}

export function parseSetup(raw: unknown): MatchSetup {
  const r = obj(raw, 'Match setup');
  if (!Array.isArray(r.sides) || r.sides.length !== 2) fail('A match needs two sides');
  const sides: [SideSetup, SideSetup] = [parseSide(r.sides[0], 'Team 1'), parseSide(r.sides[1], 'Team 2')];
  if (sides[0].teamId === sides[1].teamId) fail('A team can’t play itself');
  const shared = sides[0].players.find((p) => sides[1].players.some((q) => q.id === p.id));
  if (shared) fail(`${shared.name} is in both squads`);
  const toss = obj(r.toss, 'The toss');
  const winnerTeamId = str(toss.winnerTeamId, 'Toss winner');
  if (winnerTeamId !== sides[0].teamId && winnerTeamId !== sides[1].teamId) fail('The toss winner must be one of the two teams');
  return {
    rules: parseRules(r.rules),
    sides,
    toss: { winnerTeamId, decision: oneOf(toss.decision, ['bat', 'bowl'] as const, 'Toss decision') },
  };
}

export function parseEvent(raw: unknown): ScoringEvent {
  const e = obj(raw, 'An event');
  const id = str(e.id, 'Event id');
  const at = typeof e.at === 'number' && Number.isFinite(e.at) ? Math.round(e.at) : 0;
  const type = typeof e.type === 'string' ? e.type : '';
  switch (type) {
    case 'start_innings':
      return {
        id, at, type,
        strikerId: str(e.strikerId, 'Striker'),
        nonStrikerId: optStr(e.nonStrikerId, 'Non-striker'),
        bowlerId: str(e.bowlerId, 'Bowler'),
      };
    case 'ball': {
      const extra = e.extra === null || e.extra === undefined ? null : oneOf(e.extra, EXTRAS, 'Extra');
      const w = e.wicket === null || e.wicket === undefined ? null : obj(e.wicket, 'Wicket');
      return {
        id, at, type,
        runs: int(e.runs ?? 0, 'Runs', 0, LIMITS.runsPerBall),
        extra,
        ...(extra === 'nb' ? { nbRunsAs: e.nbRunsAs === undefined ? 'bat' : oneOf(e.nbRunsAs, ['bat', 'bye', 'legbye'] as const, 'No-ball runs') } : {}),
        ...(e.boundary === true ? { boundary: true } : {}),
        ...(e.ran !== undefined && e.ran !== null ? { ran: int(e.ran, 'Runs run', 0, LIMITS.runsPerBall) } : {}),
        wicket: w
          ? {
            kind: oneOf(w.kind, DELIVERY_OUTS, 'Dismissal'),
            outId: str(w.outId, 'Batter out'),
            fielderId: optStr(w.fielderId, 'Fielder'),
            nextBatterId: optStr(w.nextBatterId, 'Next batter'),
            ...(optBool(w.nextOnStrike) !== undefined ? { nextOnStrike: optBool(w.nextOnStrike) } : {}),
          }
          : null,
      };
    }
    case 'bowler':
      return { id, at, type, bowlerId: str(e.bowlerId, 'Bowler') };
    case 'dismiss':
      return {
        id, at, type,
        kind: oneOf(e.kind, CREASE_OUTS, 'Dismissal'),
        batterId: str(e.batterId, 'Batter'),
        fielderId: optStr(e.fielderId, 'Fielder'),
        nextBatterId: optStr(e.nextBatterId, 'Next batter'),
        ...(optBool(e.nextOnStrike) !== undefined ? { nextOnStrike: optBool(e.nextOnStrike) } : {}),
      };
    case 'next_batter':
      return {
        id, at, type,
        batterId: str(e.batterId, 'Batter'),
        ...(optBool(e.onStrike) !== undefined ? { onStrike: optBool(e.onStrike) } : {}),
      };
    case 'swap':
    case 'super_over':
      return { id, at, type };
    case 'penalty':
      return { id, at, type, runs: int(e.runs, 'Penalty runs', 1, 10), to: oneOf(e.to, ['batting', 'fielding'] as const, 'Penalty side') };
    case 'add_player':
      return { id, at, type, teamId: str(e.teamId, 'Team'), player: parseLineupPlayer(e.player) };
    case 'revise':
      return {
        id, at, type,
        overs: e.overs === null || e.overs === undefined ? null : int(e.overs, 'Overs', LIMITS.overs.min, LIMITS.overs.max),
        target: e.target === null || e.target === undefined ? null : int(e.target, 'Target', 1, 2000),
      };
    case 'end_innings':
      return { id, at, type, reason: oneOf(e.reason, ['declared', 'other'] as const, 'Reason') };
    case 'end_match':
      return {
        id, at, type,
        result: oneOf(e.result, ['abandoned', 'no_result', 'awarded'] as const, 'Result'),
        winnerTeamId: optStr(e.winnerTeamId, 'Winner'),
        ...(optStr(e.note, 'Note', 140) ? { note: optStr(e.note, 'Note', 140)! } : {}),
      };
    case 'potm':
      return { id, at, type, playerId: optStr(e.playerId, 'Player') };
    default:
      fail('Unknown event');
  }
}

export function parseEvents(raw: unknown): ScoringEvent[] {
  if (!Array.isArray(raw)) fail('Events must be a list');
  if (raw.length > LIMITS.events) fail('Too many events');
  const events = raw.map(parseEvent);
  const ids = new Set(events.map((e) => e.id));
  if (ids.size !== events.length) fail('An event appears twice');
  return events;
}
