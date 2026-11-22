'use client';

import { useMemo } from 'react';
import { Award, Hand, Swords, Target, Zap, type LucideIcon } from 'lucide-react';
import { matchAwards, playerMatchLines, summarizeMatch, type MatchAward, type MatchState } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import { TeamDot } from './ScorecardParts';

function Tile({ icon: Icon, label, award, color, tone }: {
  icon: LucideIcon; label: string; award: MatchAward | null; color: (teamId: string) => string; tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 min-w-0">
      <p className={cn('flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide', tone)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />{label}
      </p>
      {award ? (
        <>
          <p className="mt-1.5 flex items-center gap-1.5 min-w-0">
            <TeamDot color={color(award.teamId)} />
            <span className="font-bold truncate">{award.name}</span>
          </p>
          <p className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate tabular-nums">{award.detail}</span>
            <span className="shrink-0 tabular-nums font-semibold">{award.points} pts</span>
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}

/**
 * The awards of a finished match — player of the match, best batter, bowler
 * and fielder, and the fighter from the beaten side. Derived from the replayed
 * state like everything else on the scorecard; renders nothing until the match
 * is over.
 */
export default function MatchAwards({ state, className }: { state: MatchState; className?: string }) {
  const awards = useMemo(
    () => (state.phase === 'completed' ? matchAwards(playerMatchLines(state), summarizeMatch(state)) : null),
    [state],
  );
  if (!awards?.playerOfMatch) return null;
  const color = (teamId: string) => state.setup.sides.find((s) => s.teamId === teamId)?.color ?? '#64748b';
  const potm = awards.playerOfMatch;

  return (
    <section className={cn('rounded-2xl border border-border bg-card p-4 space-y-3', className)} aria-label="Match awards">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
          <Award className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Player of the match</p>
          <p className="flex items-center gap-1.5 min-w-0">
            <TeamDot color={color(potm.teamId)} />
            <span className="text-lg font-black truncate">{potm.name}</span>
          </p>
          <p className="text-xs text-muted-foreground truncate tabular-nums">
            {potm.detail}{potm.picked ? ' · chosen by the scorer' : ''}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-2xl font-black tabular-nums leading-none">{potm.points}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">impact pts</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={Zap} label="Best batter" award={awards.bestBatter} color={color} tone="text-orange-700 dark:text-orange-300" />
        <Tile icon={Target} label="Best bowler" award={awards.bestBowler} color={color} tone="text-violet-700 dark:text-violet-300" />
        <Tile icon={Hand} label="Best fielder" award={awards.bestFielder} color={color} tone="text-sky-700 dark:text-sky-300" />
        <Tile icon={Swords} label="Fighter of the match" award={awards.fighter} color={color} tone="text-rose-700 dark:text-rose-300" />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Impact points price every run, wicket and catch against this match&apos;s own scoring rate, so batters, bowlers
        and fielders are judged on one scale. The fighter is the best performer from the side that didn&apos;t win.
      </p>
    </section>
  );
}
