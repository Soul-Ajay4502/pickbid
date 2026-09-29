'use client';

import { useEffect, useState, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  motion,
  stagger,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react';
import { Users, Calendar, ArrowUpRight, Plus, Globe, Lock, UserX } from 'lucide-react';
import type { League } from '@/lib/types';
import { cloudinaryImage } from '@/lib/utils';

interface LeagueSections {
  created: League[];
  coOrganizing: League[];
  joined: League[];
}

const EMPTY_SECTIONS: LeagueSections = { created: [], coOrganizing: [], joined: [] };

// ── Per-league accent ─────────────────────────────────────────────────────────
// `tint` carries the Tailwind classes for the monogram tile and the player
// chip; `tone` is the same colour as a bare oklch "L C H" triplet, because the
// cursor spotlight is a runtime gradient Tailwind can't generate.
const ACCENTS = [
  { tint: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400', tone: '0.696 0.17 162.48' },
  { tint: 'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400', tone: '0.623 0.214 259.815' },
  { tint: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400', tone: '0.606 0.25 292.717' },
  { tint: 'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400', tone: '0.705 0.213 47.604' },
  { tint: 'bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400', tone: '0.645 0.246 16.439' },
  { tint: 'bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:text-cyan-400', tone: '0.715 0.143 215.221' },
];

/** FNV-1a over the whole name — keying on the first letter alone put every "O…" and "I…" league on the same colour. */
function accent(name: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ACCENTS[(h >>> 0) % ACCENTS.length];
}

// ── Motion ────────────────────────────────────────────────────────────────────
// Entrance lives on the grid item and the hover lift on the link inside it, so
// the two transforms never compete for one element. Everything animates
// `transform`/`opacity` as whole values, which Motion hands to WAAPI — and which
// `MotionConfig reducedMotion` doesn't strip (it only knows `x`, `scale`, …), so
// `LeagueCard` reads the OS setting itself and swaps in the fade-only variants.
const SPRING: Transition = { type: 'spring', visualDuration: 0.35, bounce: 0.2 };

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { delayChildren: stagger(0.05) } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, transform: 'translateY(14px)' },
  show: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: {
      default: { type: 'spring', visualDuration: 0.5, bounce: 0.15 },
      opacity: { duration: 0.3, ease: 'easeOut' },
    },
  },
};

const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
};

const liftVariants: Variants = {
  rest: { transform: 'translateY(0px) scale(1)' },
  hover: { transform: 'translateY(-4px) scale(1)' },
  press: { transform: 'translateY(-1px) scale(0.985)' },
};

const tileVariants: Variants = {
  rest: { transform: 'rotate(0deg) scale(1)' },
  hover: { transform: 'rotate(-6deg) scale(1.08)' },
};

const glowVariants: Variants = {
  rest: { opacity: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  hover: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
};

// The arrow flies out of its circle top-right while a twin slides in from the
// bottom-left — the circle clips both, so it reads as one arrow looping through.
const arrowOutVariants: Variants = {
  rest: { transform: 'translate(0px, 0px)' },
  hover: { transform: 'translate(16px, -16px)' },
};
const arrowInVariants: Variants = {
  rest: { transform: 'translate(-16px, 16px)' },
  hover: { transform: 'translate(0px, 0px)' },
};

// Paints only a 1px ring of the element's background, so the spotlight
// gradient lights up the border nearest the cursor.
const RING_MASK = {
  padding: 1,
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  maskComposite: 'exclude',
} as const;

const MotionLink = motion.create(Link);

/** Red pulse marking a league whose auction is being run right this minute. */
function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-500/12 text-red-600 dark:text-red-400 border border-red-500/25">
      <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
        <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75 animate-ping" />
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-red-500" />
      </span>
      Live
    </span>
  );
}

