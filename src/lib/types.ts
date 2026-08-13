export type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper Batter';

/** Every role a player can have, in the app's canonical display order. */
export const PLAYER_ROLES: PlayerRole[] = ['Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper Batter'];

/**
 * Validates a pick-preference payload from a request body: an ordered list of
 * unique player roles, or null/empty to mean "no preference — pick randomly".
 * Returns undefined when the payload is malformed, so callers can 400.
 */
export function parsePickPreference(value: unknown): PlayerRole[] | null | undefined {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return null;
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string' || !PLAYER_ROLES.includes(v as PlayerRole) || seen.has(v)) return undefined;
    seen.add(v);
  }
  return value as PlayerRole[];
}

export interface League {
  id: string;
  name: string;
  totalPlayers: number;
  conductedBy: string;
  creatorId: string;
  templateId: string;
  logoUrl: string;
  isPublic: boolean;
  joinCode: string | null;
  /** When true, the creator has closed registration — non-creators can no longer join */
  registrationClosed: boolean;
  /**
   * Optional ordered role priority for the auction draw (e.g. all Bowlers,
   * then all Batters, then all All-Rounders). Roles left out of the list are
   * drawn last, together, at random. Null/empty means a pure random draw.
   */
  pickPreference: PlayerRole[] | null;
  /**
   * When the organizers released participation certificates, or null while they
   * haven't. Doubles as the issue date printed on the certificate — players can
   * only download one once this is set. See `LeagueCertificate`.
   */
  certificatesReleasedAt: string | null;
  createdAt: string;
}

export interface Player {
  id: string;
  leagueId: string;
  userId?: string | null;
  name: string;
  photo: string;
  battingType: 'Right-Hand Bat' | 'Left-Hand Bat';
  bowlingType:
    | 'Right-Arm Fast'
    | 'Right-Arm Medium'
    | 'Right-Arm Off-Spin'
    | 'Right-Arm Leg-Spin'
    | 'Left-Arm Fast'
    | 'Left-Arm Medium'
    | 'Left-Arm Spin'
    | 'N/A';
  role: PlayerRole;
  isWicketKeeper: boolean;
  creatorToken: string;
  /** Personal contact number — records only; never shown on cards/posters or exposed to non-creators */
  contactNumber?: string | null;
  createdAt: string;
  // Auction
  teamId?: string | null;
  soldPrice?: number | null;
  isUnsold?: boolean;
  /** Star player pre-assigned to a team before the auction */
  isIcon?: boolean;
  /** When this player is an icon, the team they're pre-assigned to (derived on the API). Null otherwise. */
  iconOfTeam?: { id: string; name: string; colorHex: string } | null;
  // Stats
  statsMatches?: number | null;
  statsRuns?: number | null;
  statsWickets?: number | null;
  statsAverage?: number | null;
  statsSR?: number | null;
}

export interface Team {
  id: string;
  leagueId: string;
  name: string;
  colorHex: string;
  budget: number;
  /** Squad size — how many players this team can buy in the auction */
  maxPlayers: number;
  createdAt: string;
}

/**
 * Non-playing member of a team (coach, manager, owner, …). Officials never take
 * part in the auction and don't affect budgets or squad size — they appear only
 * on the squad poster. `contactNumber` is for the organiser's records and is
 * not printed on the poster or exposed to non-creators.
 */
export interface TeamOfficial {
  id: string;
  leagueId: string;
  teamId: string;
  name: string;
  contactNumber: string | null;
  role: string;
  photo: string;
  createdAt: string;
}

/**
 * A sponsor/partner logo shown in the league's sponsor marquee. Sponsors
 * never affect the auction — they're purely a display/recognition feature.
 */
export interface Sponsor {
  id: string;
  leagueId: string;
  name: string;
  logoUrl: string;
  /** Optional link opened when the logo is clicked in the marquee */
  website: string | null;
  createdAt: string;
}

/**
 * A league's optional income & expense sheet, written as markdown by the
 * organizers (registration fees collected, sponsorship received, ground rent,
 * trophies, …). Entirely opt-in: most leagues never create one, and one that
 * exists stays a private draft until an organizer publishes it. Once published
 * it's readable by that league's members only — never by the public, even for
 * a public league.
 */
