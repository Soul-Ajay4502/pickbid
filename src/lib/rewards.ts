import { unstable_cache } from 'next/cache';
import { awardBadges, getBadgeRarity, getRewardMetrics, recordWeeklyActivity } from './store';
import {
  BADGES, badgeKey, countBounceBacks, countEarnedBadges, countFlyingStarts, countReturns, countWeeks,
  milestoneMetrics, monthRuns, nextGoal, qualifyingTiers, runLengths, weekFlags, type BadgeDefinition,
} from './badges';
import type { RewardMetrics, RewardsCheckIn, RewardsOverview } from './types';

/** Every tier of the matching badges that `metrics` reaches. */
function candidatesFor(metrics: RewardMetrics, include: (def: BadgeDefinition) => boolean) {
  return BADGES.filter(include).flatMap((def) =>
    qualifyingTiers(def, metrics[def.metric]).map((tier) => ({ badgeId: def.id, tier }))
  );
}

/**
 * Rewards are evaluated lazily, on the user's own requests — the check-in the
 * app shell sends and the `/rewards` page — never from the write paths that
 * change the numbers. A sale, a match result or a new card doesn't have to know
 * badges exist; the next evaluation counts it. Accounts that predate the
 * feature are backfilled the same way, on their first visit.
 *
 * Milestone badges count other badges, so they're awarded in a second pass over
 * what the first one left in the cabinet. That pass only touches the database
 * when a milestone tier is actually missing, so the usual cost stays at two
 * parallel queries (streak upsert, metrics) and one insert-and-list, all scoped
 * to one user by index.
 */
async function evaluateRewards(userId: string) {
  const [weekly, stored] = await Promise.all([
    recordWeeklyActivity(userId),
    getRewardMetrics(userId),
  ]);
  const picks = runLengths(stored.pickSequence);
  const wins = stored.winSequences.map(runLengths);
  const months = monthRuns(stored.months);
  const base: RewardMetrics = {
    ...stored.metrics,
    weeklyStreakLongest: weekly.longest,
    weeklyStreakCurrent: weekly.current,
    activeWeeks:         countWeeks(weekly.history),
    welcomeBacks:        countReturns(weekly.history),
    pickStreakLongest:   picks.longest,
    pickStreakCurrent:   picks.current,
    // Every auction entered was a pick — and stays 0 for good after a miss
    cleanPickRecord:     stored.pickSequence.includes('0') ? 0 : stored.pickSequence.length,
    winRunLongest:       Math.max(0, ...wins.map((w) => w.longest)),
    winRunCurrent:       Math.max(0, ...wins.map((w) => w.current)),
    bounceBacks:         countBounceBacks(stored.winSequences),
    flyingStarts:        countFlyingStarts(stored.winSequences),
    monthsPlayed:        new Set(stored.months).size,
    monthRunLongest:     months.longest,
    monthRunCurrent:     months.current,
    // Filled in by the milestone pass below
    badgeLevels: 0, goldMedals: 0, silverMedals: 0, bronzeMedals: 0, categoriesCovered: 0,
  };

  const first = await awardBadges(userId, candidatesFor(base, (d) => d.category !== 'milestone'));
  const metrics: RewardMetrics = { ...base, ...milestoneMetrics(first.earned) };

  const held = new Set(first.earned.map((e) => badgeKey(e.badgeId, e.tier)));
  const missing = candidatesFor(metrics, (d) => d.category === 'milestone')
    .filter((c) => !held.has(badgeKey(c.badgeId, c.tier)));
  const second = missing.length ? await awardBadges(userId, missing) : null;

  return {
    metrics,
    weekly,
    picks,
    auctions: stored.pickSequence.length,
    earned: second?.earned ?? first.earned,
    unlocked: [...first.unlocked, ...(second?.unlocked ?? [])],
  };
}

// Counting holders scans every award on the platform, and rarity drifting by an
// hour is invisible — so it's computed once an hour, not per page view.
const getCachedRarity = unstable_cache(getBadgeRarity, ['badge-rarity'], { revalidate: 3600 });

/**
 * POST /api/rewards/check-in. Counts this week towards the streak and awards
 * anything newly earned. `unlocked` is non-empty only on the one request that
 * actually inserted those tiers, so the toast fires once per badge.
 */
export async function checkInRewards(userId: string): Promise<RewardsCheckIn> {
  const ev = await evaluateRewards(userId);
  return {
    streak: { current: ev.weekly.current, longest: ev.weekly.longest },
    unlocked: ev.unlocked,
    badgesEarned: countEarnedBadges(ev.earned),
    next: nextGoal(ev.metrics, ev.earned),
  };
}

/**
 * The `/rewards` page payload. It evaluates too, so the page is never behind
 * the check-in — and whatever this evaluation unlocks, the page celebrates.
 * Rarity is decorative: if it fails the cabinet still renders, without it.
 */
export async function getRewardsOverview(userId: string): Promise<RewardsOverview> {
  const [ev, rarity] = await Promise.all([
    evaluateRewards(userId),
    getCachedRarity().catch((err) => {
      console.error('Badge rarity unavailable:', err);
      return {} as Record<string, number>;
    }),
  ]);
  return {
    metrics: ev.metrics,
    earned: ev.earned,
    justUnlocked: ev.unlocked.map((u) => badgeKey(u.badgeId, u.tier)),
    weekly: {
      current: ev.weekly.current,
      longest: ev.weekly.longest,
      weeks: weekFlags(ev.weekly.history),
    },
    pickStreak: { current: ev.picks.current, longest: ev.picks.longest, auctions: ev.auctions },
    next: nextGoal(ev.metrics, ev.earned),
    rarity,
    evaluatedAt: new Date().toISOString(),
  };
}
