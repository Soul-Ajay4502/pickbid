'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trophy, Crown, Medal, Star } from 'lucide-react';
import type { LeagueWithPlayers, Player } from '@/lib/types';

/** Most bids shown on the board (top 3 podium + the rest as a list). */
const MAX_RANKS = 20;

function fmt(n: number): string {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Ask Cloudinary for a small face-cropped square instead of the full upload. */
function thumb(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_300,h_300,c_fill,g_auto/');
  }
  return url;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

interface TeamMeta { name: string; color: string; }

/** Circular avatar — player photo over a team-colour initials fallback. */
function Avatar({ photo, name, color, size, ring }: { photo: string; name: string; color: string; size: number; ring: string }) {
  return (
    <div
      className="relative rounded-full overflow-hidden shrink-0"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 0 3px ${ring}, 0 10px 28px rgba(0,0,0,0.35)` }}
    >
      <span className="absolute inset-0 flex items-center justify-center font-black text-white/90" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </span>
      {photo && (
        <div className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${thumb(photo)})`, backgroundPosition: 'center top' }} />
      )}
    </div>
  );
}

const RANK = [
  { ring: '#f59e0b', ped: 'from-amber-400 to-yellow-600', text: 'text-amber-500', medal: Crown, av: 104, height: 88 },
  { ring: '#cbd5e1', ped: 'from-slate-300 to-slate-500', text: 'text-slate-400', medal: Medal, av: 84, height: 64 },
  { ring: '#cd7f32', ped: 'from-orange-400 to-amber-700', text: 'text-amber-600', medal: Medal, av: 84, height: 48 },
];
// 2nd | 1st | 3rd staircase on sm+, but natural rank order stacked on mobile
const ORDER = ['sm:order-2', 'sm:order-1', 'sm:order-3'];

function PodiumCard({ player, rank, meta }: { player: Player; rank: number; meta?: TeamMeta }) {
  const r = RANK[rank];
  const Medalish = r.medal;
  return (
    <div className={`flex flex-col items-center gap-3 flex-1 max-w-50 ${ORDER[rank]}`}>
      <div className="relative">
        <Avatar photo={player.photo} name={player.name} color={meta?.color ?? '#64748b'} size={r.av} ring={r.ring} />
        <div className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-lg">
          <Medalish className={r.text} style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <div className="text-center px-1">
        <p className="font-bold text-sm sm:text-base flex items-center justify-center gap-1 leading-tight">
          {player.isIcon && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
          <span className="truncate">{player.name}</span>
        </p>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5 truncate">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.color ?? '#64748b' }} />
          <span className="truncate">{meta?.name ?? '—'}</span>
        </p>
        <p className={`mt-1 font-black tabular-nums ${rank === 0 ? 'text-xl' : 'text-lg'} ${r.text}`}>{fmt(player.soldPrice ?? 0)}</p>
      </div>
      <div
        className={`w-full rounded-t-xl bg-linear-to-t ${r.ped} flex items-start justify-center pt-2 text-white font-black text-2xl tabular-nums shadow-inner`}
        style={{ height: r.height }}
      >
        {rank + 1}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeague = useCallback(async () => {
    const res = await fetch(`/api/leagues/${id}`);
    if (!res.ok) { router.push('/'); return; }
    setData(await res.json());
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);

  const board = useMemo(() => {
    if (!data) return null;
    const teams = data.teams ?? [];
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
    const meta = (teamId?: string | null): TeamMeta | undefined => {
      if (!teamId) return undefined;
      const t = teamById[teamId];
      return { name: t?.name ?? teamId, color: t?.colorHex ?? '#64748b' };
    };
    const bids = data.players
      .filter(p => p.teamId && (p.soldPrice ?? 0) > 0)
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, MAX_RANKS);
    return { bids, top: bids.slice(0, 3), rest: bids.slice(3), meta };
  }, [data]);

  if (loading || !data || !board) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-8 w-56 bg-muted rounded-lg mb-8 shimmer" />
        <div className="flex items-end justify-center gap-4 mb-8">
          {[64, 88, 56].map((h, i) => <div key={i} className="flex-1 max-w-45 h-40 bg-muted rounded-xl shimmer" style={{ marginBottom: h - 56 }} />)}
        </div>
        <div className="space-y-2.5">{[1, 2, 3, 4, 5].map(n => <div key={n} className="h-12 rounded-xl bg-muted shimmer" />)}</div>
      </div>
    );
  }

  const { top, rest, bids } = board;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <button onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />Back to League
        </button>
        <h1 className="text-2xl sm:text-3xl font-black text-gradient-green tracking-tight flex items-center gap-2.5">
          <Trophy className="w-6 h-6 text-amber-500" />Bid Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{data.name} · Highest winning bids of the auction</p>
      </div>

      {bids.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground animate-fade-in-up">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bids yet — the leaderboard fills up as players are sold in the auction.</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 mb-6 animate-fade-in-up overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-end justify-center gap-5 sm:gap-4">
              {top.map((p, i) => (
                <PodiumCard key={p.id} player={p} rank={i} meta={board.meta(p.teamId)} />
              ))}
            </div>
          </div>

          {/* Ranks 4–20 */}
          {rest.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.06s' }}>
              <div className="px-5 py-3.5 border-b border-border bg-muted/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More Top Bids</p>
              </div>
              <ol className="divide-y divide-border/60">
                {rest.map((p, i) => {
                  const m = board.meta(p.teamId);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                      <span className="w-6 text-center text-sm font-bold tabular-nums text-muted-foreground/60 shrink-0">{i + 4}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                          {p.isIcon && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m?.color ?? '#64748b' }} />
                          <span className="truncate">{m?.name ?? '—'}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400 shrink-0">{fmt(p.soldPrice ?? 0)}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
