import {
  ballChip, ballTone, commentary, dismissalText, economy, nameLookup, oversText, runRate, strikeRate,
  type BallRecord, type BatterState, type InningsState, type MatchState, type NameOf, type OverState,
} from '@/lib/scoring';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Presentational pieces shared by the scorer's console and the public match
// centre, so the two always draw a scorecard the same way. No state, no
// fetching — everything comes from a replayed `MatchState`.

const TONE: Record<ReturnType<typeof ballTone>, string> = {
  wicket: 'bg-red-600 text-white border-red-600',
  six: 'bg-violet-600 text-white border-violet-600',
  four: 'bg-emerald-600 text-white border-emerald-600',
  extra: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
  dot: 'bg-muted text-muted-foreground border-border',
  run: 'bg-card text-foreground border-border',
};

export function BallChip({ ball, size = 'md' }: { ball: BallRecord; size?: 'sm' | 'md' }) {
  const label = ballChip(ball);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-bold tabular-nums shrink-0',
        size === 'sm' ? 'h-6 min-w-6 px-1.5 text-[10px]' : 'h-8 min-w-8 px-2 text-xs',
        TONE[ballTone(ball)],
      )}
      title={ball.label}
    >
      {label}
    </span>
  );
}

/** The chips of one over, oldest first. */
export function OverStrip({ over, size = 'md', className }: { over: OverState | null | undefined; size?: 'sm' | 'md'; className?: string }) {
  if (!over || over.balls.length === 0) {
    return <p className={cn('text-xs text-muted-foreground', className)}>New over</p>;
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {over.balls.map((b) => <BallChip key={b.eventId} ball={b} size={size} />)}
    </div>
  );
}

export function TeamDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', className)} style={{ background: color }} />;
}

function sideOf(state: MatchState, teamId: string) {
  return state.setup.sides.find((s) => s.teamId === teamId);
}

/** "(c)" and "†" the way scorecards mark captains and keepers. */
function roleMarks(state: MatchState, teamId: string, playerId: string): string {
  const side = sideOf(state, teamId);
  return `${side?.captainId === playerId ? ' (c)' : ''}${side?.keeperId === playerId ? ' †' : ''}`;
}

function batterLine(b: BatterState, live: boolean, onStrike: boolean, nameOf: NameOf): string {
  if (b.status === 'batting') return live ? (onStrike ? 'batting *' : 'batting') : 'not out';
  if (b.status === 'not_out') return 'not out';
  return dismissalText(b.dismissal, nameOf);
}

export function BattingTable({ state, inn }: { state: MatchState; inn: InningsState }) {
  const nameOf = nameLookup(state);
  const live = !inn.complete;
  const bpo = state.setup.rules.ballsPerOver;
  const squad = state.squads[inn.battingTeamId] ?? [];
  const yetToBat = squad.filter((p) => !inn.batters.some((b) => b.id === p.id));
  const ex = inn.extras;
  const extrasTotal = ex.b + ex.lb + ex.wd + ex.nb + ex.p;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-2 text-left font-semibold">Batter</th>
            <th className="py-2 px-2 text-right font-semibold">R</th>
            <th className="py-2 px-2 text-right font-semibold">B</th>
            <th className="py-2 px-2 text-right font-semibold">4s</th>
            <th className="py-2 px-2 text-right font-semibold">6s</th>
            <th className="py-2 pl-2 pr-4 text-right font-semibold">SR</th>
          </tr>
        </thead>
        <tbody>
          {inn.batters.map((b) => {
            const atCrease = live && b.status === 'batting';
            return (
              <tr key={b.id} className={cn('border-b border-border/50', atCrease && 'bg-primary/5')}>
                <td className="py-2 pl-4 pr-2 min-w-40">
                  <p className={cn('font-semibold leading-tight', atCrease && 'text-primary')}>
                    {b.name}{roleMarks(state, inn.battingTeamId, b.id)}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {batterLine(b, live, inn.strikerId === b.id, nameOf)}
                  </p>
                </td>
                <td className="py-2 px-2 text-right font-bold tabular-nums">{b.runs}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.balls}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.fours}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.sixes}</td>
                <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground">{strikeRate(b.runs, b.balls)}</td>
              </tr>
            );
          })}
          <tr className="border-b border-border/50">
            <td className="py-2 pl-4 pr-2 text-muted-foreground">
              Extras <span className="text-xs">(b {ex.b}, lb {ex.lb}, w {ex.wd}, nb {ex.nb}{ex.p ? `, p ${ex.p}` : ''})</span>
            </td>
            <td className="py-2 px-2 text-right font-semibold tabular-nums">{extrasTotal}</td>
            <td colSpan={4} />
          </tr>
          <tr>
            <td className="py-2.5 pl-4 pr-2 font-bold">Total</td>
            <td colSpan={5} className="py-2.5 pl-2 pr-4 text-right">
              <span className="font-black tabular-nums">{inn.runs}/{inn.wickets}</span>
              <span className="text-xs text-muted-foreground ml-1.5">
                ({oversText(inn.legalBalls, bpo)} ov, RR {runRate(inn.runs, inn.legalBalls, bpo)})
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      {yetToBat.length > 0 && (
        <p className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border/50">
          <span className="font-semibold text-foreground/80">{live ? 'Yet to bat' : 'Did not bat'}: </span>
          {yetToBat.map((p) => `${p.name}${roleMarks(state, inn.battingTeamId, p.id)}`).join(', ')}
        </p>
      )}
    </div>
  );
}

