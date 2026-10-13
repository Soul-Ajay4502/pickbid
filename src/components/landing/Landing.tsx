import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CreditCard,
  Layers,
  MessagesSquare,
  MoonStar,
  Plus,
  Share2,
  Trophy,
  Tv,
  Users,
  Zap,
} from 'lucide-react';
import type { PlatformStats } from '@/lib/types';
import type { LandingShowcase } from '@/lib/landingShowcase';
import { JsonLd, faqSchema } from '@/lib/jsonLd';
import { cn } from '@/lib/utils';
import Footer from '../Footer';
import SignInButton from './SignInButton';
import { displaySerif } from './fonts';
import { AfterVisual, AuctionVisual, CardShowcase, HeroVisual, RegistrationVisual } from './visuals';

/* The signed-out landing. A server component: the only interactive pieces are
   the sign-in buttons (a client island) and the FAQ, which is native
   <details>, so the page ships next to no JavaScript of its own. Scroll
   reveals are CSS scroll-driven animations (`.lp-reveal` in globals.css). */

/* ── Season, in three stages — replaces the old feature grid ──────────────── */
const STAGES = [
  {
    numeral: 'I',
    label: 'Before the auction',
    title: 'Players sign themselves up.',
    body: 'Share one link in the team group. Players add a photo and a few stats, and each gets a broadcast-quality card — no account, no app.',
    points: [
      'Budgets, squad size and pick order set in under a minute',
      'Card templates in classic league colours',
      'Optional ID and entry-fee checks, seen only by organizers',
    ],
    visual: (s: LandingShowcase | null) => <RegistrationVisual roster={s?.roster ?? null} />,
  },
  {
    numeral: 'II',
    label: 'Auction night',
    title: 'Run the room. Let everyone watch.',
    body: 'Put players under the hammer with purses and squads that update on every bid. A public watch link puts the whole auction on every phone in the hall.',
    points: [
      'Live bidding with purse and squad tracking',
      'Watch mode for fans — no sign-in needed',
      'A sponsor wall built for the big screen',
    ],
    visual: (s: LandingShowcase | null) => <AuctionVisual auction={s?.auction ?? null} />,
  },
  {
    numeral: 'III',
    label: 'After the hammer',
    title: 'The season keeps its story.',
    body: 'Results feed a points table that maintains itself, and the auction lives on in recaps, reveals and keepsakes made to be shared.',
    points: [
      'Auction Wrapped — a tap-through recap of the night',
      'Pack-opening squad reveals and PDF squad sheets',
      'Participation certificates and a private league ledger',
    ],
    visual: (s: LandingShowcase | null) => <AfterVisual standings={s?.standings ?? null} />,
  },
];

/* ── Who it's for ─────────────────────────────────────────────────────────── */
const AUDIENCES = [
  {
    icon: Trophy,
    title: 'Organizers',
    body: 'Registration, the auction room, fixtures and results — run from one screen instead of five spreadsheets.',
  },
  {
    icon: Users,
    title: 'Team owners',
    body: 'Bid in real time with your purse and squad balance in view, then open your signings like a pack of cards.',
  },
  {
    icon: CreditCard,
    title: 'Players',
    body: 'Register from a link and get a card worthy of a superstar, ready to share on WhatsApp.',
  },
  {
    icon: Tv,
    title: 'Fans',
    body: 'Follow every bid and every result live from any browser. Nothing to sign up for.',
  },
];

/* ── Small things that come with every league ─────────────────────────────── */
const INCLUDED = [
  { icon: Check, title: 'Google sign-in', body: 'No passwords. Your leagues are ready in seconds.' },
  { icon: Share2, title: 'One-link sharing', body: 'Players and fans open everything in the browser.' },
  { icon: Zap, title: 'Real-time updates', body: 'Bids, sales and standings sync on every screen.' },
  { icon: MessagesSquare, title: 'WhatsApp ready', body: 'Send cards and results to the group in a tap.' },
  { icon: Layers, title: 'Installable app', body: 'Add it to your home screen for a full-screen feel.' },
  { icon: MoonStar, title: 'Light and dark', body: 'Easy on the eyes at the ground or at midnight.' },
];

/* ── FAQ (also emitted as FAQPage JSON-LD for search engines) ──────────────── */
const FAQS = [
  {
    q: 'Is Pickbid free to use?',
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
    q: 'Does Pickbid work on phones?',
    a: 'Pickbid runs in any modern browser and can be installed to your home screen as an app for a fast, full-screen experience.',
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
    label: 'How Pickbid works, step by step',
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
    body: 'Squads, auction results and tables from leagues already running on Pickbid.',
  },
];

// Derived from the same array the section renders, so the markup can never
// describe a question a visitor cannot see. Goes through the shared builder and
// escaping serializer in `jsonLd.tsx` rather than a raw JSON.stringify.
const FAQ_JSON_LD = faqSchema(FAQS.map((f) => ({ question: f.q, answer: f.a })));

