'use client';

import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowLeftRight, Award, Check, CloudOff, Flag, Gavel, ListOrdered, MoreVertical, Pencil, PlusCircle,
  RotateCcw, Share2, Trash2, Trophy, UserMinus, UserPlus, Users, CloudRain, RefreshCw,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
  DISMISSAL_LABELS, ballChip, currentInnings, economy, nameLookup, oversText, runRate, statusText, strikeRate,
  teamNameLookup, tryReplay, type BallRecord, type Extra, type MatchState, type ScoringEvent,
} from '@/lib/scoring';
import type { MatchScorecard, Player } from '@/lib/types';
import { cn, copyToClipboard, whatsappShareLink } from '@/lib/utils';
import { useScorecardSync, eventId, type SyncStatus } from './useScorecardSync';
import { InningsCard, OverStrip, TeamDot, currentStand } from './ScorecardParts';
import {
  AddPlayerSheet, BowlerPicker, CustomRunsSheet, EditBallSheet, EndMatchSheet, ExtrasSheet, PenaltySheet, PotmSheet, ReviseSheet,
  Sheet, StartInningsPanel, WicketSheet, type Draft, type Preview, type Send,
} from './ScorerDialogs';

type SheetState =
  | null
  | { kind: 'menu' }
  | { kind: 'extra'; extra: Extra }
  | { kind: 'runs' }
  | { kind: 'wicket'; mode: 'delivery' | 'crease'; extra: Extra | null }
  | { kind: 'bowler' }
  | { kind: 'revise' }
  | { kind: 'penalty' }
  | { kind: 'endMatch' }
  | { kind: 'addPlayer' }
  | { kind: 'potm' }
  | { kind: 'editBall' }
  | { kind: 'scorecard' };

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

function SyncBadge({ status, pending, errorText, onRetry }: { status: SyncStatus; pending: number; errorText: string | null; onRetry: () => void }) {
  if (status === 'error') return <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 truncate">{errorText}</p>;
  if (status === 'offline') {
    return (
      <button type="button" onClick={onRetry} className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        <CloudOff className="w-3 h-3" />Offline · {pending} unsaved · retry
      </button>
    );
  }
  if (status === 'saving') {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />Saving…
      </p>
    );
  }
  return <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><Check className="w-3 h-3" />Saved · live</p>;
}

function KeyButton({ children, onClick, className, disabled, label }: {
  children: ReactNode; onClick: () => void; className?: string; disabled?: boolean; label?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className={cn('h-15 sm:h-16 rounded-2xl border text-lg font-black active:scale-[0.97] transition-transform disabled:opacity-40 disabled:active:scale-100 select-none', className)}>
      {children}
    </button>
  );
}

