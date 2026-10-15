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

/** The kinds of document a player can submit as identity proof. */
export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Voter ID', 'Driving Licence', 'Other'] as const;
export type IdProofType = (typeof ID_PROOF_TYPES)[number];

/**
 * Validates an identity-proof type from a request body. Returns `null` for
 * "cleared", the type for a good one, and `undefined` when the payload is
 * malformed so callers can 400 — same contract as `parsePickPreference`.
 */
export function parseIdProofType(value: unknown): IdProofType | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  return ID_PROOF_TYPES.includes(value as IdProofType) ? (value as IdProofType) : undefined;
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
  /**
   * When true, a player can't self-register a card here without an identity
   * proof on their profile. Opt-in per league and false by default, so leagues
   * created before the feature existed are unaffected.
   */
  idProofRequired: boolean;
  /**
   * When true, a player can't self-register a card here without attaching a
   * payment receipt. Opt-in per league and false by default. Unlike the
   * identity document this one is per *card* — an entry fee is paid to one
   * league, so it never carries across to another.
   */
  paymentProofRequired: boolean;
  /**
   * When false, a player opening this league sees only their own card and the
   * icon players — the rest of the roster is withheld. Organizers (and the
   * platform owner) always see everyone. Defaults to true, so leagues created
   * before the switch existed are unaffected.
   *
   * This governs the league's *own* roster listing. It is not a substitute for
   * making a league private: a public league is served to logged-out visitors
   * by `getPublicLeagueView`, which publishes every player by design.
   */
  rosterVisibleToPlayers: boolean;
  /**
   * When false, only the league's organizers may delete a player card — the
   * `creatorToken` that normally proves card ownership no longer authorises a
   * delete. Editing is untouched either way, so a player can still fix their
   * own photo or stats. Defaults to true.
   */
  playersCanDeleteCards: boolean;
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
  /**
   * Cloudinary URL of the entry-fee receipt for *this* league. Organizer-grade
   * PII like `contactNumber` — a payment screenshot carries account handles —
   * so it is stripped for anyone who can't manage the league, and never goes on
   * a card, poster or PDF.
   */
  paymentProofUrl?: string | null;
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

/**
 * One player's documents on the organizer's register.
 *
 * The two come from different places, which is why they behave differently.
 * The identity document is read off the *user account* the card is linked to,
 * so a card with no `userId` can never carry one — that shows up as
 * `linked: false`, a different problem from a linked player who simply hasn't
 * uploaded yet. The payment receipt is on the card itself, so it works for
 * anonymous cards too.
 */
export interface PlayerDocuments {
  playerId: string;
  playerName: string;
  photo: string;
  /** Whether this card belongs to a signed-in account at all. */
  linked: boolean;
  idProofType: IdProofType | null;
  /** Cloudinary URL of the ID document — organizers only. Null when not submitted. */
  idProofUrl: string | null;
  /** When the owning account last saved their profile, or null if unlinked. */
  idSubmittedAt: string | null;
  /** Cloudinary URL of this league's entry-fee receipt — organizers only. */
  paymentProofUrl: string | null;
  /**
   * The organizer's own confirmation that this player's entry fee arrived,
   * ticked by hand on the register. Independent of `paymentProofUrl`: a receipt
   * is what the player claims, this is what the organizer verified, and fees
   * paid in cash have the second without ever having the first. Deliberately
   * absent from `Player` — it is written only through the organizer-gated
   * register, never through the player PATCH a card holder can call.
   */
  paymentReceived: boolean;
  /** The team this card is in — bought at auction or pre-assigned as an icon. Null while it has none. */
  teamId: string | null;
}

/** GET /api/leagues/[id]/identity — the organizer's document register. */
export interface LeagueDocumentsResponse {
  leagueName: string;
  /** Whether this league makes an ID mandatory for self-registration. */
  idRequired: boolean;
  /** Whether this league makes a payment receipt mandatory for self-registration. */
  paymentRequired: boolean;
  players: PlayerDocuments[];
  /** Just enough of each team to group the register's team-wise payment lists. */
  teams: Pick<Team, 'id' | 'name' | 'colorHex'>[];
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
  /** Which document `idProofUrl` is a photo of, or null when none is on file. */
  idProofType?: IdProofType | null;
  /**
   * Cloudinary URL of the identity document. Organizer-grade PII — it goes to
   * the player themselves and to the managers of a league they have a card in,
   * and nowhere else. Never put it on a player card, poster or PDF.
   */
  idProofUrl?: string | null;
  updatedAt: string;
}

