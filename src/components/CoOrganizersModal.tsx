'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { CoOrganizer } from '@/lib/types';

interface UserResult {
  id: string;
  name: string;
  email: string;
  photo: string;
}

function Avatar({ name, email, photo }: { name: string; email: string | null; photo: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />;
  }
  const initial = (name || email || '?').slice(0, 1).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

/**
 * Creator-only management of a league's co-organizers: search existing
 * PickBid accounts by name/email/phone, add them, and remove current ones.
 * Removal takes effect on the removed user's very next request — every
 * management endpoint re-checks the co-organizer table per call.
 */
export default function CoOrganizersModal({ leagueId, onClose }: {
  leagueId: string;
  /** `changed` is true when anyone was added or removed, so the parent can refetch */
  onClose: (changed: boolean) => void;
}) {
  const [list, setList] = useState<CoOrganizer[] | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  // The query the current `results` answer — "searching" is derived from the
  // gap between it and what's typed, so the effect never sets state directly
  const [searchedFor, setSearchedFor] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const changed = useRef(false);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length >= 2 && trimmedQuery !== searchedFor;

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/co-organizers`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CoOrganizer[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]));
  }, [leagueId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const handle = setTimeout(() => {
      fetch(`/api/leagues/${leagueId}/users/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: UserResult[]) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setSearchedFor(q));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, leagueId]);

  async function handleAdd(user: UserResult) {
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/co-organizers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to add co-organizer');
      changed.current = true;
      setList((prev) => [...(prev ?? []), json as CoOrganizer]);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`${user.name || user.email} is now a co-organizer`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add co-organizer');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRemove(co: CoOrganizer) {
    if (!confirm(`Remove ${co.name || co.email} as co-organizer? They lose auction and league management access immediately.`)) return;
    setBusyUserId(co.userId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/co-organizers/${co.userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? 'Failed to remove co-organizer');
      }
      changed.current = true;
      setList((prev) => (prev ?? []).filter((c) => c.userId !== co.userId));
      toast.success(`${co.name || co.email} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove co-organizer');
    } finally {
      setBusyUserId(null);
    }
  }

  const close = () => onClose(changed.current);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-popover border border-foreground/12 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4.5 h-4.5 text-violet-500 shrink-0" />
            <h3 className="font-bold text-lg text-foreground truncate">Co-Organizers</h3>
          </div>
          <button onClick={close} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Co-organizers can run the auction and manage players, teams and settings —
            everything except deleting the league or changing this list.
          </p>

          {/* Search existing accounts */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {trimmedQuery.length >= 2 && (
            <div className="rounded-xl border border-border overflow-hidden">
              {searching ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
              ) : results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No matching accounts — they need to sign in to PickBid once first.
                </p>
              ) : (
                results.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                    <Avatar name={user.name} email={user.email} photo={user.photo} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{user.name || user.email}</span>
                      {user.name && <span className="block text-xs text-muted-foreground truncate">{user.email}</span>}
                    </span>
                    <button
                      onClick={() => handleAdd(user)}
                      disabled={busyUserId === user.id}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25 hover:bg-violet-500/20 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {busyUserId === user.id
                        ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : <UserPlus className="w-3.5 h-3.5" />}
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Current co-organizers */}
          <div>
            <p className="text-[10px] uppercase tracking-[2.5px] text-foreground/35 font-bold mb-2">
              Current co-organizers{list ? ` · ${list.length}` : ''}
            </p>
            {list === null ? (
              <p className="text-sm text-muted-foreground py-2">Loading…</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                None yet — search above to add a trusted helper.
              </p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {list.map((co) => (
                  <div key={co.userId} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                    <Avatar name={co.name} email={co.email} photo={co.photo} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{co.name || co.email}</span>
                      {co.name && co.email && <span className="block text-xs text-muted-foreground truncate">{co.email}</span>}
                    </span>
                    <button
                      onClick={() => handleRemove(co)}
                      disabled={busyUserId === co.userId}
                      title="Remove co-organizer"
                      aria-label={`Remove ${co.name || co.email} as co-organizer`}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {busyUserId === co.userId
                        ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
