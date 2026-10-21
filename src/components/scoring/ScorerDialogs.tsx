'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  DISMISSAL_LABELS, SUB_FIELDER, allowedDismissals, ballChip as ballLabel, bowlerOptions, currentInnings, economy, nextBatterOptions,
  oversText, playerMatchLines, strikeRate, strikerOnly, upcomingInnings,
  type CreaseDismissal, type DeliveryDismissal, type Extra, type LineupPlayer, type MatchState, type ScoringEvent,
} from '@/lib/scoring';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { eventId } from './useScorecardSync';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before it gets its id and timestamp. */
export type Draft = DistributiveOmit<ScoringEvent, 'id' | 'at'>;
/** Records a draft; returns the engine's objection, or null when recorded. */
export type Send = (d: Draft) => string | null;
/** Checks a draft against the engine without recording it. */
export type Preview = (d: Draft) => string | null;

// ── Building blocks ──────────────────────────────────────────────────────────

export function Sheet({ open, onClose, title, description, children, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto', wide ? 'sm:max-w-lg' : 'sm:max-w-md')}>
        <DialogTitle className="text-base font-bold">{title}</DialogTitle>
        {description && <DialogDescription className="-mt-2">{description}</DialogDescription>}
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
        'min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? tone === 'danger' ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400' : 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{children}</p>;
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-xs text-amber-600 dark:text-amber-400 text-center">{text}</p>;
}

function Submit({ onClick, disabled, children, tone = 'default' }: { onClick: () => void; disabled?: boolean; children: ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('w-full h-12 rounded-xl font-bold text-white disabled:opacity-40',
        tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'btn-premium')}>
      {children}
    </button>
  );
}

function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-11 h-11 rounded-xl border border-border bg-card text-xl disabled:opacity-40" aria-label="Less">−</button>
      <span className="w-12 text-center text-2xl font-black tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-11 h-11 rounded-xl border border-border bg-card text-xl disabled:opacity-40" aria-label="More">+</button>
    </div>
  );
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

// ── Start of an innings ──────────────────────────────────────────────────────

export function StartInningsPanel({ state, send }: { state: MatchState; send: Send }) {
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

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{ordinal}</p>
        <h2 className="text-lg font-black">{side(next.battingTeamId)?.name} to bat</h2>
        <p className="text-sm text-muted-foreground">
          {next.overs} over{next.overs === 1 ? '' : 's'}{next.target !== null && <> · Target <strong className="text-foreground">{next.target}</strong></>}
        </p>
      </div>
      <PlayerSelect label="Striker" value={striker} onChange={setStriker} players={batting} exclude={[nonStriker]} />
      <PlayerSelect label="Non-striker" value={nonStriker} onChange={setNonStriker} players={batting} exclude={[striker]} />
      <PlayerSelect label={`Opening bowler (${side(next.bowlingTeamId)?.name ?? ''})`} value={bowler} onChange={setBowler} players={bowling} />
      <Problem text={problem} />
      <Submit
        disabled={!striker || !nonStriker || !bowler}
        onClick={() => setProblem(send({ type: 'start_innings', strikerId: striker!, nonStrikerId: nonStriker, bowlerId: bowler! }))}
      >
        Start {ordinal}
      </Submit>
    </section>
  );
}

// ── Bowler ───────────────────────────────────────────────────────────────────

