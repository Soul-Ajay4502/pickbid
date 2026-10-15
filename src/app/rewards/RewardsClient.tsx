'use client';

import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Check, ChevronRight, Flame, Lock, Sparkles } from 'lucide-react';
import Confetti from '@/components/Confetti';
import BadgeMedal, { TierPips } from '@/components/rewards/BadgeMedal';
import { primeRewards } from '@/components/rewards/rewardsStore';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  BADGES, BADGE_BY_ID, CATEGORY_LABELS, badgeKey, badgeStanding, countEarnedBadges, highestTiers,
  isTiered, medalTone, progressLabel, remainingLabel, tierName,
  type BadgeCategory, type BadgeDefinition, type BadgeStanding, type MedalTone,
} from '@/lib/badges';
import type { PickStreak, RewardsOverview, WeeklyStreak } from '@/lib/types';

const CATEGORIES: BadgeCategory[] = ['career', 'auction', 'match', 'organizer', 'streak', 'milestone'];

const CATEGORY_BLURBS: Record<BadgeCategory, string> = {
  career: 'Your profile, your leagues and the people you play with.',
  auction: 'What happens under the hammer.',
  match: 'Results, rivalries and the seasons you play through.',
  organizer: 'For running leagues people want to play in.',
  streak: 'Keep showing up — and keep getting picked.',
  milestone: 'Badges for collecting badges.',
};

type Filter = 'all' | 'earned' | 'locked';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'locked', label: 'Locked' },
];

/** A tier wears the "New" tag for a week after it's struck. */
const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;

const TONE_TEXT: Record<MedalTone, string> = {
  bronze: 'text-amber-700 dark:text-amber-500',
  silver: 'text-slate-500 dark:text-slate-300',
  gold: 'text-yellow-600 dark:text-yellow-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  locked: 'text-muted-foreground',
};

const TALLY: { tone: Exclude<MedalTone, 'locked'>; label: string }[] = [
  { tone: 'gold', label: 'Gold' },
  { tone: 'silver', label: 'Silver' },
  { tone: 'bronze', label: 'Bronze' },
  { tone: 'emerald', label: 'Special' },
];

