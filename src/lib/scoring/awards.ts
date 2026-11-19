import { oversText } from './format';
import type { MatchScoreSummary, PlayerMatchLine, ScoredMatchLines } from './stats';

// Match awards and the league MVP table, from one currency: impact points.
//
// A point is a run. Everything a player does is priced in runs *of this match*,
// so a 30 in a six-over tennis-ball game and a 70 in a T20 are judged against
// the game they were played in, and a batter, a bowler and a fielder can be
// compared on one scale:
//
//   par          = the match's runs per ball (both regulation innings)
//   wicket value = one sixth of a full innings at par — a typical innings
//                  loses about six wickets, so that is what one costs
//
//   batting  = runs + ½ × (runs − balls × par)       runs, plus tempo vs par
//   bowling  = wickets × wicket value
//              + (balls × par − runs conceded)       wickets, plus runs saved
//   fielding = (0.4 × catches + 0.5 × stumpings
//              + 0.6 × run outs) × wicket value      a share of the wicket
//
// Each discipline floors at zero: a bad day earns nothing, it doesn't take
// away what the same player did elsewhere. Nothing here depends on which side
// won — the result only breaks exact ties and decides who the Fighter is.
//
// It is all a pure function of a match's cached player lines and summary, so
// the league table needs no replay, and matches scored before this existed are
// counted without a backfill.

/** Share of a wicket's value a fielder earns. A run out has no bowler to share with. */
export const FIELDING_SHARE = { catch: 0.4, stumping: 0.5, runOut: 0.6 } as const;
/** How much of a batter's runs above (or below) par count on top of the runs. */
export const TEMPO_WEIGHT = 0.5;
/** A typical innings loses about this many wickets. */
const WICKETS_PER_INNINGS = 6;
/** A wicket is never worth less than this, however low the scoring. */
const MIN_WICKET_VALUE = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ImpactContext {
  /** Runs per ball across the match's regulation innings. */
  par: number;
  /** What one wicket is worth, in runs. */
  wicketValue: number;
}

/** The match's own scale, or null before a ball has been bowled. */
export function impactContext(summary: MatchScoreSummary): ImpactContext | null {
  const main = summary.innings.filter((i) => !i.superOver);
  const runs = main.reduce((n, i) => n + i.runs, 0);
  const balls = main.reduce((n, i) => n + i.balls, 0);
  if (balls <= 0) return null;
  const par = runs / balls;
  const fullInnings = Math.max(...main.map((i) => i.maxBalls));
  return { par, wicketValue: Math.max(MIN_WICKET_VALUE, (par * fullInnings) / WICKETS_PER_INNINGS) };
}

export interface PlayerImpact {
  id: string;
  name: string;
  teamId: string;
  batting: number;
  bowling: number;
  fielding: number;
  total: number;
}

function impactOf(l: PlayerMatchLine, ctx: ImpactContext): PlayerImpact {
  const batting = l.batted ? Math.max(0, l.runs + TEMPO_WEIGHT * (l.runs - l.balls * ctx.par)) : 0;
  const bowling = l.bowled
    ? Math.max(0, l.wickets * ctx.wicketValue + (l.ballsBowled * ctx.par - l.runsConceded))
    : 0;
  const fielding = ctx.wicketValue
    * (l.catches * FIELDING_SHARE.catch + l.stumpings * FIELDING_SHARE.stumping + l.runOuts * FIELDING_SHARE.runOut);
  return {
    id: l.id, name: l.name, teamId: l.teamId,
    batting: round1(batting), bowling: round1(bowling), fielding: round1(fielding),
    total: round1(batting + bowling + fielding),
  };
}

/** Every squad member's impact points in one match, in the lines' order. */
export function matchImpact(lines: readonly PlayerMatchLine[], summary: MatchScoreSummary): PlayerImpact[] {
  const ctx = impactContext(summary);
  if (!ctx) return [];
  return lines.map((l) => impactOf(l, ctx));
}

export interface MatchAward {
  id: string;
  name: string;
  teamId: string;
  points: number;
  /** The figures behind it: "42* (25) · 2/14 (3) · 1 ct". */
  detail: string;
}

export interface MatchAwards {
  /** `picked` when the scorer chose them by hand, overriding the points. */
  playerOfMatch: (MatchAward & { picked: boolean }) | null;
  bestBatter: MatchAward | null;
  bestBowler: MatchAward | null;
  bestFielder: MatchAward | null;
  /** The best performer on the side that didn't win, other than the player of the match. */
  fighter: MatchAward | null;
}

const battingText = (l: PlayerMatchLine) => `${l.runs}${l.out ? '' : '*'} (${l.balls})`;
const bowlingText = (l: PlayerMatchLine, bpo: number) => `${l.wickets}/${l.runsConceded} (${oversText(l.ballsBowled, bpo)})`;
function fieldingText(l: PlayerMatchLine): string {
  return [
    l.catches ? `${l.catches} ct` : '',
    l.runOuts ? `${l.runOuts} run out${l.runOuts === 1 ? '' : 's'}` : '',
    l.stumpings ? `${l.stumpings} st` : '',
  ].filter(Boolean).join(' · ');
}
function allRoundText(l: PlayerMatchLine, bpo: number): string {
  return [l.batted ? battingText(l) : '', l.bowled ? bowlingText(l, bpo) : '', fieldingText(l)].filter(Boolean).join(' · ');
}

