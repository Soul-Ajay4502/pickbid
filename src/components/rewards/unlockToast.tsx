'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, X } from 'lucide-react';
import BadgeMedal from './BadgeMedal';
import { BADGE_BY_ID, tierName } from '@/lib/badges';
import type { BadgeTier, EarnedBadge } from '@/lib/types';

/**
 * The "badge unlocked" toast. Loaded on demand by `rewardsStore` — only a
 * check-in that actually unlocked something pulls in this module and the medal
 * art, so the app shell doesn't carry them on every page.
 */

type Unlock = { badgeId: string; tier: BadgeTier };

/**
 * One entry per badge at its highest new tier, best first. A first check-in
 * after a busy season can strike bronze, silver and gold of one badge at once;
 * the toast names the gold.
 */
function collapse(unlocked: readonly EarnedBadge[]): Unlock[] {
  const best = new Map<string, BadgeTier>();
  for (const u of unlocked) {
    if (!BADGE_BY_ID.has(u.badgeId)) continue;
    if ((best.get(u.badgeId) ?? 0) < u.tier) best.set(u.badgeId, u.tier);
  }
  return [...best]
    .map(([badgeId, tier]) => ({ badgeId, tier }))
    .sort((a, b) => b.tier - a.tier);
}

function UnlockToast({ id, unlocks }: { id: string | number; unlocks: Unlock[] }) {
  const pathname = usePathname();
  const lead = unlocks[0];
  const def = BADGE_BY_ID.get(lead.badgeId)!;
  const single = unlocks.length === 1;
  const tier = tierName(def, lead.tier);

  return (
    <div className="relative flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3.5 overflow-hidden rounded-xl border border-amber-500/30 bg-popover p-3.5 pr-9 text-popover-foreground shadow-[0_18px_44px_-18px_oklch(0_0_0/0.45)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-12 size-36 rounded-full bg-amber-400/20 blur-2xl"
      />

      <div className="relative flex shrink-0 -space-x-6">
        {unlocks.slice(0, 3).map((u, i) => (
          <BadgeMedal
            key={u.badgeId}
            def={BADGE_BY_ID.get(u.badgeId)!}
            tier={u.tier}
            size={i === 0 ? 56 : 48}
            celebrate
            className={i === 0 ? 'z-10' : 'self-end opacity-90'}
          />
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <p className="text-[10.5px] font-black uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">
          {single ? 'Badge unlocked' : `${unlocks.length} badges unlocked`}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-foreground">
          {single
            ? `${def.name}${tier ? ` · ${tier}` : ''}`
            : unlocks.map((u) => BADGE_BY_ID.get(u.badgeId)!.name).join(', ')}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {single ? def.goal(def.thresholds[lead.tier - 1]) : 'Added to your trophy cabinet'}
        </p>
        {pathname !== '/rewards' && (
          <Link
            href="/rewards"
            onClick={() => toast.dismiss(id)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-2"
          >
            View rewards
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="Dismiss"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function showUnlockToast(unlocked: readonly EarnedBadge[]) {
  const unlocks = collapse(unlocked);
  if (unlocks.length === 0) return;
  toast.custom((id) => <UnlockToast id={id} unlocks={unlocks} />, { duration: 9000 });
}
