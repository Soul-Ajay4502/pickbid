'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  DISMISSAL_LABELS, LIMITS, SUB_FIELDER, allowedDismissals, bowlerOptions, creditsBowler, currentInnings, dismissalText, economy,
  nameLookup, nextBatterOptions, matchImpact, oversText, playerMatchLines, strikeRate, strikerOnly, summarizeMatch, upcomingInnings,
  type CreaseDismissal, type DeliveryDismissal, type DismissalKind, type Extra, type LineupPlayer, type MatchState, type ScoringEvent,
} from '@/lib/scoring';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { eventId } from './useScorecardSync';
import { BallChip, TeamDot } from './ScorecardParts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before it gets its id and timestamp. */
export type Draft = DistributiveOmit<ScoringEvent, 'id' | 'at'>;
/** Records a draft; returns the engine's objection, or null when recorded. */
export type Send = (d: Draft) => string | null;
/** Checks a draft against the engine without recording it. */
export type Preview = (d: Draft) => string | null;
/** Where the runs off a no-ball came from. */
export type NbRunsAs = 'bat' | 'bye' | 'legbye';

const EXTRA_SHORT: Record<Extra, string> = { wd: 'Wd', nb: 'Nb', b: 'B', lb: 'Lb' };

/** The over-strip chip a delivery would leave — the same text `ballChip` draws once it's recorded. */
export function draftChip(runs: number, extra: Extra | null): string {
  if (!extra) return String(runs);
  if (extra === 'wd' || extra === 'nb') return runs > 0 ? `${EXTRA_SHORT[extra]}+${runs}` : EXTRA_SHORT[extra];
  return `${runs}${EXTRA_SHORT[extra]}`;
}

// ── Building blocks ──────────────────────────────────────────────────────────

/**
 * Every scorer dialog. A sheet that rises from the bottom edge on a phone —
 * where the scorer's thumb already is — and a centred dialog from `sm` up.
 */
export function Sheet({ open, onClose, title, description, children, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn(
        'max-h-[88dvh] overflow-y-auto overscroll-contain gap-4 p-5',
        'top-auto bottom-0 left-0 translate-x-0 translate-y-0 w-full max-w-full rounded-3xl rounded-b-none',
        'pb-[max(1.25rem,env(safe-area-inset-bottom))] data-open:slide-in-from-bottom-8 data-closed:slide-out-to-bottom-8',
        'sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-5',
        wide ? 'sm:max-w-lg' : 'sm:max-w-md',
      )}>
        <span aria-hidden className="sm:hidden mx-auto -mt-2 -mb-1 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <div className="space-y-1 pr-8">
          <DialogTitle className="text-lg font-black tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13px] leading-snug">{description}</DialogDescription>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Choice({ active, onClick, children, className, disabled, tone = 'default' }: {
  active?: boolean; onClick: () => void; children: ReactNode; className?: string; disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? tone === 'danger'
            ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/30'
            : 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
          : 'border-border bg-card hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{children}</p>;
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200 text-center">
      {text}
    </p>
  );
}

function Submit({ onClick, disabled, children, tone = 'default' }: { onClick: () => void; disabled?: boolean; children: ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('w-full h-12 rounded-2xl font-bold text-white disabled:opacity-40 touch-manipulation',
        tone === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-[0_10px_22px_-12px_rgb(220_38_38)]' : 'btn-premium')}>
      {children}
    </button>
  );
}

function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-muted/40 p-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-10 h-10 rounded-xl bg-card border border-border text-xl disabled:opacity-40" aria-label="Less">−</button>
      <span className="w-10 text-center text-2xl font-black tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-10 h-10 rounded-xl bg-card border border-border text-xl disabled:opacity-40" aria-label="More">+</button>
    </div>
  );
}

/** Segmented choice of where the runs off a no-ball came from. */
function NbAsPicker({ value, onChange }: { value: NbRunsAs; onChange: (v: NbRunsAs) => void }) {
  const options: { id: NbRunsAs; label: string }[] = [{ id: 'bat', label: 'Off the bat' }, { id: 'bye', label: 'Byes' }, { id: 'legbye', label: 'Leg byes' }];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted/40 p-1" role="group" aria-label="Runs off the no-ball came">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={cn('h-9 rounded-xl text-xs font-semibold transition-colors',
            value === o.id ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A tappable player for the pickers: name, an optional line under it, an optional corner badge. */
function PlayerTile({ name, sub, badge, active, disabled, onClick, tone = 'primary' }: {
  name: string; sub?: ReactNode; badge?: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void;
  tone?: 'primary' | 'danger';
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn(
        'relative w-full h-full min-h-12 rounded-xl border px-3 py-2 text-left transition-colors touch-manipulation',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        active
          ? tone === 'danger' ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/30' : 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border bg-card hover:bg-muted/60 disabled:hover:bg-card',
      )}>
      <span className={cn('block text-sm font-semibold truncate', badge !== undefined && 'pr-6',
        active && (tone === 'danger' ? 'text-red-700 dark:text-red-300' : 'text-primary'))}>{name}</span>
      {sub && <span className="block mt-0.5 text-[11px] leading-tight text-muted-foreground truncate tabular-nums">{sub}</span>}
      {badge !== undefined && badge !== null && <span className="absolute top-2 right-2">{badge}</span>}
    </button>
  );
}

/** "(c)" and "†" after a name, the way scorecards mark captains and keepers. */
function marks(state: MatchState, teamId: string, playerId: string): string {
  const side = state.setup.sides.find((s) => s.teamId === teamId);
  return `${side?.captainId === playerId ? ' (c)' : ''}${side?.keeperId === playerId ? ' †' : ''}`;
}

