import { nameLookup, oversText, resultText, scoreLine, scoreText, statusText, teamNameLookup } from './format';
import type { InningsState, MatchResult, MatchState } from './types';

// What a scored match contributes outside its own screen: a compact summary
// for match lists and the points table, the result written back onto the
// match row, and one line per player for league-wide stats. All derived from
// the replayed state, so none of it can drift from the scorecard.

export interface InningsLine {
  teamId: string;
  runs: number;
  wickets: number;
  /** Deliveries faced that counted towards an over. */
  balls: number;
  /** The innings' full quota of deliveries — what NRR charges an all-out side. */
  maxBalls: number;
  allOut: boolean;
  superOver: boolean;
}

/** A scored match as lists and tables need it — no players, no balls. */
export interface MatchScoreSummary {
  phase: MatchState['phase'];
  ballsPerOver: number;
  innings: InningsLine[];
  result: MatchResult | null;
  resultText: string;
  statusText: string;
  /** The innings in progress, for a LIVE badge. */
  live: { battingTeamId: string; score: string; overs: string; target: number | null } | null;
  playerOfMatch: { id: string; name: string } | null;
}

function line(inn: InningsState, ballsPerOver: number): InningsLine {
  return {
    teamId: inn.battingTeamId,
    runs: inn.runs,
    wickets: inn.wickets,
    balls: inn.legalBalls,
    maxBalls: inn.maxOvers * ballsPerOver,
    allOut: inn.endReason === 'all_out',
    superOver: inn.superOver,
  };
}

export function summarizeMatch(state: MatchState): MatchScoreSummary {
  const bpo = state.setup.rules.ballsPerOver;
  const current = state.phase === 'live' ? state.innings[state.innings.length - 1] : null;
  const nameOf = nameLookup(state);
  return {
    phase: state.phase,
    ballsPerOver: bpo,
    innings: state.innings.map((inn) => line(inn, bpo)),
    result: state.result,
    resultText: resultText(state.result, teamNameLookup(state)),
    statusText: statusText(state),
    live: current
      ? {
        battingTeamId: current.battingTeamId,
        score: scoreText(current),
        overs: oversText(current.legalBalls, bpo),
        target: current.target,
      }
      : null,
    playerOfMatch: state.playerOfMatchId ? { id: state.playerOfMatchId, name: nameOf(state.playerOfMatchId) } : null,
  };
}

/**
 * The result as the match row stores it, or null while the match is unfinished
 * — a live score must not reach the points table, which counts any match with
 * a score as played.
 */
export function matchRowResult(state: MatchState): {
  team1Score: string | null;
  team2Score: string | null;
  winnerTeamId: string | null;
} | null {
  if (state.phase !== 'completed' || !state.result) return null;
  const bpo = state.setup.rules.ballsPerOver;
  const main = state.innings.filter((inn) => !inn.superOver);
  const scoreOf = (teamId: string): string | null => {
    const inn = main.find((i) => i.battingTeamId === teamId);
    return inn ? scoreLine(inn, bpo) : null;
  };
  const [a, b] = state.setup.sides;
  let team1Score = scoreOf(a.teamId);
  let team2Score = scoreOf(b.teamId);
  const r = state.result;
  // Called off before a ball: still a played fixture, worth a point each
  if (!team1Score && !team2Score && (r.kind === 'abandoned' || r.kind === 'no_result')) {
    team1Score = team2Score = r.kind === 'abandoned' ? 'Abandoned' : 'No result';
  }
  const winnerTeamId = r.kind === 'won' || r.kind === 'awarded' ? r.winnerTeamId : null;
  return { team1Score, team2Score, winnerTeamId };
}

