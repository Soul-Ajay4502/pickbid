'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarRange, ChevronDown, Shuffle, Undo2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import FixtureOptions, { DEFAULT_FIXTURE_FORM, toFixtureConfig, type FixtureFormState } from '@/components/fixtures/FixtureOptions';
import FixturePreview from '@/components/fixtures/FixturePreview';
import FixturePosterDialog from '@/components/fixtures/FixturePosterDialog';
import { formatMatchDay, generateFixtures, randomSeed, roundDate } from '@/lib/fixtures';
import type { Match, Team } from '@/lib/types';

const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide';
const inputClass = 'w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * The organizer's fixture builder: pick a format, see the exact fixture, save
 * it. The preview is generated here in the browser, and what gets posted is
 * that very list of matches — the server re-validates it against the league's
 * teams rather than generating its own, so what you see is what you get.
 */
export default function FixtureGeneratorPanel({ leagueId, leagueName, conductedBy, teams, existingMatches, onCreated }: {
  leagueId: string;
  leagueName: string;
  conductedBy: string;
  teams: Team[];
  existingMatches: number;
  onCreated: (created: Match[]) => void;
}) {
  // Open by default only while the league has no matches — that's when it's the next step.
  const [open, setOpen] = useState(existingMatches === 0);
  const [form, setForm] = useState<FixtureFormState>(DEFAULT_FIXTURE_FORM);
  const [seed, setSeed] = useState<string | null>(null);
  const [schedule, setSchedule] = useState({ startDate: '', gap: '7' });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Name order — the order the server validates in — so who gets an uneven
  // split's extra matches doesn't depend on when each team was created.
  const sorted = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const teamIds = useMemo(() => sorted.map((t) => t.id), [sorted]);
  const labels = useMemo(() => Object.fromEntries(sorted.map((t) => [t.id, t.name])), [sorted]);
  const colors = useMemo(() => new Map(sorted.map((t) => [t.id, t.colorHex])), [sorted]);
  const config = useMemo(() => toFixtureConfig(form, teamIds), [form, teamIds]);
  const result = useMemo(
    () => generateFixtures(teamIds, config, { randomize: seed !== null, seed: seed ?? undefined, labels }),
    [teamIds, config, seed, labels],
  );

  const gap = Number(schedule.gap);
  const rounds = result.success ? result.stats.rounds : 0;
  const firstDay = schedule.startDate ? roundDate(schedule.startDate, 0, gap) : null;
  const lastDay = schedule.startDate && rounds ? roundDate(schedule.startDate, rounds - 1, gap) : null;
  // The poster shows the dates this fixture would be saved with.
  const posterMatches = useMemo(
    () => (result.success
      ? result.matches.map((m) => ({ ...m, date: schedule.startDate ? roundDate(schedule.startDate, m.round - 1, gap) : null }))
      : []),
    [result, schedule.startDate, gap],
  );
  const posterTeams = useMemo(() => sorted.map((t) => ({ id: t.id, name: t.name, color: t.colorHex })), [sorted]);

  async function save() {
    if (!result.success) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/matches/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          matches: result.matches.map((m) => ({ team1Id: m.teamAId, team2Id: m.teamBId })),
          schedule: schedule.startDate ? { startDate: schedule.startDate, daysBetweenRounds: gap } : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Failed to save fixtures');
      const created: Match[] = json;
      onCreated(created);
      setConfirmOpen(false);
      toast.success(`${created.length} fixtures added`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save fixtures'); }
    finally { setSaving(false); }
  }

  // Adding to a list that already has matches is worth a pause — the new
  // fixtures go in alongside them, and nothing is replaced.
  function requestSave() {
    if (existingMatches > 0) setConfirmOpen(true);
    else void save();
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`w-full px-5 py-4 bg-muted/40 flex items-center gap-2.5 text-left ${open ? 'border-b border-border' : ''}`}>
        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-sky-500/20 to-indigo-600/20 border border-sky-500/20 flex items-center justify-center shrink-0">
          <CalendarRange className="w-4 h-4 text-sky-600 dark:text-sky-400"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Generate Fixtures</p>
          <p className="text-xs text-muted-foreground">Round robin, a set number per team, or your own rules</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {open && (
        <div className="p-5 space-y-5">
          <FixtureOptions teams={sorted} value={form} onChange={setForm} result={result} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="gen-start" className={labelClass}>First round <span className="normal-case font-normal">(optional)</span></label>
              <input id="gen-start" type="date" value={schedule.startDate} onChange={e => setSchedule(s => ({ ...s, startDate: e.target.value }))} className={inputClass}/>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gen-gap" className={labelClass}>Then</label>
              <select id="gen-gap" value={schedule.gap} onChange={e => setSchedule(s => ({ ...s, gap: e.target.value }))} disabled={!schedule.startDate}
                className={`${inputClass} disabled:opacity-50`}>
                <option value="7">A round every week</option>
                <option value="1">A round every day</option>
                <option value="0">All on the same day</option>
              </select>
            </div>
          </div>

          {result.success && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {firstDay && lastDay
                    ? firstDay === lastDay ? `All on ${formatMatchDay(firstDay)}` : `${formatMatchDay(firstDay)} to ${formatMatchDay(lastDay)}, one round per date`
                    : 'Undated — set a first round to date every match'}
                  {seed && <> · shuffled (seed <span className="font-mono">{seed}</span>)</>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <FixturePosterDialog
                    teams={posterTeams}
                    matches={posterMatches}
                    defaultTitle={leagueName}
                    defaultSubtitle={conductedBy ? `Conducted by ${conductedBy}` : ''}
                  />
                  {seed && (
                    <button type="button" onClick={() => setSeed(null)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <Undo2 className="w-3.5 h-3.5"/>Name order
                    </button>
                  )}
                  <button type="button" onClick={() => setSeed(randomSeed())}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    <Shuffle className="w-3.5 h-3.5"/>Shuffle
                  </button>
                </div>
              </div>
              <FixturePreview matches={result.matches} teams={sorted} colorOf={(id) => colors.get(id)} />
            </>
          )}

          <button type="button" onClick={requestSave} disabled={!result.success || saving}
            className="btn-premium w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60">
            <CalendarRange className="w-4 h-4"/>
            {saving ? 'Saving…' : result.success ? `Add ${result.stats.totalMatches} fixtures` : 'Fix the settings above to continue'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Add ${result.success ? result.stats.totalMatches : 0} more fixtures?`}
        description={`This league already has ${existingMatches} ${existingMatches === 1 ? 'match' : 'matches'}. The new fixtures are added alongside them — nothing is replaced or removed.`}
        confirmLabel="Add fixtures"
        pendingLabel="Saving…"
        destructive={false}
        onConfirm={save}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