/**
 * A PickBid account that could be added to a league as a player — one hit from
 * GET /api/leagues/[id]/players/candidates.
 *
 * Every field but `email` is a player-card field, because that is what this
 * shape is for: the account's own cricket profile is copied onto the new card,
 * so the organizer picks a person rather than filling a form. `email` is what
 * links the card back to that account and what tells two people with the same
 * name apart.
 *
 * Organizer-grade like `Player.contactNumber`, so it is only ever served
 * behind `requireLeagueManager`.
 */
export interface LeagueUserCandidate {
  userId: string;
  name: string;
  email: string;
  photo: string;
  battingType: Player['battingType'];
  bowlingType: Player['bowlingType'];
  role: PlayerRole;
  isWicketKeeper: boolean;
  /** Organizer-only, exactly like `Player.contactNumber`. */
  contactNumber?: string | null;
}

/**
 * Shape returned by GET /api/leagues/[id]/nav — the league sidebar's entire
 * data source.
 *
 * Deliberately scalar-only. The sidebar renders on every league screen, so it
 * must not pull the roster: `playerCount` and `hasAuctionData` are counted in
 * SQL precisely so the cards stay out of this payload. Nothing organizer-only
 * (contact numbers, receipts, co-organizer emails) belongs here either — it
 * is served to members and, for a public league, to any signed-in visitor.
 */
export interface LeagueNavSummary {
  id: string;
  name: string;
  isPublic: boolean;
  joinCode: string | null;
  templateId: string;
  certificatesReleasedAt: string | null;
  rosterVisibleToPlayers: boolean;
  playersCanDeleteCards: boolean;
  /** Strictly the true creator — never the platform owner. Gates Delete and Co-Organizers. */
  isCreator: boolean;
  /** Creator, co-organizer or platform owner. Gates the whole Manage group. */
  canManage: boolean;
  /** Member of this league (own card, co-organizer or creator) — gates the Ledger link. */
  isMember: boolean;
  ledgerPublished: boolean;
  /** True signup count, used only to enable/disable Release Certificates. */
  playerCount: number;
  /** A non-icon player is on a team, or someone is flagged unsold — Reset Auction has work to do. */
  hasAuctionData: boolean;
}

/** Shape returned by GET /api/leagues/[id] */
export interface LeagueWithPlayers extends Omit<League, 'creatorId'> {
  /**
   * The roster this requester is allowed to see. Normally every registered
   * card; trimmed to the requester's own cards plus the icon players when the
   * league has `rosterVisibleToPlayers` off — read `registeredPlayers`, never
   * `players.length`, for how many people have actually signed up.
   */
  players: Player[];
  /**
   * How many cards the league really holds, independent of what `players`
   * carries. Always the true count, so the slots-filled meter stays honest for
   * a player looking at a hidden roster.
   */
  registeredPlayers: number;
  /** True when `players` was trimmed above — the cue to explain the gap. */
  rosterHidden: boolean;
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
  /**
   * Set only while an auction is actually being run right now. It drives the
   * LIVE banner and its resume/watch links — without it the running auction is
   * unreachable from the app, since the watch link lives inside the auction
   * console's share modal. Null when nothing has been broadcast, when the
   * auction finished, or when the last push went stale.
   */
  liveAuction: LiveAuctionSummary | null;
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
  /** When the card was made — printed on the card as its date and season. */
  createdAt: string;
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
  /**
   * Set while an auction is being run right now, so the page can point at the
   * public watch screen. Distinct from `auctionStatus`, which describes the
   * results on record rather than whether anyone is bidding this minute.
   */
  liveAuction: LiveAuctionSummary | null;
  registeredPlayers: number;
  totalSpend: number;
}