/**
 * 1 → "1" · 47 → "40+" · 1,160 → "1.1K+" — modest rounding, never inflated.
 */
function formatStat(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}K+`;
  if (n >= 1000) return `${(Math.floor(n / 100) / 10).toFixed(1)}K+`;
  if (n >= 20) return `${Math.floor(n / 10) * 10}+`;
  return String(n);
}

// A counter only impresses once it has something to count: each stat appears
// after it crosses this floor, and the strip stays hidden until at least two
// qualify — no code change needed as the platform grows into the rest.
const STAT_DISPLAY_FLOOR = 25;

const CONTAINER = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';

/* ── Section opener — eyebrow, serif title, optional standfirst ────────────── */
function SectionIntro({
  eyebrow,
  title,
  sub,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn('lp-reveal max-w-3xl', className)}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 className="lp-display mt-5 text-[2.6rem] sm:text-6xl">{title}</h2>
      {sub && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Landing({
  stats,
  showcase = null,
}: {
  stats?: PlatformStats | null;
  showcase?: LandingShowcase | null;
}) {
  const statItems = stats
    ? [
      { value: stats.leagues, label: 'Leagues created' },
      { value: stats.players, label: 'Player cards made' },
      { value: stats.teams, label: 'Teams built' },
      { value: stats.playersSold, label: 'Players sold at auction' },
    ].filter((s) => s.value >= STAT_DISPLAY_FLOOR)
    : [];

  return (
    <div className={cn('landing-scope', displaySerif.variable)}>
      {/* ════════════════════════ HERO ════════════════════════ */}
      {/* The eyebrow, headline and intro rise in rather than fade: they're the
          page's largest paint, and text held at opacity 0 doesn't count as
          painted until its fade starts — see `riseIn` in globals.css. */}
      <section className="lp-hero overflow-hidden">
        <div className={cn(CONTAINER, 'grid items-center gap-14 pb-20 pt-12 sm:pt-20 lg:grid-cols-[1.08fr_1fr] lg:gap-8 lg:pb-28 lg:pt-24')}>
          <div className="text-center lg:text-left">
            <p className="lp-eyebrow animate-rise-in justify-center lg:justify-start">
              Cricket auctions &amp; leagues
            </p>
            <h1
              className="lp-display mt-6 animate-rise-in text-[2.95rem] sm:text-7xl lg:text-[5.4rem]"
              style={{ animationDelay: '0.06s' }}
            >
              The cricket auction your league <em>deserves.</em>
            </h1>
            <p
              className="mx-auto mt-6 max-w-xl animate-rise-in text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0"
              style={{ animationDelay: '0.12s' }}
            >
              Player cards, a live auction room, a watch link for fans and a points table that
              keeps itself — everything a local league needs, in one place.
            </p>

            <div
              className="mt-9 flex animate-fade-in-up flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
              style={{ animationDelay: '0.2s' }}
            >
              <SignInButton className="lp-btn w-full sm:w-auto">
                Start your league — free
                <ArrowRight className="h-4 w-4" />
              </SignInButton>
              <Link href="/leagues/discover" className="lp-btn-ghost w-full sm:w-auto">
                Browse live leagues
              </Link>
            </div>

            <ul
              className="mt-8 flex animate-fade-in-up flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground lg:justify-start"
              style={{ animationDelay: '0.28s' }}
            >
              {['Free to start', 'Players join without an account', 'Nothing to install'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-(--lp-accent)" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-rise-in" style={{ animationDelay: '0.1s' }}>
            <HeroVisual cards={showcase?.cards ?? []} />
          </div>
        </div>
      </section>

      {/* ════════════════════════ LIVE PLATFORM NUMBERS ════════════════════════ */}
      {statItems.length >= 2 && (
        <section aria-label="Pickbid in numbers" className="border-y border-border">
          <div className={CONTAINER}>
            <div className="grid grid-cols-2 sm:flex sm:divide-x sm:divide-border">
              {statItems.map((s) => (
                <div key={s.label} className="flex-1 px-4 py-10 text-center sm:py-12">
                  <p className="lp-display text-5xl tabular-nums sm:text-6xl">{formatStat(s.value)}</p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="border-t border-border py-3 text-center text-[11px] text-muted-foreground/80">
            Live totals from leagues running on Pickbid
          </p>
        </section>
      )}

      {/* ════════════════════════ REAL CARDS ════════════════════════ */}
      {/* The hero takes the first three; the rest go here. Each links to its
          league's public page, which already shows the same card. */}
      {showcase && showcase.cards.length > 3 && (
        <section className="pt-24 sm:pt-32">
          <div className={cn(CONTAINER, 'flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between')}>
            <SectionIntro
              eyebrow="Made on Pickbid"
              title={
                <>
                  Real cards from <em>real leagues.</em>
                </>
              }
              sub="Every card here was made by a player through their league's join link, and every price is the bid that won them."
            />
            <Link href="/leagues/discover" className="lp-btn-ghost lp-reveal shrink-0 self-start lg:self-auto">
              Browse public leagues
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className={cn(CONTAINER, 'mt-12')}>
            <CardShowcase cards={showcase.cards.slice(3)} />
          </div>
        </section>
      )}

      {/* ════════════════════════ HOW A SEASON RUNS ════════════════════════ */}
      <section id="features" className="scroll-mt-20 py-24 sm:py-32">
        <div className={CONTAINER}>
          <SectionIntro
            eyebrow="How it works"
            title={
              <>
                From sign-up to <em>the final hammer.</em>
              </>
            }
            sub="Three stages, one link. Pickbid handles the paperwork so the night belongs to the cricket."
          />

          <div className="mt-20 space-y-24 sm:mt-24 lg:space-y-32">
            {STAGES.map((s, i) => (
              <article
                key={s.numeral}
                className="lp-reveal grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
              >
                <div className={cn(i % 2 === 1 && 'lg:order-2')}>
                  <p className="flex items-baseline gap-3">
                    <span className="lp-display text-3xl italic text-(--lp-gold)">{s.numeral}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {s.label}
                    </span>
                  </p>
                  <h3 className="lp-display mt-4 text-4xl sm:text-5xl">{s.title}</h3>
                  <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">{s.body}</p>
                  <ul className="mt-7 border-t border-border">
                    {s.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-3 border-b border-border py-3.5 text-[15px]"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-(--lp-accent)" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={cn('flex justify-center', i % 2 === 1 && 'lg:order-1')}>
                  {s.visual(showcase)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════ FOR EVERYONE ════════════════════════ */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className={CONTAINER}>
          <SectionIntro
            eyebrow="Who it's for"
            title={
              <>
                Made for everyone <em>at the ground.</em>
              </>
            }
          />
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.title} className="lp-reveal border-t border-foreground/80 pt-6">
                  <Icon className="h-5 w-5 text-(--lp-gold)" strokeWidth={1.6} />
                  <h3 className="lp-display mt-5 text-[1.9rem]">{a.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{a.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════ INCLUDED ════════════════════════ */}
      <section className="pb-24 sm:pb-32">
        <div className={CONTAINER}>
          <div className="lp-reveal lp-panel rounded-[28px] px-6 py-10 sm:px-10 sm:py-12">
            <p className="lp-eyebrow">Included with every league</p>
            <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDED.map((e) => {
                const Icon = e.icon;
                return (
                  <div key={e.title} className="flex items-start gap-3.5">
                    <span className="lp-icon">
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-[15px] font-medium">{e.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════ FAQ ════════════════════════ */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className={cn(CONTAINER, 'grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20')}>
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionIntro
              eyebrow="FAQ"
              title={
                <>
                  Questions, <em>answered.</em>
                </>
              }
            />
            <p className="lp-reveal mt-6 text-[15px] text-muted-foreground">
              Accounts, sharing, who can see your league — more on the{' '}
              <Link href="/faq" className="lp-link">
                full FAQ
              </Link>
              .
            </p>
          </div>

          <div className="lp-reveal border-t border-border">
            {FAQS.map((f) => (
              <details key={f.q} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium transition-colors hover:text-(--lp-accent) [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-6 pr-10 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <JsonLd data={FAQ_JSON_LD} />
        </div>
      </section>

      {/* ════════════════════════ GUIDES ════════════════════════ */}
      {/* The home page's hub links. Every destination is described by its own
          anchor text, so both visitors and crawlers can tell where each goes
          without the surrounding sentence. */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className={CONTAINER}>
          <SectionIntro
            eyebrow="Guides & tools"
            title={
              <>
                Learn the game <em>behind the game.</em>
              </>
            }
          />
          <nav aria-label="Cricket auction and league guides" className="mt-14">
            <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href} className="lp-reveal border-t border-border">
                  <Link href={link.href} className="group block py-6">
                    <span className="flex items-start justify-between gap-4 text-[16px] font-medium transition-colors group-hover:text-(--lp-accent)">
                      {link.label}
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--lp-accent)" />
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">{link.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* ════════════════════════ FINAL CTA ════════════════════════ */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="lp-pitch lp-reveal relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-20 text-center sm:py-28">
          <div className="relative flex flex-col items-center">
            <p className="lp-eyebrow lp-eyebrow-on-pitch justify-center">Your season starts here</p>
            <h2 className="lp-display mt-6 max-w-3xl text-[2.75rem] text-[#f3ecdc] sm:text-7xl">
              Bring your league <br className="hidden sm:block" />
              <em>to the auction table.</em>
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-[#f3ecdc]/70">
              Free to start and set up in a minute. Share one link with players, owners and fans.
            </p>
            <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <SignInButton className="lp-btn lp-btn-on-pitch w-full sm:w-auto">
                Start your league — free
                <ArrowRight className="h-4 w-4" />
              </SignInButton>
              <Link href="/how-it-works" className="lp-btn-ghost lp-btn-ghost-on-pitch w-full sm:w-auto">
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
