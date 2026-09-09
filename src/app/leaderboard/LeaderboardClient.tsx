'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, Crown, Medal, Star, Globe, ArrowUpRight } from 'lucide-react';
import type { TopBid } from '@/lib/types';

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * Share of the team's purse, as a percentage. One decimal keeps the ranking
 * legible when the top few buys land within a fraction of a point of each
 * other; anything under 0.1% shows as `<0.1%` rather than a flat `0.0%`.
 */
function pct(share: number): string {
  const p = share * 100;
  if (p > 0 && p < 0.1) return '<0.1%';
  return `${p.toFixed(1)}%`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tick a number up from 0 to `target` once it becomes active. Skipped entirely
 * for users who ask for reduced motion — they get the final value immediately.
 */
function useCountUp(target: number, active: boolean, duration = 900, delay = 0): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const reduced = prefersReducedMotion();
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (reduced) { setVal(target); return; }
      if (!start) start = t;
      const elapsed = t - start - delay;
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration, delay]);
  return val;
}

/** The ranked figure ticks up on reveal; the rupee footnote stays static. */
function Share({ value, active, className, delay }: { value: number; active: boolean; className?: string; delay?: number }) {
  const n = useCountUp(value, active, 900, delay);
  return <span className={`tabular-nums ${className ?? ''}`}>{pct(n)}</span>;
}

/** Ask Cloudinary for a small face-cropped square instead of the full upload. */
function thumb(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_300,h_300,c_fill,g_auto/');
  }
  return url;
}

