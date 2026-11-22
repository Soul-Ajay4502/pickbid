'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowLeftRight, Award, CircleDot, CloudOff, CloudRain, Coins, Flag, Gavel, ListOrdered, MoreHorizontal, Pencil,
  PlusCircle, Radio, RefreshCw, RotateCcw, Share2, Trash2, Trophy, UserMinus, UserPlus, Users,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
  DISMISSAL_LABELS, ballChip, commentary, currentInnings, economy, nameLookup, oversText, runRate, statusText, strikeRate,
  teamNameLookup, teamSquadPlayer, tryReplay,
  type BallRecord, type BatterState, type Extra, type InningsState, type MatchState, type ScoringEvent,
} from '@/lib/scoring';
import type { MatchScorecard, Player } from '@/lib/types';
import { cn, copyToClipboard, whatsappShareLink } from '@/lib/utils';
import { useScorecardSync, eventId, type SyncStatus } from './useScorecardSync';
import MatchAwards from './MatchAwards';
import ScorerKeypad from './ScorerKeypad';
import { BallChip, Commentary, InningsCard, TeamDot, currentStand } from './ScorecardParts';
import {
  AddPlayerSheet, BowlerPicker, EditBallSheet, EndMatchSheet, MoreRunsSheet, PenaltySheet, PotmSheet, ReviseSheet,
  Sheet, StartInningsPanel, WicketSheet, type Draft, type NbRunsAs, type Preview, type Send,
} from './ScorerDialogs';

type SheetState =
  | null
  | { kind: 'menu' }
  | { kind: 'runs'; extra: Extra | null; nbRunsAs: NbRunsAs }
  | { kind: 'wicket'; mode: 'delivery' | 'crease'; extra: Extra | null }
  | { kind: 'bowler' }
  | { kind: 'revise' }
  | { kind: 'penalty' }
  | { kind: 'endMatch' }
  | { kind: 'addPlayer' }
  | { kind: 'potm' }
  | { kind: 'editBall' }
  | { kind: 'scorecard' };

/** The big word over the scoreboard after a boundary or a wicket. */
interface Flash { key: number; text: string; tone: 'four' | 'six' | 'out' }

const FLASH_TONE: Record<Flash['tone'], string> = {
  four: 'bg-emerald-600/92',
  six: 'bg-violet-600/92',
  out: 'bg-red-600/92',
};

function flashFor(d: Draft): Omit<Flash, 'key'> | null {
  if (d.type === 'dismiss') return d.kind === 'retired_hurt' ? null : { text: 'OUT', tone: 'out' };
  if (d.type !== 'ball') return null;
  if (d.wicket) return { text: 'OUT', tone: 'out' };
  // Four byes to the rope aren't a FOUR to celebrate
  const offBat = d.extra === null || (d.extra === 'nb' && (d.nbRunsAs ?? 'bat') === 'bat');
  if (d.boundary && offBat && d.runs === 6) return { text: 'SIX', tone: 'six' };
  if (d.boundary && offBat && d.runs === 4) return { text: 'FOUR', tone: 'four' };
  return null;
}

function findBall(state: MatchState, id: string): BallRecord | null {
  for (const inn of state.innings) {
    for (const o of inn.overs) {
      const b = o.balls.find((x) => x.eventId === id);
      if (b) return b;
    }
  }
  return null;
}

/** "11.4 FOUR"-style label for the undo toast and menu. */
function describeEvent(state: MatchState, e: ScoringEvent): string {
  const nameOf = nameLookup(state);
  switch (e.type) {
    case 'ball': {
      const b = findBall(state, e.id);
      return b ? `ball ${b.label} (${ballChip(b)})` : 'the last ball';
    }
    case 'start_innings': return 'the start of the innings';
    case 'bowler': return `${nameOf(e.bowlerId)} coming on to bowl`;
    case 'dismiss': return `${nameOf(e.batterId)} ${DISMISSAL_LABELS[e.kind].toLowerCase()}`;
    case 'next_batter': return `${nameOf(e.batterId)} coming in`;
    case 'swap': return 'the strike change';
    case 'penalty': return `${e.runs} penalty runs`;
    case 'add_player': return `adding ${e.player.name}`;
    case 'revise': return 'the revision';
    case 'end_innings': return 'the end of the innings';
    case 'super_over': return 'the super over';
    case 'end_match': return 'the end of the match';
    case 'potm': return 'player of the match';
  }
}

