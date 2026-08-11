'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import {
  BarChart3,
  Check,
  ChevronDown,
  Clapperboard,
  CreditCard,
  Crown,
  Gavel,
  Handshake,
  Layers,
  Link2,
  ListOrdered,
  MessagesSquare,
  MoonStar,
  Package,
  Radio,
  Share2,
  Sparkles,
  Trophy,
  Tv,
  Users,
  Zap,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import type { PlatformStats } from '@/lib/types';
import { JsonLd, faqSchema } from '@/lib/jsonLd';
import { cn } from '@/lib/utils';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { BorderBeam } from '@/components/ui/border-beam';
import Footer from '../Footer';

const signInGoogle = () => signIn('google');

/* ── Monochrome icon chip — a single quiet accent carries the whole page ───── */
function IconChip({
  icon: Icon,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-chip flex h-10 w-10 items-center justify-center rounded-xl text-foreground/70',
        className,
      )}
    >
      <Icon className="h-4.5 w-4.5" />
    </div>
  );
}

/* ── Decorative header visuals for the wide bento tiles ────────────────────── */
function PlayerCardVisual() {
  return (
    <div className="relative flex flex-1 items-center justify-center rounded-xl py-2">
      <div className="relative flex w-36 -rotate-3 flex-col gap-1.5 rounded-2xl border border-border bg-card p-2.5 shadow-lg shadow-black/10 transition-transform duration-300 group-hover/bento:rotate-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-foreground/15 ring-2 ring-foreground/10" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-3/4 rounded-full bg-foreground/20" />
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {['98', '76', '88'].map((n) => (
            <div key={n} className="rounded-md bg-muted py-1 text-center">
              <span className="text-[11px] font-semibold text-foreground/80">{n}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-500">Rating</span>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <Sparkles key={i} className="h-2.5 w-2.5 text-amber-500" />
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
      <div className="relative w-full max-w-60 space-y-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Live
          </span>
          <span className="text-[10px] text-muted-foreground">Lot 14 / 32</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Current bid</span>
          <span className="font-mono text-base font-semibold text-primary">₹2.4 Cr</span>
        </div>
        <div className="flex gap-1.5">
          {['Royals', 'Kings', 'Titans'].map((t, i) => (
            <span
              key={t}
              className={cn(
                'flex-1 rounded-md py-1 text-center text-[10px] font-semibold',
                i === 0
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/25'
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

function WrappedVisual() {
  const spends = [
    { name: 'Royals', bar: 'bg-primary/80', pct: '86%', amt: '₹8.6 Cr' },
    { name: 'Titans', bar: 'bg-foreground/25', pct: '58%', amt: '₹5.8 Cr' },
  ];
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl">
      <div className="relative w-full max-w-60 space-y-2 rounded-2xl border border-border bg-card p-3">
        {/* story progress segments */}
        <div className="flex gap-1" aria-hidden="true">
          {[100, 100, 50, 0, 0, 0].map((fill, i) => (
            <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-foreground/40" style={{ width: `${fill}%` }} />
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Auction Wrapped
          </span>
          <span className="text-[9px] text-muted-foreground">Slide 3 / 7</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-1.5 ring-1 ring-amber-500/20">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-500">
            <Crown className="h-3 w-3" />
            Record buy
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">₹2.4 Cr</span>
        </div>
        {spends.map((t) => (
          <div key={t.name} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="font-semibold text-foreground">{t.name}</span>
              <span className="text-muted-foreground">{t.amt}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div className={cn('h-full rounded-full', t.bar)} style={{ width: t.pct }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackRevealVisual() {
  return (
    <div className="relative flex flex-1 items-center justify-center rounded-xl py-2">
      <div className="relative w-28 -rotate-3 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-lg shadow-black/10 transition-transform duration-300 group-hover/bento:rotate-0">
        {/* holographic foil sweep */}
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-transform duration-500 group-hover/bento:translate-x-3"
          style={{
            background:
              'linear-gradient(115deg, transparent 25%, rgba(56,189,248,0.16) 42%, rgba(168,85,247,0.16) 52%, rgba(251,191,36,0.16) 62%, transparent 78%)',
          }}
          aria-hidden="true"
        />
        <div className="flex h-14 items-center justify-center rounded-lg bg-foreground/10">
          <div className="h-7 w-7 rounded-full bg-foreground/15 ring-2 ring-foreground/10" />
        </div>
        <div className="mt-2 h-2 w-3/4 rounded-full bg-foreground/20" />
        <div className="mt-2 flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-1">
          <Sparkles className="h-2.5 w-2.5 text-amber-500" />
          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-amber-500">Legendary</span>
        </div>
      </div>
    </div>
  );
}

function SponsorWallVisual() {
  return (
    <div className="relative mb-2 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black py-2">
      <div
        className="grid grid-cols-3 gap-2"
        style={{ transform: 'rotateX(14deg) rotateY(-10deg) rotateZ(4deg)' }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex h-9 w-15 items-center justify-center rounded-md bg-white/95 shadow-sm">
            <div className="h-2 w-8 rounded-full bg-foreground/20" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black to-transparent" />
    </div>
  );
}

/* ── Compact mock-UI visuals for the persona rows ──────────────────────────── */
function LeagueSetupVisual() {
  return (
    <div className="w-full max-w-60 space-y-2 rounded-2xl border border-border bg-card p-3">
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">League name</p>
        <p className="text-xs font-semibold text-foreground">Sunday Premier League</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Team budget</p>
          <p className="text-xs font-semibold text-foreground">₹10 Cr</p>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Squad size</p>
          <p className="text-xs font-semibold text-foreground">11</p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
        <span className="text-[10px] font-semibold text-primary">Registration link ready</span>
        <Link2 className="h-3.5 w-3.5 text-primary" />
      </div>
    </div>
  );
}

function SquadPurseVisual() {
  const teams = [
    { name: 'Royals', bar: 'bg-primary/80', pct: '72%', squad: '9/11' },
    { name: 'Kings', bar: 'bg-foreground/25', pct: '45%', squad: '6/11' },
    { name: 'Titans', bar: 'bg-foreground/25', pct: '58%', squad: '7/11' },
  ];
  return (
    <div className="w-full max-w-60 space-y-2.5 rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Purse used</p>
      {teams.map((t) => (
        <div key={t.name} className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="font-semibold text-foreground">{t.name}</span>
            <span className="text-muted-foreground">{t.squad} squad</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div className={cn('h-full rounded-full', t.bar)} style={{ width: t.pct }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StandingsVisual() {
  const rows = [
    { pos: 1, team: 'Royals', pts: 12, leader: true },
    { pos: 2, team: 'Titans', pts: 10, leader: false },
    { pos: 3, team: 'Kings', pts: 7, leader: false },
  ];
  return (
    <div className="w-full max-w-60 space-y-1.5 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Standings</p>
        <span className="flex items-center gap-1 text-[9px] font-semibold text-primary">
          <span className="h-1 w-1 animate-pulse rounded-full bg-primary" />
          Live
        </span>
      </div>
      {rows.map((r) => (
        <div
          key={r.pos}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2.5 py-1.5',
            r.leader ? 'bg-amber-500/10 ring-1 ring-amber-500/25' : 'bg-muted/50',
          )}
        >
          <span className="font-mono text-[10px] font-semibold text-muted-foreground">{r.pos}</span>
          <span className="flex-1 text-[11px] font-semibold text-foreground">{r.team}</span>
          {r.leader && <Trophy className="h-3 w-3 text-amber-500" />}
          <span className="font-mono text-[11px] font-semibold text-foreground/80">{r.pts} pts</span>
        </div>
      ))}
    </div>
  );
}

/* ── Section heading — quiet title + muted sub, revealed on scroll ─────────── */
function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <BlurFade inView className="mb-14 text-center">
      <h2 className="text-3xl font-medium tracking-[-0.01em] text-foreground sm:text-5xl sm:leading-[1.1]">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-muted-foreground sm:text-lg">
          {sub}
        </p>
      )}
    </BlurFade>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    n: '01',
    title: 'Create your league',
    body: 'Name your tournament, set the team budget and squad rules. Takes under a minute.',
    icon: Trophy,
  },
  {
    n: '02',
    title: 'Add players & cards',
    body: 'Upload photos and stats — they format instantly into premium, share-ready player cards.',
    icon: CreditCard,
  },
  {
    n: '03',
    title: 'Go live & share',
    body: 'Run the auction in real time, broadcast a watch link to fans, and export squad PDFs.',
    icon: Radio,
  },
];

/* ── "Everything in the box" — quiet icon + copy pairs ─────────────────────── */
const EXTRAS = [
  {
    title: 'Instant Google sign-in',
    description: 'No passwords, no setup. Sign in and your leagues are ready in seconds.',
    icon: Check,
  },
  {
    title: 'Public share links',
    description: 'Send a single link — players and fans open everything in the browser, no app needed.',
    icon: Share2,
  },
  {
    title: 'Installable PWA',
    description: 'Add it to your home screen for a fast, app-like experience on any device.',
    icon: Layers,
  },
  {
    title: 'Light & dark themes',
    description: 'A polished, premium interface that looks great in either mode, day or night.',
    icon: MoonStar,
  },
  {
    title: 'Real-time updates',
    description: 'Bids, sales and standings sync live across every connected screen.',
    icon: Zap,
  },
  {
    title: 'WhatsApp broadcast',
    description: 'Share player cards and auction results straight to WhatsApp in a tap.',
    icon: MessagesSquare,
  },
];

/* ── "For everyone" persona rows, CricHeroes-style ─────────────────────────── */
const PERSONAS = [
  {
    label: 'For organizers',
    title: 'Run the whole show, minus the spreadsheets',
    body: 'Set up the league, collect entries and put every player under the hammer — all from one screen.',
    bullets: [
      'Create a league with budgets and squad rules in under a minute',
      'Share a registration link — players add their own details and photos',
      'Run the live auction room and export final squads as PDFs',
      'Set a pick order preference so the draw pulls bowlers, batters or any role first',
      'Add sponsor logos and light up a big-screen 3D marquee wall for the venue',
    ],
    icon: Trophy,
    visual: <LeagueSetupVisual />,
  },
  {
    label: 'For team owners',
    title: 'Build your dream squad on a budget',
    body: 'Bid in real time, watch your purse update with every hammer and keep the squad balanced.',
    bullets: [
      'Live bidding with instant budget and purse tracking',
      'Squad analytics — spend, balance and value at a glance',
      'Rosters and team officials managed in one place',
      'Open your finished squad as a pack of holographic, rarity-tiered cards',
    ],
    icon: Users,
    visual: <SquadPurseVisual />,
  },
  {
    label: 'For players',
    title: 'Get a card worthy of a superstar',
    body: 'A photo and a few stats become a broadcast-quality player card, ready to share anywhere.',
    bullets: [
      'Premium player cards on multiple templates',
      'No account needed — register through the league link',
      'Share your card straight to WhatsApp',
    ],
    icon: CreditCard,
    visual: <PlayerCardVisual />,
  },
  {
    label: 'For fans',
    title: 'Follow every bid, live',
    body: 'A public watch link mirrors the auction and standings on any screen — no sign-in, no app.',
    bullets: [
      'Watch mode for every auction, open to everyone',
      'Auction Wrapped — a tap-through recap of the night, made to be shared',
      'Leaderboards that update the moment a result lands',
      'Works in any browser, on any device',
    ],
    icon: Tv,
    visual: <StandingsVisual />,
  },
];

/* ── FAQ (also emitted as FAQPage JSON-LD for search engines) ──────────────── */
const FAQS = [
  {
    q: 'Is Player Hunt free to use?',
    a: 'Yes — sign in with Google and start building your league for free. No credit card needed.',
  },
  {
    q: 'Do players need an account to join a league?',
    a: 'No. Organizers share a registration link; players open it, add their details and photo, and their card is created — no sign-in required.',
  },
  {
    q: 'Can fans watch the auction without signing in?',
    a: 'Yes. Every auction has a public watch link that mirrors bids, sales and standings live in any browser.',
  },
  {
    q: 'Does Player Hunt work on phones?',
    a: 'Player Hunt runs in any modern browser and can be installed to your home screen as an app for a fast, full-screen experience.',
  },
  {
    q: 'What do I need to start a league?',
    a: 'Just a name, a team budget and squad rules — setup takes under a minute. Add players and cards whenever you like.',
  },
  {
    q: 'Can I export or share results?',
    a: 'Yes — one-tap PDF squad sheets, WhatsApp sharing for player cards and results, and public links for leaderboards.',
  },
  {
    q: 'Can I show sponsors at my auction?',
    a: 'Yes — add sponsor logos and links from the league dashboard, then display them as a full-screen, animated 3D marquee wall for the venue or stream.',
  },
  {
    q: 'What happens after the auction ends?',
    a: 'The fun keeps going. Every league gets an Auction Wrapped — a tap-through recap of record buys, big spenders and steals — and each team can open its squad as a pack of holographic, rarity-tiered player cards. Both are shareable with a link.',
  },
];

/* ── Internal links out of the home page ──────────────────────────────────── */
const EXPLORE_LINKS: { href: string; label: string; body: string }[] = [
  {
    href: '/how-it-works',
    label: 'How Player Hunt works, step by step',
    body: 'The five steps from creating a league to sharing the finished squads.',
  },
  {
    href: '/cricket-auction',
    label: 'How a cricket auction works',
    body: 'Team purses, base prices, icon players and unsold rounds — the format explained.',
  },
  {
    href: '/online-cricket-auction',
    label: 'Run your cricket auction online',
    body: 'The two-screen setup for auction night, including remote team owners.',
  },
  {
    href: '/cricket-league-management',
    label: 'Cricket league management',
    body: 'Registration, squads, fixtures, results and a points table that maintains itself.',
  },
  {
    href: '/cricket-tournament-management',
    label: 'Cricket tournament management',
    body: 'Pick a format, fit the matches into the days you have, and publish results.',
  },
  {
    href: '/tools/cricket-auction-budget-calculator',
    label: 'Cricket auction budget calculator',
    body: 'Check your purse, squad size and base price work together before you publish them.',
  },
  {
    href: '/tools/cricket-fixture-generator',
    label: 'Cricket fixture generator',
    body: 'A round-robin schedule for your teams, with nobody playing twice in a row.',
  },
  {
    href: '/resources/how-to-organize-cricket-auction',
    label: 'How to organize a cricket auction',
    body: 'A run sheet from opening registration to the final unsold round.',
  },
  {
    href: '/leagues/discover',
    label: 'Browse public cricket leagues',
    body: 'Squads, auction results and tables from leagues already running on Player Hunt.',
  },
];

// Derived from the same array the section renders, so the markup can never
// describe a question a visitor cannot see. Goes through the shared builder and
// escaping serializer in `jsonLd.tsx` rather than a raw JSON.stringify.
const FAQ_JSON_LD = faqSchema(FAQS.map((f) => ({ question: f.q, answer: f.a })));

/**
 * 1 → {1} · 47 → {40, "+"} · 1,160 → {1.1, "K+"} — modest rounding, never
 * inflated. Split into number + suffix so the number can tick up on scroll
 * while the suffix stays put.
 */
function statParts(n: number): { value: number; decimals: number; suffix: string } {
  if (n >= 10000) return { value: Math.floor(n / 1000), decimals: 0, suffix: 'K+' };
  if (n >= 1000) return { value: Math.floor(n / 100) / 10, decimals: 1, suffix: 'K+' };
  if (n >= 20) return { value: Math.floor(n / 10) * 10, decimals: 0, suffix: '+' };
  return { value: n, decimals: 0, suffix: '' };
}

// A counter only impresses once it has something to count: each stat appears
// after it crosses this floor, and the strip stays hidden until at least two
// qualify — no code change needed as the platform grows into the rest.
const STAT_DISPLAY_FLOOR = 25;

export default function Landing({ stats }: { stats?: PlatformStats | null }) {
  const statItems = stats
    ? [
      { value: stats.leagues, label: 'Leagues created' },
      { value: stats.players, label: 'Player cards made' },
      { value: stats.teams, label: 'Teams built' },
      { value: stats.playersSold, label: 'Players sold at auction' },
    ].filter((s) => s.value >= STAT_DISPLAY_FLOOR)
    : [];

  return (
    // reducedMotion="user" keeps the JS-driven Magic UI animations in step
    // with the CSS-side prefers-reduced-motion collapse in globals.css.
    <MotionConfig reducedMotion="user">
      <div className="landing-scope relative overflow-hidden">
        {/* Page-wide ambient aura — the colour the frosted-glass surfaces
            refract as they scroll over it. Sits behind all content but above
            the scope background (see .landing-scope isolation in globals.css).

            Desktop only, and that's a memory fix rather than a style call.
            Stacked into one column this page measures ~11,400px tall, so
            `absolute inset-0` made this element 360×11311 — a composited layer
            the full height of the document, and the largest thing on the page
            after the root scrolling layer. That is enough to get the renderer
            OOM-killed on a 3GB phone (Galaxy A04 and similar).

            Viewport-sized `fixed` was the obvious alternative and measured
            worse: a fixed-position child forces Blink to composite the
            scrolling contents separately, trading an 11311px gradient layer
            for a 9475px scrolling layer. Dropping the element below `sm`
            instead leaves the root scrolling layer as the only large layer on
            the page. Little is lost — these are 4 blobs at 0.06–0.16 alpha,
            and the glass surfaces carry no backdrop blur under `sm`
            (see globals.css), so there is no refraction for them to feed.
            From `sm` up the blur is live and the aura works as designed. */}
        <div className="landing-ambient pointer-events-none hidden sm:block sm:absolute inset-0 -z-10" aria-hidden="true" />

        {/* ════════════════════════ HERO ════════════════════════ */}
        <section className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
          {/* A single faint aura, masked out toward the bottom — all the scene-setting */}
          <div
            className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent_95%)]"
            style={{
              background:
                'radial-gradient(90% 70% at 50% -10%, oklch(0.62 0.19 150 / 0.12), transparent 65%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-center">
            <p className="animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
              <AnimatedShinyText className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                The all-in-one cricket league platform
              </AnimatedShinyText>
            </p>

            <h1
              className="landing-hero-title mt-6 animate-fade-in-up text-5xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-7xl lg:text-[80px]"
              style={{ animationDelay: '0.15s' }}
            >
              Run cricket leagues
              <br />
              like a pro.
            </h1>

            <p
              className="mt-6 max-w-xl animate-fade-in-up text-lg leading-relaxed text-foreground/70 sm:text-xl"
              style={{ animationDelay: '0.25s' }}
            >
              Design premium player cards, host real-time auctions, track live leaderboards and share
              it all with a single link — beautifully, in one place.
            </p>

            <div
              className="mt-9 flex animate-fade-in-up flex-col items-center gap-5 sm:flex-row"
              style={{ animationDelay: '0.35s' }}
            >
              <button onClick={signInGoogle} className="landing-btn">
                Get Started Free
              </button>
              <a
                href="#features"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Explore features
              </a>
            </div>

            <p
              className="mt-7 animate-fade-in-up text-xs text-muted-foreground/70"
              style={{ animationDelay: '0.45s' }}
            >
              Sign in with Google · Free to start · No credit card needed
            </p>
          </div>
        </section>

        {/* ════════════════════════ LIVE PLATFORM NUMBERS ════════════════════════ */}
        {statItems.length >= 2 && (
          <section className="border-y border-border">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
              <div className="flex flex-wrap items-start justify-center gap-x-16 gap-y-10 text-center">
                {statItems.map((s, i) => {
                  const parts = statParts(s.value);
                  return (
                    <BlurFade key={s.label} inView delay={i * 0.1} className="min-w-32">
                      <p className="text-[44px] font-medium leading-none tracking-tight text-foreground tabular-nums sm:text-5xl">
                        <NumberTicker
                          value={parts.value}
                          decimalPlaces={parts.decimals}
                          delay={0.2 + i * 0.1}
                          className="tracking-tight text-foreground dark:text-foreground"
                        />
                        {parts.suffix}
                      </p>
                      <p className="mt-3 text-[13px] font-medium text-muted-foreground">{s.label}</p>
                    </BlurFade>
                  );
                })}
              </div>
              <p className="mt-9 text-center text-xs text-muted-foreground/60">
                Live totals from leagues running on Player Hunt right now
              </p>
            </div>
          </section>
        )}

        {/* ════════════════════════ FEATURES (Bento) ════════════════════════ */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
          <SectionHeading
            title="One platform, the whole tournament"
            sub="From the first player card to the final whistle — every part of running a cricket league, crafted to feel premium."
          />

          <BlurFade inView delay={0.1}>
            <BentoGrid>
              <BentoGridItem
                className="md:col-span-2"
                header={<PlayerCardVisual />}
                icon={<IconChip icon={CreditCard} />}
                title="Premium player cards"
                description="Upload a photo, add stats and ratings — get gorgeous, broadcast-quality cards in seconds. Multiple templates, fully yours."
              />
              <BentoGridItem
                icon={<IconChip icon={Gavel} />}
                title="Live auctions"
                description="Put players under the hammer with a real-time bidding room. Budgets and squads update instantly."
              />

              <BentoGridItem
                icon={<IconChip icon={BarChart3} />}
                title="Squad analytics"
                description="See spend, squad balance and value at a glance with clean, insightful charts."
              />
              <BentoGridItem
                className="md:col-span-2"
                header={<LiveAuctionVisual />}
                icon={<IconChip icon={Tv} />}
                title="Watch mode for fans"
                description="Broadcast a public watch link so spectators follow every bid and reveal live — no sign-in required."
              />

              <BentoGridItem
                icon={<IconChip icon={Trophy} />}
                title="Real-time leaderboard"
                description="Standings that update the moment a result lands, ready to share."
              />
              <BentoGridItem
                icon={<IconChip icon={Users} />}
                title="Teams & budgets"
                description="Manage rosters, owners and team officials with budget tracking built in."
              />
              <BentoGridItem
                icon={<IconChip icon={Share2} />}
                title="Share & export"
                description="One-tap PDF squad sheets and WhatsApp sharing for cards, results and links."
              />

              <BentoGridItem
                className="md:col-span-2"
                header={<WrappedVisual />}
                icon={<IconChip icon={Clapperboard} />}
                title="Auction Wrapped"
                description="When the hammer falls, the story begins — a tap-through recap of record buys, big spenders and steals, ready to share anywhere."
              />
              <BentoGridItem
                header={<PackRevealVisual />}
                icon={<IconChip icon={Package} />}
                title="Pack-opening squad reveals"
                description="Open your finished squad like a pack of holographic cards — every signing rarity-tiered by its winning bid."
              />

              <BentoGridItem
                className="md:col-span-2"
                header={<SponsorWallVisual />}
                icon={<IconChip icon={Handshake} />}
                title="Sponsor wall"
                description="Add sponsor logos and links, then display them as an animated 3D marquee wall — built for the big screen at the venue."
              />
              <BentoGridItem
                icon={<IconChip icon={ListOrdered} />}
                title="Custom pick order"
                description="Set a role order — bowlers first, then batters — so the auction draws players in exactly the sequence you want."
              />
            </BentoGrid>
          </BlurFade>
        </section>

        {/* ════════════════════════ FOR EVERYONE (personas) ════════════════════════ */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-16">
            <SectionHeading
              title="Player Hunt is for every cricket lover"
              sub="Whether you run the league, own a team, walk out to bat or cheer from the stands."
            />
          </div>

          <div className="space-y-16 md:space-y-24">
            {PERSONAS.map((p, i) => {
              const Icon = p.icon;
              return (
                <BlurFade
                  key={p.label}
                  inView
                  className="grid items-center gap-10 md:grid-cols-2 md:gap-14"
                >
                  <div className={cn(i % 2 === 1 && 'md:order-2')}>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {p.label}
                    </p>
                    <h3 className="mt-4 text-2xl font-medium tracking-[-0.01em] text-foreground sm:text-3xl">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">{p.body}</p>
                    <ul className="mt-6 space-y-3">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={cn('flex justify-center', i % 2 === 1 && 'md:order-1')}>
                    <div className="glass flex w-full max-w-sm items-center justify-center rounded-3xl p-8">
                      {p.visual}
                    </div>
                  </div>
                </BlurFade>
              );
            })}
          </div>
        </section>

        {/* ════════════════════════ HOW IT WORKS ════════════════════════ */}
        <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <SectionHeading title="Three steps to match day" sub="Up and running in minutes." />

          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <BlurFade key={s.n} inView delay={i * 0.12}>
                <div className="glass relative h-full rounded-2xl p-7">
                  {/* connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute -right-2.5 top-1/2 z-10 hidden h-px w-5 bg-border md:block" aria-hidden="true" />
                  )}
                  <div className="flex items-center justify-between">
                    <IconChip icon={s.icon} className="h-12 w-12" />
                    <span className="font-mono text-3xl font-medium text-foreground/10">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-[17px] font-medium text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </BlurFade>
            ))}
          </div>
        </section>

        {/* ════════════════════════ EVERYTHING IN THE BOX ════════════════════════ */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
          <SectionHeading title="Everything in the box" sub="Thoughtful details, included by default." />
          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRAS.map((e, i) => {
              const Icon = e.icon;
              return (
                <BlurFade key={e.title} inView delay={i * 0.06} className="flex items-start gap-3.5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[15px] font-medium text-foreground">{e.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.description}</p>
                  </div>
                </BlurFade>
              );
            })}
          </div>
        </section>

        {/* ════════════════════════ FAQ ════════════════════════ */}
        <section className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
          <SectionHeading title="Frequently asked questions" />
          <div>
            {FAQS.map((f, i) => (
              <BlurFade key={f.q} inView delay={i * 0.05}>
                <details className="group -mx-4 rounded-xl transition-colors hover:bg-foreground/4.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-5 text-[15px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="px-4 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              </BlurFade>
            ))}
          </div>
          <BlurFade inView>
            <p className="mt-8 px-4 text-sm text-muted-foreground">
              More questions — accounts, sharing, who can see your league — are
              answered on the{' '}
              <Link
                href="/faq"
                className="font-medium text-foreground underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-primary"
              >
                full FAQ
              </Link>
              .
            </p>
          </BlurFade>
          <JsonLd data={FAQ_JSON_LD} />
        </section>

        {/* ════════════════════════ EXPLORE ════════════════════════ */}
        {/* The home page's hub links. Every destination is described by its own
            anchor text, so both visitors and crawlers can tell where each goes
            without the surrounding sentence. */}
        <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <SectionHeading title="Learn how it works" />
          <nav aria-label="Cricket auction and league guides">
            <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {EXPLORE_LINKS.map((link, i) => (
                <BlurFade key={link.href} inView delay={i * 0.04}>
                  <li>
                    <Link
                      href={link.href}
                      className="text-[15px] font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {link.body}
                    </p>
                  </li>
                </BlurFade>
              ))}
            </ul>
          </nav>
        </section>

        {/* ════════════════════════ FINAL CTA ════════════════════════ */}
        <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <BlurFade inView>
            <div className="glass relative overflow-hidden rounded-3xl px-6 py-20 text-center sm:py-24">
              <BorderBeam
                size={90}
                duration={9}
                colorFrom="var(--primary)"
                colorTo="var(--foreground)"
              />
              <div className="relative z-10 flex flex-col items-center gap-6">
                <h2 className="text-3xl font-medium tracking-[-0.01em] text-foreground sm:text-5xl">
                  Ready to run your league?
                </h2>
                <p className="max-w-md text-base text-muted-foreground sm:text-lg">
                  Build your first player card and host your auction today — completely free to start.
                </p>
                <button onClick={signInGoogle} className="landing-btn mt-2">
                  Get Started Free
                </button>
              </div>
            </div>
          </BlurFade>
        </section>
        <Footer />
      </div>
    </MotionConfig>
  );
}
