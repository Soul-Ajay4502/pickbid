'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Search, ArrowRight, Globe, Lock, Users, Calendar, Hash } from 'lucide-react';
import type { League } from '@/lib/types';

export default function DiscoverPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  useEffect(() => {
    fetch('/api/leagues/public')
      .then(r => r.ok ? r.json() : [])
      .then(data => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoinCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    if (!session) { signIn('google'); return; }
    setJoiningCode(true);
    try {
      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Invalid code');
      toast.success(`Found: ${data.name}`);
      router.push(`/leagues/${data.leagueId}?open=true`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setJoiningCode(false);
    }
  }

  const filtered = leagues.filter(l =>
    !query || l.name.toLowerCase().includes(query.toLowerCase()) || l.conductedBy.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow-badge mb-4">
          <Globe className="w-3 h-3" />
          Public Leagues
        </div>
        <h1 className="text-2xl font-black text-gradient-green tracking-tight">Discover Leagues</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse public leagues or join one with a code.</p>
      </div>

      {/* Join by code */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Join by Code</p>
        </div>
        <form onSubmit={handleJoinCode} className="p-5 flex gap-3">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-character code (e.g. AB12CD)"
            maxLength={8}
            className="flex-1 h-11 px-4 rounded-xl border border-border bg-input text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
          />
          <button
            type="submit" disabled={joiningCode || code.length < 4}
            className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {joiningCode ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Join
          </button>
        </form>
      </div>

      {/* Search public leagues */}
      <div className="mb-5 flex items-center gap-3">
        <div className="section-label">Browse Public Leagues</div>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search leagues…"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3,4].map(n => <div key={n} className="h-32 rounded-2xl bg-muted shimmer" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{query ? 'No leagues match your search.' : 'No public leagues yet.'}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((league, i) => (
            <div
              key={league.id}
              className="group card-premium cursor-pointer animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => router.push(`/leagues/${league.id}?open=true`)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && router.push(`/leagues/${league.id}?open=true`)}
            >
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20 flex items-center justify-center text-sm font-black text-emerald-400 select-none">
                    {league.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{league.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">by {league.conductedBy}</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 dark:text-green-400 border border-green-500/15">
                    <Users className="w-3 h-3" />{league.totalPlayers}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                    <Globe className="w-3 h-3 text-primary/50" />
                    <span>Public</span>
                    {league.joinCode && (
                      <>
                        <span className="text-border">·</span>
                        <Lock className="w-3 h-3" />
                        <span className="font-mono tracking-widest text-muted-foreground/40">{league.joinCode}</span>
                      </>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/40 group-hover:text-primary transition-colors">
                    Join <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How to make your league public */}
      {session && (
        <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-5">
          <p className="text-sm font-semibold text-foreground mb-1.5">Want your league to appear here?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Open your league settings and enable <strong className="text-foreground">Public</strong>. A join code will be generated automatically that others can use to find and join your league.
          </p>
          <button onClick={() => router.push('/')} className="mt-3 text-xs text-primary hover:underline underline-offset-2">
            Go to My Leagues →
          </button>
        </div>
      )}
    </div>
  );
}
