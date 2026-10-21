import Link from 'next/link';
import { Check, Eye, Link2, Trophy } from 'lucide-react';
import PlayerCard from '@/components/PlayerCard';
import { cloudinaryImage } from '@/lib/utils';
import type { Player, PlayerRole } from '@/lib/types';
import type {
  ShowcaseAuction,
  ShowcaseCard,
  ShowcaseRoster,
  ShowcaseStandings,
} from '@/lib/landingShowcase';

/* Pictures for the landing page, drawn from real public leagues
   (`getLandingShowcase`). Every one has a sample fallback for when there is no
   data to show — a fresh database, or a failed query — so the page never
   renders an empty frame. Sample names are made up; real ones are never mixed
   with invented figures. */

/* `PlayerCard`'s own size. Duplicated rather than imported: the component is a
   client module, and a constant imported from one into a server component
   arrives as a client reference, not a number. Keep in step with CARD_W/H. */
const CARD_W = 340;
const CARD_H = 481;

/** The rupee sign isn't in the display face, so it's set in the sans at a
    slightly smaller size instead of falling back to a mismatched serif. */
function Price({ value }: { value: number }) {
  return (
    <>
      <span className="mr-[0.06em] align-[0.1em] font-sans text-[0.62em] font-medium">₹</span>
      {Math.round(value).toLocaleString('en-IN')}
    </>
  );
}

const ROLE_LABEL: Record<PlayerRole, string> = {
  Batter: 'Batter',
  Bowler: 'Bowler',
  'All-Rounder': 'All-rounder',
  'Wicket-Keeper Batter': 'Wicket-keeper',
};

/** A cricket ground from above — boundary rope, thirty-yard circle, pitch. */
function FieldMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" className={className} aria-hidden="true">
      <circle cx="200" cy="200" r="196" stroke="currentColor" />
      <circle cx="200" cy="200" r="124" stroke="currentColor" strokeDasharray="1.5 7" strokeLinecap="round" />
      <rect x="191" y="164" width="18" height="72" rx="1" stroke="currentColor" />
      <path d="M186 174h28M186 226h28" stroke="currentColor" />
    </svg>
  );
}

/**
 * The real `PlayerCard`, shrunk. `scaleVar` names a CSS custom property set by
 * the parent, so one card can take different sizes per breakpoint. The box is
 * sized to the scaled card so layout around it stays honest.
 */
function ScaledCard({
  card,
  scaleVar,
  priority,
}: {
  card: ShowcaseCard;
  scaleVar: string;
  priority?: boolean;
}) {
  return (
    <div
      style={{
        width: `calc(${CARD_W}px * var(${scaleVar}))`,
        height: `calc(${CARD_H}px * var(${scaleVar}))`,
      }}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          transform: `scale(var(${scaleVar}))`,
          transformOrigin: 'top left',
        }}
      >
        <PlayerCard
          player={card.player}
          templateId={card.templateId}
          leagueName={card.leagueName}
          conductedBy={card.conductedBy}
          logoUrl={card.logoUrl}
          priority={priority}
        />
      </div>
    </div>
  );
}

/* ── Sample data, for when there are no public leagues to draw from ────────── */

function samplePlayer(id: string, name: string, role: PlayerRole, bowling: Player['bowlingType']): Player {
  return {
    id,
    leagueId: 'preview',
    name,
    photo: '',
    battingType: 'Right-Hand Bat',
    bowlingType: bowling,
    role,
    isWicketKeeper: role === 'Wicket-Keeper Batter',
    creatorToken: '',
    createdAt: '2026-01-10T00:00:00.000Z',
  };
}

const SAMPLE_CARDS: ShowcaseCard[] = [
  { name: 'Arun Kumar', role: 'All-Rounder' as const, bowling: 'Right-Arm Off-Spin' as const, template: 'classic-green' },
  { name: 'Sanju Thomas', role: 'Wicket-Keeper Batter' as const, bowling: 'N/A' as const, template: 'ocean-deep' },
  { name: 'Vignesh Raj', role: 'Bowler' as const, bowling: 'Right-Arm Fast' as const, template: 'fiery-ember' },
].map((s, i) => ({
  player: samplePlayer(`sample-${i}`, s.name, s.role, s.bowling),
  templateId: s.template,
  leagueId: '',
  leagueName: 'Sunday Premier League',
  conductedBy: 'League Organiser',
  logoUrl: '',
  teamName: null,
  soldPrice: null,
}));

/* ── Hero: three real cards fanned out, with the top one's sale ────────────── */