function PlayerSelect({ label, value, onChange, players, placeholder = 'Choose…', exclude = [] }: {
  label: string; value: string | null; onChange: (id: string | null) => void; players: LineupPlayer[];
  placeholder?: string; exclude?: (string | null)[];
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
        className="w-full h-11 px-3 rounded-xl border border-border bg-input text-sm">
        <option value="">{placeholder}</option>
        {players.filter((p) => !exclude.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

// ── Someone who isn't in the list ────────────────────────────────────────────

/**
 * "Not in the list?" — sits under every batter and bowler picker, so a player
 * who turns up after the squads were set can be added at the moment they walk
 * out, not from a menu the scorer has to remember exists. It records the same
 * `add_player` event as *Add a late arrival*: pick a league player who isn't
 * in either squad, or type a name for a guest. `onAdded` hands back the new
 * id so the picker can select them straight away.
 */
export function QuickAddPlayer({ state, teamId, players, send, onAdded }: {
  state: MatchState;
  /** The side the new player joins — the batting side under a batter picker, the fielding side under a bowler's. */
  teamId: string;
  /** The league roster, for players who have a card but aren't in a squad. */
  players: Player[];
  send: Send;
  onAdded?: (playerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cardId, setCardId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const teamName = state.setup.sides.find((s) => s.teamId === teamId)?.name ?? 'this team';
  const squadOnly = !!state.setup.squadOnly;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full min-h-10 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50">
        <UserPlus className="w-4 h-4" />{squadOnly ? 'Add an available team member' : 'Not in the list? Add a new player'}
      </button>
    );
  }

  const taken = new Set(Object.values(state.squads).flat().map((p) => p.id));
  const available = players.filter((p) => !taken.has(p.id) && (!squadOnly || p.teamId === teamId))
    .sort((a, b) => Number(b.teamId === teamId) - Number(a.teamId === teamId) || a.name.localeCompare(b.name));

  function add() {
    const card = players.find((p) => p.id === cardId);
    if (squadOnly && (!card || card.teamId !== teamId)) {
      setProblem('Choose a player from this team’s existing squad');
      return;
    }
    const typed = name.trim().slice(0, 80);
    if (!card && !typed) return;
    const player = card ? { id: card.id, name: card.name } : { id: `guest:${eventId()}`, name: typed };
    const err = send({ type: 'add_player', teamId, player });
    if (err) { setProblem(err); return; }
    setOpen(false); setName(''); setCardId(null); setProblem(null);
    onAdded?.(player.id);
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2.5">
      <p className="text-xs font-semibold text-foreground">New player for {teamName}</p>
      {!squadOnly && <input value={name} autoFocus
        onChange={(e) => { setName(e.target.value); if (e.target.value) setCardId(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder="Player name" maxLength={80}
        className="w-full h-11 px-3 rounded-xl border border-border bg-input text-sm" />}
      {available.length > 0 && (
        <select value={cardId ?? ''} onChange={(e) => { setCardId(e.target.value || null); if (e.target.value) setName(''); }}
          aria-label={squadOnly ? 'Pick an available team member' : "Or pick a league player who isn't in a squad"}
          className="w-full h-11 px-3 rounded-xl border border-border bg-input text-sm">
          <option value="">{squadOnly ? 'Choose a team member…' : '…or pick from the league'}</option>
          {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {squadOnly && available.length === 0 && <p className="text-xs text-muted-foreground">No other team members are available.</p>}
      <Problem text={problem} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setOpen(false); setProblem(null); }}
          className="h-10 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted">Cancel</button>
        <button type="button" onClick={add} disabled={!cardId && (squadOnly || !name.trim())}
          className="h-10 rounded-xl btn-premium text-sm font-bold text-white disabled:opacity-40">Add to squad</button>
      </div>
    </div>
  );
}

// ── Start of an innings ──────────────────────────────────────────────────────

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-3xl border border-border bg-card p-4 sm:p-5', className)}>{children}</section>;
}

/**
 * Openers and the opening bowler, picked by tapping names rather than from
 * drop-downs: the first batter tapped takes strike, the second the other end.
 * The start button rides the bottom edge so a long squad never hides it.
 */
export function StartInningsPanel({ state, players, send }: { state: MatchState; players: Player[]; send: Send }) {
  const next = upcomingInnings(state);
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!next) return null;
  const batting = state.squads[next.battingTeamId] ?? [];
  const bowling = state.squads[next.bowlingTeamId] ?? [];
  const side = (id: string) => state.setup.sides.find((s) => s.teamId === id);
  const ordinal = next.superOver ? 'Super Over' : next.index === 0 ? '1st innings' : '2nd innings';
  const nameOf = nameLookup(state);

  function tapBatter(id: string) {
    setProblem(null);
    if (striker === id) { setStriker(null); return; }
    if (nonStriker === id) { setNonStriker(null); return; }
    if (!striker) setStriker(id);
    else setNonStriker(id);
  }

  const badge = (n: 1 | 2) => (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">{n}</span>
  );

  return (
    <>
      <Card className="relative overflow-hidden">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: side(next.battingTeamId)?.color }} />
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{ordinal}</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight">
          <TeamDot color={side(next.battingTeamId)?.color ?? '#64748b'} className="w-3 h-3" />
          <span className="truncate">{side(next.battingTeamId)?.name} to bat</span>
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold tabular-nums">{next.overs} over{next.overs === 1 ? '' : 's'}</span>
          {next.target !== null && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary tabular-nums">Target {next.target}</span>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{side(next.bowlingTeamId)?.name} bowling</span>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold">Opening batters</h3>
            <p className="text-xs text-muted-foreground">Tap the striker first, then the non-striker</p>
          </div>
          {striker && nonStriker && (
            <button type="button" onClick={() => { setStriker(nonStriker); setNonStriker(striker); }}
              className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted">
              <ArrowLeftRight className="w-3.5 h-3.5" />Swap
            </button>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-1.5">
          {batting.map((p) => (
            <li key={p.id}>
              <PlayerTile name={`${p.name}${marks(state, next.battingTeamId, p.id)}`} onClick={() => tapBatter(p.id)}
                active={striker === p.id || nonStriker === p.id}
                sub={striker === p.id ? 'On strike' : nonStriker === p.id ? 'Non-striker' : undefined}
                badge={striker === p.id ? badge(1) : nonStriker === p.id ? badge(2) : null} />
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <QuickAddPlayer state={state} teamId={next.battingTeamId} players={players} send={send}
            onAdded={(pid) => { if (!striker) setStriker(pid); else if (!nonStriker) setNonStriker(pid); }} />
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <h3 className="font-bold">Opening bowler</h3>
          <p className="text-xs text-muted-foreground">{side(next.bowlingTeamId)?.name}</p>
        </div>
        <ul className="grid grid-cols-2 gap-1.5">
          {bowling.map((p) => (
            <li key={p.id}>
              <PlayerTile name={`${p.name}${marks(state, next.bowlingTeamId, p.id)}`} active={bowler === p.id}
                onClick={() => { setProblem(null); setBowler(bowler === p.id ? null : p.id); }} />
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <QuickAddPlayer state={state} teamId={next.bowlingTeamId} players={players} send={send} onAdded={setBowler} />
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background/95 backdrop-blur-xl border-t border-border/60 space-y-2">
        <Problem text={problem} />
        <p className="text-center text-xs text-muted-foreground truncate">
          {striker || nonStriker || bowler ? (
            <>
              <span className="font-semibold text-foreground">{striker ? `${nameOf(striker)}*` : '—'}</span>
              {' & '}
              <span className="font-semibold text-foreground">{nonStriker ? nameOf(nonStriker) : '—'}</span>
              {' · '}
              <span className="font-semibold text-foreground">{bowler ? nameOf(bowler) : '—'}</span> to bowl
            </>
          ) : 'Pick two openers and a bowler'}
        </p>
        <Submit
          disabled={!striker || !nonStriker || !bowler}
          onClick={() => setProblem(send({ type: 'start_innings', strikerId: striker!, nonStrikerId: nonStriker, bowlerId: bowler! }))}
        >
          Start {ordinal}
        </Submit>
      </div>
    </>
  );
}

// ── Bowler ───────────────────────────────────────────────────────────────────

export function BowlerPicker({ state, players, send, onDone }: { state: MatchState; players: Player[]; send: Send; onDone?: () => void }) {
  const inn = currentInnings(state);
  const fieldingTeamId = inn?.bowlingTeamId ?? null;
  const bpo = state.setup.rules.ballsPerOver;
  const quota = inn?.superOver ? null : state.setup.rules.maxOversPerBowler;
  const options = bowlerOptions(state);
  // The attack already in use first, then fresh arms, then anyone who can't bowl now
  const rank = (o: (typeof options)[number]) => (o.blocked ? 2 : o.figures ? 0 : 1);
  const sorted = [...options].sort((a, b) => rank(a) - rank(b));
  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-2 gap-1.5">
        {sorted.map(({ player, blocked, figures }) => (
          <li key={player.id}>
            <PlayerTile
              name={`${player.name}${fieldingTeamId ? marks(state, fieldingTeamId, player.id) : ''}`}
              disabled={!!blocked}
              onClick={() => { if (!send({ type: 'bowler', bowlerId: player.id })) onDone?.(); }}
              sub={
                <>
                  <span className={cn(blocked && 'text-amber-700 dark:text-amber-300')}>
                    {blocked ?? (figures
                      ? `${figures.wickets}/${figures.runs} · ${oversText(figures.balls, bpo)} ov · Econ ${economy(figures.runs, figures.balls, bpo)}`
                      : 'Yet to bowl')}
                  </span>
                  {quota !== null && figures && (
                    <span className="mt-1.5 block h-1 rounded-full bg-muted overflow-hidden" aria-label={`${oversText(figures?.balls ?? 0, bpo)} of ${quota} overs`}>
                      <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, ((figures?.balls ?? 0) / (quota * bpo)) * 100)}%` }} />
                    </span>
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>
      {fieldingTeamId && (
        // A bowler who isn't in the squad yet: add them and bring them on in one go
        <QuickAddPlayer state={state} teamId={fieldingTeamId} players={players} send={send}
          onAdded={(pid) => { if (!send({ type: 'bowler', bowlerId: pid })) onDone?.(); }} />
      )}
    </div>
  );
}

// ── Runs the keypad has no key for ───────────────────────────────────────────

const MORE_TITLE: Record<Extra | 'none', string> = {
  none: 'More runs', wd: 'Wide + runs', nb: 'No-ball + runs', b: 'Byes', lb: 'Leg byes',
};

/**
 * Fives, all-run fours, overthrows — on a legal ball or on whichever extra the
 * keypad had armed. Strike follows the runs the batters actually ran.
 */
export function MoreRunsSheet({ extra, nbRunsAs = 'bat', state, send, onClose }: {
  extra: Extra | null; nbRunsAs?: NbRunsAs; state: MatchState; send: Send; onClose: () => void;
}) {
  const rules = state.setup.rules;
  const [runs, setRuns] = useState(5);
  const [ran, setRan] = useState(5);
  const [boundary, setBoundary] = useState(false);
  const [as, setAs] = useState<NbRunsAs>(nbRunsAs);
  const offBat = extra === null || (extra === 'nb' && as === 'bat');
  const canBoundary = runs === 4 || (runs === 6 && offBat);
  const penalty = extra === 'wd' ? rules.wideRuns : extra === 'nb' ? rules.noBallRuns : 0;
  const description = extra === null
    ? 'All-run fours, fives, overthrows. Strike follows the runs the batters actually ran.'
    : extra === 'wd'
      ? `${penalty} for the wide, plus the runs below.`
      : extra === 'nb'
        ? `${penalty} for the no-ball, plus the runs below${rules.freeHit ? ' — next ball is a free hit' : ''}.`
        : 'Runs the batters took — not off the bat, not charged to the bowler.';

  function pick(v: number) {
    setRuns(v);
    setRan(v);
    if (!(v === 4 || (v === 6 && offBat))) setBoundary(false);
  }

  return (
    <Sheet open onClose={onClose} title={MORE_TITLE[extra ?? 'none']} description={description}>
      <div className="space-y-4">
        {extra === 'nb' && <NbAsPicker value={as} onChange={(v) => { setAs(v); if (v !== 'bat' && runs === 6) setBoundary(false); }} />}
        <div>
          <Label>{extra === null ? 'Runs scored off the bat' : extra === 'wd' ? 'Runs on top of the wide' : extra === 'nb' ? 'Runs on top of the no-ball' : 'Runs'}</Label>
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: LIMITS.runsPerBall }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => pick(n)} aria-pressed={runs === n}
                className={cn('h-11 rounded-xl border text-base font-black tabular-nums transition-colors touch-manipulation',
                  runs === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {canBoundary && (
          <div className="grid grid-cols-2 gap-1.5">
            <Choice active={!boundary} onClick={() => setBoundary(false)}>Ran them</Choice>
            <Choice active={boundary} onClick={() => setBoundary(true)}>Boundary</Choice>
          </div>
        )}
        {!boundary && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Runs actually run</p>
              <p className="text-xs text-muted-foreground">Fewer than scored when overthrows went to the rope</p>
            </div>
            <Stepper value={Math.min(ran, runs)} min={0} max={runs} onChange={setRan} />
          </div>
        )}
        <Submit onClick={() => {
          const err = send({
            type: 'ball', runs, extra,
            ...(extra === 'nb' ? { nbRunsAs: as } : {}),
            ...(boundary && canBoundary ? { boundary: true } : {}),
            ...(!boundary && ran !== runs ? { ran } : {}),
          });
          if (!err) onClose();
        }}>
          Record {draftChip(runs, extra)}{extra === null ? ` run${runs === 1 ? '' : 's'}` : ''}
        </Submit>
      </div>
    </Sheet>
  );
}

// ── Wickets ──────────────────────────────────────────────────────────────────

const DELIVERY_KINDS: DeliveryDismissal[] = ['bowled', 'caught', 'lbw', 'stumped', 'run_out', 'hit_wicket', 'obstructing_field', 'hit_ball_twice'];
const CREASE_KINDS: CreaseDismissal[] = ['retired_hurt', 'retired_out', 'timed_out', 'run_out'];
type DeliveryType = 'legal' | Extra;
const DELIVERY_LABEL: Record<DeliveryType, string> = { legal: 'Legal ball', wd: 'Wide', nb: 'No-ball', b: 'Bye', lb: 'Leg bye' };
const toExtra = (t: DeliveryType): Extra | null => (t === 'legal' ? null : t);

export function WicketSheet({ state, players, mode, presetExtra, send, preview, onClose }: {
  state: MatchState;
  /** The league roster, so a batter who isn't in the squad can be added as they walk in. */
  players: Player[];
  /** `delivery`: out off a ball. `crease`: retirements and the like, between balls. */
  mode: 'delivery' | 'crease';
  presetExtra: Extra | null;
  send: Send;
  preview: Preview;
  onClose: () => void;
}) {
  const inn = currentInnings(state);
  const [kind, setKind] = useState<DeliveryDismissal | CreaseDismissal | null>(null);
  const [delivery, setDelivery] = useState<DeliveryType>(presetExtra ?? 'legal');
  const [outId, setOutId] = useState<string | null>(null);
  const [fielderId, setFielderId] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);
  const [nbRunsAs, setNbRunsAs] = useState<'bat' | 'bye' | 'legbye'>('bat');
  const [nextBatterId, setNextBatterId] = useState<string | null>(null);
  const [nextOnStrike, setNextOnStrike] = useState<boolean | undefined>(undefined);

  const draft = useMemo((): Draft | null => {
    if (!inn || !kind) return null;
    if (mode === 'crease') {
      const batterId = kind === 'run_out' ? inn.nonStrikerId : outId;
      if (!batterId) return null;
      return {
        type: 'dismiss', kind: kind as CreaseDismissal, batterId,
        fielderId: kind === 'run_out' ? fielderId : null,
        nextBatterId,
        ...(nextOnStrike !== undefined ? { nextOnStrike } : {}),
      };
    }
    const k = kind as DeliveryDismissal;
    const out = strikerOnly(k) ? inn.strikerId : outId;
    if (!out) return null;
    const extra = toExtra(delivery);
    const takesRuns = k === 'run_out' || k === 'obstructing_field';
    return {
      type: 'ball',
      runs: takesRuns ? runs : 0,
      extra,
      ...(extra === 'nb' ? { nbRunsAs } : {}),
      wicket: {
        kind: k, outId: out, fielderId, nextBatterId,
        ...(nextOnStrike !== undefined && !strikerOnly(k) ? { nextOnStrike } : {}),
      },
    };
  }, [inn, kind, mode, outId, fielderId, nextBatterId, nextOnStrike, delivery, runs, nbRunsAs]);

  if (!inn) return null;
  const freeHit = inn.freeHit;
  const types: DeliveryType[] = presetExtra ? [presetExtra] : ['legal', 'wd', 'nb', 'b', 'lb'];
  const kindsFor = (t: DeliveryType) => allowedDismissals(toExtra(t), freeHit);
  const deliveryKinds = DELIVERY_KINDS.filter((k) => types.some((t) => kindsFor(t).includes(k)));
  const validTypes = kind && mode === 'delivery' ? types.filter((t) => kindsFor(t).includes(kind as DeliveryDismissal)) : [];

  const fielders = state.squads[inn.bowlingTeamId] ?? [];
  const keeperId = state.setup.sides.find((s) => s.teamId === inn.bowlingTeamId)?.keeperId ?? null;
  const atCrease = [inn.strikerId, inn.nonStrikerId].filter((x): x is string => !!x)
    .map((id) => inn.batters.find((b) => b.id === id)!);
  const candidates = nextBatterOptions(state);
  const problem = draft ? preview(draft) : null;

  function pick(k: DeliveryDismissal | CreaseDismissal) {
    setKind(k);
    setRuns(0);
    setNextOnStrike(undefined);
    if (mode === 'delivery') {
      const valid = types.filter((t) => kindsFor(t).includes(k as DeliveryDismissal));
      if (!valid.includes(delivery)) setDelivery(valid[0] ?? 'legal');
      setOutId(strikerOnly(k as DeliveryDismissal) ? inn!.strikerId : null);
      setFielderId(k === 'stumped' ? keeperId : null);
    } else {
      setOutId(k === 'run_out' ? inn!.nonStrikerId : null);
      setFielderId(null);
    }
  }

  const needsFielder = kind === 'caught' || kind === 'stumped' || (kind === 'run_out' && mode === 'delivery');
  const chooseBatter = kind !== null && (mode === 'crease' ? kind !== 'run_out' : !strikerOnly(kind as DeliveryDismissal));
  const endsAmbiguous = kind === 'run_out' || kind === 'obstructing_field' || mode === 'crease';
  const takesRuns = mode === 'delivery' && (kind === 'run_out' || kind === 'obstructing_field');
  const freshCandidates = candidates.filter((p) => !inn.batters.some((b) => b.id === p.id));

  // The line this wicket will leave on the scorecard, built as the scorer picks
  const nameOf = nameLookup(state);
  const leaving = draft?.type === 'ball' ? draft.wicket?.outId ?? null : draft?.type === 'dismiss' ? draft.batterId : null;
  const summary = kind && leaving ? (() => {
    const k = kind as DismissalKind;
    const fielder = k === 'stumped' ? fielderId ?? keeperId : fielderId;
    return dismissalText({ kind: k, bowlerId: creditsBowler(k) ? inn.bowlerId : null, fielderId: fielder }, nameOf);
  })() : null;
  const extraOn = mode === 'delivery' ? toExtra(delivery) : null;

  return (
    <Sheet open onClose={onClose} wide
      title={mode === 'crease' ? 'Retire or dismiss a batter' : 'Wicket'}
      description={freeHit && mode === 'delivery' ? 'Free hit — only a run out (or obstruction, or hitting it twice) is out' : undefined}>
      <div className="space-y-4">
        <div>
          <Label>How</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {(mode === 'crease' ? CREASE_KINDS : deliveryKinds).map((k) => (
              <Choice key={k} active={kind === k} tone="danger" onClick={() => pick(k)}>
                {mode === 'crease' && k === 'run_out' ? 'Run out (backing up)' : DISMISSAL_LABELS[k]}
              </Choice>
            ))}
          </div>
        </div>

        {kind && validTypes.length > 1 && (
          <div>
            <Label>Off a</Label>
            <div className="flex flex-wrap gap-1.5">
              {validTypes.map((t) => <Choice key={t} active={delivery === t} onClick={() => setDelivery(t)}>{DELIVERY_LABEL[t]}</Choice>)}
            </div>
          </div>
        )}

        {chooseBatter && (
          <div>
            <Label>Who</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {atCrease.map((b) => (
                <Choice key={b.id} active={outId === b.id} onClick={() => setOutId(b.id)}
                  disabled={kind === 'timed_out' && b.balls > 0}>
                  {b.name}{inn.strikerId === b.id ? ' *' : ''}
                </Choice>
              ))}
            </div>
          </div>
        )}

        {takesRuns && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Runs completed</Label>
              <p className="text-xs text-muted-foreground -mt-1">Before the wicket fell</p>
            </div>
            <Stepper value={runs} min={0} max={6} onChange={setRuns} />
          </div>
        )}
        {takesRuns && delivery === 'nb' && runs > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            <Choice active={nbRunsAs === 'bat'} onClick={() => setNbRunsAs('bat')}>Off the bat</Choice>
            <Choice active={nbRunsAs === 'bye'} onClick={() => setNbRunsAs('bye')}>Byes</Choice>
            <Choice active={nbRunsAs === 'legbye'} onClick={() => setNbRunsAs('legbye')}>Leg byes</Choice>
          </div>
        )}

        {needsFielder && (
          <div>
            <Label>{kind === 'caught' ? 'Caught by' : kind === 'stumped' ? 'Keeper' : 'Fielder (optional)'}</Label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {fielders.map((f) => (
                <Choice key={f.id} active={fielderId === f.id} onClick={() => setFielderId(fielderId === f.id ? null : f.id)} className="min-h-9 py-1">
                  {f.name}{f.id === inn.bowlerId ? ' (bowler)' : f.id === keeperId ? ' †' : ''}
                </Choice>
              ))}
              <Choice active={fielderId === SUB_FIELDER} onClick={() => setFielderId(fielderId === SUB_FIELDER ? null : SUB_FIELDER)} className="min-h-9 py-1">
                Substitute
              </Choice>
            </div>
          </div>
        )}

        {kind && (
          <div>
            <Label>Next batter</Label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto empty:hidden">
              {candidates.map((p) => {
                const back = !freshCandidates.some((c) => c.id === p.id);
                return (
                  <Choice key={p.id} active={nextBatterId === p.id} onClick={() => setNextBatterId(nextBatterId === p.id ? null : p.id)} className="min-h-9 py-1">
                    {p.name}{back ? ' (returning)' : ''}
                  </Choice>
                );
              })}
            </div>
            {freshCandidates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {state.setup.rules.lastManStanding ? 'Leave empty to let the last batter carry on alone.' : 'Leave empty if nobody can come in — the innings ends.'}
              </p>
            )}
            <div className="mt-2">
              <QuickAddPlayer state={state} teamId={inn.battingTeamId} players={players} send={send} onAdded={setNextBatterId} />
            </div>
          </div>
        )}

        {kind && endsAmbiguous && nextBatterId && (
          <div>
            <Label>Who faces the next ball</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <Choice active={nextOnStrike === true} onClick={() => setNextOnStrike(true)}>New batter</Choice>
              <Choice active={nextOnStrike === false} onClick={() => setNextOnStrike(false)}>Other batter</Choice>
            </div>
          </div>
        )}

        {summary && leaving && (
          <div className={cn('rounded-2xl border px-3.5 py-3',
            kind === 'retired_hurt' ? 'border-border bg-muted/50' : 'border-red-500/30 bg-red-500/6')}>
            <p className={cn('text-[10px] font-bold uppercase tracking-wider',
              kind === 'retired_hurt' ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400')}>
              {kind === 'retired_hurt' ? 'Retiring' : 'Out'}
              {extraOn ? ` · off a ${DELIVERY_LABEL[extraOn].toLowerCase()}` : ''}
              {takesRuns && runs > 0 ? ` · ${runs} run${runs === 1 ? '' : 's'} completed` : ''}
            </p>
            <p className="mt-0.5 font-bold leading-snug">
              {nameOf(leaving)} <span className="font-semibold text-muted-foreground">{summary}</span>
            </p>
            {nextBatterId && <p className="mt-0.5 text-xs text-muted-foreground">{nameOf(nextBatterId)} comes in</p>}
          </div>
        )}
        <Problem text={kind ? problem : null} />
        <Submit tone="danger" disabled={!draft || !!problem}
          onClick={() => { if (draft && !send(draft)) onClose(); }}>
          {kind === 'retired_hurt' ? 'Retire hurt' : kind === 'retired_out' ? 'Retire out' : 'Confirm wicket'}
        </Submit>
      </div>
    </Sheet>
  );
}

// ── Match management ─────────────────────────────────────────────────────────

export function ReviseSheet({ state, send, onClose }: { state: MatchState; send: Send; onClose: () => void }) {
  const inn = currentInnings(state);
  const next = upcomingInnings(state);
  const chasing = inn ? inn.index % 2 === 1 : (next?.index ?? 0) % 2 === 1;
  const currentOvers = inn?.maxOvers ?? next?.overs ?? state.setup.rules.overs;
  const currentTarget = inn?.target ?? next?.target ?? null;
  const [overs, setOvers] = useState(currentOvers);
  const [target, setTarget] = useState<number>(currentTarget ?? 1);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} title="Revise overs / target"
      description={inn ? 'For a rain-shortened innings. Work the target out with your league’s method (DLS, average run rate…) and enter it here.' : 'Applies to the innings about to start.'}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Overs</Label>
          <Stepper value={overs} min={1} max={50} onChange={setOvers} />
        </div>
        {chasing && (
          <div className="flex items-center justify-between">
            <Label>Target</Label>
            <input type="number" min={1} value={target} onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
              className="w-28 h-11 px-3 rounded-xl border border-border bg-input text-lg font-bold text-right tabular-nums" />
          </div>
        )}
        <Problem text={problem} />
        <Submit onClick={() => {
          const err = send({
            type: 'revise',
            overs: overs !== currentOvers ? overs : null,
            target: chasing && target !== currentTarget ? target : null,
          });
          if (err) setProblem(err); else onClose();
        }}>
          Save revision
        </Submit>
      </div>
    </Sheet>
  );
}

export function PenaltySheet({ state, send, onClose }: { state: MatchState; send: Send; onClose: () => void }) {
  const inn = currentInnings(state);
  const [runs, setRuns] = useState(5);
  if (!inn) return null;
  const name = (id: string) => state.setup.sides.find((s) => s.teamId === id)?.name ?? '';
  return (
    <Sheet open onClose={onClose} title="Penalty runs"
      description="Ball hitting a helmet on the field, deliberate short runs, time wasting…">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Runs</Label>
          <Stepper value={runs} min={1} max={10} onChange={setRuns} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Choice onClick={() => { if (!send({ type: 'penalty', runs, to: 'batting' })) onClose(); }}>
            To {name(inn.battingTeamId)} (batting)
          </Choice>
          <Choice onClick={() => { if (!send({ type: 'penalty', runs, to: 'fielding' })) onClose(); }}>
            To {name(inn.bowlingTeamId)} (fielding)
          </Choice>
        </div>
      </div>
    </Sheet>
  );
}

export function EndMatchSheet({ state, send, onClose }: { state: MatchState; send: Send; onClose: () => void }) {
  const [result, setResult] = useState<'abandoned' | 'no_result' | 'awarded' | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const tied = state.phase === 'completed' && state.result?.kind === 'tie';
  return (
    <Sheet open onClose={onClose} title={tied ? 'Settle the tie' : 'End the match'}
      description={tied ? 'Award it (on boundary count, say) if your league settles ties without a super over.' : 'For rain, bad light, a walkover or a match called off.'}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1.5">
          {!tied && <Choice active={result === 'abandoned'} onClick={() => setResult('abandoned')}>Abandoned</Choice>}
          {!tied && <Choice active={result === 'no_result'} onClick={() => setResult('no_result')}>No result</Choice>}
          <Choice active={result === 'awarded'} onClick={() => setResult('awarded')}>Award to…</Choice>
        </div>
        {result === 'awarded' && (
          <div className="grid grid-cols-2 gap-1.5">
            {state.setup.sides.map((s) => <Choice key={s.teamId} active={winner === s.teamId} onClick={() => setWinner(s.teamId)}>{s.name}</Choice>)}
          </div>
        )}
        <label className="block">
          <Label>Note (optional)</Label>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))}
            placeholder={result === 'awarded' ? 'e.g. Opponents conceded' : 'e.g. Rain'}
            className="w-full h-11 px-3 rounded-xl border border-border bg-input text-sm" />
        </label>
        <Problem text={problem} />
        <Submit tone="danger" disabled={!result || (result === 'awarded' && !winner)} onClick={() => {
          const err = send({
            type: 'end_match', result: result!, winnerTeamId: result === 'awarded' ? winner : null,
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          if (err) setProblem(err); else onClose();
        }}>
          End match
        </Submit>
      </div>
    </Sheet>
  );
}

export function AddPlayerSheet({ state, players, send, onClose }: {
  state: MatchState; players: Player[]; send: Send; onClose: () => void;
}) {
  const [teamId, setTeamId] = useState(state.setup.sides[0].teamId);
  const [cardId, setCardId] = useState<string | null>(null);
  const [guest, setGuest] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const taken = new Set(Object.values(state.squads).flat().map((p) => p.id));
  const squadOnly = !!state.setup.squadOnly;
  const available = players.filter((p) => !taken.has(p.id) && (!squadOnly || p.teamId === teamId))
    .sort((a, b) => Number(b.teamId === teamId) - Number(a.teamId === teamId) || a.name.localeCompare(b.name));
  return (
    <Sheet open onClose={onClose} title="Add a late arrival" description="Joins the squad for the rest of the match — one more wicket for that side.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5">
          {state.setup.sides.map((s) => <Choice key={s.teamId} active={teamId === s.teamId} onClick={() => { setTeamId(s.teamId); setCardId(null); setProblem(null); }}>{s.name}</Choice>)}
        </div>
        {available.length > 0 && (
          <PlayerSelect label={squadOnly ? 'From this team’s squad' : 'From the league'} value={cardId} onChange={(v) => { setCardId(v); if (v) setGuest(''); }}
            players={available.map((p) => ({ id: p.id, name: p.name }))} placeholder="Choose a player…" />
        )}
        {!squadOnly && <label className="block">
          <Label>Or a guest</Label>
          <input value={guest} onChange={(e) => { setGuest(e.target.value); if (e.target.value) setCardId(null); }}
            placeholder="Name" className="w-full h-11 px-3 rounded-xl border border-border bg-input text-sm" />
        </label>}
        {squadOnly && available.length === 0 && <p className="text-xs text-muted-foreground">No other team members are available.</p>}
        <Problem text={problem} />
        <Submit disabled={!cardId && (squadOnly || !guest.trim())} onClick={() => {
          const card = players.find((p) => p.id === cardId);
          if (squadOnly && (!card || card.teamId !== teamId)) {
            setProblem('Choose a player from this team’s existing squad');
            return;
          }
          const player = card ? { id: card.id, name: card.name } : { id: `guest:${eventId()}`, name: guest.trim().slice(0, 80) };
          const err = send({ type: 'add_player', teamId, player });
          if (err) setProblem(err); else onClose();
        }}>
          Add to squad
        </Submit>
      </div>
    </Sheet>
  );
}

/**
 * Player of the match by hand. The awards name the top of this list on their
 * own; picking here overrides that, and picking the same player again is how a
 * scorer confirms it.
 */
export function PotmSheet({ state, send, onClose }: { state: MatchState; send: Send; onClose: () => void }) {
  const bpo = state.setup.rules.ballsPerOver;
  const lines = playerMatchLines(state);
  const points = new Map(matchImpact(lines, summarizeMatch(state)).map((p) => [p.id, p.total]));
  const impact = (l: (typeof lines)[number]) => points.get(l.id) ?? 0;
  const ranked = [...lines].sort((a, b) => impact(b) - impact(a));
  const team = (id: string) => state.setup.sides.find((s) => s.teamId === id);
  return (
    <Sheet open onClose={onClose} title="Player of the match" wide>
      <p className="mb-2 text-xs text-muted-foreground">
        Ranked by impact points. The top name is awarded automatically — pick someone else to override it.
      </p>
      <ul className="grid gap-1.5 max-h-[60dvh] overflow-y-auto">
        {ranked.map((l, i) => (
          <li key={l.id}>
            <button type="button" onClick={() => { if (!send({ type: 'potm', playerId: l.id })) onClose(); }}
              className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-muted',
                state.playerOfMatchId === l.id ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card')}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team(l.teamId)?.color }} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{l.name}{i === 0 && impact(l) > 0 ? ' · suggested' : ''}</span>
                <span className="block text-xs text-muted-foreground">
                  {l.batted ? `${l.runs}${l.out ? '' : '*'} (${l.balls}) SR ${strikeRate(l.runs, l.balls)}` : 'DNB'}
                  {l.bowled ? ` · ${l.wickets}/${l.runsConceded} (${oversText(l.ballsBowled, bpo)})` : ''}
                  {l.catches ? ` · ${l.catches} ct` : ''}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{impact(l)} pts</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ── Corrections ──────────────────────────────────────────────────────────────

/**
 * Re-enter the runs or extra of an earlier ball without undoing everything
 * after it. The later balls replay on top of the change, so who faced them
 * follows from the corrected runs — and if a later event no longer fits (say
 * the strike now puts the wrong batter on for a wicket), the engine refuses
 * and nothing changes.
 */
export function EditBallSheet({ state, events, replace, onClose }: {
  state: MatchState;
  events: ScoringEvent[];
  replace: (id: string, next: ScoringEvent) => string | null;
  onClose: () => void;
}) {
  const nameOf = (id: string) => Object.values(state.squads).flat().find((p) => p.id === id)?.name ?? '';
  const inn = state.innings[state.innings.length - 1];
  const balls = inn ? inn.overs.flatMap((o) => o.balls).reverse() : [];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const original = events.find((e): e is Extract<ScoringEvent, { type: 'ball' }> => e.type === 'ball' && e.id === pickedId) ?? null;
  const [delivery, setDelivery] = useState<DeliveryType>('legal');
  const [runs, setRuns] = useState(0);
  const [boundary, setBoundary] = useState(false);
  const [nbRunsAs, setNbRunsAs] = useState<'bat' | 'bye' | 'legbye'>('bat');
  const [problem, setProblem] = useState<string | null>(null);

  function pick(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e || e.type !== 'ball') return;
    setPickedId(id);
    setDelivery(e.extra ?? 'legal');
    setRuns(e.runs);
    setBoundary(!!e.boundary);
    setNbRunsAs(e.nbRunsAs ?? 'bat');
    setProblem(null);
  }

  const canBoundary = runs === 4 || (runs === 6 && (delivery === 'legal' || (delivery === 'nb' && nbRunsAs === 'bat')));

  return (
    <Sheet open onClose={onClose} wide title="Edit a ball"
      description={original ? 'Later balls replay on top of the change.' : 'Pick the ball to correct — this innings, newest first.'}>
      {!original ? (
        balls.length === 0
          ? <p className="text-sm text-muted-foreground">No balls in this innings yet.</p>
          : (
            <ul className="grid gap-1 max-h-[60dvh] overflow-y-auto">
              {balls.map((b) => (
                <li key={b.eventId}>
                  <button type="button" onClick={() => pick(b.eventId)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left hover:bg-muted">
                    <span className="w-9 text-xs font-semibold tabular-nums text-muted-foreground">{b.label}</span>
                    <BallChip ball={b} />
                    <span className="flex-1 min-w-0 truncate text-sm">{nameOf(b.bowlerId)} to {nameOf(b.strikerId)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
      ) : (
        <div className="space-y-4">
          <div>
            <Label>Delivery</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['legal', 'wd', 'nb', 'b', 'lb'] as const).map((t) => (
                <Choice key={t} active={delivery === t} onClick={() => setDelivery(t)}>{DELIVERY_LABEL[t]}</Choice>
              ))}
            </div>
          </div>
          {delivery === 'nb' && (
            <div className="grid grid-cols-3 gap-1.5">
              <Choice active={nbRunsAs === 'bat'} onClick={() => setNbRunsAs('bat')}>Off the bat</Choice>
              <Choice active={nbRunsAs === 'bye'} onClick={() => setNbRunsAs('bye')}>Byes</Choice>
              <Choice active={nbRunsAs === 'legbye'} onClick={() => setNbRunsAs('legbye')}>Leg byes</Choice>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label>{delivery === 'wd' ? 'Runs run (on top of the wide)' : delivery === 'b' || delivery === 'lb' ? 'Runs' : 'Runs scored'}</Label>
            <Stepper value={runs} min={0} max={12} onChange={(v) => { setRuns(v); if (v !== 4 && v !== 6) setBoundary(false); }} />
          </div>
          {canBoundary && (
            <div className="grid grid-cols-2 gap-1.5">
              <Choice active={!boundary} onClick={() => setBoundary(false)}>Ran them</Choice>
              <Choice active={boundary} onClick={() => setBoundary(true)}>Boundary</Choice>
            </div>
          )}
          {original.wicket && <p className="text-xs text-muted-foreground">The wicket on this ball stays as it is.</p>}
          <Problem text={problem} />
          <div className="grid grid-cols-2 gap-2">
            <Choice onClick={() => { setPickedId(null); setProblem(null); }}>Back</Choice>
            <Submit onClick={() => {
              const extra = toExtra(delivery);
              const next: ScoringEvent = {
                id: eventId(), at: original.at, type: 'ball', runs, extra,
                ...(extra === 'nb' ? { nbRunsAs } : {}),
                ...(boundary && canBoundary ? { boundary: true } : {}),
                wicket: original.wicket ?? null,
              };
              const err = replace(original.id, next);
              if (err) setProblem(err); else onClose();
            }}>
              Save change
            </Submit>
          </div>
        </div>
      )}
    </Sheet>
  );
}