/** One player's part in one match. Super overs don't count, as in the record books. */
export interface PlayerMatchLine {
  id: string;
  name: string;
  teamId: string;
  batted: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  /** Dismissed — retired hurt and not out both leave this false. */
  out: boolean;
  bowled: boolean;
  /** Deliveries bowled that counted towards an over. */
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export function playerMatchLines(state: MatchState): PlayerMatchLine[] {
  const lines = new Map<string, PlayerMatchLine>();
  for (const [teamId, squad] of Object.entries(state.squads)) {
    for (const p of squad) {
      lines.set(p.id, {
        id: p.id, name: p.name, teamId,
        batted: false, runs: 0, balls: 0, fours: 0, sixes: 0, out: false,
        bowled: false, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0, dots: 0,
        catches: 0, stumpings: 0, runOuts: 0,
      });
    }
  }
  for (const inn of state.innings) {
    if (inn.superOver) continue;
    for (const b of inn.batters) {
      const l = lines.get(b.id);
      if (!l) continue;
      l.batted = true;
      l.runs += b.runs;
      l.balls += b.balls;
      l.fours += b.fours;
      l.sixes += b.sixes;
      if (b.status === 'out') l.out = true;
      const d = b.dismissal;
      const fielder = d?.fielderId ? lines.get(d.fielderId) : undefined;
      if (d && fielder) {
        if (d.kind === 'caught') fielder.catches++;
        else if (d.kind === 'stumped') fielder.stumpings++;
        else if (d.kind === 'run_out') fielder.runOuts++;
      }
    }
    for (const b of inn.bowlers) {
      const l = lines.get(b.id);
      if (!l) continue;
      l.bowled = l.bowled || b.balls > 0 || b.wides + b.noBalls > 0;
      l.ballsBowled += b.balls;
      l.runsConceded += b.runs;
      l.wickets += b.wickets;
      l.maidens += b.maidens;
      l.wides += b.wides;
      l.noBalls += b.noBalls;
      l.dots += b.dots;
    }
  }
  return [...lines.values()];
}

// ── League aggregates ────────────────────────────────────────────────────────

export interface BattingRow {
  id: string;
  name: string;
  teamId: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  notOuts: number;
  highest: number;
  highestNotOut: boolean;
  fifties: number;
  hundreds: number;
  /** Null until the batter has been dismissed. */
  average: number | null;
  strikeRate: number | null;
}

export interface BowlingRow {
  id: string;
  name: string;
  teamId: string;
  matches: number;
  innings: number;
  balls: number;
  /** Overs as bowled, e.g. "15.2" (assumes the league's usual over length). */
  overs: string;
  runs: number;
  wickets: number;
  maidens: number;
  best: { wickets: number; runs: number } | null;
  average: number | null;
  economy: number | null;
  strikeRate: number | null;
  threeFors: number;
  fiveFors: number;
}

export interface FieldingRow {
  id: string;
  name: string;
  teamId: string;
  catches: number;
  stumpings: number;
  runOuts: number;
  dismissals: number;
}

export interface LeagueStats {
  matches: number;
  batting: BattingRow[];
  bowling: BowlingRow[];
  fielding: FieldingRow[];
}

export interface ScoredMatchLines {
  ballsPerOver: number;
  lines: PlayerMatchLine[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Folds every scored match's player lines into league leaderboards. */
export function aggregateLeagueStats(matches: readonly ScoredMatchLines[]): LeagueStats {
  const bat = new Map<string, BattingRow>();
  const bowl = new Map<string, BowlingRow & { overUnits: number; bpo: number }>();
  const field = new Map<string, FieldingRow>();

  for (const m of matches) {
    for (const l of m.lines) {
      let b = bat.get(l.id);
      if (!b) {
        b = {
          id: l.id, name: l.name, teamId: l.teamId, matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
          notOuts: 0, highest: 0, highestNotOut: false, fifties: 0, hundreds: 0, average: null, strikeRate: null,
        };
        bat.set(l.id, b);
      }
      b.name = l.name;
      b.teamId = l.teamId;
      b.matches++;
      if (l.batted) {
        b.innings++;
        b.runs += l.runs;
        b.balls += l.balls;
        b.fours += l.fours;
        b.sixes += l.sixes;
        if (!l.out) b.notOuts++;
        if (l.runs > b.highest || (l.runs === b.highest && !l.out)) {
          b.highest = l.runs;
          b.highestNotOut = !l.out;
        }
        if (l.runs >= 100) b.hundreds++;
        else if (l.runs >= 50) b.fifties++;
      }

      let w = bowl.get(l.id);
      if (!w) {
        w = {
          id: l.id, name: l.name, teamId: l.teamId, matches: 0, innings: 0, balls: 0, overs: '0', runs: 0,
          wickets: 0, maidens: 0, best: null, average: null, economy: null, strikeRate: null, threeFors: 0, fiveFors: 0,
          overUnits: 0, bpo: m.ballsPerOver,
        };
        bowl.set(l.id, w);
      }
      w.name = l.name;
      w.teamId = l.teamId;
      w.matches++;
      if (l.bowled) {
        w.innings++;
        w.balls += l.ballsBowled;
        w.overUnits += l.ballsBowled / m.ballsPerOver;
        w.bpo = m.ballsPerOver;
        w.runs += l.runsConceded;
        w.wickets += l.wickets;
        w.maidens += l.maidens;
        if (!w.best || l.wickets > w.best.wickets || (l.wickets === w.best.wickets && l.runsConceded < w.best.runs)) {
          w.best = { wickets: l.wickets, runs: l.runsConceded };
        }
        if (l.wickets >= 5) w.fiveFors++;
        else if (l.wickets >= 3) w.threeFors++;
      }

      let f = field.get(l.id);
      if (!f) {
        f = { id: l.id, name: l.name, teamId: l.teamId, catches: 0, stumpings: 0, runOuts: 0, dismissals: 0 };
        field.set(l.id, f);
      }
      f.name = l.name;
      f.teamId = l.teamId;
      f.catches += l.catches;
      f.stumpings += l.stumpings;
      f.runOuts += l.runOuts;
      f.dismissals = f.catches + f.stumpings + f.runOuts;
    }
  }

  const batting = [...bat.values()]
    .filter((b) => b.innings > 0)
    .map((b) => ({
      ...b,
      average: b.innings - b.notOuts > 0 ? round2(b.runs / (b.innings - b.notOuts)) : null,
      strikeRate: b.balls > 0 ? round2((b.runs * 100) / b.balls) : null,
    }))
    .sort((a, b) => b.runs - a.runs || (b.strikeRate ?? 0) - (a.strikeRate ?? 0));

  const bowling = [...bowl.values()]
    .filter((w) => w.innings > 0)
    .map(({ overUnits, bpo, ...w }) => ({
      ...w,
      overs: oversText(w.balls, bpo),
      average: w.wickets > 0 ? round2(w.runs / w.wickets) : null,
      economy: overUnits > 0 ? round2(w.runs / overUnits) : null,
      strikeRate: w.wickets > 0 ? round2(w.balls / w.wickets) : null,
    }))
    .sort((a, b) => b.wickets - a.wickets || (a.economy ?? 99) - (b.economy ?? 99));

  const fielding = [...field.values()]
    .filter((f) => f.dismissals > 0)
    .sort((a, b) => b.dismissals - a.dismissals || b.catches - a.catches);

  return { matches: matches.length, batting, bowling, fielding };
}
