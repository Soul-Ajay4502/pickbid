/**
 * The server-rendered page a logged-out visitor or a search crawler sees for a
 * public league.
 *
 * Everything here comes from `getPublicLeagueView`, which is the only sanitized
 * path out of the store — no client fetch, no session, so the full content is
 * present in the initial HTML. That is the point: the interactive league
 * workspace is a client component whose data arrives after hydration, which
 * left crawlers with an empty shell and left logged-out visitors at a sign-in
 * redirect. This renders the same facts as static HTML instead.
 *
 * A deliberate constraint: this component must never receive the internal
 * `League`/`Player` types. It takes `PublicLeagueView`, whose fields are all
 * safe to publish.
 */
import Link from 'next/link';
import Image from 'next/image';
import { Gavel, Users, Trophy, CalendarDays, Handshake, ShieldCheck } from 'lucide-react';
import LiveAuctionBanner from '@/components/league/LiveAuctionBanner';
import { formatINR } from '@/lib/utils';
import { SITE_NAME } from '@/lib/seo';
import type { PublicLeagueView, PublicPlayer } from '@/lib/types';

const AUCTION_STATUS_LABEL: Record<PublicLeagueView['auctionStatus'], string> = {
  'not-started': 'Auction not started',
  'in-progress': 'Auction in progress',
  complete: 'Auction complete',
};

function playerStyleSummary(player: PublicPlayer): string {
  const parts: string[] = [player.battingType];
  if (player.bowlingType && player.bowlingType !== 'N/A') parts.push(player.bowlingType);
  if (player.isWicketKeeper) parts.push('Wicket-keeper');
  return parts.join(' · ');
}

