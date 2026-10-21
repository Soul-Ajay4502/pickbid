'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { replay, tryReplay, type MatchSetup, type MatchState, type ScoringEvent } from '@/lib/scoring';
import type { MatchScorecard } from '@/lib/types';

/**
 * The scorer's copy of the log, and the job of getting it to the server.
 *
 * Scoring is local-first: a tap is replayed and drawn at once, and the sync
 * catches up behind it. A ground's 4G drops for minutes at a time, so balls
 * recorded offline queue up (and survive a reload — they're kept in
 * localStorage until the server has them) and go in one request once the
 * connection is back.
 *
 * Every write names the version it was built on. A conflict means one of two
 * things: our previous write landed but its reply was lost (the server's log
 * is then a prefix of ours, so we rebase silently), or someone else scored on
 * another phone (we adopt their log and say so).
 */
export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';

interface Synced {
  version: number;
  events: ScoringEvent[];
}

function storageKey(matchId: string) {
  return `pickbid_scoring_${matchId}`;
}

/** Leading events two logs share, by id. */
function commonPrefix(a: readonly ScoringEvent[], b: readonly ScoringEvent[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i].id === b[i].id) i++;
  return i;
}

function isPrefix(prefix: readonly ScoringEvent[], of: readonly ScoringEvent[]): boolean {
  return prefix.length <= of.length && commonPrefix(prefix, of) === prefix.length;
}