// True once hydrated. `Confetti` styles its pieces with long floats that the
// server and the browser don't always print identically, so it only ever
// renders on the client.
const noSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function rarityLabel(share: number | undefined): string | null {
  if (share === undefined) return null;
  const p = share * 100;
  return p < 1 ? 'Held by under 1% of players' : `Held by ${Math.round(p)}% of players`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

/** "Silver", "Earned" for a one-off, "Locked" before the first tier. */
function statusText(s: BadgeStanding): string {
  if (s.tier === 0) return 'Locked';
  return tierName(s.def, s.tier) || 'Earned';
}

/** The line under a tile: the first goal while locked, progress to the next tier, or done. */
function tileHint(s: BadgeStanding): string {
  if (s.tier === 0) return s.def.goal(s.def.thresholds[0]);
  if (s.nextTier !== null && s.target !== null) return `Next: ${progressLabel(s.def, s.value, s.target)}`;
  return isTiered(s.def) ? 'Every tier earned' : s.def.goal(s.def.thresholds[0]);
}

/**
 * The trophy cabinet. Server-rendered with its data by `page.tsx`; this only
 * adds the detail dialog and hands the summary to the app shell's store.
 */
export default function RewardsClient({ userId, overview }: { userId: string; overview: RewardsOverview }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const hydrated = useHydrated();

  const tiers = useMemo(() => highestTiers(overview.earned), [overview.earned]);
  const earnedAt = useMemo(
    () => new Map(overview.earned.map((e) => [badgeKey(e.badgeId, e.tier), e.earnedAt])),
    [overview.earned]
  );
  const standings = useMemo(
    () => new Map(BADGES.map((def) => [def.id, badgeStanding(def, overview.metrics, tiers.get(def.id) ?? 0)])),
    [overview.metrics, tiers]
  );
  const justUnlocked = useMemo(() => new Set(overview.justUnlocked), [overview.justUnlocked]);
  const badgesEarned = countEarnedBadges(overview.earned);

  // Measured against the evaluation's clock, not the browser's, so the server
  // render and hydration agree on which tiers are new.
  const now = Date.parse(overview.evaluatedAt);
  const isNew = (badgeId: string, tier: number) => {
    const at = earnedAt.get(badgeKey(badgeId, tier));
    return at !== undefined && now - Date.parse(at) < NEW_FOR_MS;
  };
  const struckNow = (badgeId: string) => [1, 2, 3].some((t) => justUnlocked.has(badgeKey(badgeId, t)));

  // A layout effect so it lands before the nav's watcher runs its passive
  // effect — this evaluation makes that check-in redundant.
  useLayoutEffect(() => {
    primeRewards(userId, {
      streak: { current: overview.weekly.current, longest: overview.weekly.longest },
      unlocked: [],
      badgesEarned,
      next: overview.next,
    });
  }, [userId, overview, badgesEarned]);

  function openBadge(id: string) {
    setSelectedId(id);
    setDialogOpen(true);
  }

  const unlockedBadgeIds = [...new Set(overview.justUnlocked.map((k) => k.split(':')[0]))].filter((id) => BADGE_BY_ID.has(id));
  let unlockMessage = `You just unlocked ${unlockedBadgeIds.length} badges — they're shining below.`;
  if (unlockedBadgeIds.length === 1) {
    const def = BADGE_BY_ID.get(unlockedBadgeIds[0])!;
    const tier = tierName(def, tiers.get(def.id) ?? 0);
    unlockMessage = `You just earned ${def.name}${tier ? ` ${tier}` : ''} — it's shining below.`;
  }
  const selected = selectedId ? standings.get(selectedId) ?? null : null;

  const matchesFilter = (badgeId: string) => {
    if (filter === 'all') return true;
    const earned = (tiers.get(badgeId) ?? 0) > 0;
    return filter === 'earned' ? earned : !earned;
  };
  const visibleCount = BADGES.filter((d) => matchesFilter(d.id)).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {hydrated && unlockedBadgeIds.length > 0 && <Confetti fixed />}

      <header className="animate-rise-in">
        <span className="eyebrow-badge">
          <Sparkles className="size-3" />
          Rewards
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-gradient-green sm:text-4xl">Trophy cabinet</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Badges for what you do on Pickbid — as a player and as an organizer — and a streak for every
          week you show up. Once earned, a badge is yours to keep.
        </p>
      </header>

      {unlockedBadgeIds.length > 0 && (
        <div
          role="status"
          className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 animate-badge-pop"
        >
          <Sparkles className="size-4 shrink-0 text-amber-500" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{unlockMessage}</p>
        </div>
      )}

      <section aria-label="Your progress" className="mt-8 grid gap-5 lg:grid-cols-5">
        <StreakPanel
          weekly={overview.weekly}
          pick={overview.pickStreak}
          roll={standings.get('on-a-roll')!}
          hot={standings.get('hot-property')!}
          onOpen={openBadge}
        />
        <CollectionPanel
          overview={overview}
          badgesEarned={badgesEarned}
          onOpen={openBadge}
        />
      </section>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight text-foreground">
          All badges <span className="font-semibold text-muted-foreground tabular-nums">· {BADGES.length}</span>
        </h2>
        <div role="group" aria-label="Show badges" className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1">
          {FILTERS.map((f) => {
            const count = f.id === 'all' ? BADGES.length : f.id === 'earned' ? badgesEarned : BADGES.length - badgesEarned;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-[color,background-color,box-shadow] duration-150 ${
                  active
                    ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border),0_1px_3px_oklch(0_0_0/0.08)] dark:bg-white/8'
                    : 'text-muted-foreground hover:bg-foreground/6 hover:text-foreground'
                }`}
              >
                {f.label}
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visibleCount === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {filter === 'earned'
            ? 'Nothing earned yet — make a player card or create a league and your first badge lands.'
            : 'Every badge earned. Nothing left to unlock.'}
        </p>
      )}

      <div className="mt-6 space-y-10">
        {CATEGORIES.map((category) => {
          const defs = BADGES.filter((d) => d.category === category);
          const visible = defs.filter((d) => matchesFilter(d.id));
          if (visible.length === 0) return null;
          const earnedHere = defs.filter((d) => (tiers.get(d.id) ?? 0) > 0).length;
          return (
            <section key={category} aria-labelledby={`badges-${category}`}>
              <div className="flex items-center gap-3">
                <h3 id={`badges-${category}`} className="section-label">{CATEGORY_LABELS[category]}</h3>
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-green-600 dark:text-green-400">
                  {earnedHere}/{defs.length}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <p className="mt-1.5 mb-4 text-xs text-muted-foreground">{CATEGORY_BLURBS[category]}</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {visible.map((def, i) => {
                  const s = standings.get(def.id)!;
                  return (
                    <BadgeTile
                      key={def.id}
                      s={s}
                      index={i}
                      isNew={s.tier > 0 && isNew(def.id, s.tier)}
                      celebrate={struckNow(def.id)}
                      rarity={s.tier > 0 ? rarityLabel(overview.rarity[badgeKey(def.id, s.tier)]) : null}
                      onOpen={openBadge}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-12 text-xs leading-relaxed text-muted-foreground">
        Badges count your cards, auctions and results across every league, and update each time you open
        Pickbid. Weeks run Monday to Sunday, India time.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {selected && (
          <BadgeDetail
            s={selected}
            earnedAt={earnedAt}
            rarity={overview.rarity}
          />
        )}
      </Dialog>
    </div>
  );
}

// ── Streak ────────────────────────────────────────────────────────────────────

/** One of the streak badges under the calendar: its medal, next tier and where the run stands. */
function StreakGoal({ s, detail, onOpen }: { s: BadgeStanding; detail: string; onOpen: (id: string) => void }) {
  const next = s.nextTier ? tierName(s.def, s.nextTier) : '';
  return (
    <button
      type="button"
      onClick={() => onOpen(s.def.id)}
      aria-haspopup="dialog"
      className="medal-host flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 text-left transition-colors hover:border-orange-500/35 hover:bg-muted/40"
    >
      <BadgeMedal def={s.def} tier={s.tier} size={44} progress={s.nextTier ? s.progress : undefined} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {s.def.name}
          {next ? ` · ${next}` : ''}
        </span>
        <span className="block truncate text-xs text-muted-foreground tabular-nums">{detail}</span>
      </span>
    </button>
  );
}

function StreakPanel({
  weekly, pick, roll, hot, onOpen,
}: {
  weekly: WeeklyStreak;
  pick: PickStreak;
  roll: BadgeStanding;
  hot: BadgeStanding;
  onOpen: (id: string) => void;
}) {
  const activeWeeks = weekly.weeks.filter(Boolean).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-3 animate-rise-in">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-orange-500/10 blur-3xl"
      />

      <div className="relative flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-amber-400 to-orange-600 text-white shadow-[0_10px_24px_-10px_oklch(0.66_0.21_38/0.8)]">
          <Flame className="size-7" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className="text-4xl font-black leading-none tracking-tight tabular-nums text-foreground">{weekly.current}</span>
            <span className="text-sm font-bold text-muted-foreground">
              {weekly.current === 1 ? 'week' : 'weeks'} in a row
            </span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
              <Check className="size-3.5" />
              This week counted
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Longest {plural(weekly.longest, 'week')}</span>
          </p>
        </div>
      </div>

      <div className="relative mt-6">
        <div
          role="img"
          aria-label={`Active in ${activeWeeks} of the last ${weekly.weeks.length} weeks`}
          className="grid gap-0.75 sm:gap-1"
          style={{ gridTemplateColumns: `repeat(${weekly.weeks.length}, minmax(0, 1fr))` }}
        >
          {weekly.weeks.map((on, i) => (
            <span
              key={i}
              className="streak-cell"
              data-on={on || undefined}
              data-now={i === weekly.weeks.length - 1 || undefined}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10.5px] text-muted-foreground">
          <span>{weekly.weeks.length} weeks ago</span>
          <span>This week</span>
        </div>
      </div>

      <div className="relative mt-5 grid gap-2.5 sm:grid-cols-2">
        <StreakGoal
          s={roll}
          detail={
            roll.nextTier && roll.target !== null
              ? `${remainingLabel(roll.def, roll.value, roll.target)} to go`
              : 'Every tier earned'
          }
          onOpen={onOpen}
        />
        <StreakGoal
          s={hot}
          detail={
            pick.auctions === 0
              ? 'Get picked at your next auction'
              : `${plural(pick.current, 'auction')} in a row · best ${pick.longest}`
          }
          onOpen={onOpen}
        />
      </div>

      <p className="relative mt-4 text-xs text-muted-foreground">
        Open Pickbid any day of the week to keep the streak alive.
      </p>
    </div>
  );
}

// ── Collection ────────────────────────────────────────────────────────────────

function CollectionPanel({
  overview, badgesEarned, onOpen,
}: {
  overview: RewardsOverview;
  badgesEarned: number;
  onOpen: (id: string) => void;
}) {
  const total = BADGES.length;
  const share = total > 0 ? badgesEarned / total : 0;

  const tally = new Map<MedalTone, number>();
  for (const e of overview.earned) {
    const def = BADGE_BY_ID.get(e.badgeId);
    if (!def) continue;
    const tone = medalTone(def, e.tier);
    tally.set(tone, (tally.get(tone) ?? 0) + 1);
  }

  // The earned tier the fewest accounts hold — a brag line, so only counted tiers qualify
  let rarest: { def: BadgeDefinition; tier: number; share: number } | null = null;
  for (const e of overview.earned) {
    const def = BADGE_BY_ID.get(e.badgeId);
    const share = overview.rarity[badgeKey(e.badgeId, e.tier)];
    if (!def || share === undefined) continue;
    if (!rarest || share < rarest.share) rarest = { def, tier: e.tier, share };
  }

  const next = overview.next;
  const nextDef = next ? BADGE_BY_ID.get(next.badgeId) : undefined;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-2 animate-rise-in">
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0" role="img" aria-label={`${badgesEarned} of ${total} badges earned`}>
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-muted" />
            {share > 0 && (
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${Math.round(share * 100)} 100`}
                className="stroke-primary"
              />
            )}
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            <span className="text-lg font-black tabular-nums leading-none text-foreground">
              {badgesEarned}
              <span className="text-xs font-bold text-muted-foreground">/{total}</span>
            </span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Badges earned</p>
          <p className="text-xs text-muted-foreground">
            {plural(overview.earned.filter((e) => BADGE_BY_ID.has(e.badgeId)).length, 'tier')} struck so far
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
            {TALLY.map(({ tone, label }) => (
              <li key={tone} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="tier-pip" data-medal={tone} />
                <span className="font-semibold tabular-nums text-foreground">{tally.get(tone) ?? 0}</span>
                {label.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {rarest && (
        <button
          type="button"
          onClick={() => onOpen(rarest.def.id)}
          aria-haspopup="dialog"
          className="medal-host mt-5 flex w-full items-center gap-3 rounded-xl border border-border bg-background/40 p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
        >
          <BadgeMedal def={rarest.def} tier={rarest.tier} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              Your rarest
            </span>
            <span className="block truncate text-sm font-semibold text-foreground">
              {rarest.def.name}
              {tierName(rarest.def, rarest.tier) ? ` · ${tierName(rarest.def, rarest.tier)}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-right leading-tight">
            <span className="block text-sm font-black tabular-nums text-foreground">
              {rarest.share < 0.01 ? '<1%' : `${Math.round(rarest.share * 100)}%`}
            </span>
            <span className="block text-[10.5px] text-muted-foreground">of players</span>
          </span>
        </button>
      )}

      {next && nextDef && (
        <button
          type="button"
          onClick={() => onOpen(nextDef.id)}
          className="medal-host group mt-6 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/4 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/8 lg:mt-auto"
        >
          <BadgeMedal def={nextDef} tier={next.tier - 1} size={48} progress={next.value / next.target} />
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-black uppercase tracking-[0.12em] text-primary dark:text-green-400">
              Next up
            </span>
            <span className="block truncate text-sm font-bold text-foreground">
              {nextDef.name}
              {tierName(nextDef, next.tier) ? ` · ${tierName(nextDef, next.tier)}` : ''}
            </span>
            <span className="progress-track mt-1.5 block">
              <span
                className="progress-fill block"
                style={{ width: `${Math.round(Math.min(1, next.value / next.target) * 100)}%` }}
              />
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {nextDef.goal(next.target)} · {remainingLabel(nextDef, next.value, next.target)}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

function BadgeTile({
  s, index, isNew, celebrate, rarity, onOpen,
}: {
  s: BadgeStanding;
  index: number;
  isNew: boolean;
  celebrate: boolean;
  rarity: string | null;
  onOpen: (id: string) => void;
}) {
  const def = s.def;
  const tone = medalTone(def, s.tier);
  const locked = s.tier === 0;

  return (
    <li className="animate-fade-in-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <button
        type="button"
        onClick={() => onOpen(def.id)}
        aria-haspopup="dialog"
        className="medal-host relative flex h-full w-full flex-col items-center rounded-xl border border-border bg-card px-3 pb-4 pt-5 text-center transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_34px_-18px_oklch(0_0_0/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {isNew && (
          <span className="absolute right-2 top-2 rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary dark:text-green-400">
            New
          </span>
        )}
        <BadgeMedal
          def={def}
          tier={s.tier}
          size={76}
          progress={s.nextTier ? s.progress : undefined}
          celebrate={celebrate}
        />
        <span className={`mt-3 text-sm font-bold leading-tight ${locked ? 'text-foreground/75' : 'text-foreground'}`}>
          {def.name}
        </span>
        <span className={`mt-1 text-[10.5px] font-bold uppercase tracking-wider ${TONE_TEXT[tone]}`}>
          {statusText(s)}
        </span>
        <span className="mt-1.5 empty:hidden">
          <TierPips def={def} tier={s.tier} />
        </span>
        <span className="mt-2 text-xs leading-snug text-muted-foreground tabular-nums">{tileHint(s)}</span>
        {rarity && <span className="mt-1 text-[10.5px] text-muted-foreground/80">{rarity}</span>}
      </button>
    </li>
  );
}

function BadgeDetail({
  s, earnedAt, rarity,
}: {
  s: BadgeStanding;
  earnedAt: Map<string, string>;
  rarity: Record<string, number>;
}) {
  const def = s.def;
  return (
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
      <div className="medal-host flex flex-col items-center bg-linear-to-b from-muted/70 to-transparent px-6 pb-5 pt-8 text-center">
        <BadgeMedal def={def} tier={s.tier} size={112} progress={s.nextTier ? s.progress : undefined} />
        <DialogTitle className="mt-4 text-xl font-black tracking-tight">{def.name}</DialogTitle>
        <DialogDescription className="mt-1.5">
          {CATEGORY_LABELS[def.category]} badge · {statusText(s)}
        </DialogDescription>
      </div>

      <ol className="space-y-2 px-5 pb-5">
        {def.thresholds.map((threshold, i) => {
          const tier = i + 1;
          const at = earnedAt.get(badgeKey(def.id, tier));
          const isNext = !at && s.nextTier === tier && s.target !== null;
          const held = rarityLabel(rarity[badgeKey(def.id, tier)]);
          return (
            <li
              key={tier}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                at ? 'border-border bg-muted/40' : isNext ? 'border-dashed border-primary/35' : 'border-border/60'
              }`}
            >
              <BadgeMedal
                def={def}
                tier={at ? tier : 0}
                size={40}
                progress={isNext ? s.progress : undefined}
                ringTier={tier}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${at ? TONE_TEXT[medalTone(def, tier)] : 'text-foreground'}`}>
                  {tierName(def, tier) || def.name}
                </p>
                <p className="text-xs text-muted-foreground">{def.goal(threshold)}</p>
                {isNext && (
                  <>
                    <span className="progress-track mt-2 block">
                      <span className="progress-fill block" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {progressLabel(def, s.value, threshold)} · {remainingLabel(def, s.value, threshold)}
                    </p>
                  </>
                )}
                {held && <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">{held}</p>}
              </div>
              <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                {at ? (
                  <>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary dark:text-green-400">
                      <Check className="size-3.5" />
                      Earned
                    </span>
                    <span className="block tabular-nums">{formatDate(at)}</span>
                  </>
                ) : (
                  !isNext && <Lock className="size-4" aria-label="Locked" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </DialogContent>
  );
}
