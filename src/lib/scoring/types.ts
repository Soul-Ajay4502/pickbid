// Ball-by-ball scoring: the setup a match is scored under, the events a scorer
// records, and the state the engine derives from them.
//
// The event log is the only thing stored. Everything a screen shows — the
// score, the scorecard, strike, who may bowl next, the result — is rebuilt by
// replaying it (`replay` in engine.ts), so undo is "drop the last event" and an
// edited ball can never leave a stale total behind.

export type Extra = 'wd' | 'nb' | 'b' | 'lb';

/** Ways out on a delivery. "Caught and bowled" is `caught` with the bowler as fielder. */
export type DeliveryDismissal =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'stumped'
  | 'hit_wicket'
  | 'run_out'
  | 'obstructing_field'
  | 'hit_ball_twice';

/**
 * Ways a batter leaves between deliveries. `run_out` here is the bowler running
 * out the non-striker backing up before delivering — not a ball of the over.
 */
export type CreaseDismissal = 'retired_hurt' | 'retired_out' | 'timed_out' | 'run_out';

export type DismissalKind = DeliveryDismissal | Exclude<CreaseDismissal, 'run_out'>;

/** Stand-in fielder id for a substitute who isn't in the playing squad. */
export const SUB_FIELDER = 'sub';

export interface ScoringRules {
  /** Overs per innings. */
  overs: number;
  ballsPerOver: number;
  /** Penalty runs for a wide, on top of anything run. */
  wideRuns: number;
  /** Penalty runs for a no-ball, on top of anything scored. */
  noBallRuns: number;
  /** Whether a wide has to be bowled again (counts towards the over when false). */
  wideReball: boolean;
  /** Whether a no-ball has to be bowled again (counts towards the over when false). */
  noBallReball: boolean;
  /** The delivery after a no-ball is a free hit. */
  freeHit: boolean;
  /** The last batter may carry on alone instead of the innings closing. */
  lastManStanding: boolean;
  /** Overs one bowler may bowl in an innings; null for no limit. */
  maxOversPerBowler: number | null;
}

export interface LineupPlayer {
  /** A player card id, or `guest:…` for someone without a card in this league. */
  id: string;
  name: string;
}

export interface SideSetup {
  teamId: string;
  name: string;
  color: string;
  /** The playing squad. Batting order is not fixed up front. */
  players: LineupPlayer[];
  captainId: string | null;
  keeperId: string | null;
}

export interface MatchSetup {
  rules: ScoringRules;
  /** `sides[0]` is the match's team 1. */
  sides: [SideSetup, SideSetup];
  toss: { winnerTeamId: string; decision: 'bat' | 'bowl' };
}

// ── Events ───────────────────────────────────────────────────────────────────

interface EventBase {
  /** Client-generated, unique within the match — how two logs are compared. */
  id: string;
  /** Client clock, ms. Display only. */
  at: number;
}

export interface WicketInput {
  kind: DeliveryDismissal;
  outId: string;
  /** Catcher, run-out fielder or keeper. `SUB_FIELDER` for a substitute. */
  fielderId?: string | null;
  /** Who walks in. Required whenever the innings carries on and someone can. */
  nextBatterId?: string | null;
  /**
   * Run outs and obstruction leave the ends ambiguous, so the scorer says
   * whether the new batter takes strike. Ignored for the other dismissals,
   * where the new batter always goes to the striker's end.
   */
  nextOnStrike?: boolean;
}

export interface BallEvent extends EventBase {
  type: 'ball';
  /**
   * Runs scored off this delivery excluding the wide/no-ball penalty: off the
   * bat, or as byes/leg byes/extra wides.
   */
  runs: number;
  extra: Extra | null;
  /** On a no-ball, whether `runs` came off the bat or as byes / leg byes. */
  nbRunsAs?: 'bat' | 'bye' | 'legbye';
  /** A four or six that reached the rope — counted as such and nobody ran. */
  boundary?: boolean;
  /**
   * Runs physically run, when it differs from `runs` (overthrows to the rope:
   * ran 1, then 4 overthrows). Decides who is on strike. Defaults to `runs`,
   * or 0 for a boundary.
   */
  ran?: number;
  wicket?: WicketInput | null;
}

export type ScoringEvent =
  | (EventBase & { type: 'start_innings'; strikerId: string; nonStrikerId: string | null; bowlerId: string })
  | BallEvent
  | (EventBase & { type: 'bowler'; bowlerId: string })
  | (EventBase & {
    type: 'dismiss';
    kind: CreaseDismissal;
    batterId: string;
    fielderId?: string | null;
    nextBatterId?: string | null;
    nextOnStrike?: boolean;
  })
  | (EventBase & { type: 'next_batter'; batterId: string; onStrike?: boolean })
  | (EventBase & { type: 'swap' })
  | (EventBase & { type: 'penalty'; runs: number; to: 'batting' | 'fielding' })
  | (EventBase & { type: 'add_player'; teamId: string; player: LineupPlayer })
  | (EventBase & { type: 'revise'; overs?: number | null; target?: number | null })
  | (EventBase & { type: 'end_innings'; reason: 'declared' | 'other' })
  | (EventBase & { type: 'super_over' })
  | (EventBase & { type: 'end_match'; result: 'abandoned' | 'no_result' | 'awarded'; winnerTeamId?: string | null; note?: string })
  | (EventBase & { type: 'potm'; playerId: string | null });