/**
 * One entry on the global (system-wide) bid leaderboard: the biggest buys
 * across every league. Flattened with the league/team context the board needs
 * so the client doesn't have to join anything.
 *
 * The board ranks on `purseShare`, not `soldPrice` — leagues set their own
 * budgets, so rupee totals from a ₹1 lakh league and a ₹10 crore league aren't
 * comparable. `soldPrice` is still carried for display.
 */
export interface TopBid {
  playerId: string;
  playerName: string;
  photo: string;
  soldPrice: number;
  /** The buying team's full purse — the denominator behind `purseShare`. */
  teamBudget: number;
  /** `soldPrice / teamBudget`, 0–1. The leaderboard's ranking key. */
  purseShare: number;
  isIcon: boolean;
  leagueId: string;
  leagueName: string;
  teamName: string;
  teamColor: string;
  /**
   * The same player's *other* big buys, best-first — empty for most players.
   * A regular who goes big in three leagues would otherwise fill three of the
   * twenty slots, so the board shows their best buy and folds the rest in here
   * for the count badge and its tooltip.
   */
  otherBuys: TopBidAppearance[];
}

/** One of a player's runner-up buys, folded into their `TopBid`. */
export interface TopBidAppearance {
  leagueId: string;
  leagueName: string;
  teamName: string;
  soldPrice: number;
  purseShare: number;
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
  /**
   * Everyone still to be called — the pool first, then the unsold queue waiting
   * on the next round. Names and roles only: enough for the watch screen's
   * "Left" list without dragging photos or stats through a blob that every
   * spectator polls every 1.5s. Who is sold is already implicit in `purses`.
   *
   * Optional because boards broadcast before this field existed don't carry it
   * — read it as `?? []` and say "not sent yet" rather than "nobody left".
   */
  remaining?: { name: string; role: PlayerRole; isUnsold: boolean }[];
}

/**
 * How long a broadcast keeps counting as live without a fresh push. The auction
 * page only posts on transitions, so a slow bidding round can sit quiet for a
 * while — but a board nobody has touched in half an hour is a tab someone left
 * open, not an auction in progress.
 */
export const LIVE_AUCTION_TTL_MS = 30 * 60 * 1000;

/**
 * "An auction is running right now" — the compact form of `LiveAuctionState`
 * that drives the LIVE banner and its links. It carries no players, purses or
 * contact numbers, so it is safe for anyone who can see the league at all, and
 * cheap enough to poll.
 */
export interface LiveAuctionSummary {
  phase: LiveAuctionState['phase'];
  round: number;
  sold: number;
  total: number;
  /** Server clock, not the auctioneer's device — ISO 8601. */
  updatedAt: string;
}

// ── Rewards: badges & streaks ─────────────────────────────────────────────────
// Badges are *derived*: `getRewardMetrics` counts these from the tables the app
// already keeps (cards, auction results, matches, leagues), and the catalog in
// `src/lib/badges.ts` turns the numbers into tiers. Everything here is private
// to the user it describes — none of it belongs on a card, poster or spectator
// screen.

/**
 * Every number a badge can be earned on. Adding a badge on an existing metric
 * is a catalog entry only; a new metric also needs a column in
 * `getRewardMetrics` and a key here.
 */
export interface RewardMetrics extends StoredRewardMetrics, DerivedRewardMetrics {}

/**
 * The metrics `getRewardMetrics` counts in SQL. "Your leagues" below means
 * leagues this account *created* — co-organizers have their own badge, but
 * the organizer counts follow the creator, as `creatorId` does everywhere else.
 * A match "counts" once it has a score or a winner, as in `calcStandings`; a
 * "buy" is a non-icon card on a team at a price, as on the bid leaderboard.
 */
