import { DISMISSAL_LABELS } from './rules';
import { SUB_FIELDER } from './types';
import type { BallRecord, Dismissal, InningsState, MatchResult, MatchState } from './types';

/** "11.4", or "20" for a completed over count. */
export function oversText(balls: number, ballsPerOver: number): string {
  const whole = Math.floor(balls / ballsPerOver);
  const rest = balls % ballsPerOver;
  return rest === 0 ? String(whole) : `${whole}.${rest}`;
}

/** Runs per over, to two places. */
export function runRate(runs: number, balls: number, ballsPerOver: number): string {
  if (balls <= 0) return '0.00';
  return ((runs * ballsPerOver) / balls).toFixed(2);
}

export function strikeRate(runs: number, balls: number): string {
  return balls > 0 ? ((runs * 100) / balls).toFixed(1) : '0.0';
}

export function economy(runs: number, balls: number, ballsPerOver: number): string {
  return runRate(runs, balls, ballsPerOver);
}

/** "156/7" */
export function scoreText(inn: Pick<InningsState, 'runs' | 'wickets'>): string {
  return `${inn.runs}/${inn.wickets}`;
}

/** "156/7 (20)" or "142 all out (18.3)" — the form the match list stores. */
export function scoreLine(inn: InningsState, ballsPerOver: number): string {
  const overs = oversText(inn.legalBalls, ballsPerOver);
  return inn.endReason === 'all_out'
    ? `${inn.runs} all out (${overs})`
    : `${inn.runs}/${inn.wickets} (${overs})`;
}

export type NameOf = (id: string | null | undefined) => string;

/** Every player in both squads, late arrivals included. */
export function nameLookup(state: Pick<MatchState, 'squads'>): NameOf {
  const names = new Map<string, string>();
  for (const squad of Object.values(state.squads)) for (const p of squad) names.set(p.id, p.name);
  return (id) => {
    if (!id) return '';
    if (id === SUB_FIELDER) return 'sub';
    return names.get(id) ?? 'Unknown';
  };
}

/** Scorecard form: "c Rahul b Arjun", "run out (Vikram)", "retired hurt". */
export function dismissalText(d: Dismissal | null, nameOf: NameOf): string {
  if (!d) return 'not out';
  const bowler = nameOf(d.bowlerId);
  const fielder = d.fielderId ? nameOf(d.fielderId) : '';
  switch (d.kind) {
    case 'bowled': return `b ${bowler}`;
    case 'caught':
      if (d.fielderId && d.fielderId === d.bowlerId) return `c & b ${bowler}`;
      return fielder ? `c ${fielder} b ${bowler}` : `c ? b ${bowler}`;
    case 'lbw': return `lbw b ${bowler}`;
    case 'stumped': return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'hit_wicket': return `hit wicket b ${bowler}`;
    case 'run_out': return fielder ? `run out (${fielder})` : 'run out';
    case 'obstructing_field': return 'obstructing the field';
    case 'hit_ball_twice': return 'hit the ball twice';
    case 'retired_hurt': return 'retired hurt';
    case 'retired_out': return 'retired out';
    case 'timed_out': return 'timed out';
  }
}

const EXTRA_CHIP = { wd: 'Wd', nb: 'Nb', b: 'B', lb: 'Lb' } as const;

/** The compact "this over" chip: "4", "6", "W", "Wd", "Nb+4", "2Lb". */
export function ballChip(b: BallRecord): string {
  const extraRun = b.extra === 'wd' ? b.total - b.penalty : b.extra === 'nb' ? b.total - b.penalty : b.total;
  let chip: string;
  if (!b.extra) chip = String(b.total);
  else if (b.extra === 'wd' || b.extra === 'nb') chip = extraRun > 0 ? `${EXTRA_CHIP[b.extra]}+${extraRun}` : EXTRA_CHIP[b.extra];
  else chip = `${b.total}${EXTRA_CHIP[b.extra]}`;
  if (!b.wicket) return chip;
  return chip === '0' ? 'W' : `${chip}+W`;
}