function MenuItem({ icon: Icon, label, hint, onClick, tone, disabled }: {
  icon: typeof Flag; label: string; hint?: string; onClick: () => void; tone?: 'danger'; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted disabled:opacity-40',
        tone === 'danger' && 'text-red-600 dark:text-red-400')}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground truncate">{hint}</span>}
      </span>
    </button>
  );
}

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
  const close = useCallback(() => setSheet(null), []);

  const send: Send = useCallback((d: Draft) => {
    const err = record({ ...d, id: eventId(), at: Date.now() } as ScoringEvent);
    if (err) toast.error(err);
    return err;
  }, [record]);

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

  function doUndo() {
    if (!lastEvent) return;
    const what = describeEvent(state, lastEvent);
    undo();
    toast(`Undid ${what}`);
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

  const ball = (runs: number, more: Partial<Extract<Draft, { type: 'ball' }>> = {}) =>
    send({ type: 'ball', runs, extra: null, ...more });

  const currentOver = inn?.overs[inn.overs.length - 1];
  const showOver = inn && currentOver && (state.awaiting === 'bowler' || currentOver.index === Math.floor(inn.legalBalls / bpo))
    ? currentOver : null;
  const canBowl = state.awaiting === 'ball';
  const striker = inn?.batters.find((b) => b.id === inn.strikerId) ?? null;
  const nonStriker = inn?.batters.find((b) => b.id === inn.nonStrikerId) ?? null;
  const bowler = inn?.bowlers.find((b) => b.id === inn.bowlerId) ?? null;
  const stand = inn ? currentStand(inn) : null;
  const previous = inn && inn.index > 0 ? state.innings[inn.index - 1] : null;
  const tied = state.phase === 'completed' && state.result?.kind === 'tie';
  // Revisions are for the regulation innings only, live or about to start
  const canRevise = inn ? !inn.superOver : (state.phase === 'pre' || state.phase === 'break') && state.innings.length < 2;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-xl mx-auto flex items-center gap-1.5 px-3 h-14">
          <Link href={centreHref} aria-label="Back to the match centre"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{sideA.name} vs {sideB.name}</p>
            <SyncBadge status={status} pending={pending} errorText={errorText} onRetry={() => { void retry(); }} />
          </div>
          <button type="button" onClick={() => setSheet({ kind: 'scorecard' })} aria-label="Full scorecard"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <ListOrdered className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'menu' })} aria-label="Match options"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-3 py-3 space-y-3">
        {state.phase === 'pre' && (
          <p className="text-center text-sm text-muted-foreground">{statusText(state)}</p>
        )}

        {/* Between innings: what just happened, then who's next */}
        {state.awaiting === 'start_innings' && state.innings.length > 0 && (() => {
          const last = state.innings[state.innings.length - 1];
          return (
            <section className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Innings break</p>
              <p className="mt-1 text-lg font-black">{teamName(last.battingTeamId)} {last.runs}/{last.wickets}
                <span className="ml-1.5 text-sm font-medium text-muted-foreground">({oversText(last.legalBalls, bpo)} ov)</span></p>
              <p className="text-sm text-muted-foreground mt-0.5">{statusText(state)}</p>
            </section>
          );
        })()}
        {state.awaiting === 'start_innings' && <StartInningsPanel state={state} send={send} />}

        {inn && (
          <>
            {/* Score */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold min-w-0">
                  <TeamDot color={setup.sides.find((s) => s.teamId === inn.battingTeamId)?.color ?? '#64748b'} />
                  <span className="truncate">{teamName(inn.battingTeamId)}{inn.superOver ? ' · Super Over' : ''}</span>
                </p>
                {inn.freeHit && (
                  <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white animate-pulse">Free hit</span>
                )}
              </div>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-black tabular-nums tracking-tight">{inn.runs}/{inn.wickets}</span>
                <span className="text-base font-semibold text-muted-foreground tabular-nums">({oversText(inn.legalBalls, bpo)}/{inn.maxOvers})</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>CRR <strong className="text-foreground tabular-nums">{runRate(inn.runs, inn.legalBalls, bpo)}</strong></span>
                {inn.target !== null && (
                  <>
                    <span>Target <strong className="text-foreground tabular-nums">{inn.target}</strong>{inn.targetRevised ? ' (rev.)' : ''}</span>
                    <span>RRR <strong className="text-foreground tabular-nums">
                      {runRate(Math.max(0, inn.target - inn.runs), Math.max(1, inn.maxOvers * bpo - inn.legalBalls), bpo)}
                    </strong></span>
                  </>
                )}
                {stand && <span>P&apos;ship <strong className="text-foreground tabular-nums">{stand.runs} ({stand.balls})</strong></span>}
              </div>
              {inn.target !== null
                ? <p className="mt-2 text-sm font-semibold text-primary">{statusText(state)}</p>
                : previous && <p className="mt-2 text-xs text-muted-foreground">{teamName(previous.battingTeamId)} {previous.runs}/{previous.wickets}</p>}
            </section>

            {/* Crease */}
            <section className="rounded-2xl border border-border bg-card divide-y divide-border/60">
              {[striker, nonStriker].map((b, i) => b && (
                <button key={b.id} type="button"
                  onClick={() => { if (i === 1) send({ type: 'swap' }); }}
                  title={i === 1 ? 'Tap to give this batter the strike' : undefined}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left', i === 1 && 'hover:bg-muted/50')}>
                  <span className={cn('w-2 h-2 rounded-full shrink-0', i === 0 ? 'bg-primary' : 'bg-transparent border border-border')} />
                  <span className={cn('flex-1 min-w-0 truncate font-semibold', i === 0 && 'text-primary')}>{b.name}</span>
                  <span className="tabular-nums font-black">{b.runs}</span>
                  <span className="tabular-nums text-xs text-muted-foreground w-10">({b.balls})</span>
                  <span className="hidden sm:inline tabular-nums text-xs text-muted-foreground w-16 text-right">{b.fours}×4 {b.sixes}×6</span>
                  <span className="tabular-nums text-xs text-muted-foreground w-16 text-right whitespace-nowrap">SR {strikeRate(b.runs, b.balls)}</span>
                </button>
              ))}
              {!nonStriker && striker && (
                <p className="px-4 py-2 text-xs text-muted-foreground">Last man standing — batting alone</p>
              )}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Gavel className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {bowler ? (
                  <>
                    <span className="flex-1 min-w-0 truncate font-semibold">{bowler.name}</span>
                    <span className="tabular-nums text-sm whitespace-nowrap">
                      {oversText(bowler.balls, bpo)}-{bowler.maidens}-{bowler.runs}-<strong>{bowler.wickets}</strong>
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground w-16 text-right whitespace-nowrap">Econ {economy(bowler.runs, bowler.balls, bpo)}</span>
                    <button type="button" onClick={() => setSheet({ kind: 'bowler' })} className="text-xs font-semibold text-primary shrink-0">Change</button>
                  </>
                ) : <span className="text-sm text-muted-foreground">Choose the next bowler</span>}
              </div>
            </section>

            {/* This over */}
            <section className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {showOver ? `Over ${showOver.index + 1}` : `Over ${Math.floor(inn.legalBalls / bpo) + 1}`}
                </p>
                {showOver && <p className="text-xs font-semibold tabular-nums">{showOver.runs} run{showOver.runs === 1 ? '' : 's'}</p>}
              </div>
              <OverStrip over={showOver} />
            </section>

            {state.awaiting === 'bowler' ? (
              <section className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
                <p className="text-sm font-bold mb-2 px-1">Over complete — who bowls next?</p>
                <BowlerPicker state={state} send={send} />
              </section>
            ) : (
              <section className="sticky bottom-0 -mx-3 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background/95 backdrop-blur-xl">
                <div className="grid grid-cols-4 gap-2">
                  <KeyButton onClick={() => ball(0)} disabled={!canBowl} className="border-border bg-card" label="Dot ball">0</KeyButton>
                  <KeyButton onClick={() => ball(1)} disabled={!canBowl} className="border-border bg-card">1</KeyButton>
                  <KeyButton onClick={() => ball(2)} disabled={!canBowl} className="border-border bg-card">2</KeyButton>
                  <KeyButton onClick={() => ball(3)} disabled={!canBowl} className="border-border bg-card">3</KeyButton>
                  <KeyButton onClick={() => ball(4, { boundary: true })} disabled={!canBowl} className="border-emerald-600 bg-emerald-600 text-white" label="Four">4</KeyButton>
                  <KeyButton onClick={() => ball(6, { boundary: true })} disabled={!canBowl} className="border-violet-600 bg-violet-600 text-white" label="Six">6</KeyButton>
                  <KeyButton onClick={() => setSheet({ kind: 'runs' })} disabled={!canBowl} className="border-border bg-card text-base" label="Other runs">5, 7…</KeyButton>
                  <KeyButton onClick={doUndo} disabled={!lastEvent} className="border-border bg-muted text-base" label="Undo">
                    <RotateCcw className="w-5 h-5 mx-auto" />
                  </KeyButton>
                  {(['wd', 'nb', 'b', 'lb'] as const).map((x) => (
                    <KeyButton key={x} onClick={() => setSheet({ kind: 'extra', extra: x })} disabled={!canBowl}
                      className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-base">
                      {{ wd: 'Wide', nb: 'No ball', b: 'Bye', lb: 'Leg bye' }[x]}
                    </KeyButton>
                  ))}
                  <KeyButton onClick={() => setSheet({ kind: 'wicket', mode: 'delivery', extra: null })} disabled={!canBowl}
                    className="col-span-4 h-14 border-red-600 bg-red-600 text-white tracking-widest">
                    OUT
                  </KeyButton>
                </div>
              </section>
            )}
          </>
        )}

        {state.phase === 'completed' && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 text-center space-y-3">
            <Trophy className="w-8 h-8 mx-auto text-amber-500" />
            <div className="space-y-1">
              {state.innings.map((i) => (
                <p key={i.index} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <TeamDot color={setup.sides.find((s) => s.teamId === i.battingTeamId)?.color ?? '#64748b'} />
                    <span className="truncate font-semibold">{teamName(i.battingTeamId)}{i.superOver ? ' · Super Over' : ''}</span>
                  </span>
                  <span className="tabular-nums font-bold shrink-0">
                    {i.runs}/{i.wickets} <span className="text-xs font-medium text-muted-foreground">({oversText(i.legalBalls, bpo)} ov)</span>
                  </span>
                </p>
              ))}
            </div>
            <p className="text-xl font-black">{statusText(state)}</p>
            {state.playerOfMatchId && (
              <p className="text-sm">Player of the match: <strong>{nameLookup(state)(state.playerOfMatchId)}</strong></p>
            )}
            <div className="grid gap-2">
              {tied && (
                <button type="button" onClick={() => send({ type: 'super_over' })} className="btn-premium h-12 rounded-xl font-bold">
                  Play a Super Over
                </button>
              )}
              {tied && (
                <button type="button" onClick={() => setSheet({ kind: 'endMatch' })} className="h-11 rounded-xl border border-border bg-card font-semibold text-sm">
                  Settle the tie another way
                </button>
              )}
              <button type="button" onClick={() => setSheet({ kind: 'potm' })} className="h-11 rounded-xl border border-border bg-card font-semibold text-sm inline-flex items-center justify-center gap-2">
                <Award className="w-4 h-4" />{state.playerOfMatchId ? 'Change player of the match' : 'Pick player of the match'}
              </button>
              <Link href={centreHref} className="h-11 rounded-xl border border-border bg-card font-semibold text-sm inline-flex items-center justify-center">
                Open the match centre
              </Link>
              <button type="button" onClick={share} className="h-11 rounded-xl border border-border bg-card font-semibold text-sm inline-flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />Share the result
              </button>
              {lastEvent && (
                <button type="button" onClick={doUndo} className="text-xs text-muted-foreground underline underline-offset-2">
                  Undo {describeEvent(state, lastEvent)}
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Sheets */}
      {sheet?.kind === 'extra' && (
        <ExtrasSheet extra={sheet.extra} state={state} send={send} onClose={close}
          onWicket={(extra) => setSheet({ kind: 'wicket', mode: 'delivery', extra })} />
      )}
      <CustomRunsSheet open={sheet?.kind === 'runs'} send={send} onClose={close} />
      {sheet?.kind === 'wicket' && (
        <WicketSheet state={state} mode={sheet.mode} presetExtra={sheet.extra} send={send} preview={preview} onClose={close} />
      )}
      {sheet?.kind === 'bowler' && (
        <Sheet open onClose={close} title="Change bowler" description="Finishes the over — injury, or a change of mind before the first ball.">
          <BowlerPicker state={state} send={send} onDone={close} />
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
          <div className="-mx-2 flex flex-col">
            {lastEvent && <MenuItem icon={RotateCcw} label="Undo" hint={describeEvent(state, lastEvent)} onClick={() => { doUndo(); close(); }} />}
            {state.innings[state.innings.length - 1]?.overs.length ? (
              <MenuItem icon={Pencil} label="Edit a ball" hint="Fix the runs or extra of an earlier delivery" onClick={() => setSheet({ kind: 'editBall' })} />
            ) : null}
            {inn && inn.strikerId && inn.nonStrikerId && (
              <MenuItem icon={ArrowLeftRight} label="Swap strike" onClick={() => { if (!send({ type: 'swap' })) close(); }} />
            )}
            {inn && canBowl && <MenuItem icon={Gavel} label="Change bowler" hint="Mid-over — injury or a mistake" onClick={() => setSheet({ kind: 'bowler' })} />}
            {inn && <MenuItem icon={UserMinus} label="Retire a batter" hint="Retired hurt / out, timed out, run out backing up" onClick={() => setSheet({ kind: 'wicket', mode: 'crease', extra: null })} />}
            {inn && <MenuItem icon={PlusCircle} label="Penalty runs" onClick={() => setSheet({ kind: 'penalty' })} />}
            {state.phase !== 'completed' && <MenuItem icon={UserPlus} label="Add a late arrival" onClick={() => setSheet({ kind: 'addPlayer' })} />}
            {canRevise && (
              <MenuItem icon={CloudRain} label="Revise overs / target" hint="Rain, bad light, a late start" onClick={() => setSheet({ kind: 'revise' })} />
            )}
            {inn && <MenuItem icon={Flag} label={inn.index % 2 === 0 ? 'End innings / declare' : 'End innings'} onClick={() => { if (!send({ type: 'end_innings', reason: 'declared' })) close(); }} />}
            {(state.phase !== 'completed' || tied) && <MenuItem icon={CloudOff} label={tied ? 'Settle the tie' : 'End match'} hint="Abandoned, no result, walkover" onClick={() => setSheet({ kind: 'endMatch' })} />}
            {state.phase === 'completed' && <MenuItem icon={Award} label="Player of the match" onClick={() => setSheet({ kind: 'potm' })} />}
            {events.length === 0 && (
              <MenuItem icon={Pencil} label="Edit squads, rules or toss" disabled={status !== 'saved'} onClick={() => onEditSetup(version)} />
            )}
            <MenuItem icon={Users} label="Full scorecard" onClick={() => setSheet({ kind: 'scorecard' })} />
            <MenuItem icon={Share2} label="Share live link" onClick={() => { void share(); close(); }} />
            {status === 'offline' && <MenuItem icon={RefreshCw} label="Retry saving now" onClick={() => { void retry(); close(); }} />}
            <MenuItem icon={Trash2} label="Delete scorecard" hint="Removes every ball and any result it recorded" tone="danger"
              onClick={() => { close(); setDeleteOpen(true); }} />
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
