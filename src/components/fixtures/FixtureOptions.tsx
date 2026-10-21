'use client';

import { useId } from 'react';
import type { FixtureConfig, FixtureMode, FixtureResult, TeamRequirement } from '@/lib/fixtures';

/**
 * The fixture-type form shared by a league's matches screen and the public
 * fixture-generator tool. Controlled and string-valued, so a half-typed number
 * is kept as typed; `toFixtureConfig` turns it into the engine's config, and
 * anything malformed comes back from the engine as a readable error that the
 * summary shows straight away.
 */

export interface FixtureFormState {
  mode: FixtureMode;
  homeAndAway: boolean;
  matchesPerTeam: string;
  totalMatches: string;
  /** total_matches: bounds for every team; custom: the default for teams without their own. */
  minPerTeam: string;
  maxPerTeam: string;
  allowRematches: boolean;
  minRest: string;
  maxInARow: string;
  /** custom: per-team bounds, keyed by team id. */
  teamLimits: Record<string, { min: string; max: string }>;
}

export const DEFAULT_FIXTURE_FORM: FixtureFormState = {
  mode: 'full_round_robin',
  homeAndAway: false,
  matchesPerTeam: '2',
  totalMatches: '',
  minPerTeam: '',
  maxPerTeam: '',
  allowRematches: false,
  minRest: '',
  maxInARow: '',
  teamLimits: {},
};

const MODES: { mode: FixtureMode; label: string; hint: string }[] = [
  { mode: 'full_round_robin', label: 'Full Round Robin', hint: 'Every team plays every other' },
  { mode: 'matches_per_team', label: 'Matches Per Team', hint: 'Each team plays the same number' },
  { mode: 'total_matches', label: 'Total Matches', hint: 'A set number, spread evenly' },
  { mode: 'custom', label: 'Custom', hint: 'A range for each team' },
];

const optionalNumber = (s: string) => (s.trim() === '' ? undefined : Number(s));

export function toFixtureConfig(form: FixtureFormState, teamIds: readonly string[]): FixtureConfig {
  const ordering = {
    minRestMatches: optionalNumber(form.minRest),
    maxConsecutiveMatches: optionalNumber(form.maxInARow),
  };
  const bounds = {
    noRematches: !form.allowRematches,
    minMatchesPerTeam: optionalNumber(form.minPerTeam),
    maxMatchesPerTeam: optionalNumber(form.maxPerTeam),
  };
  switch (form.mode) {
    case 'full_round_robin':
      return { mode: form.mode, legs: form.homeAndAway ? 2 : 1, rules: ordering };
    case 'matches_per_team':
      return { mode: form.mode, matchesPerTeam: optionalNumber(form.matchesPerTeam), rules: { noRematches: !form.allowRematches, ...ordering } };
    case 'total_matches':
      return { mode: form.mode, totalMatches: optionalNumber(form.totalMatches), rules: { ...bounds, ...ordering } };
    case 'custom': {
      const teamRequirements: Record<string, TeamRequirement> = {};
      for (const id of teamIds) {
        const min = optionalNumber(form.teamLimits[id]?.min ?? '');
        const max = optionalNumber(form.teamLimits[id]?.max ?? '');
        if (min !== undefined || max !== undefined) teamRequirements[id] = { min, max };
      }
      return { mode: form.mode, totalMatches: optionalNumber(form.totalMatches), teamRequirements, rules: { ...bounds, ...ordering } };
    }
  }
}

const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide';
const inputClass = 'w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