export interface StoredRewardMetrics {
  // ── As a player ──
  /** Player cards linked to this account, across every league. */
  cards: number;
  /** 1 once the cricket profile has been saved, else 0. */
  profileCompleted: number;
  /** 1 when an identity document is on the profile, else 0. */
  idProofOnFile: number;
  /** Cards wearing an uploaded photo rather than the Google avatar. */
  uploadedPhotos: number;
  /** Cards whose entry fee an organizer has confirmed. */
  feesConfirmed: number;
  /** Distinct leagues this account has a card in. */
  leaguesJoined: number;
  /** Most leagues played under any one organizer, not counting this account's own. */
  clubLoyalty: number;
  /** Other people's leagues where this account's card was among the first three in. */
  earlyBirds: number;
  /** Leagues this account both plays in and helps run. */
  playerManager: number;
  /** Cards bought at auction. */
  timesBought: number;
  /** Biggest single buy as a share of the buying team's purse, 0–1. */
  bestPurseShare: number;
  /** Leagues where this account's buy was the auction's highest (ties count). */
  recordBuys: number;
  /** Buys for 5% of the purse or less. */
  steals: number;
  /** Cards named an icon player. */
  iconPicks: number;
  /** Results recorded for a team this account's card was on. */
  matchesPlayed: number;
  /** Matches won by a team this account's card was on. */
  matchWins: number;
  /** Leagues (3+ results) where that team tops the points table, ties included. */
  tableTops: number;
  /** Leagues where that team won every one of at least three matches. */
  invincibles: number;
  /** Leagues that have released this account's participation certificate. */
  certificates: number;
  /** 1 when a contact number is on the profile, else 0. */
  contactOnFile: number;
  /** Different organizers whose leagues this account has played in (its own excluded). */
  organizersPlayedFor: number;
  /** Registrations in the biggest league this account has a card in. */
  biggestLeagueJoined: number;
  /** Public leagues this account has a card in. */
  publicLeaguesJoined: number;
  /** Leagues where this account's card took the last spot before the player target. */
  lastManIn: number;
  /** Cards made before the early-adopter cutoff. */
  earlyCards: number;
  /** Most leagues shared a team with any one other player. */
  partnerLeagues: number;
  /** Different signed-in players this account has shared a team with. */
  teammates: number;
  /** Cards registered with an entry-fee receipt attached. */
  receiptsAttached: number;

  // ── At auction ──
  /** Buys that were the most expensive in the buying team. */
  franchiseBuys: number;
  /** Buys above the average buy of the same auction. */
  premiumBuys: number;
  /** Cards currently marked unsold. */
  unsoldCount: number;
  /** Buys registered as a fast or medium bowler. */
  paceBuys: number;
  /** Buys registered as a spinner. */
  spinBuys: number;
  /** Buys registered as a wicketkeeper. */
  keeperBuys: number;
  /** Buys registered as a Batter. */
  batterBuys: number;
  /** Buys registered as an All-Rounder. */
  allRounderBuys: number;
  /** Buys registered as a Bowler. */
  bowlerBuys: number;
  /** Buys registered as a left-hand bat. */
  leftHandBuys: number;
  /** Buys in an auction that was broadcast live. */
  broadcastBuys: number;

