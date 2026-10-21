import type { DeliveryDismissal, DismissalKind, Extra, ScoringRules } from './types';

/** Thrown for anything the laws (or the match's own rules) don't allow. */
export class ScoringError extends Error {
  /** Index of the offending event in the log, or -1 outside a replay. */
  readonly eventIndex: number;
  constructor(message: string, eventIndex = -1) {
    super(message);
    this.name = 'ScoringError';
    this.eventIndex = eventIndex;
  }
}

export const DEFAULT_RULES: ScoringRules = {
  overs: 20,
  ballsPerOver: 6,
  wideRuns: 1,
  noBallRuns: 1,
  wideReball: true,
  noBallReball: true,
  freeHit: true,
  lastManStanding: false,
  maxOversPerBowler: 4,
};

/** A fifth of the innings, rounded up — the usual limited-overs quota. */
export function defaultBowlerQuota(overs: number): number {
  return Math.max(1, Math.ceil(overs / 5));
}

export const LIMITS = {
  overs: { min: 1, max: 50 },
  ballsPerOver: { min: 2, max: 10 },
  penaltyRuns: { min: 0, max: 5 },
  squad: { min: 2, max: 25 },
  /** Most runs a single delivery can add, overthrows and all. */
  runsPerBall: 12,
  events: 5000,
} as const;

/** Dismissals the bowler gets the wicket for. */
const BOWLER_CREDITED: ReadonlySet<DismissalKind> = new Set(['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket']);

export function creditsBowler(kind: DismissalKind): boolean {
  return BOWLER_CREDITED.has(kind);
}

/** Dismissals where only the striker can be the one out. */
const STRIKER_ONLY: ReadonlySet<DeliveryDismissal> = new Set([
  'bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'hit_ball_twice',
]);

export function strikerOnly(kind: DeliveryDismissal): boolean {
  return STRIKER_ONLY.has(kind);
}

/** Dismissals that leave runs at zero: the ball is dead the moment it happens. */
export function scoresNoRuns(kind: DeliveryDismissal): boolean {
  return kind !== 'run_out' && kind !== 'obstructing_field';
}

/** Ways out a no-ball, and so a free hit, still allows. */
const FREE_HIT_OUTS: ReadonlySet<DeliveryDismissal> = new Set(['run_out', 'obstructing_field', 'hit_ball_twice']);

const BY_EXTRA: Record<Extra | 'none', DeliveryDismissal[]> = {
  none: ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'run_out', 'obstructing_field', 'hit_ball_twice'],
  // Nothing that needs the ball to have been hittable, and no catch.
  wd: ['stumped', 'hit_wicket', 'run_out', 'obstructing_field'],
  nb: ['run_out', 'obstructing_field', 'hit_ball_twice'],
  b: ['run_out', 'obstructing_field'],
  lb: ['run_out', 'obstructing_field'],
};

/** The dismissals a delivery of this kind allows, free hit taken into account. */
export function allowedDismissals(extra: Extra | null, freeHit: boolean): DeliveryDismissal[] {
  const kinds = BY_EXTRA[extra ?? 'none'];
  return freeHit ? kinds.filter((k) => FREE_HIT_OUTS.has(k)) : kinds;
}

/** Whether a delivery counts towards the over. */
export function countsInOver(extra: Extra | null, rules: ScoringRules): boolean {
  if (extra === 'wd') return !rules.wideReball;
  if (extra === 'nb') return !rules.noBallReball;
  return true;
}

export const DISMISSAL_LABELS: Record<DismissalKind | 'run_out', string> = {
  bowled: 'Bowled',
  caught: 'Caught',
  lbw: 'LBW',
  stumped: 'Stumped',
  hit_wicket: 'Hit wicket',
  run_out: 'Run out',
  obstructing_field: 'Obstructing the field',
  hit_ball_twice: 'Hit the ball twice',
  retired_hurt: 'Retired hurt',
  retired_out: 'Retired out',
  timed_out: 'Timed out',
};
