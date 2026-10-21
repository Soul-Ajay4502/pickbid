import type { FixtureConfig, FixtureMode, FixtureRules, TeamRequirement } from './types';

export const FIXTURE_MODES: readonly FixtureMode[] = ['full_round_robin', 'matches_per_team', 'total_matches', 'custom'];

// Generous ceilings for a cricket league, there to stop a typo of 5000 from
// spinning the search — not limits anyone should meet in practice.
export const MAX_MATCHES_PER_TEAM = 100;
export const MAX_TOTAL_MATCHES = 1000;

export type ParsedConfig = { ok: true; config: FixtureConfig } | { ok: false; message: string };

function wholeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * Checks the shape of a config — from a request body, or from code calling the
 * engine — and returns a clean copy with unknown keys dropped. Whether a
 * well-formed config can actually be satisfied is `planParticipation`'s job.
 */
export function parseFixtureConfig(input: unknown): ParsedConfig {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Fixture settings are missing.' };
  const raw = input as Record<string, unknown>;

  if (!FIXTURE_MODES.includes(raw.mode as FixtureMode)) return { ok: false, message: 'Choose a fixture type.' };
  const config: FixtureConfig = { mode: raw.mode as FixtureMode };

  // Each field is checked only when present, so a config may carry settings
  // for other modes (a form switching between them) without failing.
  if (raw.legs !== undefined) {
    const legs = wholeNumber(raw.legs, 1, 2);
    if (legs === null) return { ok: false, message: 'A round robin is played once or twice (home and away).' };
    config.legs = legs;
  }
  if (raw.matchesPerTeam !== undefined) {
    const n = wholeNumber(raw.matchesPerTeam, 1, MAX_MATCHES_PER_TEAM);
    if (n === null) return { ok: false, message: `Matches per team must be a whole number from 1 to ${MAX_MATCHES_PER_TEAM}.` };
    config.matchesPerTeam = n;
  }
  if (raw.totalMatches !== undefined) {
    const n = wholeNumber(raw.totalMatches, 1, MAX_TOTAL_MATCHES);
    if (n === null) return { ok: false, message: `Total matches must be a whole number from 1 to ${MAX_TOTAL_MATCHES}.` };
    config.totalMatches = n;
  }

  if (raw.rules !== undefined) {
    if (!raw.rules || typeof raw.rules !== 'object') return { ok: false, message: 'Fixture rules are malformed.' };
    const r = raw.rules as Record<string, unknown>;
    const rules: FixtureRules = {};
    if (r.noRematches !== undefined) {
      if (typeof r.noRematches !== 'boolean') return { ok: false, message: 'Fixture rules are malformed.' };
      rules.noRematches = r.noRematches;
    }
    const counts: [keyof FixtureRules, number, string][] = [
      ['minMatchesPerTeam', 0, 'Minimum matches per team'],
      ['maxMatchesPerTeam', 0, 'Maximum matches per team'],
      ['maxConsecutiveMatches', 1, 'Matches in a row'],
      ['minRestMatches', 0, 'Rest between matches'],
    ];
    for (const [key, min, label] of counts) {
      if (r[key] === undefined) continue;
      const n = wholeNumber(r[key], min, MAX_MATCHES_PER_TEAM);
      if (n === null) return { ok: false, message: `${label} must be a whole number from ${min} to ${MAX_MATCHES_PER_TEAM}.` };
      (rules as Record<string, number>)[key] = n;
    }
    if (rules.minMatchesPerTeam !== undefined && rules.maxMatchesPerTeam !== undefined && rules.minMatchesPerTeam > rules.maxMatchesPerTeam) {
      return { ok: false, message: 'The minimum matches per team is above the maximum.' };
    }
    config.rules = rules;
  }

  if (raw.teamRequirements !== undefined) {
    if (!raw.teamRequirements || typeof raw.teamRequirements !== 'object') return { ok: false, message: 'Team requirements are malformed.' };
    const entries = Object.entries(raw.teamRequirements as Record<string, unknown>);
    if (entries.length > 200) return { ok: false, message: 'Too many team requirements.' };
    const reqs: Record<string, TeamRequirement> = {};
    for (const [teamId, value] of entries) {
      if (!value || typeof value !== 'object') return { ok: false, message: 'Team requirements are malformed.' };
      const v = value as Record<string, unknown>;
      const req: TeamRequirement = {};
      for (const key of ['min', 'max'] as const) {
        if (v[key] === undefined) continue;
        const n = wholeNumber(v[key], 0, MAX_MATCHES_PER_TEAM);
        if (n === null) return { ok: false, message: `Team ${key === 'min' ? 'minimums' : 'maximums'} must be whole numbers from 0 to ${MAX_MATCHES_PER_TEAM}.` };
        req[key] = n;
      }
      if (req.min !== undefined && req.max !== undefined && req.min > req.max) {
        return { ok: false, message: 'A team\'s minimum matches is above its maximum.' };
      }
      reqs[teamId] = req;
    }
    config.teamRequirements = reqs;
  }

  if (config.mode === 'matches_per_team' && config.matchesPerTeam === undefined) {
    return { ok: false, message: 'Enter how many matches each team plays.' };
  }
  if (config.mode === 'total_matches' && config.totalMatches === undefined) {
    return { ok: false, message: 'Enter the total number of matches.' };
  }
  return { ok: true, config };
}