/** Player photos are optional; fall back to an initial rather than a broken box. */
function PlayerAvatar({ player, size }: { player: PublicPlayer; size: number }) {
  if (player.photo) {
    return (
      <Image
        src={player.photo}
        alt={`${player.name} — ${player.role}`}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0"
      style={{ width: size, height: size }}
    >
      {player.name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-lg font-black tracking-tight text-foreground">{value}</p>
    </div>
  );
}

export default function PublicLeagueView({ league }: { league: PublicLeagueView }) {
  const {
    id,
    name,
    conductedBy,
    logoUrl,
    teams,
    soldPlayers,
    unsoldPlayers,
    availablePlayers,
    matches,
    standings,
    sponsors,
    auctionStatus,
    liveAuction,
    registeredPlayers,
    totalSpend,
  } = league;

  const playedMatches = matches.filter((m) => m.played);
  const upcomingMatches = matches.filter((m) => !m.played);
  const hasTable = standings.some((s) => s.played > 0);
  const topBuys = soldPlayers.slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 animate-fade-in-up">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors duration-200">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/leagues/discover"
              className="hover:text-foreground transition-colors duration-200"
            >
              Cricket leagues
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground/80">{name}</li>
        </ol>
      </nav>

      {/* A logged-out visitor can follow the auction without an account — the
          watch screen is public, and this is the only place it's advertised. */}
      {liveAuction ? <LiveAuctionBanner leagueId={id} live={liveAuction} /> : null}

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-5">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`${name} logo`}
            width={88}
            height={88}
            className="h-22 w-22 rounded-2xl object-cover border border-border/60 shrink-0"
            priority
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
            Cricket league
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient-green wrap-break-word">
            {name}
          </h1>
          {conductedBy ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Conducted by {conductedBy}
            </p>
          ) : null}
        </div>
      </header>

      <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-3xl">
        {name} is a public cricket league on {SITE_NAME}
        {conductedBy ? `, run by ${conductedBy}` : ''}. This page shows the league&apos;s
        teams and squads, its player auction results, fixtures and results, and the
        current points table — {AUCTION_STATUS_LABEL[auctionStatus].toLowerCase()}.
      </p>

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="league-summary" className="mt-8">
        <h2 id="league-summary" className="sr-only">
          League summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile icon={Users} label="Players" value={String(registeredPlayers)} />
          <StatTile icon={ShieldCheck} label="Teams" value={String(teams.length)} />
          <StatTile icon={Gavel} label="Sold" value={String(soldPlayers.length)} />
          <StatTile
            icon={Trophy}
            label="Total spend"
            value={totalSpend > 0 ? formatINR(totalSpend) : '—'}
          />
        </div>
      </section>

      {/* ── On this page ─────────────────────────────────────────────────── */}
      <nav aria-label="Sections of this league page" className="mt-8">
        <ul className="flex flex-wrap gap-2 text-xs">
          {teams.length > 0 && (
            <li>
              <a
                href="#squads"
                className="inline-block rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground hover:border-primary/30"
              >
                View team squads
              </a>
            </li>
          )}
          {topBuys.length > 0 && (
            <li>
              <a
                href="#auction-results"
                className="inline-block rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground hover:border-primary/30"
              >
                View auction results
              </a>
            </li>
          )}
          {matches.length > 0 && (
            <li>
              <a
                href="#fixtures"
                className="inline-block rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground hover:border-primary/30"
              >
                View league fixtures and results
              </a>
            </li>
          )}
          {hasTable && (
            <li>
              <a
                href="#points-table"
                className="inline-block rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground hover:border-primary/30"
              >
                View the points table
              </a>
            </li>
          )}
        </ul>
      </nav>

      {/* ── Points table ─────────────────────────────────────────────────── */}
      {hasTable && (
        <section id="points-table" aria-labelledby="points-table-heading" className="mt-14">
          <h2
            id="points-table-heading"
            className="text-lg font-bold text-foreground mb-1 flex items-center gap-2"
          >
            <Trophy className="h-4 w-4 text-primary" />
            {name} points table
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Two points for a win, one each for a tie or no result.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Points table for {name}, ordered by points
              </caption>
              <thead className="bg-card/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Team</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">P</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">W</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">L</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">T</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.teamId} className="border-t border-border/40">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.colorHex }}
                        />
                        {row.teamName}
                      </span>
                    </th>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{row.played}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{row.won}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{row.lost}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{row.tied}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Fixtures & results ───────────────────────────────────────────── */}
      {matches.length > 0 && (
        <section id="fixtures" aria-labelledby="fixtures-heading" className="mt-14">
          <h2
            id="fixtures-heading"
            className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            {name} fixtures and results
          </h2>

          {playedMatches.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Results</h3>
              <ul className="space-y-2 mb-8">
                {playedMatches.map((match) => (
                  <li
                    key={match.id}
                    className="rounded-xl border border-border/60 bg-card/40 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {match.team1Name}
                      {match.team1Score ? ` ${match.team1Score}` : ''} v{' '}
                      {match.team2Name}
                      {match.team2Score ? ` ${match.team2Score}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {match.winnerTeamName ? `${match.winnerTeamName} won` : 'No result'}
                      {match.matchDate ? ` · ${match.matchDate}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {upcomingMatches.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">Upcoming fixtures</h3>
              <ul className="space-y-2">
                {upcomingMatches.map((match) => (
                  <li
                    key={match.id}
                    className="rounded-xl border border-border/60 bg-card/40 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {match.team1Name} v {match.team2Name}
                    </p>
                    {match.matchDate ? (
                      <p className="mt-1 text-xs text-muted-foreground">{match.matchDate}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ── Squads ───────────────────────────────────────────────────────── */}
      {teams.length > 0 && (
        <section id="squads" aria-labelledby="squads-heading" className="mt-14">
          <h2
            id="squads-heading"
            className="text-lg font-bold text-foreground mb-1 flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
            {name} teams and squads
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            {teams.length} {teams.length === 1 ? 'team' : 'teams'} with the players each
            bought at auction.
          </p>

          <div className="space-y-8">
            {teams.map((team) => (
              <article
                key={team.id}
                id={`team-${team.id}`}
                className="rounded-2xl border border-border/60 bg-card/30 p-5"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: team.colorHex }}
                    />
                    {team.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {team.players.length}
                    {team.maxPlayers ? ` / ${team.maxPlayers}` : ''} players
                    {team.spent > 0 ? ` · ${formatINR(team.spent)} spent` : ''}
                    {team.budget > 0
                      ? ` · ${formatINR(Math.max(team.budget - team.spent, 0))} left`
                      : ''}
                  </p>
                </header>

                {team.players.length > 0 ? (
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {team.players.map((player) => (
                      <li key={player.id} className="flex items-center gap-3">
                        <PlayerAvatar player={player} size={40} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {player.name}
                            {player.isIcon ? (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                                Icon
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {player.role}
                            {player.soldPrice ? ` · ${formatINR(player.soldPrice)}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No players bought yet.
                  </p>
                )}

                {team.officials.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border/40">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Team officials
                    </h4>
                    <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {team.officials.map((official) => (
                        <li key={official.id} className="text-xs text-muted-foreground">
                          <span className="text-foreground/80">{official.name}</span>
                          {official.role ? ` — ${official.role}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Auction results ──────────────────────────────────────────────── */}
      {topBuys.length > 0 && (
        <section id="auction-results" aria-labelledby="auction-results-heading" className="mt-14">
          <h2
            id="auction-results-heading"
            className="text-lg font-bold text-foreground mb-1 flex items-center gap-2"
          >
            <Gavel className="h-4 w-4 text-primary" />
            {name} auction results
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            The biggest winning bids of the {soldPlayers.length}-player auction.
          </p>
          <ol className="space-y-2">
            {topBuys.map((player, index) => (
              <li
                key={player.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3"
              >
                <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <PlayerAvatar player={player} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {player.role} · {playerStyleSummary(player)}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums shrink-0">
                  {player.soldPrice ? formatINR(player.soldPrice) : '—'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Players still to be auctioned / passed over ──────────────────── */}
      {(availablePlayers.length > 0 || unsoldPlayers.length > 0) && (
        <section aria-labelledby="registered-players-heading" className="mt-14">
          <h2 id="registered-players-heading" className="text-lg font-bold text-foreground mb-4">
            {name} registered players
          </h2>

          {availablePlayers.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">
                Yet to be auctioned ({availablePlayers.length})
              </h3>
              <ul className="grid sm:grid-cols-2 gap-2 mb-8">
                {availablePlayers.map((player) => (
                  <li key={player.id} className="flex items-center gap-3">
                    <PlayerAvatar player={player} size={32} />
                    <span className="text-sm text-foreground truncate">
                      {player.name}
                      <span className="text-muted-foreground"> · {player.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {unsoldPlayers.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-foreground/80 mb-3">
                Unsold ({unsoldPlayers.length})
              </h3>
              <ul className="grid sm:grid-cols-2 gap-2">
                {unsoldPlayers.map((player) => (
                  <li key={player.id} className="flex items-center gap-3">
                    <PlayerAvatar player={player} size={32} />
                    <span className="text-sm text-foreground truncate">
                      {player.name}
                      <span className="text-muted-foreground"> · {player.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ── Sponsors ─────────────────────────────────────────────────────── */}
      {sponsors.length > 0 && (
        <section aria-labelledby="sponsors-heading" className="mt-14">
          <h2
            id="sponsors-heading"
            className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"
          >
            <Handshake className="h-4 w-4 text-primary" />
            {name} sponsors
          </h2>
          <ul className="flex flex-wrap gap-4">
            {sponsors.map((sponsor) => (
              <li
                key={sponsor.id}
                className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 px-4 py-2.5"
              >
                {sponsor.logoUrl ? (
                  <Image
                    src={sponsor.logoUrl}
                    alt={`${sponsor.name} logo`}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded object-contain"
                  />
                ) : null}
                {sponsor.website ? (
                  <a
                    href={sponsor.website}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="text-sm text-foreground hover:text-primary transition-colors duration-200"
                  >
                    {sponsor.name}
                  </a>
                ) : (
                  <span className="text-sm text-foreground">{sponsor.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Conversion + internal links ──────────────────────────────────── */}
      <section aria-labelledby="cta-heading" className="mt-16 pt-10 border-t border-border/50">
        <h2 id="cta-heading" className="text-lg font-bold text-foreground mb-2">
          Run a cricket league like this one
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-2xl">
          {SITE_NAME} is free for organizers. Register your players, run a live player
          auction with team budgets, then track fixtures, results and the points table
          from one shareable link.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/leagues/new"
            className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Create your cricket league
          </Link>
          <Link
            href="/leagues/discover"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground hover:border-primary/30"
          >
            Browse other public leagues
          </Link>
        </div>

        <ul className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
          <li>
            <Link
              href="/cricket-auction"
              className="text-primary hover:underline underline-offset-2"
            >
              How a cricket auction works
            </Link>
          </li>
          <li>
            <Link
              href="/cricket-league-management"
              className="text-primary hover:underline underline-offset-2"
            >
              Cricket league management explained
            </Link>
          </li>
          <li>
            <Link
              href="/tools/cricket-fixture-generator"
              className="text-primary hover:underline underline-offset-2"
            >
              Generate fixtures for your teams
            </Link>
          </li>
          <li>
            <Link
              href="/leaderboard"
              className="text-primary hover:underline underline-offset-2"
            >
              Biggest auction buys across all leagues
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
