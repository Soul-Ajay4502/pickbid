'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Users, Calendar, ArrowRight, Trophy, Star, Zap, Plus } from 'lucide-react';
import type { League } from '@/lib/types';

interface LeagueSections {
  created: League[];
  joined: League[];
}

// ── Colour palette for league initials avatars ────────────────────────────────
const AVATAR_PALETTES = [
  { bg: 'from-emerald-500/20 to-green-600/20', border: 'border-emerald-500/25', text: 'text-emerald-400' },
  { bg: 'from-blue-500/20 to-indigo-600/20', border: 'border-blue-500/25', text: 'text-blue-400' },
  { bg: 'from-violet-500/20 to-purple-600/20', border: 'border-violet-500/25', text: 'text-violet-400' },
  { bg: 'from-orange-500/20 to-amber-600/20', border: 'border-orange-500/25', text: 'text-orange-400' },
  { bg: 'from-rose-500/20 to-pink-600/20', border: 'border-rose-500/25', text: 'text-rose-400' },
  { bg: 'from-cyan-500/20 to-teal-600/20', border: 'border-cyan-500/25', text: 'text-cyan-400' },
];

function palette(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function LeagueCard({ league, index }: { league: League; index: number }) {
  const router = useRouter();
  const pal = palette(league.name);

  return (
    <div
      className="group card-premium cursor-pointer animate-fade-in-up"
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={() => router.push(`/leagues/${league.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/leagues/${league.id}`)}
    >
      <div className="p-5">
        {/* Header row: avatar + name + player count */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`shrink-0 w-11 h-11 rounded-xl bg-linear-to-br ${pal.bg} border ${pal.border} flex items-center justify-center text-sm font-black ${pal.text} select-none`}
          >
            {league.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-bold text-[15px] leading-snug text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-2">
              {league.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              by {league.conductedBy}
            </p>
          </div>
          <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-linear-to-br ${pal.bg} ${pal.text} border ${pal.border}`}>
            <Users className="w-3 h-3" />
            {league.totalPlayers}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-border/50">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Calendar className="w-3 h-3" />
            {new Date(league.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground/50 group-hover:text-primary transition-colors duration-200">
            Open <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shimmer">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-muted rounded-md w-3/4" />
          <div className="h-3 bg-muted rounded-md w-1/2" />
        </div>
      </div>
      <div className="h-px bg-muted" />
      <div className="h-3 bg-muted rounded-md w-1/3" />
    </div>
  );
}

function SectionHeader({ label, count, accent = 'green' }: { label: string; count: number; accent?: 'green' | 'blue' }) {
  const countCls = accent === 'green'
    ? 'bg-green-500/10 text-green-500 border-green-500/20 dark:text-green-400'
    : 'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:text-blue-400';

  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="section-label">{label}</div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${countCls}`}>
        {count}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [sections, setSections] = useState<LeagueSections>({ created: [], joined: [] });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    fetch('/api/leagues')
      .then((r) => (r.ok ? r.json() : { created: [], joined: [] }))
      .then((data) => setSections({
        created: Array.isArray(data.created) ? data.created : [],
        joined: Array.isArray(data.joined) ? data.joined : [],
      }))
      .catch(() => setSections({ created: [], joined: [] }))
      .finally(() => setLoading(false));
  }, [status]);

  // ── Auth loading ───────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      </div>
    );
  }

  // ── Hero (signed out) ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 gap-10 text-center overflow-hidden">

        {/* Atmospheric orbs — behind content */}
        <div className="absolute top-0 left-1/4 w-150 h-150 rounded-full bg-green-500/5 blur-[140px] animate-orb pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-10 right-1/4 w-125 h-125 rounded-full bg-blue-500/4 blur-[120px] animate-orb pointer-events-none" style={{ animationDelay: '4s' }} aria-hidden="true" />
        <div className="absolute top-1/3 -left-20 w-96 h-96 rounded-full bg-teal-400/4 blur-[100px] animate-orb pointer-events-none" style={{ animationDelay: '8s' }} aria-hidden="true" />

        {/* Eyebrow badge */}
        <div className="eyebrow-badge animate-badge-pop" style={{ animationDelay: '0.05s' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Cricket leagues made simple
        </div>

        {/* Heading + subtext */}
        <div className="space-y-5 animate-fade-in-up max-w-2xl" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-[1.03]">
            <span className="block text-gradient-green">Cricket</span>
            <span className="block text-foreground/90">Player Cards</span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-md mx-auto leading-relaxed">
            Build your league, design premium player cards, and host live auctions — all in one place.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={() => signIn('google')}
            className="btn-premium inline-flex items-center gap-2.5 px-10 py-3.5 text-base rounded-2xl font-semibold"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-muted-foreground/40 text-xs tracking-wide">
            Sign in with Google · No credit card needed
          </p>
        </div>

        {/* Stats row */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 animate-fade-in-up"
          style={{ animationDelay: '0.3s' }}
        >
          {[
            { icon: Trophy, label: 'Player Cards' },
            { icon: Zap, label: 'Live Auction' },
            { icon: Star, label: 'PDF Export' },
            { icon: Users, label: 'Share Links' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="stat-chip">
              <Icon className="w-3.5 h-3.5 text-primary/70" />
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = !loading && sections.created.length === 0 && sections.joined.length === 0;

  // ── Dashboard (signed in) ──────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Page header */}
      <div className="flex items-start justify-between mb-10 animate-fade-in-up">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-gradient-green">My Leagues</h1>
          <p className="text-muted-foreground text-sm">
            Leagues you&apos;ve created or joined as a player
          </p>
        </div>
        <button
          onClick={() => router.push('/leagues/new')}
          className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          New League
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-32 gap-7 animate-fade-in-up">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl scale-[2.5]" aria-hidden="true" />
            <div className="relative w-20 h-20 rounded-3xl bg-linear-to-br from-green-500/15 to-emerald-600/15 border border-green-500/20 flex items-center justify-center text-4xl animate-float select-none shadow-[0_0_40px_oklch(0.62_0.19_150/0.1)]">
              🏏
            </div>
          </div>
          <div className="text-center space-y-2.5 max-w-xs">
            <h2 className="text-xl font-bold text-foreground">No leagues yet</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Create your first cricket league and start adding premium player cards.
            </p>
          </div>
          <button
            onClick={() => router.push('/leagues/new')}
            className="btn-premium inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create Your First League
          </button>
        </div>
      )}

      {/* Created leagues */}
      {!loading && sections.created.length > 0 && (
        <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <SectionHeader label="Created by you" count={sections.created.length} accent="green" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sections.created.map((league, i) => (
              <LeagueCard key={league.id} league={league} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Joined leagues */}
      {!loading && sections.joined.length > 0 && (
        <section className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SectionHeader label="Joined" count={sections.joined.length} accent="blue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sections.joined.map((league, i) => (
              <LeagueCard key={league.id} league={league} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
