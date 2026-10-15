import type { RewardsCheckIn } from '@/lib/types';

/**
 * The app shell's copy of the signed-in user's rewards summary — streak, badge
 * count, next goal. `RewardsWatcher` fills it from the check-in; the nav chip
 * and the dashboard strip read it through `useSyncExternalStore`, so neither
 * makes a request of its own.
 *
 * Kept per tab in sessionStorage (keyed by account) so a reload repaints the
 * chip at once and the throttle survives it, without sharing state between
 * accounts that take turns on one browser.
 */

export interface RewardsState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: RewardsCheckIn | null;
}

interface StoredCheckIn {
  userId: string;
  at: number;
  data: RewardsCheckIn;
}

const STORAGE_KEY = 'pickbid:rewards';
/** One check-in per tab per this long, unless something forces one sooner. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const SERVER_STATE: RewardsState = { status: 'idle', data: null };

let state: RewardsState = SERVER_STATE;
let boundUserId: string | null = null;
let lastCheckAt = 0;
let inFlight = false;
let forceQueued = false;
const listeners = new Set<() => void>();

function emit(next: RewardsState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeRewards(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRewardsState(): RewardsState {
  return state;
}

/** Nothing on the server: the summary only exists once the browser has checked in. */
export function getServerRewardsState(): RewardsState {
  return SERVER_STATE;
}

function readStored(): StoredCheckIn | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredCheckIn) : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredCheckIn) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked — the next reload just checks in again
  }
}

/**
 * Point the store at the signed-in account, restoring this tab's last check-in
 * for it. A different account than last time starts from nothing, so one
 * person's streak never flashes up in another's header.
 */
export function bindRewardsUser(userId: string) {
  if (boundUserId === userId) return;
  boundUserId = userId;
  const stored = readStored();
  if (stored?.userId === userId && stored.data) {
    lastCheckAt = stored.at;
    emit({ status: 'ready', data: stored.data });
  } else {
    lastCheckAt = 0;
    emit({ status: 'idle', data: null });
  }
}

/**
 * Check in unless this tab already did within `CHECK_INTERVAL_MS`. `force`
 * skips the wait; one arriving mid-request is queued rather than dropped, so
 * the action that asked for it is always counted.
 */
export function checkInRewards(force = false) {
  const userId = boundUserId;
  if (!userId) return;
  if (inFlight) {
    if (force) forceQueued = true;
    return;
  }
  if (!force && Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;

  inFlight = true;
  if (!state.data) emit({ status: 'loading', data: null });

  fetch('/api/rewards/check-in', { method: 'POST' })
    .then((res) => (res.ok ? (res.json() as Promise<RewardsCheckIn>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => {
      if (boundUserId !== userId) return; // signed out or switched mid-request
      lastCheckAt = Date.now();
      // Unlocks are a one-time event — never replay them from storage
      writeStored({ userId, at: lastCheckAt, data: { ...data, unlocked: [] } });
      emit({ status: 'ready', data });
      if (data.unlocked.length > 0) {
        // The toast and the medal art load only when there's something to show
        import('./unlockToast')
          .then((m) => m.showUnlockToast(data.unlocked))
          .catch(() => {});
      }
    })
    .catch(() => {
      // Back off for a full interval rather than retrying on every navigation
      lastCheckAt = Date.now();
      if (!state.data) emit({ status: 'error', data: null });
    })
    .finally(() => {
      inFlight = false;
      if (forceQueued) {
        forceQueued = false;
        checkInRewards(true);
      }
    });
}

/**
 * Seed the store from a payload the server just evaluated — the `/rewards`
 * page does this so the chip and strip agree with the cabinet, and so the
 * watcher doesn't immediately send a check-in the page has made redundant.
 * Call it from a layout effect: those run before the watcher's passive ones.
 */
export function primeRewards(userId: string, data: RewardsCheckIn) {
  bindRewardsUser(userId);
  lastCheckAt = Date.now();
  writeStored({ userId, at: lastCheckAt, data: { ...data, unlocked: [] } });
  emit({ status: 'ready', data });
}

/**
 * Check in now. Call it after an action that may have unlocked a badge — a
 * card made, a league created — so the toast lands on the next screen instead
 * of minutes later.
 */
export function requestRewardsCheck() {
  checkInRewards(true);
}
