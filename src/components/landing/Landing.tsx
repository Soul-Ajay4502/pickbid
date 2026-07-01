'use client';

import { signIn } from 'next-auth/react';
import {
  ArrowRight,
  BarChart3,
  Check,
  CreditCard,
  Download,
  Gavel,
  Layers,
  MessagesSquare,
  MoonStar,
  Radio,
  Share2,
  Sparkles,
  Trophy,
  Tv,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spotlight } from '@/components/ui/spotlight';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { HoverEffect } from '@/components/ui/card-hover-effect';
import { MovingBorderButton } from '@/components/ui/moving-border';

const signInGoogle = () => signIn('google');

/* ── Small reusable icon chip, matching the app's avatar palette ───────────── */
function IconChip({
  icon: Icon,
  tone,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-xl border bg-linear-to-br',
        tone,
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

const TONE = {
  emerald: 'from-emerald-500/20 to-green-600/20 border-emerald-500/25 text-emerald-400',
  blue: 'from-blue-500/20 to-indigo-600/20 border-blue-500/25 text-blue-400',
  violet: 'from-violet-500/20 to-purple-600/20 border-violet-500/25 text-violet-400',
  amber: 'from-orange-500/20 to-amber-600/20 border-amber-500/25 text-amber-400',
  rose: 'from-rose-500/20 to-pink-600/20 border-rose-500/25 text-rose-400',
  cyan: 'from-cyan-500/20 to-teal-600/20 border-cyan-500/25 text-cyan-400',
} as const;

/* ── Decorative header visuals for the wide bento tiles ────────────────────── */
function PlayerCardVisual() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-linear-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
      <div className="relative flex w-40 -rotate-3 flex-col gap-2 rounded-2xl border border-emerald-500/25 bg-card/80 p-3 shadow-2xl shadow-emerald-500/10 backdrop-blur-sm transition-transform duration-300 group-hover/bento:rotate-0">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-linear-to-br from-emerald-400/40 to-cyan-500/40 ring-2 ring-emerald-400/30" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-3/4 rounded-full bg-foreground/20" />
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {['98', '76', '88'].map((n) => (
            <div key={n} className="rounded-md bg-emerald-500/10 py-1 text-center">
              <span className="text-[11px] font-black text-emerald-400">{n}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400">Rating</span>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <Sparkles key={i} className="h-2.5 w-2.5 text-amber-400" />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function LiveAuctionVisual() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-linear-to-br from-rose-500/10 via-transparent to-violet-500/10" />
      <div className="relative w-full max-w-[15rem] space-y-2 rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Live
          </span>
          <span className="text-[10px] text-muted-foreground">Lot 14 / 32</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Current bid</span>
          <span className="font-mono text-base font-black text-emerald-400">₹2.4 Cr</span>
        </div>
        <div className="flex gap-1.5">
          {['Royals', 'Kings', 'Titans'].map((t, i) => (
            <span
              key={t}
              className={cn(
                'flex-1 rounded-md py-1 text-center text-[10px] font-semibold',
                i === 0
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'bg-muted/50 text-muted-foreground',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Section heading ───────────────────────────────────────────────────────── */
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow-badge mx-auto mb-5">
      <Sparkles className="h-3 w-3" />
      {children}
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    n: '01',
    title: 'Create your league',
    body: 'Name your tournament, set the team budget and squad rules. Takes under a minute.',
    icon: Trophy,
    tone: TONE.emerald,
  },
  {
    n: '02',
    title: 'Add players & cards',
    body: 'Upload photos and stats — they format instantly into premium, share-ready player cards.',
    icon: CreditCard,
    tone: TONE.blue,
  },
  {
    n: '03',
    title: 'Go live & share',
    body: 'Run the auction in real time, broadcast a watch link to fans, and export squad PDFs.',
    icon: Radio,
    tone: TONE.rose,
  },
];

/* ── "Everything in the box" — hover-effect grid ───────────────────────────── */
const EXTRAS = [
  {
    title: 'Instant Google sign-in',
    description: 'No passwords, no setup. Sign in and your leagues are ready in seconds.',
    icon: <Check className="h-5 w-5 text-emerald-400" />,
  },
  {
    title: 'Public share links',
    description: 'Send a single link — players and fans open everything in the browser, no app needed.',
    icon: <Share2 className="h-5 w-5 text-blue-400" />,
  },
  {
    title: 'Installable PWA',
    description: 'Add it to your home screen for a fast, app-like experience on any device.',
    icon: <Layers className="h-5 w-5 text-violet-400" />,
  },
  {
    title: 'Light & dark themes',
    description: 'A polished, premium interface that looks great in either mode, day or night.',
    icon: <MoonStar className="h-5 w-5 text-amber-400" />,
  },
  {
    title: 'Real-time updates',
    description: 'Bids, sales and standings sync live across every connected screen.',
    icon: <Zap className="h-5 w-5 text-cyan-400" />,
  },
  {
    title: 'WhatsApp broadcast',
    description: 'Share player cards and auction results straight to WhatsApp in a tap.',
    icon: <MessagesSquare className="h-5 w-5 text-emerald-400" />,
  },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* ════════════════════════ HERO ════════════════════════ */}
      <section className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
        {/* Aceternity Spotlight */}
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#10b981" />

        {/* Atmospheric orbs */}
        <div className="pointer-events-none absolute left-1/4 top-0 h-150 w-150 animate-orb rounded-full bg-green-500/5 blur-[140px]" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-10 right-1/4 h-125 w-125 animate-orb rounded-full bg-blue-500/4 blur-[120px]" style={{ animationDelay: '4s' }} aria-hidden="true" />

        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_50%,transparent_100%)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, oklch(0.62 0.19 150 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.62 0.19 150 / 0.12) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="eyebrow-badge animate-badge-pop" style={{ animationDelay: '0.05s' }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            The all-in-one cricket league platform
          </div>

          <div className="animate-fade-in-up space-y-6" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl">
              <span className="block text-foreground/90">Run cricket leagues</span>
              <span className="block text-gradient-green">like a pro.</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Design premium player cards, host real-time auctions, track live leaderboards and share
              it all with a single link — beautifully, in one place.
            </p>
          </div>

          <div className="flex animate-fade-in-up flex-col items-center gap-4 sm:flex-row" style={{ animationDelay: '0.2s' }}>
            <MovingBorderButton onClick={signInGoogle}>
              <span className="bg-linear-to-r from-emerald-400 to-cyan-300 bg-clip-text font-bold text-transparent">
                Get Started Free
              </span>
              <ArrowRight className="h-4 w-4 text-emerald-400" />
            </MovingBorderButton>
            <a
              href="#features"
              className="btn-outline inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold"
            >
              Explore features
            </a>
          </div>

          <p className="animate-fade-in-up text-xs tracking-wide text-muted-foreground/50" style={{ animationDelay: '0.25s' }}>
            Sign in with Google · Free to start · No credit card needed
          </p>

          {/* Stats row */}
          <div className="mt-4 flex animate-fade-in-up flex-wrap items-center justify-center gap-x-10 gap-y-4" style={{ animationDelay: '0.3s' }}>
            {[
              { icon: CreditCard, label: 'Player Cards' },
              { icon: Gavel, label: 'Live Auctions' },
              { icon: Trophy, label: 'Leaderboards' },
              { icon: Download, label: 'PDF Export' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="stat-chip">
                <Icon className="h-4 w-4 text-primary/70" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════ FEATURES (Bento) ════════════════════════ */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <SectionEyebrow>Everything you need</SectionEyebrow>
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            One platform, the <span className="text-gradient-green">whole tournament</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            From the first player card to the final whistle — every part of running a cricket league,
            crafted to feel premium.
          </p>
        </div>

        <BentoGrid>
          <BentoGridItem
            className="md:col-span-2"
            header={<PlayerCardVisual />}
            icon={<IconChip icon={CreditCard} tone={TONE.emerald} />}
            title="Premium player cards"
            description="Upload a photo, add stats and ratings — get gorgeous, broadcast-quality cards in seconds. Multiple templates, fully yours."
          />
          <BentoGridItem
            icon={<IconChip icon={Gavel} tone={TONE.rose} />}
            title="Live auctions"
            description="Put players under the hammer with a real-time bidding room. Budgets and squads update instantly."
          />

          <BentoGridItem
            icon={<IconChip icon={BarChart3} tone={TONE.blue} />}
            title="Squad analytics"
            description="See spend, squad balance and value at a glance with clean, insightful charts."
          />
          <BentoGridItem
            className="md:col-span-2"
            header={<LiveAuctionVisual />}
            icon={<IconChip icon={Tv} tone={TONE.violet} />}
            title="Watch mode for fans"
            description="Broadcast a public watch link so spectators follow every bid and reveal live — no sign-in required."
          />

          <BentoGridItem
            icon={<IconChip icon={Trophy} tone={TONE.amber} />}
            title="Real-time leaderboard"
            description="Standings that update the moment a result lands, ready to share."
          />
          <BentoGridItem
            icon={<IconChip icon={Users} tone={TONE.cyan} />}
            title="Teams & budgets"
            description="Manage rosters, owners and team officials with budget tracking built in."
          />
          <BentoGridItem
            icon={<IconChip icon={Share2} tone={TONE.emerald} />}
            title="Share & export"
            description="One-tap PDF squad sheets and WhatsApp sharing for cards, results and links."
          />
        </BentoGrid>
      </section>

      {/* ════════════════════════ HOW IT WORKS ════════════════════════ */}
      <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <SectionEyebrow>Up and running in minutes</SectionEyebrow>
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            Three steps to <span className="text-gradient-green">match day</span>
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="card-premium group relative p-7">
              {/* connector line */}
              {i < STEPS.length - 1 && (
                <div className="absolute -right-2.5 top-1/2 z-10 hidden h-px w-5 bg-border md:block" aria-hidden="true" />
              )}
              <div className="flex items-center justify-between">
                <IconChip icon={s.icon} tone={s.tone} className="h-12 w-12" />
                <span className="font-mono text-3xl font-black text-muted-foreground/15">{s.n}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════ EVERYTHING IN THE BOX ════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <SectionEyebrow>Thoughtful details</SectionEyebrow>
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            Everything in the <span className="text-gradient-green">box</span>
          </h2>
        </div>
        <HoverEffect items={EXTRAS} />
      </section>

      {/* ════════════════════════ FINAL CTA ════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/10 via-card to-cyan-500/10 px-6 py-16 text-center sm:py-20">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 animate-orb rounded-full bg-emerald-500/15 blur-[100px]" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 animate-orb rounded-full bg-cyan-500/10 blur-[100px]" style={{ animationDelay: '3s' }} aria-hidden="true" />

          <div className="relative z-10 flex flex-col items-center gap-7">
            <div className="flex h-16 w-16 animate-float items-center justify-center rounded-3xl bg-linear-to-br from-green-500/20 to-emerald-600/20 text-3xl shadow-[0_0_40px_oklch(0.62_0.19_150/0.15)] ring-1 ring-emerald-500/25 select-none">
              🏏
            </div>
            <div className="space-y-3">
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                Ready to run your league?
              </h2>
              <p className="mx-auto max-w-md text-base text-muted-foreground sm:text-lg">
                Build your first player card and host your auction today — completely free to start.
              </p>
            </div>
            <button
              onClick={signInGoogle}
              className="btn-premium inline-flex items-center gap-2.5 rounded-2xl px-10 py-4 text-base font-semibold"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ════════════════════════ */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm shadow-[0_0_16px_oklch(0.62_0.19_150/0.35)]"
              style={{ background: 'linear-gradient(135deg, #16a34a 0%, #059669 55%, #0d9488 100%)' }}
            >
              🏏
            </div>
            <span className="text-sm font-bold text-gradient-green">Pickbid</span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Built for cricket leagues · Player cards, auctions & more
          </p>
        </div>
      </footer>
    </div>
  );
}
