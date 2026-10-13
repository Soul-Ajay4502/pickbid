import { getPublicLeagues, getPublicLeagueView } from './store';
import { cleanPlayerName, playerNameKey } from './utils';
import type { League, Player, PlayerRole, PublicLeagueView, PublicPlayer, PublicStanding } from './types';

/**
 * Real cards and results for the signed-out landing page.
 *
 * Built only from `getPublicLeagueView` — the one sanitized path by which
 * league content reaches a logged-out visitor — so the home page can never show
 * more than a league's own public page already does, and private leagues are
 * never read. Names go through `cleanPlayerName`, because organizers type
 * serial and phone numbers into them; a name with no letters at all is skipped
 * rather than shown raw.
 */

/** A card ready for `<PlayerCard>`, with the league details it prints. */
export interface ShowcaseCard {
  /** Shaped as a `Player` for the card component. Every private field is blank. */
  player: Player;
  templateId: string;
  leagueId: string;
  leagueName: string;
  conductedBy: string;
  logoUrl: string;
  teamName: string | null;
  soldPrice: number | null;
}

export interface ShowcaseRoster {
  leagueName: string;
  players: { id: string; name: string; photo: string; role: PlayerRole }[];
}

export interface ShowcaseAuction {
  leagueId: string;
  leagueName: string;
  topBuy: { name: string; role: PlayerRole; soldPrice: number; teamName: string };
  /** Biggest spenders first. */
  teams: { name: string; colorHex: string; budget: number; spent: number; squad: number; maxPlayers: number }[];
}

export interface ShowcaseStandings {
  leagueId: string;
  leagueName: string;
  rows: PublicStanding[];
}

export interface LandingShowcase {
  /** Interleaved across leagues, so neighbouring cards show different templates. */
  cards: ShowcaseCard[];
  roster: ShowcaseRoster | null;
  auction: ShowcaseAuction | null;
  standings: ShowcaseStandings | null;
}

/** How many of the newest public leagues are considered. */
const LEAGUES_SCANNED = 6;
/** A league needs this many photo cards to be featured — keeps half-built and test leagues off the home page. */
const MIN_PHOTO_CARDS = 8;
const CARDS_PER_LEAGUE = 4;
const MAX_CARDS = 9;

const HAS_LETTER = /\p{L}/u;

/**
 * Only photos the player uploaded for their card. A player who never uploads
 * one carries their Google avatar instead — a small profile picture that looks
 * poor at card size, and Google throttles a page that loads several at once.
 */
function showable(p: PublicPlayer): boolean {
  return p.photo.startsWith('https://res.cloudinary.com/') && HAS_LETTER.test(p.name);
}

/** Sold players by price first (the auction's headliners), then everyone else. */
function rosterByBid(view: PublicLeagueView): PublicPlayer[] {
  return [...view.soldPlayers, ...view.availablePlayers, ...view.unsoldPlayers].filter(showable);
}

function toCardPlayer(p: PublicPlayer, leagueId: string): Player {
  return {
    id:              p.id,
    leagueId,
    userId:          null,
    name:            cleanPlayerName(p.name),
    photo:           p.photo,
    battingType:     p.battingType,
    bowlingType:     p.bowlingType,
    role:            p.role,
    isWicketKeeper:  p.isWicketKeeper,
    creatorToken:    '',
    contactNumber:   null,
    paymentProofUrl: null,
    createdAt:       p.createdAt,
    soldPrice:       p.soldPrice,
    isIcon:          p.isIcon,
    // The icon badge is a button with a popover — nothing to click on a showcase.
    iconOfTeam:      null,
    statsMatches:    p.statsMatches,
    statsRuns:       p.statsRuns,
    statsWickets:    p.statsWickets,
    statsAverage:    p.statsAverage,
    statsSR:         p.statsSR,
  };
}