export function HeroVisual({ cards }: { cards: ShowcaseCard[] }) {
  const real = cards.length >= 3;
  const [front, left, right] = real ? cards : SAMPLE_CARDS;

  return (
    <figure className="m-0">
      <div
        className="relative mx-auto h-[330px] w-full max-w-[340px] [--back:0.46] [--dx:82px] [--front:0.56] sm:h-[460px] sm:max-w-[520px] sm:[--back:0.62] sm:[--dx:138px] sm:[--front:0.78]"
      >
        <FieldMotif className="absolute left-1/2 top-1/2 h-[112%] w-[112%] -translate-x-1/2 -translate-y-1/2 text-foreground/[0.08]" />

        <div
          className="absolute left-1/2 top-[9%] opacity-95"
          style={{ transform: 'translateX(calc(-50% - var(--dx))) rotate(-7deg)' }}
        >
          <ScaledCard card={left} scaleVar="--back" />
        </div>
        <div
          className="absolute left-1/2 top-[9%] opacity-95"
          style={{ transform: 'translateX(calc(-50% + var(--dx))) rotate(7deg)' }}
        >
          <ScaledCard card={right} scaleVar="--back" />
        </div>
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <ScaledCard card={front} scaleVar="--front" priority />
        </div>

        {real && front.soldPrice && front.teamName && (
          <div className="lp-surface absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full py-2 pl-4 pr-5 sm:bottom-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Sold to {front.teamName}
            </span>
            <span className="lp-display text-[22px] leading-none tabular-nums sm:text-[26px]">
              <Price value={front.soldPrice} />
            </span>
          </div>
        )}
      </div>
      {real && (
        <figcaption className="mt-5 text-center text-[12px] text-muted-foreground">
          Real cards from {[...new Set([front, left, right].map((c) => c.leagueName))].join(', ')}
        </figcaption>
      )}
    </figure>
  );
}

/* ── Showcase row: more real cards, each linking to its league ─────────────── */

