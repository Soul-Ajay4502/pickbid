'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Check, Coins, Plus, Settings2, UserPlus, Users, X } from 'lucide-react';
import { DEFAULT_RULES, defaultBowlerQuota, LIMITS, type LineupPlayer, type MatchSetup, type ScoringRules } from '@/lib/scoring';
import type { Match, MatchScorecard, Player, Team } from '@/lib/types';
import { cn } from '@/lib/utils';
import { eventId } from './useScorecardSync';

interface SideDraft {
  /** Card ids chosen from the league roster, in the order they were ticked. */
  cardIds: string[];
  guests: LineupPlayer[];
  captainId: string | null;
  keeperId: string | null;
}

const OVER_PRESETS = [20, 10, 8, 6, 5];

function rulesKey(leagueId: string) {
  return `pickbid_scoring_rules_${leagueId}`;
}

/** The rules this league last played under on this device, so every fixture isn't set up from scratch. */
function lastRules(leagueId: string): ScoringRules {
  try {
    const raw = localStorage.getItem(rulesKey(leagueId));
    if (raw) return { ...DEFAULT_RULES, ...(JSON.parse(raw) as Partial<ScoringRules>) };
  } catch { /* nothing remembered */ }
  return DEFAULT_RULES;
}

function draftFor(team: Team, players: Player[], existing: MatchSetup['sides'][number] | null): SideDraft {
  if (existing) {
    return {
      cardIds: existing.players.filter((p) => !p.id.startsWith('guest:')).map((p) => p.id),
      guests: existing.players.filter((p) => p.id.startsWith('guest:')),
      captainId: existing.captainId,
      keeperId: existing.keeperId,
    };
  }
  const squad = players.filter((p) => p.teamId === team.id);
  const icons = squad.filter((p) => p.isIcon);
  return {
    cardIds: squad.map((p) => p.id),
    guests: [],
    captainId: icons.length === 1 ? icons[0].id : null,
    keeperId: squad.find((p) => p.isWicketKeeper)?.id ?? null,
  };
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
      aria-pressed={checked}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', checked ? 'bg-primary' : 'bg-muted-foreground/30')}>
        <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', checked ? 'left-4.5' : 'left-0.5')} />
      </span>
    </button>
  );
}

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="w-8 h-8 rounded-lg border border-border bg-card text-lg leading-none disabled:opacity-40" aria-label={`Fewer: ${label}`}>−</button>
        <span className="w-8 text-center font-bold tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="w-8 h-8 rounded-lg border border-border bg-card text-lg leading-none disabled:opacity-40" aria-label={`More: ${label}`}>+</button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof Users; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border bg-muted/40 flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function SquadPicker({
  team, draft, onChange, roster, borrowable,
}: {
  team: Team;
  draft: SideDraft;
  onChange: (d: SideDraft) => void;
  roster: Player[];
  /** League players on neither squad — borrowed or unsold. */
  borrowable: Player[];
}) {
  const [guestName, setGuestName] = useState('');
  const chosen = new Set(draft.cardIds);
  const extra = draft.cardIds.filter((id) => !roster.some((p) => p.id === id));
  const byId = (id: string) => roster.find((p) => p.id === id) ?? borrowable.find((p) => p.id === id);
  const squad: LineupPlayer[] = [
    ...draft.cardIds.map((id) => ({ id, name: byId(id)?.name ?? 'Player' })),
    ...draft.guests,
  ];

  function toggle(id: string) {
    const cardIds = chosen.has(id) ? draft.cardIds.filter((x) => x !== id) : [...draft.cardIds, id];
    onChange({
      ...draft,
      cardIds,
      captainId: cardIds.includes(draft.captainId ?? '') || draft.guests.some((g) => g.id === draft.captainId) ? draft.captainId : null,
      keeperId: cardIds.includes(draft.keeperId ?? '') || draft.guests.some((g) => g.id === draft.keeperId) ? draft.keeperId : null,
    });
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    onChange({ ...draft, guests: [...draft.guests, { id: `guest:${eventId()}`, name: name.slice(0, 80) }] });
    setGuestName('');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{squad.length} selected</p>
        {roster.length > 0 && (
          <button type="button" className="text-xs font-semibold text-primary"
            onClick={() => {
              const rosterIds = new Set(roster.map((p) => p.id));
              const allOn = roster.every((p) => chosen.has(p.id));
              const cardIds = allOn
                ? draft.cardIds.filter((x) => !rosterIds.has(x))
                : [...new Set([...draft.cardIds, ...rosterIds])];
              onChange({ ...draft, cardIds });
            }}>
            {roster.every((p) => chosen.has(p.id)) ? 'Clear team' : 'Select whole team'}
          </button>
        )}
      </div>
      {roster.length === 0 && extra.length === 0 && draft.guests.length === 0 && (
        <p className="text-sm text-muted-foreground">Nobody is on this team yet — add players from the league or as guests below.</p>
      )}
      <ul className="grid sm:grid-cols-2 gap-1.5">
        {[...roster, ...extra.map((id) => byId(id)).filter((p): p is Player => !!p)].map((p) => {
          const on = chosen.has(p.id);
          return (
            <li key={p.id}>
              <button type="button" onClick={() => toggle(p.id)}
                className={cn('w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  on ? 'border-primary/50 bg-primary/8' : 'border-border hover:bg-muted/50')}>
                <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0', on ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>
                  {on && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">{p.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{p.teamId === team.id ? p.role : 'Borrowed'}</span>
              </button>
            </li>
          );
        })}
        {draft.guests.map((g) => (
          <li key={g.id} className="flex items-center gap-2.5 rounded-xl border border-primary/50 bg-primary/8 px-3 py-2 text-sm">
            <span className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" /></span>
            <span className="flex-1 min-w-0 truncate font-medium">{g.name}</span>
            <span className="text-[10px] text-muted-foreground">Guest</span>
            <button type="button" aria-label={`Remove ${g.name}`} className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange({ ...draft, guests: draft.guests.filter((x) => x.id !== g.id), captainId: draft.captainId === g.id ? null : draft.captainId, keeperId: draft.keeperId === g.id ? null : draft.keeperId })}>
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="grid sm:grid-cols-2 gap-2">
        {borrowable.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) toggle(e.target.value); }}
            className="h-10 px-3 rounded-xl border border-border bg-input text-sm"
            aria-label="Add a player from elsewhere in the league"
          >
            <option value="">+ Add a league player…</option>
            {borrowable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest player name"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
            className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-border bg-input text-sm" />
          <button type="button" onClick={addGuest} disabled={!guestName.trim()}
            className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-40">
            <UserPlus className="w-4 h-4" />Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Captain</span>
          <select value={draft.captainId ?? ''} onChange={(e) => onChange({ ...draft, captainId: e.target.value || null })}
            className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm">
            <option value="">—</option>
            {squad.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Wicketkeeper</span>
          <select value={draft.keeperId ?? ''} onChange={(e) => onChange({ ...draft, keeperId: e.target.value || null })}
            className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm">
            <option value="">—</option>
            {squad.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export default function MatchSetupForm({
  leagueId, match, teams, players, existing, onSaved,
}: {
  leagueId: string;
  match: Pick<Match, 'id' | 'team1Id' | 'team2Id'>;
  teams: Team[];
  players: Player[];
  existing: MatchScorecard | null;
  onSaved: (card: MatchScorecard) => void;
}) {
  const team1 = teams.find((t) => t.id === match.team1Id);
  const team2 = teams.find((t) => t.id === match.team2Id);
  const [rules, setRules] = useState<ScoringRules>(() => existing?.setup.rules ?? lastRules(leagueId));
  const [quotaTouched, setQuotaTouched] = useState(!!existing);
  const [sides, setSides] = useState<[SideDraft, SideDraft] | null>(() =>
    team1 && team2
      ? [draftFor(team1, players, existing?.setup.sides[0] ?? null), draftFor(team2, players, existing?.setup.sides[1] ?? null)]
      : null,
  );
  const [tossWinner, setTossWinner] = useState<string>(existing?.setup.toss.winnerTeamId ?? '');
  const [decision, setDecision] = useState<'bat' | 'bowl'>(existing?.setup.toss.decision ?? 'bat');
  const [saving, setSaving] = useState(false);

  const borrowable = useMemo(() => {
    if (!sides) return [[], []] as [Player[], Player[]];
    const taken = new Set([...sides[0].cardIds, ...sides[1].cardIds]);
    const pool = players.filter((p) => !taken.has(p.id));
    return [
      pool.filter((p) => p.teamId !== match.team1Id),
      pool.filter((p) => p.teamId !== match.team2Id),
    ] as [Player[], Player[]];
  }, [players, sides, match.team1Id, match.team2Id]);

  if (!team1 || !team2 || !sides) {
    return <p className="text-sm text-muted-foreground">One of this match&apos;s teams no longer exists.</p>;
  }

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player';
  const lineup = (d: SideDraft): LineupPlayer[] => [...d.cardIds.map((id) => ({ id, name: nameOf(id) })), ...d.guests];
  const counts = [lineup(sides[0]).length, lineup(sides[1]).length];
  const ready = counts.every((n) => n >= LIMITS.squad.min && n <= LIMITS.squad.max) && !!tossWinner;

  function setOvers(overs: number) {
    setRules((r) => ({ ...r, overs, maxOversPerBowler: quotaTouched ? r.maxOversPerBowler : defaultBowlerQuota(overs) }));
  }

  async function submit() {
    if (!ready || !sides || !team1 || !team2) return;
    setSaving(true);
    const quota = rules.maxOversPerBowler === null ? null : Math.min(rules.maxOversPerBowler, rules.overs);
    const setup: MatchSetup = {
      rules: { ...rules, maxOversPerBowler: quota },
      sides: [
        { teamId: team1.id, name: team1.name, color: team1.colorHex, players: lineup(sides[0]), captainId: sides[0].captainId, keeperId: sides[0].keeperId },
        { teamId: team2.id, name: team2.name, color: team2.colorHex, players: lineup(sides[1]), captainId: sides[1].captainId, keeperId: sides[1].keeperId },
      ],
      toss: { winnerTeamId: tossWinner, decision },
    };
    try {
      const res = await fetch(`/api/leagues/${leagueId}/matches/${match.id}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersion: existing?.version ?? 0, setup }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Could not save the match setup');
      try { localStorage.setItem(rulesKey(leagueId), JSON.stringify(setup.rules)); } catch { /* fine */ }
      onSaved(body as MatchScorecard);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the match setup');
      setSaving(false);
    }
  }

  const quotaOptions = Array.from({ length: rules.overs }, (_, i) => i + 1);

  return (
    <div className="space-y-4 pb-28">
      <Section icon={Settings2} title="Match rules" subtitle="Remembered for this league's next match">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {OVER_PRESETS.map((n) => (
            <button key={n} type="button" onClick={() => setOvers(n)}
              className={cn('px-3 h-8 rounded-full border text-xs font-semibold', rules.overs === n ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
              {n} overs
            </button>
          ))}
        </div>
        <div className="divide-y divide-border/60">
          <Stepper label="Overs per innings" value={rules.overs} min={LIMITS.overs.min} max={LIMITS.overs.max} onChange={setOvers} />
          <Stepper label="Balls per over" value={rules.ballsPerOver} min={LIMITS.ballsPerOver.min} max={LIMITS.ballsPerOver.max}
            onChange={(v) => setRules((r) => ({ ...r, ballsPerOver: v }))} />
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm font-medium">Max overs per bowler</span>
            <select
              value={rules.maxOversPerBowler === null ? '' : String(rules.maxOversPerBowler)}
              onChange={(e) => { setQuotaTouched(true); setRules((r) => ({ ...r, maxOversPerBowler: e.target.value ? Number(e.target.value) : null })); }}
              className="h-9 px-2 rounded-lg border border-border bg-input text-sm"
            >
              <option value="">No limit</option>
              {quotaOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <Stepper label="Runs for a wide" value={rules.wideRuns} min={0} max={LIMITS.penaltyRuns.max} onChange={(v) => setRules((r) => ({ ...r, wideRuns: v }))} />
          <Stepper label="Runs for a no-ball" value={rules.noBallRuns} min={0} max={LIMITS.penaltyRuns.max} onChange={(v) => setRules((r) => ({ ...r, noBallRuns: v }))} />
          <Toggle label="Free hit after a no-ball" checked={rules.freeHit} onChange={(v) => setRules((r) => ({ ...r, freeHit: v }))} />
          <Toggle label="Wides are bowled again" hint="Off: a wide counts as one of the over's balls"
            checked={rules.wideReball} onChange={(v) => setRules((r) => ({ ...r, wideReball: v }))} />
          <Toggle label="No-balls are bowled again" hint="Off: a no-ball counts as one of the over's balls"
            checked={rules.noBallReball} onChange={(v) => setRules((r) => ({ ...r, noBallReball: v }))} />
          <Toggle label="Last man standing" hint="The last batter can carry on alone"
            checked={rules.lastManStanding} onChange={(v) => setRules((r) => ({ ...r, lastManStanding: v }))} />
        </div>
      </Section>

      {[team1, team2].map((team, i) => (
        <Section key={team.id} icon={Users} title={`${team.name} — playing squad`}
          subtitle={`${counts[i]} player${counts[i] === 1 ? '' : 's'} · ${rules.lastManStanding ? counts[i] : Math.max(0, counts[i] - 1)} wickets to take`}>
          <SquadPicker
            team={team}
            draft={sides[i]}
            onChange={(d) => setSides((s) => (s ? (i === 0 ? [d, s[1]] : [s[0], d]) : s))}
            roster={players.filter((p) => p.teamId === team.id)}
            borrowable={borrowable[i]}
          />
        </Section>
      ))}

      <Section icon={Coins} title="Toss">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[team1, team2].map((t) => (
            <button key={t.id} type="button" onClick={() => setTossWinner(t.id)}
              className={cn('h-11 rounded-xl border text-sm font-semibold truncate px-3', tossWinner === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['bat', 'bowl'] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDecision(d)}
              className={cn('h-11 rounded-xl border text-sm font-semibold', decision === d ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
              Chose to {d}
            </button>
          ))}
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          {!ready && (
            <p className="text-xs text-muted-foreground text-center mb-2">
              {!tossWinner ? 'Pick who won the toss' : `Each side needs ${LIMITS.squad.min}–${LIMITS.squad.max} players`}
            </p>
          )}
          <button type="button" onClick={submit} disabled={!ready || saving}
            className="btn-premium w-full h-12 rounded-xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            {existing ? 'Save setup' : 'Start scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