/** The league's logo when it has one, its initial otherwise — and the initial again if the logo fails to load. */
function LeagueMark({ league, tint, still }: { league: League; tint: string; still: boolean }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const hasLogo = Boolean(league.logoUrl) && !logoFailed;

  return (
    <motion.div
      variants={still ? undefined : tileVariants}
      transition={SPRING}
      className={`shrink-0 grid place-items-center size-12 rounded-xl ring-1 ring-inset select-none overflow-hidden ${hasLogo ? 'bg-white ring-border' : `${tint} text-base font-black`
        }`}
    >
      {hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cloudinaryImage(league.logoUrl, { w: 96, h: 96, mode: 'fit' })}
          alt=""
          className="size-full object-contain p-1.5"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        league.name.charAt(0).toUpperCase()
      )}
    </motion.div>
  );
}

function MetaChip({ icon, children, className = 'bg-muted/70 text-muted-foreground ring-border/60' }: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${className}`}>
      {icon}
      {children}
    </span>
  );
}

function LeagueCard({ league, live = false }: { league: League; live?: boolean }) {
  const { tint, tone } = accent(league.name);
  const still = Boolean(useReducedMotion());

  // Pointer position inside the card, fed straight into the gradients as motion
  // values — the spotlight tracks the cursor without re-rendering the card.
  const pointerX = useMotionValue(-400);
  const pointerY = useMotionValue(-400);
  const glow = useMotionTemplate`radial-gradient(280px circle at ${pointerX}px ${pointerY}px, oklch(${tone} / 0.11), transparent 70%)`;
  const ring = useMotionTemplate`radial-gradient(200px circle at ${pointerX}px ${pointerY}px, oklch(${tone} / 0.7), transparent 70%)`;

  function trackPointer(e: PointerEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set(e.clientX - rect.left);
    pointerY.set(e.clientY - rect.top);
  }

  const created = new Date(league.createdAt);

  return (
    <motion.li variants={still ? fadeInVariants : itemVariants} className="list-none">
      <MotionLink
        href={`/leagues/${league.id}`}
        variants={still ? undefined : liftVariants}
        transition={SPRING}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileFocus="hover"
        whileTap="press"
        onPointerMove={trackPointer}
        className="group relative flex h-full flex-col rounded-md border border-border bg-card p-5 shadow-[0_1px_2px_oklch(0_0_0/0.04)] outline-none transition-shadow duration-300 hover:shadow-[0_18px_40px_-18px_oklch(0_0_0/0.22)] dark:hover:shadow-[0_18px_48px_-16px_oklch(0_0_0/0.7)] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Cursor spotlight: a soft wash over the card and a brighter ring on the border */}
        <motion.span
          aria-hidden="true"
          variants={glowVariants}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: glow }}
        />
        <motion.span
          aria-hidden="true"
          variants={glowVariants}
          className="pointer-events-none absolute -inset-px rounded-[inherit]"
          style={{ ...RING_MASK, background: ring }}
        />

        <div className="relative flex items-start gap-3.5">
          <LeagueMark league={league} tint={tint} still={still} />
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-foreground">
              {league.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">by {league.conductedBy}</p>
          </div>
          {live && <LivePill />}
        </div>

        <div className="relative mt-4 mb-4 flex flex-wrap items-center gap-1.5">
          <MetaChip icon={<Users className="size-3" />} className={tint}>
            <span className="font-bold tabular-nums">{league.totalPlayers}</span> players
          </MetaChip>
          <MetaChip icon={league.isPublic ? <Globe className="size-3" /> : <Lock className="size-3" />}>
            {league.isPublic ? 'Public' : 'Private'}
          </MetaChip>
          {league.registrationClosed && (
            <MetaChip icon={<UserX className="size-3" />}>Registration closed</MetaChip>
          )}
        </div>

        <div className="relative mt-auto flex items-center justify-between border-t border-border/60 pt-3.5">
          <time
            dateTime={league.createdAt}
            title={`Created ${created.toLocaleString('en-GB')}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Calendar className="size-3" />
            {created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </time>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground group-focus-visible:text-foreground">
            Open
            <span className="relative grid size-7 place-items-center overflow-hidden rounded-full border border-border bg-background transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:border-primary group-focus-visible:bg-primary group-focus-visible:text-primary-foreground">
              <motion.span variants={still ? undefined : arrowOutVariants} transition={SPRING} className="absolute">
                <ArrowUpRight className="size-3.5" />
              </motion.span>
              {!still && (
                <motion.span variants={arrowInVariants} transition={SPRING} className="absolute" aria-hidden="true">
                  <ArrowUpRight className="size-3.5" />
                </motion.span>
              )}
            </span>
          </span>
        </div>
      </MotionLink>
    </motion.li>
  );
}