  // ── On the field ── (scores are parsed from their leading runs, e.g. "152/6")
  /** Highest total posted by a team this account was on. */
  bestTeamScore: number;
  /** Wins by 50 runs or more. */
  bigWins: number;
  /** Results with no winner and level scores. */
  ties: number;
  /** Leagues (3+ results) where that team sits alone in second on points. */
  runnerUps: number;
  /** Matches played on a Saturday or Sunday. */
  weekendMatches: number;
  /** Matches played June–September. */
  monsoonMatches: number;
  /** Matches played November–February. */
  winterMatches: number;
  /** Matches played March–May. */
  summerMatches: number;
  /** Most matches against any one opposing team. */
  rivalMeetings: number;
  /** Points-table points earned across every team this account played for. */
  teamPoints: number;
  /** Leagues this account created. */
  leaguesCreated: number;
  /** Your leagues listed publicly in Discover. */
  publicLeagues: number;
  /** Your leagues with a logo. */
  leaguesWithLogo: number;
  /** Your leagues that require an ID or entry-fee proof to register. */
  proofLeagues: number;
  /** Your leagues that reached their declared player target. */
  fullHouses: number;
  /** Registrations in your biggest league. */
  biggestLeague: number;
  /** Teams across your leagues. */
  teamsBuilt: number;
  /** Team officials across your leagues. */
  officialsAdded: number;
  /** Sponsors across your leagues. */
  sponsorsAdded: number;
  /** Co-organizers brought into your leagues. */
  coOrganizersAdded: number;
  /** Other people's leagues this account co-organizes. */
  coOrganizing: number;
  /** Your leagues that have held an auction (at least one buy). */
  auctionsRun: number;
  /** Players bought across your auctions. */
  playersSold: number;
  /** Your auctions (8+ players) where every non-icon player was bought. */
  soldOuts: number;
  /** Entry fees confirmed across your leagues. */
  feesConfirmedForLeagues: number;
  /** Your leagues with a published ledger. */
  ledgersPublished: number;
  /** Match results recorded across your leagues. */
  resultsRecorded: number;
  /** Your leagues that have released certificates. */
  certificatesReleased: number;
  /** Your leagues with registration closed. */
  closedRegistrations: number;
  /** Your leagues with a pick order set for the auction draw. */
  pickPlans: number;
  /** Different card templates across your leagues. */
  templatesUsed: number;
  /** Your leagues that reached their player target within a week. */
  rapidFills: number;
  /** Your leagues (2+ teams) where every squad is full. */
  fullStrengths: number;
  /** Fixtures given a date across your leagues. */
  fixturesScheduled: number;
  /** Your leagues (5+ fixtures) with a result for every fixture. */
  seasonsCompleted: number;
  /** Different signed-in players across your leagues. */
  distinctPlayers: number;
  /** Players who have joined two or more of your leagues. */
  returningPlayers: number;
  /** Sponsors in your best-sponsored league. */
  maxSponsorsInLeague: number;
  /** Icon players named across your leagues. */
  iconsNamed: number;
  /** Your leagues whose auction was broadcast live. */
  broadcasts: number;
  /** Players bought in your biggest single auction. */
  biggestAuction: number;
  /** Your leagues (8+ players) with every entry fee confirmed. */
  allPaidLeagues: number;
  /** Your leagues (2+ teams) where every team has an official. */
  staffedLeagues: number;
  /** Days since your first league was created. */
  leagueAgeDays: number;
}

/** Metrics worked out in `rewards.ts` from the streak row, sequences and earned badges. */
export interface DerivedRewardMetrics {
  /** Longest run of consecutive active weeks. */
  weeklyStreakLongest: number;
  /** The run of active weeks ending this week. */
  weeklyStreakCurrent: number;
  /** Active weeks among the last 52. */
  activeWeeks: number;
  /** Longest run of consecutive auctions this account was picked in. */
  pickStreakLongest: number;
  /** The run of picks ending at this account's most recent auction. */
  pickStreakCurrent: number;
  /** Longest run of consecutive wins by a team this account was on. */
  winRunLongest: number;
  /** The best run of wins still going, across those teams. */
  winRunCurrent: number;
  /** Badge levels earned, milestones excluded. */
  badgeLevels: number;
  /** Gold levels earned, milestones excluded. */
  goldMedals: number;
  /** Silver levels earned, milestones excluded. */
  silverMedals: number;
  /** Bronze levels earned, milestones excluded. */
  bronzeMedals: number;
  /** Badge groups (milestones aside) with at least one badge earned. */
  categoriesCovered: number;
  /** Wins that came straight after a loss. */
  bounceBacks: number;
  /** Teams this account was on that won their first three matches. */
  flyingStarts: number;
  /** Returns after eight or more quiet weeks, within the last 52. */
  welcomeBacks: number;
  /** Different months this account's leagues started in. */
  monthsPlayed: number;
  /** Longest run of consecutive months with a league. */
  monthRunLongest: number;
  /** The run of months ending at the most recent one. */
  monthRunCurrent: number;
  /** Auctions entered, while every one of them was a pick — 0 once passed over. */
  cleanPickRecord: number;
}

export type RewardMetric = keyof RewardMetrics;

/** 1 bronze, 2 silver, 3 gold. A one-off badge only ever has tier 1. */
export type BadgeTier = 1 | 2 | 3;