/** The last event in a few characters, for the caption under the undo key. */
function undoHint(state: MatchState, e: ScoringEvent): string {
  switch (e.type) {
    case 'ball': { const b = findBall(state, e.id); return b ? ballChip(b) : 'ball'; }
    case 'start_innings': return 'start';
    case 'bowler': return 'bowler';
    case 'dismiss': return 'wicket';
    case 'next_batter': return 'batter';
    case 'swap': return 'swap';
    case 'penalty': return 'penalty';
    case 'add_player': return 'player';
    default: return 'last';
  }
}

// ── Header ───────────────────────────────────────────────────────────────────

function SyncPill({ status, pending, errorText, done, onRetry }: {
  status: SyncStatus; pending: number; errorText: string | null; done: boolean; onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 truncate">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{errorText}
      </p>
    );
  }
  if (status === 'offline') {
    return (
      <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        <CloudOff className="w-3 h-3" />Offline · {pending} queued · retry
      </button>
    );
  }
  if (status === 'saving') {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="w-2.5 h-2.5 border-[1.5px] border-current/30 border-t-current rounded-full animate-spin" />Saving…
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
      <span className="relative flex w-1.5 h-1.5">
        {!done && <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />}
        <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </span>
      {done ? 'Saved' : 'Live · saved'}
    </p>
  );
}

const iconButton = 'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors';

// ── Live panels ──────────────────────────────────────────────────────────────

function Scoreboard({ state, inn, flash }: { state: MatchState; inn: InningsState; flash: Flash | null }) {
  const bpo = state.setup.rules.ballsPerOver;
  const side = state.setup.sides.find((s) => s.teamId === inn.battingTeamId);
  const color = side?.color ?? '#64748b';
  const ballsLeft = Math.max(0, inn.maxOvers * bpo - inn.legalBalls);
  const target = inn.target;
  const need = target !== null ? Math.max(0, target - inn.runs) : 0;
  const stand = currentStand(inn);
  const projected = target === null && !inn.superOver && inn.legalBalls >= bpo
    ? Math.round(inn.runs + (inn.runs / inn.legalBalls) * ballsLeft)
    : null;
  const label = inn.superOver ? 'Super Over' : inn.index === 0 ? '1st innings' : '2nd innings';
  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: 'CRR', value: runRate(inn.runs, inn.legalBalls, bpo) },
    ...(target !== null
      ? [
        { label: 'RRR', value: ballsLeft > 0 ? runRate(need, ballsLeft, bpo) : '—', accent: true },
        { label: inn.targetRevised ? 'Target*' : 'Target', value: String(target) },
      ]
      : [{ label: 'Projected', value: projected !== null ? String(projected) : '—' }]),
    { label: 'P’ship', value: stand ? `${stand.runs} (${stand.balls})` : '—' },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card" aria-label="Score">
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${color} 20%, transparent), transparent 62%)` }} />
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 min-w-0 text-sm font-bold">
            <TeamDot color={color} />
            <span className="truncate">{side?.name ?? 'Batting'}</span>
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {inn.freeHit && (
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white motion-safe:animate-pulse">
                Free hit
              </span>
            )}
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
          </div>
        </div>

        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="flex items-baseline leading-none tabular-nums" aria-label={`${inn.runs} for ${inn.wickets}`}>
            <span className="text-[3.5rem] sm:text-6xl font-black tracking-tight">{inn.runs}</span>
            <span className="text-4xl sm:text-[2.75rem] font-black tracking-tight text-muted-foreground/60">/{inn.wickets}</span>
          </p>
          <div className="text-right pb-1">
            <p className="text-2xl font-black tabular-nums leading-none">
              {oversText(inn.legalBalls, bpo)}<span className="text-base font-bold text-muted-foreground">/{inn.maxOvers}</span>
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overs</p>
          </div>
        </div>

        {target !== null && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold">
                {need > 0
                  ? <>Need <span className="text-primary tabular-nums">{need}</span> from <span className="tabular-nums">{ballsLeft}</span> ball{ballsLeft === 1 ? '' : 's'}</>
                  : 'Target reached'}
              </p>
              <p className="text-xs font-semibold text-muted-foreground tabular-nums">{inn.runs}/{target}</p>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(inn.runs, target)} aria-label="Chase progress">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (inn.runs / Math.max(1, target)) * 100)}%`, background: color }} />
            </div>
          </div>
        )}

        <dl className={cn('mt-3 grid gap-1.5', stats.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-background/60 px-2.5 py-1.5 min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{s.label}</dt>
              <dd className={cn('text-sm font-black tabular-nums truncate', s.accent && 'text-primary')}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {flash && (
        <div key={flash.key} aria-hidden
          className={cn('scorer-flash pointer-events-none absolute inset-0 flex items-center justify-center', FLASH_TONE[flash.tone])}>
          <span className="scorer-flash-word text-6xl sm:text-7xl font-black tracking-[0.12em] text-white drop-shadow-lg">{flash.text}</span>
        </div>
      )}
    </section>
  );
}