export async function getLandingShowcase(): Promise<LandingShowcase | null> {
  const leagues = await getPublicLeagues(LEAGUES_SCANNED);
  const views = await Promise.all(leagues.map((l) => getPublicLeagueView(l.id)));
  const pairs = leagues
    .map((league, i) => ({ league, view: views[i] }))
    .filter((x): x is { league: League; view: PublicLeagueView } => x.view !== null);

  const featured = pairs
    .map((x) => ({ ...x, roster: rosterByBid(x.view) }))
    .filter((x) => x.roster.length >= MIN_PHOTO_CARDS)
    .sort((a, b) => b.view.soldPlayers.length - a.view.soldPlayers.length);
  if (featured.length === 0) return null;

  // One appearance per person across the whole page. Regulars play in several
  // leagues — and a cloned season copies its cards — so the same face would
  // otherwise turn up once per league. Matched on the cleaned name and on the
  // photo, since either alone misses some repeats.
  const seen = new Set<string>();
  const takeIfNew = (p: PublicPlayer): boolean => {
    const keys = [`name:${playerNameKey(p.name)}`, `photo:${p.photo}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  };
  const queues = featured.map((x) => ({ ...x, next: 0 }));
  const nextNew = (q: (typeof queues)[number]): PublicPlayer | null => {
    while (q.next < q.roster.length) {
      const p = q.roster[q.next++];
      if (takeIfNew(p)) return p;
    }
    return null;
  };

  // Each league's headliners, dealt out round-robin so neighbouring cards show
  // different templates.
  const cards: ShowcaseCard[] = [];
  for (let round = 0; round < CARDS_PER_LEAGUE && cards.length < MAX_CARDS; round++) {
    for (const q of queues) {
      if (cards.length >= MAX_CARDS) break;
      const p = nextNew(q);
      if (!p) continue;
      const team = q.view.teams.find((t) => t.players.some((tp) => tp.id === p.id));
      cards.push({
        player:      toCardPlayer(p, q.view.id),
        templateId:  q.league.templateId,
        leagueId:    q.view.id,
        leagueName:  q.view.name,
        conductedBy: q.view.conductedBy,
        logoUrl:     q.view.logoUrl,
        teamName:    team?.name ?? null,
        soldPrice:   p.soldPrice,
      });
    }
  }

  // The registration list carries on from the same queue, so nobody on a
  // card appears again here.
  const top = queues[0];
  const rosterPlayers: PublicPlayer[] = [];
  while (rosterPlayers.length < 3) {
    const p = nextNew(top);
    if (!p) break;
    rosterPlayers.push(p);
  }
  const roster: ShowcaseRoster = {
    leagueName: top.view.name,
    players: rosterPlayers.map((p) => ({
      id: p.id, name: cleanPlayerName(p.name), photo: p.photo, role: p.role,
    })),
  };

  const sold = featured.find((x) => x.view.soldPlayers.some(showable));
  let auction: ShowcaseAuction | null = null;
  if (sold) {
    const best = sold.view.soldPlayers.find(showable)!;
    const team = sold.view.teams.find((t) => t.players.some((p) => p.id === best.id));
    auction = {
      leagueId:   sold.view.id,
      leagueName: sold.view.name,
      topBuy: {
        name:      cleanPlayerName(best.name),
        role:      best.role,
        soldPrice: best.soldPrice ?? 0,
        teamName:  team?.name ?? '',
      },
      teams: sold.view.teams
        .filter((t) => t.budget > 0)
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 3)
        .map((t) => ({
          name: t.name, colorHex: t.colorHex, budget: t.budget, spent: t.spent,
          squad: t.players.length, maxPlayers: t.maxPlayers,
        })),
    };
  }

  // Any public league with results on record will do — not only featured ones.
  const played = pairs.find((x) => x.view.standings.some((s) => s.played > 0));
  const standings: ShowcaseStandings | null = played
    ? { leagueId: played.view.id, leagueName: played.view.name, rows: played.view.standings.slice(0, 4) }
    : null;

  return { cards, roster: roster.players.length === 3 ? roster : null, auction, standings };
}
