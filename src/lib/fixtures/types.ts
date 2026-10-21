/**
 * Fixture engine types. A *fixture* is the ordered list of who plays whom; a
 * *schedule* puts dates on it afterwards (`schedule.ts`). The two stay separate
 * so new formats and new scheduling constraints can each grow on their own.
 *
 * Everything in this folder is pure TypeScript with relative imports only — no
 * React, no server code, no `@/` alias — so it runs in the browser for the
 * preview, on the server for the save, and under `npm test` as plain Node.
 */

export type FixtureMode =
  /** Every pair meets `legs` times. */
  | 'full_round_robin'
  /** Every team plays exactly `matchesPerTeam` matches. */
  | 'matches_per_team'
  /** Exactly `totalMatches` matches, spread as evenly as the rules allow. */
  | 'total_matches'
  /** Per-team minimum and maximum, via `teamRequirements`. */
  | 'custom';

export interface FixtureRules {
  /** No pair meets twice. Defaults to true; ignored by `full_round_robin`, where `legs` decides. */
  noRematches?: boolean;
  minMatchesPerTeam?: number;
  maxMatchesPerTeam?: number;
  /** Most matches in a row one team may play, in fixture order. */
  maxConsecutiveMatches?: number;
  /** Fewest other matches between two of a team's appearances. */
  minRestMatches?: number;
}

export interface TeamRequirement {
  min?: number;
  max?: number;
}

export interface FixtureConfig {
  mode: FixtureMode;
  /** `full_round_robin` only: 1 is a single round robin, 2 home and away. Default 1. */
  legs?: number;
  /** `matches_per_team` only. */
  matchesPerTeam?: number;
  /**
   * Required by `total_matches`. Optional for `custom`, which otherwise builds
   * the smallest fixture that meets every team's minimum.
   */
  totalMatches?: number;
  /** `custom` only, keyed by team id. A team left out falls back to the rules' min/max. */
  teamRequirements?: Record<string, TeamRequirement>;
  rules?: FixtureRules;
}

export interface PossibleMatch {
  teamAId: string;
  teamBId: string;
}

/** A generated match. `teamAId` is the nominal home side; `round` is 1-based. */
export interface FixtureMatch extends PossibleMatch {
  round: number;
}

export type FixtureErrorCode =
  /** The config itself is malformed — a negative count, an unknown team. */
  | 'INVALID_CONFIGURATION'
  /** Well-formed, but no fixture can satisfy it. Proven, not guessed. */
  | 'IMPOSSIBLE_CONFIGURATION'
  /** The search gave up before finding one. It may exist; relaxing a rule helps. */
  | 'NO_VALID_FIXTURE';

export interface FixtureError {
  code: FixtureErrorCode;
  message: string;
}

export interface FixtureStats {
  totalMatches: number;
  rounds: number;
  teamParticipation: Record<string, number>;
}

export type FixtureResult =
  | {
      success: true;
      matches: FixtureMatch[];
      stats: FixtureStats;
      /** `scoreFixture` of the chosen fixture — lower is better. */
      score: number;
      /** The seed a randomised fixture was built from, to reproduce it; null when not randomised. */
      seed: string | null;
    }
  | { success: false; error: FixtureError };

export interface GenerateOptions {
  /** Shuffle team order and tie-breaks. Off, the same input always gives the same fixture. */
  randomize?: boolean;
  /** Reproduces a randomised fixture. Ignored unless `randomize`. */
  seed?: string;
  /** Candidate fixtures to build and score; the best valid one wins. Default 8. */
  attempts?: number;
  /** Display names for error messages, keyed by team id. */
  labels?: Record<string, string>;
}

export type FixtureIssueCode =
  | 'INVALID_CONFIGURATION'
  | 'IMPOSSIBLE_CONFIGURATION'
  | 'UNKNOWN_TEAM'
  | 'SELF_MATCH'
  | 'DUPLICATE_PAIRING'
  | 'MISSING_PAIRING'
  | 'MATCH_COUNT'
  | 'PARTICIPATION'
  | 'CONSECUTIVE_LIMIT'
  | 'REST_LIMIT';

export interface FixtureIssue {
  code: FixtureIssueCode;
  message: string;
}

export type FixtureValidation =
  | { valid: true; errors: [] }
  | { valid: false; errors: FixtureIssue[] };