export interface EarnedBadge {
  badgeId: string;
  tier: BadgeTier;
  earnedAt: string;
}

/** The weekly activity streak. Weeks run Monday–Sunday, India time. */
export interface WeeklyStreak {
  current: number;
  longest: number;
  /** One flag per week, oldest first; the last entry is the current week. */
  weeks: boolean[];
}

/** Consecutive auctions this account was picked in — bought, or named an icon. */
export interface PickStreak {
  current: number;
  longest: number;
  /** Auctions held in leagues this account had a card in. */
  auctions: number;
}

/** The closest badge tier still to earn — the "next up" nudge. */
export interface RewardGoal {
  badgeId: string;
  tier: BadgeTier;
  value: number;
  target: number;
}

/** Everything the `/rewards` page renders. Built by `getRewardsOverview`. */
export interface RewardsOverview {
  metrics: RewardMetrics;
  earned: EarnedBadge[];
  /** `badgeId:tier` keys the evaluation behind this payload awarded — the page celebrates these. */
  justUnlocked: string[];
  weekly: WeeklyStreak;
  pickStreak: PickStreak;
  next: RewardGoal | null;
  /**
   * Share of all accounts holding each `badgeId:tier`, 0–1. Cached for an hour,
   * so a tier earned since can be missing — read a miss as "not counted yet",
   * never as 0%.
   */
  rarity: Record<string, number>;
  /** When this was evaluated — the page's "now", so recency checks render the same on server and client. */
  evaluatedAt: string;
}

/**
 * POST /api/rewards/check-in — what the app shell needs after counting a visit:
 * the streak for the nav chip, anything unlocked for the toast, and the
 * dashboard strip's summary. Deliberately small; the full cabinet is the page.
 */
export interface RewardsCheckIn {
  streak: { current: number; longest: number };
  /** Tiers awarded by this very check-in. Empty on almost every call. */
  unlocked: EarnedBadge[];
  /** Distinct badges with at least one tier earned. */
  badgesEarned: number;
  next: RewardGoal | null;
}

// ── Super-admin dashboard ─────────────────────────────────────────────────────
// Platform-wide views served only to the env-configured owner account. These
// intentionally expose cross-league data (creator emails, private leagues) that
// no organizer-facing endpoint may return.

/** One league as the owner sees it: league row plus its live rollups. */
export interface AdminLeagueRow {
  id: string;
  name: string;
  conductedBy: string;
  logoUrl: string;
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  /** The organizer's declared target */
  totalPlayers: number;
  /** Cards actually registered */
  playerCount: number;
  teamCount: number;
  soldCount: number;
  /** Sum of every sold price in this league */
  auctionValue: number;
  isPublic: boolean;
  registrationClosed: boolean;
  certificatesReleasedAt: string | null;
  /** A live-auction blob exists, i.e. the auction has been broadcast at least once */
  hasLiveAuction: boolean;
  createdAt: string;
}

/** One registered account as the owner sees it. */
export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  photo: string;
  leaguesCreated: number;
  playerCards: number;
  profileCompleted: boolean;
  updatedAt: string | null;
}

/** A single day's registration counts, for the growth chart. */
export interface AdminTrendPoint {
  date: string;
  leagues: number;
  players: number;
}

/** Everything the admin dashboard's analytics view needs, in one payload. */
export interface AdminOverview {
  totals: {
    leagues: number;
    users: number;
    players: number;
    teams: number;
    matches: number;
    sponsors: number;
    publicLeagues: number;
    playersSold: number;
    /** Money moved across every auction on the platform */
    auctionValue: number;
    /** Leagues that have at least one sold player */
    auctionsRun: number;
  };
  /** New rows in the trailing 7- and 30-day windows */
  recent: {
    leagues7d: number;
    leagues30d: number;
    players7d: number;
    players30d: number;
  };
  /** Daily counts for the last 30 days, oldest first */
  trend: AdminTrendPoint[];
  /** Player-role distribution across the whole platform */
  roleSplit: { role: string; count: number }[];
  /** Biggest sales anywhere on the platform */
  topBids: TopBid[];
}