export function CardShowcase({ cards }: { cards: ShowcaseCard[] }) {
  return (
    <ul className="lp-scroll-row flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6 [--row:0.58] sm:[--row:0.62]">
      {cards.map((c) => (
        <li key={c.player.id} className="shrink-0 snap-start">
          <Link href={`/leagues/${c.leagueId}`} className="group block">
            <div className="transition-transform duration-300 group-hover:-translate-y-1">
              <ScaledCard card={c} scaleVar="--row" />
            </div>
            <p className="mt-4 text-[13px] font-medium transition-colors group-hover:text-(--lp-accent)">
              {c.leagueName}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {c.soldPrice && c.teamName ? (
                <>
                  Sold to {c.teamName} · ₹{Math.round(c.soldPrice).toLocaleString('en-IN')}
                </>
              ) : (
                ROLE_LABEL[c.player.role]
              )}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── Chapter visuals ───────────────────────────────────────────────────────── */

function LiveTag({ label = 'Live' }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-(--lp-ball)">
      <span className="lp-live-dot" />
      {label}
    </span>
  );
}

function Avatar({ name, photo }: { name: string; photo: string }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cloudinaryImage(photo, { w: 72, h: 72 })}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-(--lp-gold)/40"
      />
    );
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return <span className="lp-monogram">{initials}</span>;
}

const SAMPLE_ROSTER: ShowcaseRoster = {
  leagueName: 'Sunday Premier League',
  players: [
    { id: 's1', name: 'Arun Kumar', photo: '', role: 'All-Rounder' },
    { id: 's2', name: 'Sanju Thomas', photo: '', role: 'Wicket-Keeper Batter' },
    { id: 's3', name: 'Vignesh Raj', photo: '', role: 'Bowler' },
  ],
};

export function RegistrationVisual({ roster }: { roster: ShowcaseRoster | null }) {
  const r = roster ?? SAMPLE_ROSTER;
  return (
    <div className="lp-surface w-full max-w-md rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Registration</p>
          <p className="mt-1 truncate text-[15px] font-medium">{r.leagueName}</p>
        </div>
        <span className="lp-chip lp-chip-accent">Open</span>
      </div>

      <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-[12.5px]">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">One join link for the whole squad</span>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {r.players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <Avatar name={p.name} photo={p.photo} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{p.name}</p>
              <p className="text-[12px] text-muted-foreground">{ROLE_LABEL[p.role]}</p>
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] font-medium text-(--lp-accent)">
              <Check className="h-3.5 w-3.5" />
              Card ready
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SAMPLE_AUCTION: ShowcaseAuction = {
  leagueId: '',
  leagueName: 'Sunday Premier League',
  topBuy: { name: 'Arun Kumar', role: 'All-Rounder', soldPrice: 24000, teamName: 'Strikers' },
  teams: [
    { name: 'Strikers', colorHex: '#1d4a35', budget: 100000, spent: 76000, squad: 9, maxPlayers: 11 },
    { name: 'Titans', colorHex: '#94701a', budget: 100000, spent: 53000, squad: 7, maxPlayers: 11 },
    { name: 'Warriors', colorHex: '#58625b', budget: 100000, spent: 41000, squad: 6, maxPlayers: 11 },
  ],
};

export function AuctionVisual({ auction }: { auction: ShowcaseAuction | null }) {
  const a = auction ?? SAMPLE_AUCTION;
  const real = auction !== null;
  return (
    <div className="lp-surface w-full max-w-md rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {real ? `${a.leagueName} · Top buy` : 'Lot 14 of 32'}
        </span>
        {real ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-(--lp-gold)">Sold</span>
        ) : (
          <LiveTag />
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <p className="truncate text-[12px] text-muted-foreground">
            {a.topBuy.name} · {ROLE_LABEL[a.topBuy.role]}
          </p>
          <p className="lp-display mt-1 text-[44px] leading-none tabular-nums">
            <Price value={a.topBuy.soldPrice} />
          </p>
        </div>
        {a.topBuy.teamName && (
          <span className="lp-chip lp-chip-active mb-1 max-w-[45%] truncate">{a.topBuy.teamName}</span>
        )}
      </div>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Purse spent</p>
      <div className="mt-3 space-y-4">
        {a.teams.map((t) => (
          <div key={t.name}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.colorHex }} />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                ₹{Math.round(t.spent).toLocaleString('en-IN')} · {t.squad} players
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-(--lp-accent)"
                style={{ width: `${Math.min(100, Math.round((t.spent / t.budget) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-[12.5px]">
        <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">Watch link — open to everyone, no sign-in</span>
      </div>
    </div>
  );
}

const SAMPLE_STANDINGS: ShowcaseStandings = {
  leagueId: '',
  leagueName: 'Sunday Premier League',
  rows: [
    { teamId: 'a', teamName: 'Strikers', colorHex: '#1d4a35', played: 6, won: 5, lost: 1, tied: 0, points: 10, nrr: null },
    { teamId: 'b', teamName: 'Titans', colorHex: '#94701a', played: 6, won: 4, lost: 2, tied: 0, points: 8, nrr: null },
    { teamId: 'c', teamName: 'Warriors', colorHex: '#58625b', played: 6, won: 2, lost: 4, tied: 0, points: 4, nrr: null },
  ],
};

export function AfterVisual({ standings }: { standings: ShowcaseStandings | null }) {
  const s = standings ?? SAMPLE_STANDINGS;
  return (
    <div className="relative w-full max-w-md">
      <div className="lp-surface rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Points table</span>
          <span className="truncate text-[11px] text-muted-foreground">{s.leagueName}</span>
        </div>
        <table className="mt-4 w-full text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="w-7 pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Team</th>
              <th className="pb-2 text-right font-medium">P</th>
              <th className="pb-2 text-right font-medium">W</th>
              <th className="pb-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r, i) => (
              <tr key={r.teamId} className="border-t border-border">
                <td className="py-3 text-muted-foreground">{i + 1}</td>
                <td className="max-w-0 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.colorHex }} />
                    <span className="truncate">{r.teamName}</span>
                    {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0 text-(--lp-gold)" />}
                  </span>
                </td>
                <td className="py-3 text-right text-muted-foreground">{r.played}</td>
                <td className="py-3 text-right text-muted-foreground">{r.won}</td>
                <td className="py-3 text-right font-semibold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The certificate is paper in both themes — it's made to be printed.
          Shown as the blank template it is, not issued to anyone. */}
      <div className="lp-certificate absolute -bottom-24 -right-4 hidden w-44 rotate-[4deg] p-1.5 sm:block" aria-hidden="true">
        <div className="flex flex-col items-center border border-[#b8902a]/45 px-3 py-3 text-center">
          <p className="text-[7px] font-semibold uppercase tracking-[0.28em] text-[#3d3a33]">Certificate</p>
          <p className="text-[5.5px] uppercase tracking-[0.24em] text-[#7a7466]">of participation</p>
          <p className="lp-display mt-2 text-[16px] italic leading-none text-[#8c8577]">Player name</p>
          <span className="mt-1.5 h-px w-16 bg-[#b8902a]/50" />
          <p className="mt-1.5 max-w-full truncate text-[6.5px] font-medium text-[#8a6a1c]">{s.leagueName}</p>
        </div>
      </div>
    </div>
  );
}