export type ScoringEventType = ScoringEvent['type'];

// ── Derived state ────────────────────────────────────────────────────────────

export interface Dismissal {
  kind: DismissalKind;
  bowlerId: string | null;
  fielderId: string | null;
}

export interface BatterState {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dots: number;
  status: 'batting' | 'out' | 'retired_hurt' | 'not_out';
  dismissal: Dismissal | null;
}

export interface BowlerState {
  id: string;
  name: string;
  /** Deliveries that counted towards an over. */
  balls: number;
  /** Charged to the bowler: off the bat, wides and no-balls. Not byes/leg byes. */
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
  fours: number;
  sixes: number;
}

export interface BallRecord {
  eventId: string;
  /** "11.4" — for a ball that didn't count, the number of the one to be re-bowled. */
  label: string;
  over: number;
  strikerId: string;
  nonStrikerId: string | null;
  bowlerId: string;
  /** Everything this delivery added to the total. */
  total: number;
  /** Runs credited to the batter. */
  batRuns: number;
  extra: Extra | null;
  /** The wide / no-ball penalty alone. */
  penalty: number;
  /** `total - batRuns`: the penalty plus any byes, leg byes or extra wides. */
  extraRuns: number;
  /** Runs charged to the bowler's figures. */
  bowlerRuns: number;
  nbRunsAs: 'bat' | 'bye' | 'legbye' | null;
  boundary: 4 | 6 | null;
  countsInOver: boolean;
  freeHit: boolean;
  wicket: { kind: DeliveryDismissal; outId: string; fielderId: string | null } | null;
}

export interface OverState {
  /** 0-based. */
  index: number;
  bowlerIds: string[];
  balls: BallRecord[];
  runs: number;
  wickets: number;
  /** Deliveries that counted. */
  legal: number;
}

export interface FallOfWicket {
  wicket: number;
  runs: number;
  batterId: string;
  /** "11.4" */
  over: string;
}

export interface Partnership {
  batterIds: [string, string | null];
  runs: number;
  balls: number;
  /** Set once broken. `joined` is a last man standing finding a partner. */
  endedBy: 'wicket' | 'retired' | 'innings' | 'joined' | null;
}

export interface InningsState {
  index: number;
  battingTeamId: string;
  bowlingTeamId: string;
  superOver: boolean;
  /** Overs this innings is played over — the rules, a super over, or a revision. */
  maxOvers: number;
  maxWickets: number;
  /** For the side batting second of a pair: what it needs. Null when batting first. */
  target: number | null;
  /** Whether `target` came from a revision (rain) rather than the first innings. */
  targetRevised: boolean;
  runs: number;
  wickets: number;
  /** Deliveries that counted towards an over. */
  legalBalls: number;
  extras: { b: number; lb: number; wd: number; nb: number; p: number };
  batters: BatterState[];
  bowlers: BowlerState[];
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  overs: OverState[];
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];
  /** The next delivery is a free hit. */
  freeHit: boolean;
  complete: boolean;
  endReason: 'all_out' | 'overs' | 'target' | 'declared' | 'other' | 'match_ended' | null;
}

export type MatchResult =
  | {
    kind: 'won';
    winnerTeamId: string;
    by: 'runs' | 'wickets';
    margin: number;
    /** Deliveries to spare, for a chase. */
    ballsLeft: number | null;
    superOver: boolean;
    revised: boolean;
  }
  | { kind: 'tie'; superOver: boolean }
  | { kind: 'abandoned'; note: string | null }
  | { kind: 'no_result'; note: string | null }
  | { kind: 'awarded'; winnerTeamId: string; note: string | null };

/** What the scorer has to do next. */
export type Awaiting = 'start_innings' | 'bowler' | 'ball' | 'none';

export interface MatchState {
  setup: MatchSetup;
  /** Squads as they stand, late arrivals included. Keyed by team id. */
  squads: Record<string, LineupPlayer[]>;
  innings: InningsState[];
  phase: 'pre' | 'live' | 'break' | 'completed';
  awaiting: Awaiting;
  result: MatchResult | null;
  playerOfMatchId: string | null;
  /** Revisions entered between innings, waiting for the next one to start. */
  pendingRevision: { overs: number | null; target: number | null } | null;
  /** Fielding-side penalty runs waiting for that side's innings to start. */
  pendingPenalty: Record<string, number>;
  /** How many super-over pairs have been called. */
  superOvers: number;
  /** Events replayed to reach this state. */
  eventCount: number;
}