// Organizers often bake serial numbers and phone numbers into the name they
// type — "111.Amal Kannan (6282148147)". Display-only cleanup; the stored name
// is left exactly as the player entered it.
const NAME_JUNK = /[^\p{L}\s'’-]+/gu;                        // digits, dots, brackets, …
const DANGLING  = /(?<!\p{L})['’-]+|['’-]+(?!\p{L})/gu;      // punctuation not joining two letters

/** Strip everything but letters, keeping the hyphens and apostrophes real names use. */
function cleanName(name: string): string {
  const cleaned = name.replace(NAME_JUNK, ' ').replace(DANGLING, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || name; // a name written entirely in digits keeps its raw form
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

/** Circular avatar — player photo over a team-colour initials fallback. */
function Avatar({ photo, name, color, size, ring }: { photo: string; name: string; color: string; size: number; ring: string }) {
  return (
    <div
      className="relative rounded-full overflow-hidden shrink-0 transition-transform duration-300 group-hover:scale-105"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 0 3px ${ring}, 0 10px 28px rgba(0,0,0,0.35)` }}
    >
      <span className="absolute inset-0 flex items-center justify-center font-black text-white/90" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </span>
      {photo && (
        <Image
          src={thumb(photo)}
          alt={`${name} — cricket player photo`}
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
        />
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

function PodiumCard({ bid, rank, mounted }: { bid: TopBid; rank: number; mounted: boolean }) {
  const r = RANK[rank];
  const Medalish = r.medal;
  const isLeader = rank === 0;
  const name = cleanName(bid.playerName);
  // Reveal 1st, then 2nd, then 3rd — the winner lands first and holds the eye.
  const delay = rank * 0.12;
  return (
    <Link
      href={`/leagues/${bid.leagueId}/leaderboard`}
      className={`flex flex-col items-center gap-3 flex-1 mx-auto max-w-50 group animate-scale-in transition-transform duration-300 hover:-translate-y-1.5 ${ORDER[rank]}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="relative">
        {/* Gold halo that breathes behind the champion */}
        {isLeader && (
          <div
            className="absolute -inset-3 rounded-full blur-xl animate-glow-pulse pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.55), transparent 70%)' }}
            aria-hidden="true"
          />
        )}
        <div className={`relative ${isLeader ? 'animate-float' : ''}`}>
          <Avatar photo={bid.photo} name={name} color={bid.teamColor} size={r.av} ring={r.ring} />
          <div className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-lg">
            <Medalish className={`${r.text} ${isLeader ? 'animate-trophy' : ''}`} style={{ width: 18, height: 18 }} />
          </div>
        </div>
      </div>
      <div className="text-center px-1">
        <p className="font-bold text-sm sm:text-base flex items-center justify-center gap-1 leading-tight group-hover:text-primary transition-colors">
          {bid.isIcon && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
          <span className="truncate">{name}</span>
        </p>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5 truncate">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bid.teamColor }} />
          <span className="truncate">{bid.teamName}</span>
        </p>
        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{bid.leagueName}</p>
        <Share
          value={bid.purseShare}
          active={mounted}
          delay={delay * 1000}
          className={`block mt-1 font-black ${isLeader ? 'text-xl text-gradient-gold' : `text-lg ${r.text}`}`}
        />
        <p className="text-[11px] text-muted-foreground/70 tabular-nums leading-tight">
          {fmt(bid.soldPrice)} <span className="text-muted-foreground/50">of {fmt(bid.teamBudget)}</span>
        </p>
      </div>
      {/* Pedestal rises from nothing on mount */}
      <div
        className={`w-full rounded-b-xl md:rounded-t-xl bg-linear-to-t ${r.ped} flex items-start justify-center pt-2 text-white font-black text-2xl tabular-nums shadow-inner overflow-hidden transition-[height] duration-700 ease-out`}
        style={{ height: mounted ? r.height : 0, transitionDelay: `${delay + 0.15}s` }}
      >
        {rank + 1}
      </div>
    </Link>
  );
}

export default function LeaderboardClient({ initialBids }: { initialBids: TopBid[] }) {
  // Drives the entrance animations — flipped on one frame after hydration so
  // the height/count-up transitions run from their zero state.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { top, rest } = useMemo(
    () => ({ top: initialBids.slice(0, 3), rest: initialBids.slice(3) }),
    [initialBids],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="eyebrow-badge mb-4 animate-badge-pop border-none!">
          <Globe className="w-3 h-3" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gradient-green tracking-tight flex items-center gap-2.5">
          <Trophy className="w-6 h-6 text-amber-500 animate-trophy" />Global Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          The top 20 buys across every league on Pickbid, ranked by{' '}
          <span className="font-semibold text-foreground/80">share of the team&apos;s purse</span> — so a
          ₹50,000 league and a ₹5 crore league compare fairly.
        </p>
      </div>

      {initialBids.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground animate-fade-in-up">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bids yet — the leaderboard fills up as players are sold in auctions.</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 mb-6 animate-fade-in-up overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-end justify-center gap-5 sm:gap-4">
              {top.map((b, i) => (
                <PodiumCard key={b.playerId} bid={b} rank={i} mounted={revealed} />
              ))}
            </div>
          </div>

          {/* Ranks 4–20 */}
          {rest.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.06s' }}>
              <div className="px-5 py-3.5 border-b border-border bg-muted/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More Top Buys</p>
              </div>
              <ol className="divide-y divide-border/60">
                {rest.map((b, i) => (
                  <li
                    key={b.playerId}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${0.35 + i * 0.045}s` }}
                  >
                    <Link href={`/leagues/${b.leagueId}/leaderboard`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group">
                      <span className="w-6 text-center text-sm font-bold tabular-nums text-muted-foreground/60 shrink-0 transition-colors group-hover:text-primary">{i + 4}</span>
                      <div className="flex-1 min-w-0 transition-transform duration-200 group-hover:translate-x-0.5">
                        <p className="font-semibold text-sm truncate flex items-center gap-1.5 group-hover:text-primary transition-colors">
                          {b.isIcon && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                          {cleanName(b.playerName)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.teamColor }} />
                          <span className="truncate">{b.teamName}</span>
                          <span className="text-border">·</span>
                          <span className="truncate text-muted-foreground/60">{b.leagueName}</span>
                        </p>
                      </div>
                      <span className="text-right shrink-0 leading-tight">
                        <Share value={b.purseShare} active={revealed} delay={350 + i * 45} className="block text-sm font-bold text-green-600 dark:text-green-400" />
                        <span className="block text-[11px] text-muted-foreground/60 tabular-nums">{fmt(b.soldPrice)}</span>
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