export interface LeagueLedger {
  leagueId: string;
  /** Markdown source. GFM tables are supported, raw HTML is not rendered. */
  content: string;
  published: boolean;
  /**
   * Name of the organizer who saved last. Shown to members too — for accounts,
   * knowing who published the numbers is the point. Null if that account is gone.
   */
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/leagues/[id]/ledger — the ledger plus the requester's rights over it. */
export interface LedgerResponse {
  /** False when no organizer has started a ledger for this league yet */
  exists: boolean;
  /** May edit and publish/unpublish — creator or co-organizer */
  canManage: boolean;
  /** Null for a manager viewing a league with no ledger yet */
  ledger: LeagueLedger | null;
}

export interface Match {
  id: string;
  leagueId: string;
  team1Id: string;
  team2Id: string;
  team1Score: string | null;
  team2Score: string | null;
  winnerTeamId: string | null;
  matchDate: string | null;
  createdAt: string;
}

/**
 * A user the creator has invited to help run a league. Co-organizers can do
 * everything the creator can — run the auction, manage players/teams, edit
 * settings — except delete the league or manage the co-organizer list itself.
 */
export interface CoOrganizer {
  userId: string;
  name: string;
  /** Only returned to the league creator (it's shown in the manage list); null for everyone else */
  email: string | null;
  photo: string;
  addedAt: string;
}

/**
 * One downloadable participation certificate, as listed in the player's own
 * profile. Assembled by `getCertificatesForUser` from the player's card plus
 * the league that released it — a league only appears here once its organizers
 * have set `certificatesReleasedAt`.
 *
 * Deliberately narrow: it carries only what the certificate prints and what the
 * profile list shows. No `creatorToken`, no `contactNumber`.
 */
export interface LeagueCertificate {
  leagueId: string;
  leagueName: string;
  conductedBy: string;
  logoUrl: string;
  templateId: string;
  playerId: string;
  playerName: string;
  role: PlayerRole;
  /** Team the player ended up with, when the auction placed them. */
  teamName: string | null;
  teamColorHex: string | null;
  /** Issue date shown on the certificate — the moment the organizers released. */
  releasedAt: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  photo: string;
  battingType: Player['battingType'];
  bowlingType: Player['bowlingType'];
  role: Player['role'];
  isWicketKeeper: boolean;
  /** Personal contact number — records only; never shown on cards/posters or exposed to non-creators */
  contactNumber?: string | null;
  updatedAt: string;
}

/** Shape returned by GET /api/leagues/[id] */
export interface LeagueWithPlayers extends Omit<League, 'creatorId'> {
  players: Player[];
  teams: Team[];
  officials: TeamOfficial[];
  isCreator: boolean;
  /** Creator OR co-organizer — may run the auction and manage league content */
  canManage: boolean;
  /** Users helping run this league besides the creator (emails only visible to the creator) */
  coOrganizers: CoOrganizer[];
  /** True when the requesting user has a card in this league (matched by userId) */
  hasJoined: boolean;
  /**
   * Whether this league has a *published* income & expense ledger. Drives the
   * Ledger link for members — organizers always get the link (it's how they
   * create one), so this is only consulted for everyone else.
   */
  ledgerPublished: boolean;
}

// ── Public (unauthenticated) league view ──────────────────────────────────────
// These types back the server-rendered page a logged-out visitor or a search
// crawler sees for a league its organizer marked public. They are defined as
// *narrow* shapes rather than Omit<> of the internal types on purpose: a field
// added to `Player` or `League` later cannot silently become public, because it
// has to be added here and mapped explicitly in `getPublicLeagueView`.
//
// Deliberately absent, and must stay absent: creatorId, creatorToken, joinCode,
// contactNumber, userId, co-organizer emails and the league ledger.

/** A player as shown publicly — identity, role, and their auction result. */
export interface PublicPlayer {
  id: string;
  name: string;
  photo: string;
  role: PlayerRole;
  battingType: Player['battingType'];
  bowlingType: Player['bowlingType'];
  isWicketKeeper: boolean;
  isIcon: boolean;
  /** Winning bid, when this player was sold. */
  soldPrice: number | null;
  statsMatches: number | null;
  statsRuns: number | null;
  statsWickets: number | null;
  statsAverage: number | null;
  statsSR: number | null;
}

/** A team with its public squad. `spent` is derived from the sold prices. */
export interface PublicTeam {
  id: string;
  name: string;
  colorHex: string;
  budget: number;
  maxPlayers: number;
  spent: number;
  players: PublicPlayer[];
  /** Non-playing staff: name and role only, never contact details. */
  officials: { id: string; name: string; role: string; photo: string }[];
}

/** A fixture or result, with team names resolved for display. */
export interface PublicMatch {
  id: string;
  team1Name: string;
  team2Name: string;
  team1Score: string | null;
  team2Score: string | null;
  winnerTeamName: string | null;
  matchDate: string | null;
  /** False while the match has no scores and no winner recorded. */
  played: boolean;
}

/** A row of the public points table. */
export interface PublicStanding {
  teamId: string;
  teamName: string;
  colorHex: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
}

/**
 * Everything the public league page renders. Assembled server-side by
 * `getPublicLeagueView`, which returns null for a league that doesn't exist or
 * that the organizer has not marked public.
 */
export interface PublicLeagueView {
  id: string;
  name: string;
  conductedBy: string;
  logoUrl: string;
  /** Squad size the organizer declared when creating the league. */
  totalPlayers: number;
  registrationClosed: boolean;
  createdAt: string;
  teams: PublicTeam[];
  /** Sold players, highest bid first — the auction result. */
  soldPlayers: PublicPlayer[];
  /** Players the auction passed over. */
  unsoldPlayers: PublicPlayer[];
  /** Registered players not yet sold, unsold or assigned to a team. */
  availablePlayers: PublicPlayer[];
  matches: PublicMatch[];
  standings: PublicStanding[];
  sponsors: { id: string; name: string; logoUrl: string; website: string | null }[];
  /** Derived from whether any player has been sold and whether any remain. */
  auctionStatus: 'not-started' | 'in-progress' | 'complete';
  registeredPlayers: number;
  totalSpend: number;
}

/**
 * One entry on the global (system-wide) bid leaderboard: the highest winning
 * bids across every league. Flattened with the league/team context the board
 * needs so the client doesn't have to join anything.
 */
export interface TopBid {
  playerId: string;
  playerName: string;
  photo: string;
  soldPrice: number;
  isIcon: boolean;
  leagueId: string;
  leagueName: string;
  teamName: string;
  teamColor: string;
}

/** Whole-platform totals shown on the signed-out landing page */
export interface PlatformStats {
  leagues: number;
  players: number;
  teams: number;
  playersSold: number;
}

/** A team's purse summary shown on the live spectator board */
export interface LivePurse {
  id: string;
  name: string;
  color: string;
  budget: number | null;
  spent: number;
  count: number;
  maxPlayers: number | null;
  /** Highest bid this team can still place under the reserve-per-slot rule */
  maxBid: number | null;
  /** Players this team has bought, for the per-team breakdown modal */
  players: { name: string; price: number }[];
}

/**
 * Ephemeral live-auction state. The creator's auction page broadcasts it on
 * each transition; spectators poll it to mirror the auction in real time.
 * Player objects here are sanitized (never carry contactNumber).
 */
export interface LiveAuctionState {
  /** Monotonic sequence — lets spectators detect changes and new sales */
  v: number;
  phase: 'lobby' | 'idle' | 'picking' | 'showing' | 'sold' | 'unsold' | 'done';
  updatedAt: number;
  league: { name: string; conductedBy: string; logoUrl: string; templateId: string };
  /** Player currently on the block (during showing / sold) */
  current: Player | null;
  /** The just-completed sale, for the celebration moment */
  lastSold: { player: Player; teamName: string; teamColor: string; price: number } | null;
  progress: { sold: number; total: number; unsold: number; left: number; round: number };
  purses: LivePurse[];
}