function BatterTile({ b, onStrike, onClick, className }: { b: BatterState; onStrike: boolean; onClick?: () => void; className?: string }) {
  const body = (
    <>
      <span className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider', onStrike ? 'text-primary' : 'text-muted-foreground')}>
        {onStrike && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        {onStrike ? 'On strike' : 'Non-striker'}
      </span>
      <span className="mt-1 block font-bold truncate">{b.name}</span>
      <span className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-black tabular-nums leading-none">{b.runs}</span>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">({b.balls})</span>
      </span>
      <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums truncate">
        {b.fours}×4 · {b.sixes}×6 · SR {strikeRate(b.runs, b.balls)}
      </span>
    </>
  );
  const cls = cn('block w-full rounded-2xl border px-3 py-2.5 text-left',
    onStrike ? 'border-primary/40 bg-primary/6 ring-1 ring-primary/15' : 'border-border bg-card', className);
  return onClick
    ? <button type="button" onClick={onClick} title="Tap to give this batter the strike" className={cn(cls, 'hover:bg-muted/50 transition-colors')}>{body}</button>
    : <div className={cls}>{body}</div>;
}

function Crease({ state, inn, canBowl, onSwap, onChangeBowler }: {
  state: MatchState; inn: InningsState; canBowl: boolean; onSwap: () => void; onChangeBowler: () => void;
}) {
  const bpo = state.setup.rules.ballsPerOver;
  const quota = inn.superOver ? null : state.setup.rules.maxOversPerBowler;
  const striker = inn.batters.find((b) => b.id === inn.strikerId) ?? null;
  const nonStriker = inn.batters.find((b) => b.id === inn.nonStrikerId) ?? null;
  const bowler = inn.bowlers.find((b) => b.id === inn.bowlerId) ?? null;
  return (
    <section className="space-y-2" aria-label="At the crease">
      <div className="relative grid grid-cols-2 gap-2">
        {striker && <BatterTile b={striker} onStrike className="pr-6" />}
        {nonStriker
          ? <BatterTile b={nonStriker} onStrike={false} onClick={onSwap} className="pl-6" />
          : striker && (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              Last man standing — batting alone
            </div>
          )}
        {striker && nonStriker && (
          <button type="button" onClick={onSwap} aria-label="Swap strike" title="Swap strike"
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-muted inline-flex items-center justify-center text-muted-foreground">
          <CircleDot className="w-4 h-4" />
        </span>
        {bowler ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bowling</p>
              <p className="font-bold truncate">{bowler.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tabular-nums leading-tight">
                <span className="font-black">{bowler.wickets}/{bowler.runs}</span>{' '}
                <span className="text-xs text-muted-foreground">({oversText(bowler.balls, bpo)}{quota !== null ? `/${quota}` : ''})</span>
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Econ {economy(bowler.runs, bowler.balls, bpo)}{bowler.maidens ? ` · ${bowler.maidens}M` : ''}
              </p>
            </div>
            {canBowl && (
              <button type="button" onClick={onChangeBowler}
                className="shrink-0 h-8 px-3 rounded-full border border-border text-xs font-semibold hover:bg-muted transition-colors">
                Change
              </button>
            )}
          </>
        ) : <p className="flex-1 text-sm text-muted-foreground">Choose the next bowler</p>}
      </div>
    </section>
  );
}

/** The over in progress, with an empty slot for every legal ball still to come. */
function ThisOver({ state, inn }: { state: MatchState; inn: InningsState }) {
  const bpo = state.setup.rules.ballsPerOver;
  const last = inn.overs[inn.overs.length - 1];
  const current = last && (state.awaiting === 'bowler' || last.index === Math.floor(inn.legalBalls / bpo)) ? last : null;
  const overNo = current ? current.index + 1 : Math.floor(inn.legalBalls / bpo) + 1;
  const remaining = Math.max(0, bpo - (current?.legal ?? 0));
  const previous = inn.overs.find((o) => o.index === overNo - 2);
  const runs = current?.runs ?? 0;
  return (
    <section className="rounded-2xl border border-border bg-card px-3 py-2.5" aria-label={`Over ${overNo}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Over {overNo}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {previous && <>Last over {previous.runs}{previous.wickets ? `/${previous.wickets}` : ''} · </>}
          <strong className="text-foreground">{runs} run{runs === 1 ? '' : 's'}</strong>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {current?.balls.map((b, i) => (
          <BallChip key={b.eventId} ball={b} size="lg" className={i === current.balls.length - 1 ? 'animate-ball-pop' : undefined} />
        ))}
        {Array.from({ length: remaining }, (_, i) => (
          <span key={`slot-${i}`} aria-hidden className="h-9 w-9 rounded-full border-2 border-dashed border-border" />
        ))}
      </div>
    </section>
  );
}

// ── Menu ─────────────────────────────────────────────────────────────────────

function MenuItem({ icon: Icon, label, hint, onClick, tone, disabled }: {
  icon: typeof Flag; label: string; hint?: string; onClick: () => void; tone?: 'danger'; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-40',
        tone === 'danger' && 'text-red-600 dark:text-red-400 hover:bg-red-500/10')}>
      <span className={cn('w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center', tone === 'danger' ? 'bg-red-500/10' : 'bg-muted')}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground truncate">{hint}</span>}
      </span>
    </button>
  );
}

function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  const items = Children.toArray(children);
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-col">{items}</div>
    </div>
  );
}

// ── Console ──────────────────────────────────────────────────────────────────

export default function ScorerConsole({ leagueId, card, players, onEditSetup }: {
  leagueId: string;
  card: MatchScorecard;
  /** The league roster, for late arrivals. */
  players: Player[];
  /** Back to the setup form; only offered before the first ball. */
  onEditSetup: (version: number) => void;
}) {
  const router = useRouter();
  const { state, events, setup, record, undo, replace, status, errorText, pending, version, retry } = useScorecardSync(leagueId, card);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const close = useCallback(() => setSheet(null), []);

  // How long the log is right now, for a Redo pressed after something else was recorded
  const countRef = useRef(events.length);
  useEffect(() => { countRef.current = events.length; }, [events.length]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1300);
    return () => clearTimeout(t);
  }, [flash]);

  const send: Send = useCallback((d: Draft) => {
    if (setup.squadOnly && d.type === 'add_player') {
      try {
        d.player = teamSquadPlayer(d.player.id, d.teamId, players);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not add this player';
        toast.error(message);
        return message;
      }
    }
    const err = record({ ...d, id: eventId(), at: Date.now() } as ScoringEvent);
    if (err) {
      toast.error(err);
      return err;
    }
    const f = flashFor(d);
    if (f) setFlash({ ...f, key: Date.now() });
    return null;
  }, [record, setup.squadOnly, players]);

  const preview: Preview = useCallback((d: Draft) => {
    const r = tryReplay(setup, [...events, { ...d, id: '__preview__', at: 0 } as ScoringEvent]);
    return r.ok ? null : r.error;
  }, [setup, events]);

  const bpo = setup.rules.ballsPerOver;
  const inn = currentInnings(state);
  const teamName = teamNameLookup(state);
  const [sideA, sideB] = setup.sides;
  const centreHref = `/leagues/${leagueId}/matches/${card.matchId}`;
  const lastEvent = events[events.length - 1] ?? null;
  const canBowl = state.awaiting === 'ball';
  const tied = state.phase === 'completed' && state.result?.kind === 'tie';
  // Revisions are for the regulation innings only, live or about to start
  const canRevise = inn ? !inn.superOver : (state.phase === 'pre' || state.phase === 'break') && state.innings.length < 2;
  const lastBall = lastEvent?.type === 'ball' ? findBall(state, lastEvent.id) : null;

  function doUndo() {
    if (!lastEvent) return;
    const what = describeEvent(state, lastEvent);
    const at = events.length - 1;
    const undone = undo();
    setFlash(null);
    toast(`Undid ${what}`, undone ? {
      action: {
        label: 'Redo',
        onClick: () => {
          if (countRef.current !== at) { toast.error('More has been recorded since — enter it again instead'); return; }
          const err = record(undone);
          if (err) toast.error(err);
        },
      },
    } : undefined);
  }

  async function share() {
    const url = `${window.location.origin}${centreHref}`;
    const text = state.phase === 'completed'
      ? `🏏 ${sideA.name} vs ${sideB.name}: ${statusText(state)}\n${url}`
      : `🏏 Follow ${sideA.name} vs ${sideB.name} live, ball by ball:\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* cancelled — fall through to copy */ }
    }
    if (await copyToClipboard(text)) toast.success('Link copied');
    else window.open(whatsappShareLink(text), '_blank', 'noopener');
  }

  async function deleteScorecard() {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/matches/${card.matchId}/score`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      try { localStorage.removeItem(`pickbid_scoring_${card.matchId}`); } catch { /* fine */ }
      toast.success('Scorecard deleted');
      router.push(centreHref);
    } catch {
      toast.error('Could not delete the scorecard');
    }
  }

  const header = (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className={cn('mx-auto flex items-center gap-1 px-2 sm:px-3 h-14', inn ? 'max-w-xl lg:max-w-5xl' : 'max-w-xl')}>
        <Link href={centreHref} aria-label="Back to the match centre" className={iconButton}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0 px-1">
          <p className="flex items-center gap-1.5 text-sm font-bold min-w-0">
            <TeamDot color={sideA.color} className="w-2 h-2" />
            <span className="truncate min-w-0">{sideA.name}</span>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">vs</span>
            <TeamDot color={sideB.color} className="w-2 h-2" />
            <span className="truncate min-w-0">{sideB.name}</span>
          </p>
          <SyncPill status={status} pending={pending} errorText={errorText} done={state.phase === 'completed'} onRetry={() => { void retry(); }} />
        </div>
        <button type="button" onClick={() => setSheet({ kind: 'scorecard' })} aria-label="Full scorecard" title="Full scorecard" className={iconButton}>
          <ListOrdered className="w-4.5 h-4.5" />
        </button>
        <button type="button" onClick={() => setSheet({ kind: 'menu' })} aria-label="Match options" title="Match options" className={iconButton}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </header>
  );

  const lastInnings = state.innings[state.innings.length - 1] ?? null;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {header}
      {/* Screen readers hear each ball as it's recorded */}
      <p className="sr-only" aria-live="polite">{lastBall ? commentary(lastBall, nameLookup(state)) : ''}</p>

      {inn ? (
        <main className="flex-1 w-full max-w-xl lg:max-w-5xl mx-auto px-3 sm:px-4 pt-3 lg:pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6 lg:items-start">
          <div className="space-y-2.5 pb-3 lg:pb-6">
            <Scoreboard state={state} inn={inn} flash={flash} />
            <Crease state={state} inn={inn} canBowl={canBowl}
              onSwap={() => { send({ type: 'swap' }); }}
              onChangeBowler={() => setSheet({ kind: 'bowler' })} />
            <ThisOver state={state} inn={inn} />
            {/* A laptop has room for the story so far; a phone keeps it for the keypad */}
            <section className="hidden lg:block rounded-2xl border border-border bg-card px-4 py-3" aria-label="Recent balls">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recent</p>
              <Commentary state={state} inn={inn} limit={8} />
            </section>
          </div>

          {state.awaiting === 'bowler' ? (
            <section className="mb-6 rounded-3xl border border-primary/30 bg-primary/4 p-3 sm:p-4 lg:sticky lg:top-20">
              <div className="mb-3 flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    End of over {Math.floor(inn.legalBalls / bpo)}
                  </p>
                  <h2 className="text-lg font-black tracking-tight">Who bowls over {Math.floor(inn.legalBalls / bpo) + 1}?</h2>
                </div>
                {lastEvent && (
                  <button type="button" onClick={doUndo}
                    className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card text-xs font-semibold hover:bg-muted">
                    <RotateCcw className="w-3.5 h-3.5" />Undo
                  </button>
                )}
              </div>
              <BowlerPicker state={state} players={players} send={send} />
            </section>
          ) : (
            <div className={cn(
              'sticky bottom-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
              'border-t border-border/60 bg-background/95 backdrop-blur-xl',
              'lg:top-20 lg:bottom-auto lg:mx-0 lg:p-4 lg:rounded-3xl lg:border lg:bg-card lg:backdrop-blur-none',
            )}>
              <ScorerKeypad
                state={state}
                enabled={canBowl}
                keyboard={sheet === null && !deleteOpen}
                undoHint={lastEvent ? undoHint(state, lastEvent) : null}
                onBall={(b) => send({
                  type: 'ball', runs: b.runs, extra: b.extra,
                  ...(b.boundary ? { boundary: true } : {}),
                  ...(b.nbRunsAs ? { nbRunsAs: b.nbRunsAs } : {}),
                })}
                onMore={(extra, nbRunsAs) => setSheet({ kind: 'runs', extra, nbRunsAs })}
                onOut={(extra) => setSheet({ kind: 'wicket', mode: 'delivery', extra })}
                onUndo={doUndo}
              />
            </div>
          )}
        </main>
      ) : (
        <main className={cn('flex-1 w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 space-y-3', state.awaiting !== 'start_innings' && 'pb-8')}>
          {/* Before the first ball: the toss, with a way back to the setup */}
          {state.phase === 'pre' && (
            <section className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 inline-flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </span>
              <p className="flex-1 min-w-0 text-sm font-semibold">{statusText(state)}</p>
              {events.length === 0 && (
                <button type="button" onClick={() => onEditSetup(version)} disabled={status !== 'saved'}
                  className="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted disabled:opacity-40">
                  <Pencil className="w-3 h-3" />Setup
                </button>
              )}
            </section>
          )}

          {/* Between innings: what just happened, then who's next */}
          {state.awaiting === 'start_innings' && lastInnings && (
            <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 text-center">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1"
                style={{ background: setup.sides.find((s) => s.teamId === lastInnings.battingTeamId)?.color }} />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Innings break</p>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
                <TeamDot color={setup.sides.find((s) => s.teamId === lastInnings.battingTeamId)?.color ?? '#64748b'} />
                {teamName(lastInnings.battingTeamId)}
              </p>
              <p className="mt-1 text-4xl font-black tabular-nums tracking-tight">
                {lastInnings.runs}/{lastInnings.wickets}
                <span className="ml-2 text-base font-semibold text-muted-foreground">({oversText(lastInnings.legalBalls, bpo)} ov)</span>
              </p>
              <p className="mt-2 text-sm font-bold text-primary">{statusText(state)}</p>
              {lastEvent && (
                <button type="button" onClick={doUndo} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3 h-3" />Undo {describeEvent(state, lastEvent)}
                </button>
              )}
            </section>
          )}
          {state.awaiting === 'start_innings' && <StartInningsPanel state={state} players={players} send={send} />}

          {state.phase === 'completed' && (() => {
            const result = state.result;
            const winnerId = result && (result.kind === 'won' || result.kind === 'awarded') ? result.winnerTeamId : null;
            const winner = setup.sides.find((s) => s.teamId === winnerId);
            return (
              <>
                <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-card p-5 sm:p-6 text-center">
                  <div aria-hidden className="pointer-events-none absolute inset-0"
                    style={{ background: `radial-gradient(90% 70% at 50% 0%, color-mix(in oklab, ${winner?.color ?? '#f59e0b'} 22%, transparent), transparent 70%)` }} />
                  <div className="relative">
                    <span className="mx-auto w-14 h-14 rounded-2xl bg-amber-500 text-white inline-flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Trophy className="w-7 h-7" />
                    </span>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Match complete</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-balance">{statusText(state)}</h2>
                    <ul className="mt-4 space-y-1.5 text-left">
                      {state.innings.map((i) => (
                        <li key={i.index}
                          className={cn('flex items-center justify-between gap-3 rounded-xl border px-3 py-2',
                            i.battingTeamId === winnerId ? 'border-amber-500/30 bg-amber-500/6' : 'border-border bg-background/60')}>
                          <span className="flex items-center gap-2 min-w-0">
                            <TeamDot color={setup.sides.find((s) => s.teamId === i.battingTeamId)?.color ?? '#64748b'} />
                            <span className="truncate text-sm font-semibold">{teamName(i.battingTeamId)}{i.superOver ? ' · Super Over' : ''}</span>
                          </span>
                          <span className="shrink-0 tabular-nums font-black">
                            {i.runs}/{i.wickets} <span className="text-xs font-medium text-muted-foreground">({oversText(i.legalBalls, bpo)} ov)</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <MatchAwards state={state} />

                <div className="grid grid-cols-2 gap-2">
                  {tied && (
                    <button type="button" onClick={() => send({ type: 'super_over' })} className="col-span-2 btn-premium h-12 rounded-2xl font-bold">
                      Play a Super Over
                    </button>
                  )}
                  {tied && (
                    <button type="button" onClick={() => setSheet({ kind: 'endMatch' })}
                      className="col-span-2 h-11 rounded-2xl border border-border bg-card text-sm font-semibold hover:bg-muted">
                      Settle the tie another way
                    </button>
                  )}
                  <button type="button" onClick={share}
                    className={cn('col-span-2 h-12 rounded-2xl font-bold inline-flex items-center justify-center gap-2',
                      tied ? 'border border-border bg-card text-sm hover:bg-muted' : 'btn-premium')}>
                    <Share2 className="w-4 h-4" />Share the result
                  </button>
                  <Link href={centreHref}
                    className="h-11 rounded-2xl border border-border bg-card text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-muted">
                    <Radio className="w-4 h-4" />Match centre
                  </Link>
                  <button type="button" onClick={() => setSheet({ kind: 'potm' })}
                    className="h-11 rounded-2xl border border-border bg-card text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-muted">
                    <Award className="w-4 h-4" />Player of match
                  </button>
                </div>
                {lastEvent && (
                  <p className="text-center">
                    <button type="button" onClick={doUndo} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <RotateCcw className="w-3 h-3" />Undo {describeEvent(state, lastEvent)}
                    </button>
                  </p>
                )}
              </>
            );
          })()}

          {state.phase !== 'pre' && state.phase !== 'completed' && state.awaiting !== 'start_innings' && (
            <p className="py-10 text-center text-sm text-muted-foreground">{statusText(state)}</p>
          )}
        </main>
      )}

      {/* Sheets */}
      {sheet?.kind === 'runs' && (
        <MoreRunsSheet extra={sheet.extra} nbRunsAs={sheet.nbRunsAs} state={state} send={send} onClose={close} />
      )}
      {sheet?.kind === 'wicket' && (
        <WicketSheet state={state} players={players} mode={sheet.mode} presetExtra={sheet.extra} send={send} preview={preview} onClose={close} />
      )}
      {sheet?.kind === 'bowler' && (
        <Sheet open onClose={close} title="Change bowler" description="Finishes the over — injury, or a change of mind before the first ball.">
          <BowlerPicker state={state} players={players} send={send} onDone={close} />
        </Sheet>
      )}
      {sheet?.kind === 'revise' && <ReviseSheet state={state} send={send} onClose={close} />}
      {sheet?.kind === 'penalty' && <PenaltySheet state={state} send={send} onClose={close} />}
      {sheet?.kind === 'endMatch' && <EndMatchSheet state={state} send={send} onClose={close} />}
      {sheet?.kind === 'addPlayer' && <AddPlayerSheet state={state} players={players} send={send} onClose={close} />}
      {sheet?.kind === 'potm' && <PotmSheet state={state} send={send} onClose={close} />}
      {sheet?.kind === 'editBall' && (
        <EditBallSheet state={state} events={events} onClose={close}
          replace={(id, next) => { const err = replace(id, next); if (!err) toast.success('Ball corrected'); return err; }} />
      )}
      {sheet?.kind === 'scorecard' && (
        <Sheet open onClose={close} title="Scorecard" wide>
          {state.innings.length === 0
            ? <p className="text-sm text-muted-foreground">No innings yet.</p>
            : <div className="space-y-3 -mx-1">{state.innings.map((i) => <InningsCard key={i.index} state={state} inn={i} />)}</div>}
        </Sheet>
      )}

      {sheet?.kind === 'menu' && (
        <Sheet open onClose={close} title="Match options">
          <div className="-mx-2 space-y-3">
            <MenuGroup label="Fix a mistake">
              {lastEvent && <MenuItem icon={RotateCcw} label="Undo" hint={describeEvent(state, lastEvent)} onClick={() => { doUndo(); close(); }} />}
              {lastInnings?.overs.length ? (
                <MenuItem icon={Pencil} label="Edit a ball" hint="Fix the runs or extra of an earlier delivery" onClick={() => setSheet({ kind: 'editBall' })} />
              ) : null}
              {inn && inn.strikerId && inn.nonStrikerId && (
                <MenuItem icon={ArrowLeftRight} label="Swap strike" onClick={() => { if (!send({ type: 'swap' })) close(); }} />
              )}
            </MenuGroup>
            <MenuGroup label="Players">
              {inn && canBowl && <MenuItem icon={Gavel} label="Change bowler" hint="Mid-over — injury or a mistake" onClick={() => setSheet({ kind: 'bowler' })} />}
              {inn && <MenuItem icon={UserMinus} label="Retire a batter" hint="Retired hurt / out, timed out, run out backing up" onClick={() => setSheet({ kind: 'wicket', mode: 'crease', extra: null })} />}
              {state.phase !== 'completed' && <MenuItem icon={UserPlus} label="Add a late arrival" onClick={() => setSheet({ kind: 'addPlayer' })} />}
            </MenuGroup>
            <MenuGroup label="Match">
              {inn && <MenuItem icon={PlusCircle} label="Penalty runs" onClick={() => setSheet({ kind: 'penalty' })} />}
              {canRevise && (
                <MenuItem icon={CloudRain} label="Revise overs / target" hint="Rain, bad light, a late start" onClick={() => setSheet({ kind: 'revise' })} />
              )}
              {inn && <MenuItem icon={Flag} label={inn.index % 2 === 0 ? 'End innings / declare' : 'End innings'} onClick={() => { if (!send({ type: 'end_innings', reason: 'declared' })) close(); }} />}
              {(state.phase !== 'completed' || tied) && <MenuItem icon={CloudOff} label={tied ? 'Settle the tie' : 'End match'} hint="Abandoned, no result, walkover" onClick={() => setSheet({ kind: 'endMatch' })} />}
              {state.phase === 'completed' && <MenuItem icon={Award} label="Player of the match" onClick={() => setSheet({ kind: 'potm' })} />}
              {events.length === 0 && (
                <MenuItem icon={Pencil} label="Edit squads, rules or toss" disabled={status !== 'saved'} onClick={() => onEditSetup(version)} />
              )}
            </MenuGroup>
            <MenuGroup label="Share">
              <MenuItem icon={Users} label="Full scorecard" onClick={() => setSheet({ kind: 'scorecard' })} />
              <MenuItem icon={Share2} label="Share live link" onClick={() => { void share(); close(); }} />
              {status === 'offline' && <MenuItem icon={RefreshCw} label="Retry saving now" onClick={() => { void retry(); close(); }} />}
            </MenuGroup>
            <div className="border-t border-border pt-2">
              <MenuItem icon={Trash2} label="Delete scorecard" hint="Removes every ball and any result it recorded" tone="danger"
                onClick={() => { close(); setDeleteOpen(true); }} />
            </div>
          </div>
        </Sheet>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this scorecard?"
        description="Every ball recorded for this match is removed, and its result comes off the points table. This cannot be undone."
        confirmLabel="Delete scorecard"
        pendingLabel="Deleting…"
        onConfirm={deleteScorecard}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