function loadPending(matchId: string, server: Synced): ScoringEvent[] | null {
  try {
    const raw = localStorage.getItem(storageKey(matchId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { baseVersion: number; events: ScoringEvent[] };
    // Only if nothing has changed on the server since, and it still extends it
    if (saved.baseVersion !== server.version || !isPrefix(server.events, saved.events)) return null;
    return saved.events.length > server.events.length ? saved.events : null;
  } catch {
    return null;
  }
}

function savePending(matchId: string, baseVersion: number, events: ScoringEvent[] | null) {
  try {
    if (events) localStorage.setItem(storageKey(matchId), JSON.stringify({ baseVersion, events }));
    else localStorage.removeItem(storageKey(matchId));
  } catch { /* private mode — the queue lives in memory only */ }
}

export function useScorecardSync(leagueId: string, initial: MatchScorecard) {
  const matchId = initial.matchId;
  const url = `/api/leagues/${leagueId}/matches/${matchId}/score`;
  const setup: MatchSetup = initial.setup;

  const syncedRef = useRef<Synced>({ version: initial.version, events: initial.events });
  // Mirrors the ref for rendering: the ref is what the sync loop reads
  // mid-flight, this is what the pending count is drawn from.
  const [syncedEvents, setSyncedEvents] = useState<ScoringEvent[]>(initial.events);
  const [syncedVersion, setSyncedVersion] = useState(initial.version);
  const [events, setEventsState] = useState<ScoringEvent[]>(initial.events);
  const eventsRef = useRef(events);
  const [status, setStatus] = useState<SyncStatus>('saved');
  const [errorText, setErrorText] = useState<string | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  // The loop reschedules itself (retries, and writes recorded mid-flight);
  // through a ref, so the callback never has to name itself.
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const setEvents = useCallback((next: ScoringEvent[]) => {
    eventsRef.current = next;
    setEventsState(next);
  }, []);

  const setSynced = useCallback((next: Synced) => {
    syncedRef.current = next;
    setSyncedEvents(next.events);
    setSyncedVersion(next.version);
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current || stopped.current) return;
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    const local = eventsRef.current;
    const synced = syncedRef.current;
    const keep = commonPrefix(synced.events, local);
    if (keep === synced.events.length && keep === local.length) {
      setStatus('saved');
      savePending(matchId, synced.version, null);
      return;
    }
    savePending(matchId, synced.version, local);
    inFlight.current = true;
    setStatus('saving');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersion: synced.version, keep, append: local.slice(keep) }),
      });
      if (res.ok) {
        const { version } = (await res.json()) as { version: number };
        setSynced({ version, events: local });
        attempt.current = 0;
        setErrorText(null);
      } else if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as { scorecard?: MatchScorecard | null } | null;
        const current = body?.scorecard;
        if (!current) {
          stopped.current = true;
          setStatus('error');
          setErrorText('This scorecard was deleted on another device');
          return;
        }
        setSynced({ version: current.version, events: current.events });
        if (!isPrefix(current.events, eventsRef.current)) {
          // Someone else moved the score on — theirs wins, ours can't merge
          setEvents(current.events);
          toast.warning('The score was updated on another device — showing the latest');
        }
      } else if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        // The engine here allowed it but the server's didn't: fall back to
        // what the server has, rather than queueing a write that can't land
        setEvents(synced.events);
        toast.error(body?.error ?? 'The server refused that ball');
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        stopped.current = true;
        setStatus('error');
        setErrorText(
          res.status === 401 ? 'Signed out — sign in again to keep scoring'
            : res.status === 403 ? 'You can no longer score this match'
              : 'This scorecard no longer exists',
        );
        return;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      attempt.current++;
      setStatus('offline');
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt.current, 4));
      retryTimer.current = setTimeout(() => { void flushRef.current(); }, delay);
      return;
    } finally {
      inFlight.current = false;
    }
    // More may have been recorded while that request was out
    const after = eventsRef.current;
    const s = syncedRef.current;
    if (commonPrefix(s.events, after) !== after.length || after.length !== s.events.length) void flushRef.current();
    else {
      setStatus('saved');
      savePending(matchId, s.version, null);
    }
  }, [url, matchId, setEvents, setSynced]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  // Restore balls recorded offline before a reload — after hydration, since
  // localStorage only exists in the browser.
  useEffect(() => {
    const pending = loadPending(matchId, syncedRef.current);
    if (pending && tryReplay(setup, pending).ok) {
      setEvents(pending);
      toast.info(`Restored ${pending.length - syncedRef.current.events.length} unsaved event(s) from this device`);
    }
  }, [matchId, setup, setEvents]);

  useEffect(() => { void flush(); }, [events, flush]);

  useEffect(() => {
    const retry = () => { attempt.current = 0; void flush(); };
    window.addEventListener('online', retry);
    const onVisible = () => { if (document.visibilityState === 'visible') retry(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [flush]);

  // Closing the tab with balls still queued: they're in localStorage, but say so
  useEffect(() => {
    if (status === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  // Every event here passed the engine when it was recorded; a log that no
  // longer replays in full (stored under different rules by an older build)
  // shows up to the last event that does, rather than taking the console down.
  const state: MatchState = useMemo(() => {
    const r = tryReplay(setup, events);
    return r.ok ? r.state : replay(setup, events.slice(0, Math.max(0, r.eventIndex)));
  }, [setup, events]);

  /** Records one event if the laws allow it; returns the error otherwise. */
  const record = useCallback((event: ScoringEvent): string | null => {
    const next = [...eventsRef.current, event];
    const check = tryReplay(setup, next);
    if (!check.ok) return check.error;
    setEvents(next);
    try { navigator.vibrate?.(12); } catch { /* unsupported */ }
    return null;
  }, [setup, setEvents]);

  /**
   * Swaps one event for a corrected one and replays everything after it.
   * The replacement must carry a fresh id — the sync diffs logs by id, so a
   * reused one would look unchanged and never reach the server.
   */
  const replace = useCallback((id: string, next: ScoringEvent): string | null => {
    const current = eventsRef.current;
    const i = current.findIndex((e) => e.id === id);
    if (i < 0) return 'That event is no longer in the log';
    const updated = [...current.slice(0, i), next, ...current.slice(i + 1)];
    const check = tryReplay(setup, updated);
    if (!check.ok) {
      return check.eventIndex > i ? `That change doesn't fit what happened later: ${check.error}` : check.error;
    }
    setEvents(updated);
    return null;
  }, [setup, setEvents]);

  const undo = useCallback((): ScoringEvent | null => {
    const current = eventsRef.current;
    if (current.length === 0) return null;
    setEvents(current.slice(0, -1));
    return current[current.length - 1];
  }, [setEvents]);

  const pending = Math.max(0, events.length - commonPrefix(syncedEvents, events));

  return { setup, events, state, record, undo, replace, status, errorText, pending, version: syncedVersion, retry: flush };
}

/** A fresh id for a new event. */
export function eventId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
