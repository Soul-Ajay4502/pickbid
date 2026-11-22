'use client';

import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { Extra, MatchState } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import { draftChip, type NbRunsAs } from './ScorerDialogs';

/** A ball the keypad records in one tap. */
export interface KeyBall {
  runs: number;
  extra: Extra | null;
  boundary?: boolean;
  nbRunsAs?: NbRunsAs;
}

const EXTRAS: { extra: Extra; label: string; title: string; key: string }[] = [
  { extra: 'wd', label: 'Wide', title: 'Wide', key: 'w' },
  { extra: 'nb', label: 'No ball', title: 'No-ball', key: 'n' },
  { extra: 'b', label: 'Bye', title: 'Byes', key: 'b' },
  { extra: 'lb', label: 'Leg bye', title: 'Leg byes', key: 'l' },
];

const NB_AS: { id: NbRunsAs; label: string }[] = [
  { id: 'bat', label: 'Off the bat' },
  { id: 'bye', label: 'Byes' },
  { id: 'legbye', label: 'Leg byes' },
];

/**
 * What a run key records with the given extra armed, or null when that
 * delivery can't happen (a six off a wide, a bye nobody ran). The engine has
 * the final say; this only keeps impossible keys from looking tappable.
 */
function keyBall(runs: number, armed: Extra | null, nbAs: NbRunsAs): KeyBall | null {
  const offBat = armed === null || (armed === 'nb' && nbAs === 'bat');
  if (runs === 6 && !offBat) return null;
  if (runs === 0 && (armed === 'b' || armed === 'lb')) return null;
  return {
    runs,
    extra: armed,
    ...(runs === 4 || runs === 6 ? { boundary: true } : {}),
    ...(armed === 'nb' ? { nbRunsAs: nbAs } : {}),
  };
}

/** The small line under a run key: what it would leave in the over. */
function caption(runs: number, armed: Extra | null, nbAs: NbRunsAs): string | null {
  if (armed) return keyBall(runs, armed, nbAs) ? draftChip(runs, armed) : null;
  if (runs === 0) return 'dot';
  if (runs === 4) return 'four';
  if (runs === 6) return 'six';
  return null;
}

function Key({ children, caption: sub, onClick, disabled, className, label, pressed }: {
  children: ReactNode;
  caption?: string | null;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'relative flex flex-col items-center justify-center h-14 sm:h-16 min-w-0 px-1 rounded-2xl border text-xl font-black leading-none',
        'select-none touch-manipulation transition-[transform,background-color,border-color,box-shadow] duration-100',
        'active:scale-[0.95] disabled:opacity-30 disabled:active:scale-100',
        className,
      )}
    >
      {children}
      {sub && <span className="mt-1 max-w-full truncate text-[10px] font-semibold tracking-normal opacity-75 leading-none">{sub}</span>}
    </button>
  );
}

/**
 * The scorer's keypad. Runs are one tap. Extras are a modifier rather than a
 * pop-up: tap *Wide*, then the runs, so every delivery is recorded from the
 * same keys in the same places. *OUT* and *5+* carry an armed extra into
 * their sheets. Keyboard shortcuts mirror the keys for anyone scoring on a
 * laptop.
 */