/** Tone for a chip, so screens colour them alike. */
export function ballTone(b: BallRecord): 'wicket' | 'six' | 'four' | 'extra' | 'dot' | 'run' {
  if (b.wicket) return 'wicket';
  if (b.boundary === 6) return 'six';
  if (b.boundary === 4) return 'four';
  if (b.extra) return 'extra';
  return b.total === 0 ? 'dot' : 'run';
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

/** One line of ball-by-ball commentary, without the over number. */
export function commentary(b: BallRecord, nameOf: NameOf, dismissal?: Dismissal | null): string {
  const who = `${nameOf(b.bowlerId)} to ${nameOf(b.strikerId)}`;
  const parts: string[] = [];
  const extraRun = b.total - b.penalty;
  switch (b.extra) {
    case null:
      if (b.boundary === 6) parts.push('SIX');
      else if (b.boundary === 4) parts.push('FOUR');
      else parts.push(b.total === 0 ? 'no run' : plural(b.total, 'run'));
      break;
    case 'wd':
      parts.push(b.total <= 1 ? 'wide' : `${b.total} wides`);
      if (b.boundary === 4) parts.push('to the boundary');
      break;
    case 'nb':
      parts.push('no ball');
      if (b.nbRunsAs === 'bat' && b.boundary === 6) parts.push('SIX');
      else if (b.nbRunsAs === 'bat' && b.boundary === 4) parts.push('FOUR');
      else if (b.nbRunsAs === 'bat' && extraRun > 0) parts.push(`${plural(extraRun, 'run')} off the bat`);
      else if (b.nbRunsAs === 'bye' && extraRun > 0) parts.push(plural(extraRun, 'bye'));
      else if (b.nbRunsAs === 'legbye' && extraRun > 0) parts.push(plural(extraRun, 'leg bye'));
      break;
    case 'b':
      parts.push(b.boundary === 4 ? 'FOUR byes' : plural(b.total, 'bye'));
      break;
    case 'lb':
      parts.push(b.boundary === 4 ? 'FOUR leg byes' : plural(b.total, 'leg bye'));
      break;
  }
  let line = `${who}, ${parts.join(', ')}`;
  if (b.wicket) {
    const how = dismissal ? dismissalText(dismissal, nameOf) : DISMISSAL_LABELS[b.wicket.kind].toLowerCase();
    line = `${who}, OUT! ${nameOf(b.wicket.outId)} ${how}${b.total > 0 ? ` (${parts.join(', ')})` : ''}`;
  }
  return b.freeHit ? `Free hit — ${line}` : line;
}

export type TeamName = (teamId: string) => string;

export function teamNameLookup(state: Pick<MatchState, 'setup'>): TeamName {
  return (teamId) => state.setup.sides.find((s) => s.teamId === teamId)?.name ?? 'Unknown team';
}

/** "Rangers won by 24 runs", "Strikers won by 5 wickets (8 balls left)". */
export function resultText(result: MatchResult | null, teamName: TeamName): string {
  if (!result) return '';
  switch (result.kind) {
    case 'won': {
      const winner = teamName(result.winnerTeamId);
      if (result.superOver) return `${winner} won the Super Over`;
      const margin = result.by === 'runs' ? plural(result.margin, 'run') : plural(result.margin, 'wicket');
      const left = result.by === 'wickets' && result.ballsLeft ? ` (${plural(result.ballsLeft, 'ball')} left)` : '';
      return `${winner} won by ${margin}${left}${result.revised ? ' — revised target' : ''}`;
    }
    case 'tie': return result.superOver ? 'Super Over tied' : 'Match tied';
    case 'abandoned': return result.note ? `Match abandoned — ${result.note}` : 'Match abandoned';
    case 'no_result': return result.note ? `No result — ${result.note}` : 'No result';
    case 'awarded': {
      const winner = teamName(result.winnerTeamId);
      return result.note ? `${winner} awarded the match — ${result.note}` : `${winner} awarded the match`;
    }
  }
}

/** The line under a live score: what's needed, or the toss, or the result. */
export function statusText(state: MatchState): string {
  const teamName = teamNameLookup(state);
  const bpo = state.setup.rules.ballsPerOver;
  const inn = state.innings[state.innings.length - 1];
  if (state.phase === 'completed') return resultText(state.result, teamName);
  if (state.phase === 'pre') {
    const { winnerTeamId, decision } = state.setup.toss;
    return `${teamName(winnerTeamId)} won the toss and chose to ${decision === 'bat' ? 'bat' : 'bowl'}`;
  }
  if (state.phase === 'break') {
    if (!inn) return '';
    if (state.innings.length % 2 === 1) {
      const target = state.pendingRevision?.target ?? inn.runs + 1;
      const label = state.innings.length >= 2 ? 'Super Over: ' : '';
      return `${label}${teamName(inn.bowlingTeamId)} need ${plural(target, 'run')} to win`;
    }
    return 'Super Over — waiting to start';
  }
  if (!inn) return '';
  if (inn.target !== null) {
    const need = inn.target - inn.runs;
    const balls = inn.maxOvers * bpo - inn.legalBalls;
    return `${teamName(inn.battingTeamId)} need ${plural(need, 'run')} from ${plural(balls, 'ball')}`;
  }
  return `${teamName(inn.battingTeamId)} batting · CRR ${runRate(inn.runs, inn.legalBalls, bpo)}`;
}