export function BowlingTable({ state, inn }: { state: MatchState; inn: InningsState }) {
  const bpo = state.setup.rules.ballsPerOver;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-2 text-left font-semibold">Bowler</th>
            <th className="py-2 px-2 text-right font-semibold">O</th>
            <th className="py-2 px-2 text-right font-semibold">M</th>
            <th className="py-2 px-2 text-right font-semibold">R</th>
            <th className="py-2 px-2 text-right font-semibold">W</th>
            <th className="py-2 px-2 text-right font-semibold">Econ</th>
            <th className="py-2 px-2 text-right font-semibold">Wd</th>
            <th className="py-2 pl-2 pr-4 text-right font-semibold">Nb</th>
          </tr>
        </thead>
        <tbody>
          {inn.bowlers.map((b) => {
            const bowling = !inn.complete && inn.bowlerId === b.id;
            return (
              <tr key={b.id} className={cn('border-b border-border/50 last:border-0', bowling && 'bg-primary/5')}>
                <td className={cn('py-2 pl-4 pr-2 font-semibold min-w-32', bowling && 'text-primary')}>
                  {b.name}{bowling ? ' *' : ''}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{oversText(b.balls, bpo)}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.maidens}</td>
                <td className="py-2 px-2 text-right tabular-nums">{b.runs}</td>
                <td className="py-2 px-2 text-right font-bold tabular-nums">{b.wickets}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{economy(b.runs, b.balls, bpo)}</td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.wides}</td>
                <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground">{b.noBalls}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FallOfWickets({ state, inn }: { state: MatchState; inn: InningsState }) {
  if (inn.fallOfWickets.length === 0) return null;
  const nameOf = nameLookup(state);
  return (
    <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">
      <span className="font-semibold text-foreground/80">Fall of wickets: </span>
      {inn.fallOfWickets.map((f) => `${f.runs}-${f.wicket} (${nameOf(f.batterId)}, ${f.over} ov)`).join(' · ')}
    </p>
  );
}

export function inningsTitle(state: MatchState, inn: InningsState): string {
  const team = sideOf(state, inn.battingTeamId)?.name ?? 'Team';
  if (!inn.superOver) return team;
  const n = Math.floor((inn.index - 2) / 2) + 1;
  return `${team} — Super Over${state.superOvers > 1 ? ` ${n}` : ''}`;
}

/** One innings in full: batting, bowling, fall of wickets. */
export function InningsCard({ state, inn }: { state: MatchState; inn: InningsState }) {
  const bpo = state.setup.rules.ballsPerOver;
  const side = sideOf(state, inn.battingTeamId);
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <TeamDot color={side?.color ?? '#64748b'} />
          <h3 className="font-bold truncate">{inningsTitle(state, inn)}</h3>
        </div>
        <p className="shrink-0 font-black tabular-nums">
          {inn.runs}/{inn.wickets}
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">({oversText(inn.legalBalls, bpo)}/{inn.maxOvers} ov)</span>
        </p>
      </header>
      <BattingTable state={state} inn={inn} />
      <div className="border-t border-border">
        <FallOfWickets state={state} inn={inn} />
      </div>
      <div className="border-t border-border">
        <BowlingTable state={state} inn={inn} />
      </div>
    </section>
  );
}

/** Ball-by-ball commentary for one innings, newest first, with over summaries. */
export function Commentary({ state, inn, limit }: { state: MatchState; inn: InningsState; limit?: number }) {
  const nameOf = nameLookup(state);
  const bpo = state.setup.rules.ballsPerOver;
  const items: ReactNode[] = [];
  let running = 0;
  const afterOver = new Map<number, { runs: number; wickets: number }>();
  let wkts = 0;
  for (const over of inn.overs) {
    for (const b of over.balls) {
      running += b.total;
      if (b.wicket) wkts++;
    }
    afterOver.set(over.index, { runs: running, wickets: wkts });
  }
  const overs = [...inn.overs].reverse();
  for (const over of overs) {
    const done = over.legal >= bpo;
    if (done) {
      const score = afterOver.get(over.index)!;
      items.push(
        <li key={`end-${over.index}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-xs">
          <span className="font-semibold">End of over {over.index + 1} · {over.runs} run{over.runs === 1 ? '' : 's'}{over.wickets ? ` · ${over.wickets} wkt` : ''}</span>
          <span className="tabular-nums text-muted-foreground">{score.runs}/{score.wickets}</span>
        </li>,
      );
    }
    for (const b of [...over.balls].reverse()) {
      const out = b.wicket ? inn.batters.find((x) => x.id === b.wicket!.outId)?.dismissal ?? null : null;
      items.push(
        <li key={b.eventId} className="flex items-start gap-3 py-2">
          <span className="w-9 shrink-0 pt-1.5 text-xs font-semibold tabular-nums text-muted-foreground">{b.label}</span>
          <BallChip ball={b} />
          <p className={cn('pt-1 text-sm leading-snug', b.wicket && 'font-semibold text-red-600 dark:text-red-400', b.boundary && 'font-semibold')}>
            {commentary(b, nameOf, out)}
          </p>
        </li>,
      );
    }
  }
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) return <p className="px-1 py-6 text-center text-sm text-muted-foreground">No balls bowled yet.</p>;
  return <ul className="flex flex-col gap-1">{shown}</ul>;
}

/** Every over of an innings: bowler, chips and runs — the "Overs" tab. */
export function OversList({ state, inn }: { state: MatchState; inn: InningsState }) {
  const nameOf = nameLookup(state);
  const max = Math.max(1, ...inn.overs.map((o) => o.runs));
  if (inn.overs.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No overs bowled yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {[...inn.overs].reverse().map((o) => (
        <li key={o.index} className="py-3 flex items-start gap-3">
          <div className="w-10 shrink-0 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ov</p>
            <p className="font-black tabular-nums">{o.index + 1}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-sm font-semibold truncate">{o.bowlerIds.map(nameOf).join(' & ')}</p>
              <p className="text-sm font-bold tabular-nums shrink-0">{o.runs} run{o.runs === 1 ? '' : 's'}{o.wickets ? ` · ${o.wickets}W` : ''}</p>
            </div>
            <OverStrip over={o} size="sm" />
            {/* Manhattan bar — runs in the over against the innings' best */}
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(o.runs / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The current partnership, as "34 (22)". */
export function currentStand(inn: InningsState): { runs: number; balls: number } | null {
  const p = inn.partnerships[inn.partnerships.length - 1];
  return p && p.endedBy === null ? { runs: p.runs, balls: p.balls } : null;
}

/** Batters at the crease and the bowler, with their figures — the "Live" panel. */
export function CreasePanel({ state, inn }: { state: MatchState; inn: InningsState }) {
  const bpo = state.setup.rules.ballsPerOver;
  const atCrease = [inn.strikerId, inn.nonStrikerId]
    .filter((id): id is string => !!id)
    .map((id) => inn.batters.find((b) => b.id === id)!)
    .filter(Boolean);
  const bowler = inn.bowlers.find((b) => b.id === inn.bowlerId)
    ?? inn.bowlers.find((b) => b.id === inn.overs[inn.overs.length - 1]?.bowlerIds.slice(-1)[0]);
  const stand = currentStand(inn);
  const lastWicket = inn.fallOfWickets[inn.fallOfWickets.length - 1];
  const nameOf = nameLookup(state);
  const lastOut = lastWicket ? inn.batters.find((b) => b.id === lastWicket.batterId) : null;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-2 text-left font-semibold">Batter</th>
            <th className="py-2 px-2 text-right font-semibold">R</th>
            <th className="py-2 px-2 text-right font-semibold">B</th>
            <th className="py-2 px-2 text-right font-semibold">4s</th>
            <th className="py-2 px-2 text-right font-semibold">6s</th>
            <th className="py-2 pl-2 pr-4 text-right font-semibold">SR</th>
          </tr>
        </thead>
        <tbody>
          {atCrease.map((b) => (
            <tr key={b.id} className="border-b border-border/50">
              <td className="py-2 pl-4 pr-2 font-semibold">
                {b.name}{inn.strikerId === b.id && <span className="text-primary"> *</span>}
              </td>
              <td className="py-2 px-2 text-right font-bold tabular-nums">{b.runs}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.balls}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.fours}</td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{b.sixes}</td>
              <td className="py-2 pl-2 pr-4 text-right tabular-nums text-muted-foreground">{strikeRate(b.runs, b.balls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {bowler && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 text-sm">
          <span className="font-semibold truncate">{bowler.name}</span>
          <span className="tabular-nums text-muted-foreground shrink-0">
            {oversText(bowler.balls, bpo)}-{bowler.maidens}-{bowler.runs}-<span className="font-bold text-foreground">{bowler.wickets}</span>
            <span className="ml-2 text-xs">Econ {economy(bowler.runs, bowler.balls, bpo)}</span>
          </span>
        </div>
      )}
      <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {stand && <span>Partnership <strong className="text-foreground tabular-nums">{stand.runs} ({stand.balls})</strong></span>}
        {lastWicket && lastOut && (
          <span>Last wicket <strong className="text-foreground">{lastOut.name} {lastOut.runs} ({lastOut.balls})</strong> · {dismissalText(lastOut.dismissal, nameOf)}</span>
        )}
      </div>
    </div>
  );
}
