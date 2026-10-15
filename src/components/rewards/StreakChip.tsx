'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { getRewardsState, getServerRewardsState, subscribeRewards } from './rewardsStore';

/**
 * The weekly streak in the nav bar, linking to the trophy cabinet. Draws from
 * the check-in the watcher already made, so it costs no request; it renders
 * nothing until that has landed.
 *
 * The nav bar places it *first* in its right-aligned cluster on purpose:
 * appearing there pushes nothing that was already on screen, so it never
 * causes a layout shift.
 */
export default function StreakChip({ active }: { active: boolean }) {
  const { data } = useSyncExternalStore(subscribeRewards, getRewardsState, getServerRewardsState);
  if (!data) return null;

  const weeks = data.streak.current;
  const label = `${weeks}-week streak — your rewards`;
  return (
    <Link
      href="/rewards"
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="animate-badge-pop inline-flex h-9 items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/10 pl-2 pr-2.5 text-[13px] font-bold tabular-nums text-orange-600 transition-colors hover:border-orange-500/45 hover:bg-orange-500/15 aria-[current=page]:border-orange-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 dark:text-orange-400"
    >
      <Flame className="size-4 fill-orange-500/25" strokeWidth={2.2} />
      {weeks}
    </Link>
  );
}