function NumberField({ id, label, value, onChange, placeholder, min = 0 }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min={min} step={1} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

export default function FixtureOptions({ teams, value, onChange, result }: {
  teams: { id: string; name: string }[];
  value: FixtureFormState;
  onChange: (next: FixtureFormState) => void;
  /** The engine's answer for the current settings, summarised under the form. */
  result: FixtureResult | null;
}) {
  const uid = useId();
  const set = (patch: Partial<FixtureFormState>) => onChange({ ...value, ...patch });
  const setLimit = (teamId: string, key: 'min' | 'max', v: string) =>
    set({ teamLimits: { ...value.teamLimits, [teamId]: { ...(value.teamLimits[teamId] ?? { min: '', max: '' }), [key]: v } } });

  const counts = result?.success ? Object.values(result.stats.teamParticipation) : [];
  const fewest = counts.length ? Math.min(...counts) : 0;
  const most = counts.length ? Math.max(...counts) : 0;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={`${labelClass} mb-2`}>Fixture type</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODES.map((o) => {
            const checked = value.mode === o.mode;
            return (
              <label key={o.mode}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                <input type="radio" name={`${uid}-mode`} value={o.mode} checked={checked}
                  onChange={() => set({ mode: o.mode })} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {value.mode === 'full_round_robin' && (
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={value.homeAndAway} onChange={(e) => set({ homeAndAway: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary" />
          Home and away (each pair plays twice)
        </label>
      )}

      {value.mode === 'matches_per_team' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField id={`${uid}-per-team`} label="Matches per team" min={1} value={value.matchesPerTeam}
            onChange={(v) => set({ matchesPerTeam: v })} />
        </div>
      )}

      {value.mode === 'total_matches' && (
        <div className="grid grid-cols-3 gap-3">
          <NumberField id={`${uid}-total`} label="Total matches" min={1} value={value.totalMatches}
            onChange={(v) => set({ totalMatches: v })} />
          <NumberField id={`${uid}-min`} label="Min per team" value={value.minPerTeam} placeholder="Any"
            onChange={(v) => set({ minPerTeam: v })} />
          <NumberField id={`${uid}-max`} label="Max per team" value={value.maxPerTeam} placeholder="Any"
            onChange={(v) => set({ maxPerTeam: v })} />
        </div>
      )}

      {value.mode === 'custom' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <NumberField id={`${uid}-total`} label="Total matches" min={1} value={value.totalMatches} placeholder="Fewest"
              onChange={(v) => set({ totalMatches: v })} />
            <NumberField id={`${uid}-min`} label="Default min" value={value.minPerTeam} placeholder="0"
              onChange={(v) => set({ minPerTeam: v })} />
            <NumberField id={`${uid}-max`} label="Default max" value={value.maxPerTeam} placeholder="Any"
              onChange={(v) => set({ maxPerTeam: v })} />
          </div>
          {teams.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                <span className={labelClass}>Team</span>
                <span className={labelClass}>Min</span>
                <span className={labelClass}>Max</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                {teams.map((t) => (
                  <div key={t.id} className="grid grid-cols-[1fr_5rem_5rem] gap-2 items-center px-3 py-1.5">
                    <span className="text-sm truncate">{t.name}</span>
                    <input type="number" inputMode="numeric" min={0} step={1} aria-label={`${t.name} minimum matches`}
                      value={value.teamLimits[t.id]?.min ?? ''} placeholder={value.minPerTeam || '0'}
                      onChange={(e) => setLimit(t.id, 'min', e.target.value)} className={`${inputClass} h-8 px-2`} />
                    <input type="number" inputMode="numeric" min={0} step={1} aria-label={`${t.name} maximum matches`}
                      value={value.teamLimits[t.id]?.max ?? ''} placeholder={value.maxPerTeam || 'Any'}
                      onChange={(e) => setLimit(t.id, 'max', e.target.value)} className={`${inputClass} h-8 px-2`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {value.mode !== 'full_round_robin' && (
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={!value.allowRematches} onChange={(e) => set({ allowRematches: !e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary" />
          No rematches (each pair meets at most once)
        </label>
      )}

      <details className="rounded-xl border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold select-none">Rest rules</summary>
        <div className="grid grid-cols-2 gap-3 pt-3 pb-1">
          <NumberField id={`${uid}-rest`} label="Rest between matches" value={value.minRest} placeholder="None"
            onChange={(v) => set({ minRest: v })} />
          <NumberField id={`${uid}-run`} label="Most in a row" min={1} value={value.maxInARow} placeholder="Any"
            onChange={(v) => set({ maxInARow: v })} />
        </div>
        <p className="text-xs text-muted-foreground pb-1">Counted in matches: a rest of 1 means a team sits out at least one match between its own.</p>
      </details>

      <div aria-live="polite" className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
        {teams.length < 2 ? (
          <p className="text-muted-foreground">Add at least two teams to build a fixture.</p>
        ) : (
          <>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Teams: <strong className="tabular-nums">{teams.length}</strong></span>
              {result?.success && (
                <>
                  <span>Matches per team: <strong className="tabular-nums">{fewest === most ? most : `${fewest}–${most}`}</strong></span>
                  <span>Total matches: <strong className="tabular-nums">{result.stats.totalMatches}</strong></span>
                  <span>Rounds: <strong className="tabular-nums">{result.stats.rounds}</strong></span>
                </>
              )}
            </p>
            {result && !result.success && (
              <p className="mt-1.5 text-destructive font-medium">❌ {result.error.message}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
