'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronRight, Flame } from 'lucide-react';
import BadgeMedal from './BadgeMedal';
import { getRewardsState, getServerRewardsState, subscribeRewards } from './rewardsStore';
import { BADGES, BADGE_BY_ID, progressLabel, tierName } from '@/lib/badges';

/**
 * The dashboard's one-line progress summary — streak, badge count and the
 * nearest badge — linking to the full cabinet. Reads the check-in the nav bar's
 * watcher makes anyway, so the dashboard doesn't pay a second request for it.
 *
 * Holds its height with a skeleton until that arrives, so the league grid below
 * doesn't jump; only a failed check-in collapses it.
 */
export default function RewardsStrip() {
  const { status, data } = useSyncExternalStore(subscribeRewards, getRewardsState, getServerRewardsState);

  if (status === 'error') return null;
  if (!data) {
    return <div className="mb-10 h-[138px] sm:h-[76px] rounded-xl border border-border bg-card shimmer" aria-hidden="true" />;
  }

  const next = data.next;
  const nextDef = next ? BADGE_BY_ID.get(next.badgeId) : undefined;
  const weeks = data.streak.current;

  return (
    <Link
      href="/rewards"
      className="medal-host group mb-10 grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[0_12px_32px_-18px_oklch(0_0_0/0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex sm:h-[76px] sm:gap-5 sm:py-0 animate-fade-in"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-amber-400 to-orange-600 text-white shadow-[0_8px_18px_-8px_oklch(0.66_0.21_38/0.8)]">
          <Flame className="size-5" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold tabular-nums text-foreground">
            {weeks}-week streak
          </span>
          <span className="block text-xs text-muted-foreground tabular-nums">Longest {data.streak.longest}</span>
        </span>
      </span>

      <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />

      <span className="min-w-0">
        <span className="block text-sm font-bold tabular-nums text-foreground">
          {data.badgesEarned} <span className="font-medium text-muted-foreground">of {BADGES.length}</span>
        </span>
        <span className="block text-xs text-muted-foreground">badges earned</span>
      </span>

      <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />

      {next && nextDef ? (
        <span className="col-span-2 flex min-w-0 flex-1 items-center gap-3 border-t border-border/60 pt-3 sm:border-0 sm:pt-0">
          <BadgeMedal def={nextDef} tier={next.tier - 1} size={40} progress={next.value / next.target} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-muted-foreground">
              Next up · <span className="font-semibold text-foreground">{nextDef.name}{tierName(nextDef, next.tier) ? ` ${tierName(nextDef, next.tier)}` : ''}</span>
            </span>
            <span className="progress-track mt-1.5 block">
              <span
                className="progress-fill block"
                style={{ width: `${Math.round(Math.min(1, next.value / next.target) * 100)}%` }}
              />
            </span>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground tabular-nums">
              {progressLabel(nextDef, next.value, next.target)}
            </span>
          </span>
        </span>
      ) : (
        <span className="col-span-2 flex-1 text-sm font-semibold text-foreground sm:col-span-1">
          Every badge earned — legend.
        </span>
      )}

      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
    </Link>
  );
}