function LeagueGrid({ leagues, liveIds }: { leagues: League[]; liveIds: Set<string> }) {
  return (
    <motion.ul
      variants={gridVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {leagues.map((league) => (
        <LeagueCard key={league.id} league={league} live={liveIds.has(league.id)} />
      ))}
    </motion.ul>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shimmer">
      <div className="flex items-start gap-3.5">
        <div className="size-12 rounded-xl bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-muted rounded-md w-3/4" />
          <div className="h-3 bg-muted rounded-md w-1/3" />
        </div>
      </div>
      <div className="mt-4 mb-4 flex gap-1.5">
        <div className="h-6 w-20 rounded-md bg-muted" />
        <div className="h-6 w-16 rounded-md bg-muted" />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-3.5">
        <div className="h-3 w-24 bg-muted rounded-md" />
        <div className="size-7 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function SectionHeader({ label, count, accent = 'green' }: { label: string; count: number; accent?: 'green' | 'blue' | 'violet' }) {
  const countCls = accent === 'green'
    ? 'bg-green-500/10 text-green-500 border-green-500/20 dark:text-green-400'
    : accent === 'violet'
      ? 'bg-violet-500/10 text-violet-500 border-violet-500/20 dark:text-violet-400'
      : 'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:text-blue-400';

  return (
    <div className="flex items-center gap-3 mb-5 animate-fade-in-up">
      <div className="section-label">{label}</div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${countCls}`}>
        {count}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

/** Signed-in dashboard — the server page only renders this when a session exists. */
export default function HomeDashboard() {
  const [sections, setSections] = useState<LeagueSections>(EMPTY_SECTIONS);
  // Leagues with an auction running right now — the badge is this screen's only
  // hint that there's something live to jump back into.
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/leagues')
      .then((r) => (r.ok ? r.json() : EMPTY_SECTIONS))
      .then((data) => {
        setSections({
          created: Array.isArray(data.created) ? data.created : [],
          coOrganizing: Array.isArray(data.coOrganizing) ? data.coOrganizing : [],
          joined: Array.isArray(data.joined) ? data.joined : [],
        });
        setLiveIds(new Set<string>(Array.isArray(data.liveLeagueIds) ? data.liveLeagueIds : []));
      })
      .catch(() => setSections(EMPTY_SECTIONS))
      .finally(() => setLoading(false));
  }, []);

  const isEmpty = !loading && sections.created.length === 0 && sections.coOrganizing.length === 0 && sections.joined.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Page header */}
      <div className="flex items-start justify-between mb-10 animate-fade-in-up">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-gradient-green">My Leagues</h1>
          <p className="text-muted-foreground text-sm">
            Leagues you&apos;ve created, help organize, or joined as a player
          </p>
        </div>
        <button
          onClick={() => router.push('/leagues/new')}
          className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4" />
          New
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
        <section className="mb-10">
          <SectionHeader label="Created by you" count={sections.created.length} accent="green" />
          <LeagueGrid leagues={sections.created} liveIds={liveIds} />
        </section>
      )}

      {/* Leagues the user helps run as a co-organizer */}
      {!loading && sections.coOrganizing.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Co-organizing" count={sections.coOrganizing.length} accent="violet" />
          <LeagueGrid leagues={sections.coOrganizing} liveIds={liveIds} />
        </section>
      )}

      {/* Joined leagues */}
      {!loading && sections.joined.length > 0 && (
        <section>
          <SectionHeader label="Joined" count={sections.joined.length} accent="blue" />
          <LeagueGrid leagues={sections.joined} liveIds={liveIds} />
        </section>
      )}
    </div>
  );
}
