'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, UserCheck } from 'lucide-react';
import type { Player } from '@/lib/types';

interface PlayerSearchPickerProps {
  leagueId: string;
  onSelect: (player: Player) => void;
}

/** Lets the league creator search their own player history (other leagues they
 * run) and select a recurring player instead of retyping their details. */
export default function PlayerSearchPicker({ leagueId, onSelect }: PlayerSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/leagues/${leagueId}/players/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: Player[]) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, leagueId]);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(player: Player) {
    onSelect(player);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search a player you've added before…"
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches — add them manually below.</p>
          ) : (
            results.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => handleSelect(player)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border last:border-b-0"
              >
                {player.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
                    {player.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">{player.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {player.role}{player.isWicketKeeper ? ' · WK' : ''}
                  </span>
                </span>
                <UserCheck className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
