'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, Coins, Radio, Share2, Trophy, Pencil, Award } from 'lucide-react';
import { formatMatchDay } from '@/lib/fixtures';
import {
  nameLookup, oversText, playerMatchLines, statusText, strikeRate, tryReplay,
  type InningsState, type MatchState,
} from '@/lib/scoring';
import type { MatchCentre } from '@/lib/types';
import { cn, copyToClipboard, whatsappShareLink } from '@/lib/utils';
import { BallChip, Commentary, CreasePanel, InningsCard, OverStrip, OversList, TeamDot, inningsTitle } from './ScorecardParts';

type Tab = 'live' | 'scorecard' | 'commentary' | 'overs' | 'squads';

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'commentary', label: 'Commentary' },
  { id: 'overs', label: 'Overs' },
  { id: 'squads', label: 'Squads' },
];

/** Poll beat by phase: busy while balls are being bowled, idle once it's over. */
function pollMs(phase: MatchState['phase'] | null): number | null {
  if (phase === null) return 15000; // not being scored (yet)
  if (phase === 'live' || phase === 'break') return 2000;
  if (phase === 'pre') return 5000;
  return null;
}

function InningsPicker({ state, value, onChange }: { state: MatchState; value: number; onChange: (i: number) => void }) {
  if (state.innings.length < 2) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {state.innings.map((inn) => (
        <button key={inn.index} type="button" onClick={() => onChange(inn.index)}
          className={cn('shrink-0 h-8 px-3 rounded-full border text-xs font-semibold',
            value === inn.index ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
          {inningsTitle(state, inn)}
        </button>
      ))}
    </div>
  );
}

function TopPerformers({ state }: { state: MatchState }) {
  const bpo = state.setup.rules.ballsPerOver;
  const lines = playerMatchLines(state);
  const bat = lines.filter((l) => l.batted).sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3);
  const bowl = lines.filter((l) => l.bowled).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, 3);
  const color = (teamId: string) => state.setup.sides.find((s) => s.teamId === teamId)?.color ?? '#64748b';
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="section-label mb-3">Top batters</p>
        <ul className="space-y-2">
          {bat.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm">
              <TeamDot color={color(l.teamId)} />
              <span className="flex-1 min-w-0 truncate font-semibold">{l.name}</span>
              <span className="tabular-nums font-black">{l.runs}{l.out ? '' : '*'}</span>
              <span className="tabular-nums text-xs text-muted-foreground w-24 text-right">({l.balls}) SR {strikeRate(l.runs, l.balls)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="section-label mb-3">Top bowlers</p>
        <ul className="space-y-2">
          {bowl.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm">
              <TeamDot color={color(l.teamId)} />
              <span className="flex-1 min-w-0 truncate font-semibold">{l.name}</span>
              <span className="tabular-nums font-black">{l.wickets}/{l.runsConceded}</span>
              <span className="tabular-nums text-xs text-muted-foreground w-16 text-right">({oversText(l.ballsBowled, bpo)})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Squads({ state }: { state: MatchState }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {state.setup.sides.map((side) => (
        <section key={side.teamId} className="rounded-2xl border border-border bg-card overflow-hidden">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
            <TeamDot color={side.color} />
            <h3 className="font-bold truncate">{side.name}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{(state.squads[side.teamId] ?? []).length}</span>
          </header>
          <ul className="divide-y divide-border/50">
            {(state.squads[side.teamId] ?? []).map((p) => (
              <li key={p.id} className="px-4 py-2 text-sm flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">{p.name}</span>
                {side.captainId === p.id && <span className="text-[10px] font-bold rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5">C</span>}
                {side.keeperId === p.id && <span className="text-[10px] font-bold rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 px-1.5 py-0.5">WK</span>}
                {p.id.startsWith('guest:') && <span className="text-[10px] text-muted-foreground">Guest</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Each side's score line, regulation innings first, super overs after. */
function SideScore({ state, teamId }: { state: MatchState; teamId: string }) {
  const bpo = state.setup.rules.ballsPerOver;
  const innings = state.innings.filter((i) => i.battingTeamId === teamId);
  const main = innings.find((i) => !i.superOver);
  const supers = innings.filter((i) => i.superOver);
  const live = (i: InningsState) => !i.complete && state.phase === 'live';
  if (!main) return <span className="text-sm text-muted-foreground">Yet to bat</span>;
  return (
    <span className="text-right">
      <span className={cn('text-xl font-black tabular-nums', live(main) && 'text-primary')}>{main.runs}/{main.wickets}</span>
      <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">({oversText(main.legalBalls, bpo)}{main.maxOvers !== state.setup.rules.overs ? `/${main.maxOvers}` : ''} ov)</span>
      {supers.map((s) => (
        <span key={s.index} className="block text-xs text-muted-foreground tabular-nums">SO {s.runs}/{s.wickets} ({oversText(s.legalBalls, bpo)})</span>
      ))}
    </span>
  );
}

export default function MatchCentreView({ leagueId, initial }: { leagueId: string; initial: MatchCentre }) {
  const [centre, setCentre] = useState<MatchCentre>(initial);
  const [canManage, setCanManage] = useState(false);
  const replayed = useMemo(() => {
    const card = centre.scorecard;
    if (!card) return null;
    const r = tryReplay(card.setup, card.events);
    return r.ok ? r.state : null;
  }, [centre.scorecard]);
  const state = replayed;
  const phase = state?.phase ?? null;
  const [tab, setTab] = useState<Tab>(phase === 'completed' ? 'scorecard' : 'live');
  const [pickedInnings, setPickedInnings] = useState<number | null>(null);
  const { match } = centre;
  const matchId = match.id;

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/can-manage`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanManage(d?.canManage === true))
      .catch(() => { /* a spectator */ });
  }, [leagueId]);

  // Poll the scorecard — the same edge-cached feed every spectator shares, so
  // the default fetch cache mode on purpose (see the route's notes).
  const beat = pollMs(phase);
  useEffect(() => {
    if (beat === null) return;
    let active = true;
    const tick = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/leagues/${leagueId}/matches/${matchId}/score`);
        if (!res.ok || !active) return;
        const next = (await res.json()) as MatchCentre;
        if (!active) return;
        setCentre((prev) =>
          prev.scorecard?.version === next.scorecard?.version && !!prev.scorecard === !!next.scorecard ? prev : next);
      } catch { /* keep the last score */ }
    };
    const iv = setInterval(tick, beat);
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVisible); };
  }, [beat, leagueId, matchId]);

  async function share() {
    const url = window.location.href;
    const line = state ? statusText(state) : `${match.team1.name} vs ${match.team2.name}`;
    const text = `🏏 ${match.team1.name} vs ${match.team2.name} — ${line}\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* cancelled */ }
    }
    if (await copyToClipboard(text)) toast.success('Link copied');
    else window.open(whatsappShareLink(text), '_blank', 'noopener');
  }

  const isLive = phase === 'live' || phase === 'break';
  const lastIndex = state ? state.innings.length - 1 : -1;
  const shownIndex = pickedInnings !== null && state && pickedInnings <= lastIndex ? pickedInnings : lastIndex;
  const shown = state && shownIndex >= 0 ? state.innings[shownIndex] : null;
  const current = state && phase === 'live' ? state.innings[lastIndex] : null;
  const nameOf = state ? nameLookup(state) : null;
  const tossLine = state
    ? `${state.setup.sides.find((s) => s.teamId === state.setup.toss.winnerTeamId)?.name} won the toss and chose to ${state.setup.toss.decision}`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Link href={`/leagues/${leagueId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />{match.leagueName}
      </Link>

      {/* Match header */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-muted/40 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />{match.matchDate ? formatMatchDay(match.matchDate) : 'Date to be confirmed'}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 font-black uppercase tracking-wider text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Live
            </span>
          )}
          {phase === 'completed' && <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>}
        </div>
        <div className="px-4 py-4 space-y-3">
          {[match.team1, match.team2].map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 min-w-0">
                <TeamDot color={t.colorHex} className="w-3 h-3" />
                <span className={cn('font-bold truncate', state?.result && 'winnerTeamId' in state.result && state.result.winnerTeamId === t.id && 'text-primary')}>
                  {t.name}
                </span>
                {state?.result && 'winnerTeamId' in state.result && state.result.winnerTeamId === t.id && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
              </span>
              {state
                ? <SideScore state={state} teamId={t.id} />
                : <span className="font-mono text-sm text-muted-foreground">{t.id === match.team1.id ? match.team1Score ?? '' : match.team2Score ?? ''}</span>}
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 space-y-1">
          {state ? (
            <p className={cn('text-sm font-semibold', phase === 'completed' ? 'text-amber-600 dark:text-amber-400' : 'text-primary')}>{statusText(state)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {match.winnerTeamId || match.team1Score ? 'Result entered by the organizers — no ball-by-ball scorecard.' : 'Not started yet.'}
            </p>
          )}
          {tossLine && phase !== 'pre' && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="w-3.5 h-3.5" />{tossLine}</p>}
          {state?.playerOfMatchId && nameOf && (
            <p className="flex items-center gap-1.5 text-xs"><Award className="w-3.5 h-3.5 text-amber-500" />Player of the match: <strong>{nameOf(state.playerOfMatchId)}</strong></p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <button type="button" onClick={share}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-muted">
            <Share2 className="w-4 h-4" />Share
          </button>
          {canManage && (
            <Link href={`/leagues/${leagueId}/matches/${matchId}/score`}
              className="btn-premium h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5">
              {state ? <><Pencil className="w-4 h-4" />{phase === 'completed' ? 'Open scorer' : 'Continue scoring'}</> : <><Radio className="w-4 h-4" />Score live</>}
            </Link>
          )}
        </div>
      </section>

      {state && (
        <>
          <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1" aria-label="Match centre">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                className={cn('flex-1 shrink-0 h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                  tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'live' && (
            <div className="space-y-3">
              {current ? (
                <>
                  <CreasePanel state={state} inn={current} />
                  <section className="rounded-2xl border border-border bg-card px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">This over</p>
                    <OverStrip over={current.overs[current.overs.length - 1]?.index === Math.floor(current.legalBalls / state.setup.rules.ballsPerOver) ? current.overs[current.overs.length - 1] : null} />
                  </section>
                  {current.overs.length > 1 && (
                    <section className="rounded-2xl border border-border bg-card px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent</p>
                      <div className="flex flex-wrap gap-1">
                        {current.overs.flatMap((o) => o.balls).slice(-18).map((b) => <BallChip key={b.eventId} ball={b} size="sm" />)}
                      </div>
                    </section>
                  )}
                  <section className="rounded-2xl border border-border bg-card p-3">
                    <Commentary state={state} inn={current} limit={14} />
                  </section>
                </>
              ) : phase === 'completed' ? (
                <TopPerformers state={state} />
              ) : (
                <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  {phase === 'break' ? 'Innings break — play resumes shortly.' : 'The first ball is yet to be bowled.'}
                </p>
              )}
            </div>
          )}

          {tab === 'scorecard' && (
            <div className="space-y-3">
              {state.innings.length === 0
                ? <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No innings yet.</p>
                : state.innings.map((i) => <InningsCard key={i.index} state={state} inn={i} />)}
            </div>
          )}

          {(tab === 'commentary' || tab === 'overs') && shown && (
            <div className="space-y-3">
              <InningsPicker state={state} value={shownIndex} onChange={setPickedInnings} />
              <section className="rounded-2xl border border-border bg-card p-3">
                {tab === 'commentary' ? <Commentary state={state} inn={shown} /> : <OversList state={state} inn={shown} />}
              </section>
            </div>
          )}
          {(tab === 'commentary' || tab === 'overs') && !shown && (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No balls bowled yet.</p>
          )}

          {tab === 'squads' && <Squads state={state} />}
        </>
      )}

      {!state && centre.scorecard && (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">This scorecard couldn&apos;t be read.</p>
      )}
    </div>
  );
}