export function BowlerPicker({ state, send, onDone }: { state: MatchState; send: Send; onDone?: () => void }) {
  const bpo = state.setup.rules.ballsPerOver;
  const quota = state.setup.rules.maxOversPerBowler;
  const options = bowlerOptions(state);
  // Bowlers already used first, so the attack is one tap away
  const sorted = [...options].sort((a, b) => Number(!!b.figures) - Number(!!a.figures));
  return (
    <ul className="grid gap-1.5">
      {sorted.map(({ player, blocked, figures }) => (
        <li key={player.id}>
          <button
            type="button"
            disabled={!!blocked}
            onClick={() => { if (!send({ type: 'bowler', bowlerId: player.id })) onDone?.(); }}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-muted disabled:opacity-45 disabled:hover:bg-card"
          >
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{player.name}</span>
              <span className="block text-xs text-muted-foreground">
                {blocked ?? (figures
                  ? `${oversText(figures.balls, bpo)}-${figures.maidens}-${figures.runs}-${figures.wickets} · Econ ${economy(figures.runs, figures.balls, bpo)}`
                  : 'Yet to bowl')}
              </span>
            </span>
            {quota !== null && figures && (
              <span className="text-xs tabular-nums text-muted-foreground shrink-0">{oversText(figures.balls, bpo)}/{quota}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Extras ───────────────────────────────────────────────────────────────────

interface RunOption { label: string; runs: number; boundary?: boolean }

const EXTRA_TITLE: Record<Extra, string> = { wd: 'Wide', nb: 'No-ball', b: 'Byes', lb: 'Leg byes' };

export function ExtrasSheet({ extra, state, send, onWicket, onClose }: {
  extra: Extra | null; state: MatchState; send: Send; onWicket: (extra: Extra) => void; onClose: () => void;
}) {
  const [as, setAs] = useState<'bat' | 'bye' | 'legbye'>('bat');
  if (!extra) return null;
  const rules = state.setup.rules;
  const penalty = extra === 'wd' ? rules.wideRuns : extra === 'nb' ? rules.noBallRuns : 0;
  const options: RunOption[] =
    extra === 'wd'
      ? [{ label: '0', runs: 0 }, { label: '1', runs: 1 }, { label: '2', runs: 2 }, { label: '3', runs: 3 }, { label: '4 boundary', runs: 4, boundary: true }, { label: '4 run', runs: 4 }, { label: '5', runs: 5 }]
      : extra === 'nb'
        ? [
          { label: '0', runs: 0 }, { label: '1', runs: 1 }, { label: '2', runs: 2 }, { label: '3', runs: 3 },
          { label: 'FOUR', runs: 4, boundary: true },
          ...(as === 'bat' ? [{ label: 'SIX', runs: 6, boundary: true }] : []),
          { label: '4 run', runs: 4 }, { label: '5', runs: 5 },
        ]
        : [{ label: '1', runs: 1 }, { label: '2', runs: 2 }, { label: '3', runs: 3 }, { label: 'FOUR', runs: 4, boundary: true }, { label: '4 run', runs: 4 }, { label: '5', runs: 5 }];
  const hint = extra === 'wd'
    ? `${penalty} wide${penalty === 1 ? '' : 's'}, plus any the batters run`
    : extra === 'nb'
      ? `${penalty} for the no-ball, plus whatever was scored off it${rules.freeHit ? ' — next ball is a free hit' : ''}`
      : 'Runs the batters took — not off the bat, not charged to the bowler';

  return (
    <Sheet open onClose={onClose} title={EXTRA_TITLE[extra]} description={hint}>
      {extra === 'nb' && (
        <div className="grid grid-cols-3 gap-1.5">
          <Choice active={as === 'bat'} onClick={() => setAs('bat')}>Off the bat</Choice>
          <Choice active={as === 'bye'} onClick={() => setAs('bye')}>Byes</Choice>
          <Choice active={as === 'legbye'} onClick={() => setAs('legbye')}>Leg byes</Choice>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {options.map((o) => (
          <button key={o.label} type="button"
            onClick={() => { if (!send({ type: 'ball', runs: o.runs, extra, ...(o.boundary ? { boundary: true } : {}), ...(extra === 'nb' ? { nbRunsAs: as } : {}) })) onClose(); }}
            className={cn('h-14 rounded-xl border font-black text-sm',
              o.boundary ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-card hover:bg-muted')}>
            {o.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onWicket(extra)}
        className="w-full h-11 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-500/10">
        Wicket on this {extra === 'wd' ? 'wide' : extra === 'nb' ? 'no-ball' : 'ball'}…
      </button>
    </Sheet>
  );
}

export function CustomRunsSheet({ open, send, onClose }: { open: boolean; send: Send; onClose: () => void }) {
  const [runs, setRuns] = useState(5);
  const [ran, setRan] = useState(5);
  const [boundary, setBoundary] = useState(false);
  const canBoundary = runs === 4 || runs === 6;
  return (
    <Sheet open={open} onClose={onClose} title="Other runs"
      description="All-run fours, fives, overthrows. Strike follows the runs the batters actually ran.">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Runs scored off the bat</Label>
          <Stepper value={runs} min={0} max={12} onChange={(v) => { setRuns(v); setRan(v); if (v !== 4 && v !== 6) setBoundary(false); }} />
        </div>
        {canBoundary && (
          <div className="grid grid-cols-2 gap-1.5">
            <Choice active={!boundary} onClick={() => setBoundary(false)}>Ran them</Choice>
            <Choice active={boundary} onClick={() => setBoundary(true)}>Boundary</Choice>
          </div>
        )}
        {!boundary && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Runs actually run</Label>
              <p className="text-xs text-muted-foreground -mt-1">Less than scored when overthrows went to the rope</p>
            </div>
            <Stepper value={Math.min(ran, runs)} min={0} max={runs} onChange={setRan} />
          </div>
        )}
        <Submit onClick={() => {
          const err = send({ type: 'ball', runs, extra: null, ...(boundary ? { boundary: true } : {}), ...(!boundary && ran !== runs ? { ran } : {}) });
          if (!err) onClose();
        }}>
          Record {runs} run{runs === 1 ? '' : 's'}
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

export function WicketSheet({ state, mode, presetExtra, send, preview, onClose }: {
  state: MatchState;
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

        {kind && candidates.length > 0 && (
          <div>
            <Label>Next batter</Label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
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

        <Problem text={kind ? problem : null} />
        <Submit tone="danger" disabled={!draft || !!problem}
          onClick={() => { if (draft && !send(draft)) onClose(); }}>
          {kind === 'retired_hurt' ? 'Retire hurt' : 'Confirm wicket'}
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
  const available = players.filter((p) => !taken.has(p.id))
    .sort((a, b) => Number(b.teamId === teamId) - Number(a.teamId === teamId) || a.name.localeCompare(b.name));
  return (
    <Sheet open onClose={onClose} title="Add a late arrival" description="Joins the squad for the rest of the match — one more wicket for that side.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5">
          {state.setup.sides.map((s) => <Choice key={s.teamId} active={teamId === s.teamId} onClick={() => setTeamId(s.teamId)}>{s.name}</Choice>)}
        </div>
        {available.length > 0 && (
          <PlayerSelect label="From the league" value={cardId} onChange={(v) => { setCardId(v); if (v) setGuest(''); }}
            players={available.map((p) => ({ id: p.id, name: p.name }))} placeholder="Choose a player…" />
        )}
        <label className="block">
          <Label>Or a guest</Label>
          <input value={guest} onChange={(e) => { setGuest(e.target.value); if (e.target.value) setCardId(null); }}
            placeholder="Name" className="w-full h-11 px-3 rounded-xl border border-border bg-input text-sm" />
        </label>
        <Problem text={problem} />
        <Submit disabled={!cardId && !guest.trim()} onClick={() => {
          const card = players.find((p) => p.id === cardId);
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

/** Player of the match, with a suggestion from a simple impact score. */
export function PotmSheet({ state, send, onClose }: { state: MatchState; send: Send; onClose: () => void }) {
  const bpo = state.setup.rules.ballsPerOver;
  const lines = playerMatchLines(state);
  const impact = (l: (typeof lines)[number]) =>
    l.runs + l.fours + l.sixes * 2 + l.wickets * 25 + l.maidens * 8 + (l.catches + l.stumpings + l.runOuts) * 10;
  const ranked = [...lines].sort((a, b) => impact(b) - impact(a));
  const team = (id: string) => state.setup.sides.find((s) => s.teamId === id);
  return (
    <Sheet open onClose={onClose} title="Player of the match" wide>
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
                    <span className="min-w-12 text-center rounded-full border border-border px-2 py-0.5 text-xs font-bold">{ballLabel(b)}</span>
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