export default function ScorerKeypad({ state, enabled, keyboard, undoHint, onBall, onMore, onOut, onUndo }: {
  state: MatchState;
  /** A ball can be bowled right now. */
  enabled: boolean;
  /** Listen for keyboard shortcuts — off while a sheet is open. */
  keyboard: boolean;
  /** The last event in a few characters ("4", "Wd+1", "bowler"); null when there's nothing to undo. */
  undoHint: string | null;
  /** Records the ball; returns the engine's objection, or null when recorded. */
  onBall: (ball: KeyBall) => string | null;
  onMore: (extra: Extra | null, nbRunsAs: NbRunsAs) => void;
  onOut: (extra: Extra | null) => void;
  onUndo: () => void;
}) {
  const [armed, setArmed] = useState<Extra | null>(null);
  const [nbAs, setNbAs] = useState<NbRunsAs>('bat');
  const rules = state.setup.rules;

  // An over or innings ending mid-thought drops the modifier
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) { setArmed(null); setNbAs('bat'); }
  }

  function disarm() { setArmed(null); setNbAs('bat'); }
  function arm(x: Extra) {
    if (!enabled) return;
    if (armed === x) disarm();
    else { setArmed(x); setNbAs('bat'); }
  }
  function tap(runs: number) {
    const b = keyBall(runs, armed, nbAs);
    if (!b || !enabled) return;
    if (!onBall(b)) disarm();
  }
  function more() { if (!enabled) return; onMore(armed, nbAs); disarm(); }
  function out() { if (!enabled) return; onOut(armed); disarm(); }
  function undo() { if (!undoHint) return; disarm(); onUndo(); }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); undo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (/^[012346]$/.test(k)) { e.preventDefault(); tap(Number(k)); return; }
    if (k === '5') { e.preventDefault(); more(); return; }
    const x = EXTRAS.find((o) => o.key === k);
    if (x) { e.preventDefault(); arm(x.extra); return; }
    if (k === 'x' || k === 'o') { e.preventDefault(); out(); return; }
    if (k === 'u') { e.preventDefault(); undo(); return; }
    if (k === 'escape' && armed) { e.preventDefault(); disarm(); }
  });
  useEffect(() => {
    if (!keyboard) return;
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyboard]);

  const armedInfo = EXTRAS.find((x) => x.extra === armed) ?? null;
  const penalty = armed === 'wd' ? rules.wideRuns : armed === 'nb' ? rules.noBallRuns : 0;
  const hint = armed === 'wd'
    ? 'Now tap the runs the batters ran — 0 for a plain wide'
    : armed === 'nb'
      ? `Now tap the runs scored off it${rules.freeHit ? ' · next ball is a free hit' : ''}`
      : 'Now tap the runs the batters took — not off the bat';

  const plain = cn(
    'bg-card border-border text-foreground hover:bg-muted/70 shadow-[0_1px_0_var(--border)]',
    armed && 'border-amber-500/50 bg-amber-500/6 dark:bg-amber-500/8',
  );

  return (
    <div className="space-y-2">
      {armedInfo && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2 space-y-2 animate-rise-in" role="status">
          <div className="flex items-center gap-2.5 pl-1">
            <span className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-xs font-black text-white tabular-nums">
              {armedInfo.title}{penalty > 0 ? ` +${penalty}` : ''}
            </span>
            <p className="flex-1 min-w-0 text-xs font-medium leading-snug text-amber-900 dark:text-amber-100">{hint}</p>
            <button type="button" onClick={disarm} aria-label={`Cancel ${armedInfo.title.toLowerCase()}`}
              className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-amber-900 dark:text-amber-100 hover:bg-amber-500/20">
              <X className="w-4 h-4" />
            </button>
          </div>
          {armed === 'nb' && (
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-background/70 p-1" role="group" aria-label="Runs off the no-ball came">
              {NB_AS.map((o) => (
                <button key={o.id} type="button" onClick={() => setNbAs(o.id)} aria-pressed={nbAs === o.id}
                  className={cn('h-8 rounded-lg text-xs font-semibold transition-colors',
                    nbAs === o.id ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {[0, 1, 2, 3].map((n) => (
          <Key key={n} onClick={() => tap(n)} disabled={!enabled || !keyBall(n, armed, nbAs)} className={plain}
            caption={caption(n, armed, nbAs)} label={armed ? `${armedInfo?.title} and ${n} run${n === 1 ? '' : 's'}` : n === 0 ? 'Dot ball' : `${n} run${n === 1 ? '' : 's'}`}>
            {n}
          </Key>
        ))}
        <Key onClick={() => tap(4)} disabled={!enabled || !keyBall(4, armed, nbAs)} caption={caption(4, armed, nbAs)}
          label={armed ? `${armedInfo?.title}, four to the boundary` : 'Four'}
          className="bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-[0_8px_18px_-10px_rgb(5_150_105)]">
          4
        </Key>
        <Key onClick={() => tap(6)} disabled={!enabled || !keyBall(6, armed, nbAs)} caption={caption(6, armed, nbAs)}
          label={armed ? `${armedInfo?.title}, six` : 'Six'}
          className="bg-violet-600 border-violet-600 text-white hover:bg-violet-700 shadow-[0_8px_18px_-10px_rgb(124_58_237)]">
          6
        </Key>
        <Key onClick={more} disabled={!enabled} caption="more" label="Other runs — fives, all-run fours, overthrows" className={plain}>
          5+
        </Key>
        <Key onClick={undo} disabled={!undoHint} caption={undoHint ? `undo ${undoHint}` : 'undo'} label={undoHint ? `Undo ${undoHint}` : 'Undo'}
          className="bg-muted border-border text-foreground hover:bg-muted/60">
          <RotateCcw className="w-5 h-5" />
        </Key>

        {EXTRAS.map((x) => {
          const on = armed === x.extra;
          return (
            <Key key={x.extra} onClick={() => arm(x.extra)} disabled={!enabled} pressed={on} label={x.label}
              className={cn('text-sm font-bold',
                on
                  ? 'bg-amber-500 border-amber-500 text-white shadow-[0_8px_18px_-10px_rgb(245_158_11)]'
                  : 'bg-amber-500/10 border-amber-500/35 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20')}>
              {x.label}
            </Key>
          );
        })}

        <Key onClick={out} disabled={!enabled} label={armedInfo ? `Wicket on this ${armedInfo.label.toLowerCase()}` : 'Wicket'}
          caption={armedInfo ? `on this ${armedInfo.label.toLowerCase()}` : null}
          className="col-span-4 h-13 sm:h-15 bg-red-600 border-red-600 text-white text-lg tracking-[0.35em] hover:bg-red-700 shadow-[0_10px_22px_-12px_rgb(220_38_38)]">
          OUT
        </Key>
      </div>

      <p className="hidden lg:flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <span><Kbd>0</Kbd>–<Kbd>6</Kbd> runs</span>
        <span><Kbd>W</Kbd> <Kbd>N</Kbd> <Kbd>B</Kbd> <Kbd>L</Kbd> extras</span>
        <span><Kbd>X</Kbd> out</span>
        <span><Kbd>U</Kbd> undo</span>
      </p>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-w-5 h-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-semibold text-foreground">{children}</kbd>;
}