/**
 * The five awards of a finished match, or null while it is unfinished or was
 * over before a ball was bowled.
 *
 * Player of the match is the highest total — from either side — unless the
 * scorer picked someone by hand. The Fighter is the highest total on the side
 * that didn't win (with no loser — a tie, a no-result — the side the player of
 * the match isn't on), so the award always goes to someone else.
 */
export function matchAwards(lines: readonly PlayerMatchLine[], summary: MatchScoreSummary): MatchAwards | null {
  if (summary.phase !== 'completed') return null;
  const impact = matchImpact(lines, summary);
  if (impact.length === 0) return null;

  const bpo = summary.ballsPerOver;
  const lineOf = new Map(lines.map((l) => [l.id, l]));
  const r = summary.result;
  const winnerTeamId = r && (r.kind === 'won' || r.kind === 'awarded') ? r.winnerTeamId : null;

  // Highest points; an exact tie goes to the winning side, then squad order
  const best = (
    pool: readonly PlayerImpact[],
    points: (p: PlayerImpact) => number,
    detail: (l: PlayerMatchLine) => string,
  ): MatchAward | null => {
    let top: PlayerImpact | null = null;
    for (const p of pool) {
      if (points(p) <= 0) continue;
      if (!top || points(p) > points(top)
        || (points(p) === points(top) && p.teamId === winnerTeamId && top.teamId !== winnerTeamId)) top = p;
    }
    return top ? { id: top.id, name: top.name, teamId: top.teamId, points: points(top), detail: detail(lineOf.get(top.id)!) } : null;
  };
  const allRound = (l: PlayerMatchLine) => allRoundText(l, bpo);

  const pickedId = summary.playerOfMatch?.id ?? null;
  const picked = pickedId ? impact.find((p) => p.id === pickedId) : undefined;
  const auto = best(impact, (p) => p.total, allRound);
  const playerOfMatch = picked
    ? { id: picked.id, name: picked.name, teamId: picked.teamId, points: picked.total, detail: allRound(lineOf.get(picked.id)!), picked: true }
    : auto ? { ...auto, picked: false } : null;

  const fighterPool = impact.filter((p) =>
    p.id !== playerOfMatch?.id && (winnerTeamId ? p.teamId !== winnerTeamId : p.teamId !== playerOfMatch?.teamId));

  return {
    playerOfMatch,
    bestBatter: best(impact, (p) => p.batting, battingText),
    bestBowler: best(impact, (p) => p.bowling, (l) => bowlingText(l, bpo)),
    bestFielder: best(impact, (p) => p.fielding, fieldingText),
    fighter: playerOfMatch ? best(fighterPool, (p) => p.total, allRound) : null,
  };
}

// ── League MVP ───────────────────────────────────────────────────────────────

export interface MvpRow {
  id: string;
  name: string;
  teamId: string;
  /** Scored matches the player was in the squad for. */
  matches: number;
  batting: number;
  bowling: number;
  fielding: number;
  points: number;
  perMatch: number;
  /** Awards won in finished matches. */
  playerOfMatch: number;
  fighter: number;
  bestBatter: number;
  bestBowler: number;
  bestFielder: number;
}

/**
 * The season's most valuable players: every match's impact points added up.
 * Each match was priced on its own scale, so the totals are comparable across
 * a short game and a long one. Matches without a cached summary are skipped.
 */
export function aggregateMvp(matches: readonly ScoredMatchLines[]): MvpRow[] {
  const rows = new Map<string, MvpRow>();
  for (const m of matches) {
    if (!m.summary) continue;
    for (const p of matchImpact(m.lines, m.summary)) {
      let row = rows.get(p.id);
      if (!row) {
        row = {
          id: p.id, name: p.name, teamId: p.teamId, matches: 0, batting: 0, bowling: 0, fielding: 0, points: 0,
          perMatch: 0, playerOfMatch: 0, fighter: 0, bestBatter: 0, bestBowler: 0, bestFielder: 0,
        };
        rows.set(p.id, row);
      }
      row.name = p.name;
      row.teamId = p.teamId;
      row.matches++;
      row.batting += p.batting;
      row.bowling += p.bowling;
      row.fielding += p.fielding;
    }
    const awards = matchAwards(m.lines, m.summary);
    if (!awards) continue;
    for (const key of ['playerOfMatch', 'fighter', 'bestBatter', 'bestBowler', 'bestFielder'] as const) {
      const award = awards[key];
      const row = award ? rows.get(award.id) : undefined;
      if (row) row[key]++;
    }
  }
  return [...rows.values()]
    .map((row) => {
      const batting = round1(row.batting);
      const bowling = round1(row.bowling);
      const fielding = round1(row.fielding);
      const points = round1(batting + bowling + fielding);
      return { ...row, batting, bowling, fielding, points, perMatch: round1(points / row.matches) };
    })
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points || b.playerOfMatch - a.playerOfMatch || a.matches - b.matches);
}
