'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { generateToken, cloudinaryImage } from '@/lib/utils';
import type { LeagueUserCandidate } from '@/lib/types';

function Avatar({ name, photo }: { name: string; photo: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cloudinaryImage(photo, { w: 96, h: 96 })} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
      {(name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

/**
 * Organizer-only: search existing PickBid accounts and add one to this league
 * as a player, in a click.
 *
 * The sibling picker on the Add Player page searches the organizer's *own past
 * cards* and prefills a form with one. This searches the `users` table instead
 * and skips the form entirely — the account already carries the cricket
 * profile its owner maintains, so there is nothing to retype. The new card is
 * linked to that account (the POST resolves an existing email to its existing
 * user), which is what puts the card on their profile and lets them claim
 * their certificate later.
 *
 * Adding on someone's behalf is deliberately exempt from the league's ID and
 * receipt requirements, exactly like the Add Player form — the identity
 * register shows the gaps so the organizer can chase them.
 */
export default function AddPlayerFromAccountModal({ leagueId, onClose }: {
  leagueId: string;
  /** `changed` is true when at least one player was added, so the parent can refetch */
  onClose: (changed: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LeagueUserCandidate[]>([]);
  // The query the current `results` answer — "searching" is derived from the
  // gap between it and what's typed, so the effect never sets state directly
  const [searchedFor, setSearchedFor] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length >= 2 && trimmedQuery !== searchedFor;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const handle = setTimeout(() => {
      fetch(`/api/leagues/${leagueId}/players/candidates?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: LeagueUserCandidate[]) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setSearchedFor(q));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, leagueId]);

  async function handleAdd(user: LeagueUserCandidate) {
    setBusyUserId(user.userId);
    const creatorToken = generateToken();
    try {
      const res = await fetch(`/api/leagues/${leagueId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          photo: user.photo,
          battingType: user.battingType,
          bowlingType: user.bowlingType,
          role: user.role,
          isWicketKeeper: user.isWicketKeeper,
          contactNumber: user.contactNumber ?? null,
          creatorToken,
          // Links the new card to the account just picked rather than to the
          // organizer adding it: the API resolves an existing email to its
          // existing user, so no second account is minted.
          email: user.email,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to add player');
      // The same token handshake the Add Player form does — it is what lets
      // whoever added the card edit or remove it from this browser.
      localStorage.setItem(`creator_player_${json.id}`, creatorToken);
      setAddedCount((c) => c + 1);
      setResults((prev) => prev.filter((u) => u.userId !== user.userId));
      toast.success(`${user.name} added to the league`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setBusyUserId(null);
    }
  }

  const close = () => onClose(addedCount > 0);

  // Portalled to the body for the same reason CoOrganizersModal is: this opens
  // from the league sidebar, whose rail is `position: sticky` and therefore a
  // stacking context of its own — a plain `fixed` overlay would resolve its
  // z-index inside the rail and paint under the player cards.
  //
  // Never server-rendered — it only mounts on a click — so there is no SSR
  // pass for this guard to mismatch against.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-popover border border-foreground/12 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4.5 h-4.5 text-green-500 shrink-0" />
            <h3 className="font-bold text-lg text-foreground truncate">Add from Accounts</h3>
            {addedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shrink-0">
                {addedCount} added
              </span>
            )}
          </div>
          <button onClick={close} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Search people who already have a PickBid account and add them straight to this
            league — their card is built from their cricket profile, so there is nothing to
            type. Anyone already on the roster is left out.
          </p>

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
                  No matching accounts — they need to sign in to PickBid once first, or you can
                  add their card by hand from Add Player.
                </p>
              ) : (
                results.map((user) => (
                  <div key={user.userId} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                    <Avatar name={user.name} photo={user.photo} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{user.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">{user.email}</span>
                      <span className="block text-[11px] text-muted-foreground/80 truncate">
                        {user.role}{user.isWicketKeeper ? ' · WK' : ''}
                      </span>
                    </span>
                    <button
                      onClick={() => handleAdd(user)}
                      disabled={busyUserId === user.userId}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/25 hover:bg-green-500/20 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {busyUserId === user.userId
                        ? <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : <UserPlus className="w-3.5 h-3.5" />}
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
