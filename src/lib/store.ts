import { v4 as uuidv4 } from 'uuid';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from './db';
import { UserModel, LeagueModel, PlayerModel, TeamModel, MatchModel, TeamOfficialModel, AuctionLiveModel, SponsorModel, LeagueCoOrganizerModel, LeagueLedgerModel } from './models';
import { calcStandings } from './standings';
import { EARLY_ADOPTER_CUTOFF } from './badges';
import { playerNameKey } from './utils';
import { LIVE_AUCTION_TTL_MS } from './types';
import type { BadgeTier, EarnedBadge, StoredRewardMetrics, IdProofType, PlayerDocuments, LeagueUserCandidate, League, Player, Team, Match, UserProfile, TeamOfficial, LiveAuctionState, LiveAuctionSummary, TopBid, PlatformStats, Sponsor, CoOrganizer, LeagueLedger, LeagueCertificate, PublicLeagueView, PublicPlayer, PublicTeam, PublicMatch, PublicStanding, AdminOverview, AdminLeagueRow, AdminUserRow, AdminTrendPoint } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLeague(row: LeagueModel): League {
  return {
    id:           row.id,
    name:         row.name,
    totalPlayers: row.totalPlayers,
    conductedBy:  row.conductedBy,
    creatorId:    row.creatorId!,
    templateId:   row.templateId ?? 'classic-green',
    logoUrl:      row.logoUrl ?? '',
    isPublic:     row.isPublic ?? false,
    joinCode:     row.joinCode ?? null,
    registrationClosed: row.registrationClosed ?? false,
    pickPreference: (row.pickPreference as League['pickPreference']) ?? null,
    certificatesReleasedAt: row.certificatesReleasedAt?.toISOString() ?? null,
    idProofRequired: row.idProofRequired ?? false,
    paymentProofRequired: row.paymentProofRequired ?? false,
    rosterVisibleToPlayers: row.rosterVisibleToPlayers ?? true,
    playersCanDeleteCards: row.playersCanDeleteCards ?? true,
    createdAt:    row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function toPlayer(row: PlayerModel): Player {
  return {
    id:             row.id,
    leagueId:       row.leagueId!,
    userId:         row.userId ?? null,
    name:           row.name,
    photo:          row.photo ?? '',
    battingType:    row.battingType as Player['battingType'],
    bowlingType:    row.bowlingType as Player['bowlingType'],
    role:           row.role as Player['role'],
    isWicketKeeper: row.isWicketKeeper ?? false,
    creatorToken:   row.creatorToken,
    contactNumber:  row.contactNumber ?? null,
    paymentProofUrl: row.paymentProofUrl ?? null,
    teamId:         row.teamId ?? null,
    soldPrice:      row.soldPrice ?? null,
    isUnsold:       row.isUnsold ?? false,
    isIcon:         row.isIcon ?? false,
    statsMatches:   row.statsMatches ?? null,
    statsRuns:      row.statsRuns ?? null,
    statsWickets:   row.statsWickets ?? null,
    statsAverage:   row.statsAverage ?? null,
    statsSR:        row.statsSR ?? null,
    createdAt:      row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function toTeam(row: TeamModel): Team {
  return {
    id:         row.id,
    leagueId:   row.leagueId!,
    name:       row.name,
    colorHex:   row.colorHex ?? '#22c55e',
    budget:     row.budget ?? 10000000,
    maxPlayers: row.maxPlayers ?? 11,
    createdAt:  row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function toMatch(row: MatchModel): Match {
  return {
    id:            row.id,
    leagueId:      row.leagueId!,
    team1Id:       row.team1Id,
    team2Id:       row.team2Id,
    team1Score:    row.team1Score ?? null,
    team2Score:    row.team2Score ?? null,
    winnerTeamId:  row.winnerTeamId ?? null,
    matchDate:     row.matchDate ?? null,
    createdAt:     row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function toProfile(row: UserModel): UserProfile | null {
  if (!row.profileCompleted) return null;
  return {
    userId:         row.id,
    name:           row.name ?? '',
    photo:          row.photo ?? '',
    battingType:    (row.battingType ?? 'Right-Hand Bat') as UserProfile['battingType'],
    bowlingType:    (row.bowlingType ?? 'N/A')            as UserProfile['bowlingType'],
    role:           (row.role ?? 'Batter')                as UserProfile['role'],
    isWicketKeeper: row.isWicketKeeper ?? false,
    contactNumber:  row.contactNumber ?? null,
    idProofType:    (row.idProofType ?? null) as UserProfile['idProofType'],
    idProofUrl:     row.idProofUrl ?? null,
    updatedAt:      row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function ensureUser(id: string, email: string): Promise<void> {
  await UserModel.findOrCreate({ where: { id }, defaults: { id, email } });
}

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Leagues ───────────────────────────────────────────────────────────────────

export async function getLeague(id: string): Promise<League | null> {
  const row = await LeagueModel.findByPk(id);
  return row ? toLeague(row) : null;
}

export async function getLeaguesByCreator(creatorId: string): Promise<League[]> {
  const rows = await LeagueModel.findAll({ where: { creatorId }, order: [['createdAt', 'DESC']] });
  return rows.map(toLeague);
}

export async function getLeaguesJoinedByUser(userId: string): Promise<League[]> {
  const playerRows = await PlayerModel.findAll({
    where: { userId },
    attributes: ['leagueId'],
    group: ['leagueId'],
  });
  const leagueIds = playerRows.map((p) => p.leagueId!);
  if (leagueIds.length === 0) return [];
  const rows = await LeagueModel.findAll({
    where: { id: { [Op.in]: leagueIds }, creatorId: { [Op.ne]: userId } },
    order: [['createdAt', 'DESC']],
  });
  return rows.map(toLeague);
}

export async function getPublicLeagues(limit = 50): Promise<League[]> {
  const rows = await LeagueModel.findAll({
    where: { isPublic: true },
    order: [['createdAt', 'DESC']],
    limit,
  });
  return rows.map(toLeague);
}

/**
 * Assembles the server-rendered public view of a league, or null when the
 * league doesn't exist or its organizer has not marked it public.
 *
 * This is the *only* path by which league content reaches an unauthenticated
 * page, so it maps every field explicitly onto the narrow `Public*` types
 * instead of spreading rows. `creatorToken`, `contactNumber`, `userId`,
 * `creatorId` and `joinCode` are never read here, and the ledger is not
 * fetched at all — it stays members-only even for a public league.
 */
export async function getPublicLeagueView(id: string): Promise<PublicLeagueView | null> {
  const league = await getLeague(id);
  if (!league || !league.isPublic) return null;

  const [players, teams, officials, matches, sponsors, liveAuction] = await Promise.all([
    getPlayers(id),
    getTeams(id),
    getOfficials(id),
    getMatches(id),
    getSponsors(id),
    getAuctionLiveSummary(id),
  ]);

  const toPublicPlayer = (p: Player): PublicPlayer => ({
    id:             p.id,
    name:           p.name,
    photo:          p.photo,
    role:           p.role,
    battingType:    p.battingType,
    bowlingType:    p.bowlingType,
    isWicketKeeper: p.isWicketKeeper,
    isIcon:         p.isIcon ?? false,
    soldPrice:      p.soldPrice ?? null,
    statsMatches:   p.statsMatches ?? null,
    statsRuns:      p.statsRuns ?? null,
    statsWickets:   p.statsWickets ?? null,
    statsAverage:   p.statsAverage ?? null,
    statsSR:        p.statsSR ?? null,
    createdAt:      p.createdAt,
  });

  const officialsByTeam = new Map<string, PublicTeam['officials']>();
  for (const o of officials) {
    const list = officialsByTeam.get(o.teamId) ?? [];
    list.push({ id: o.id, name: o.name, role: o.role, photo: o.photo });
    officialsByTeam.set(o.teamId, list);
  }

  const publicTeams: PublicTeam[] = teams.map((team) => {
    // Icon players carry a teamId without a sold price, so they belong to the
    // squad but contribute nothing to spend.
    const squad = players.filter((p) => p.teamId === team.id);
    return {
      id:         team.id,
      name:       team.name,
      colorHex:   team.colorHex,
      budget:     team.budget,
      maxPlayers: team.maxPlayers,
      spent:      squad.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0),
      players:    squad
        .slice()
        .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
        .map(toPublicPlayer),
      officials:  officialsByTeam.get(team.id) ?? [],
    };
  });

  const soldPlayers = players
    .filter((p) => p.teamId && (p.soldPrice ?? 0) > 0)
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
    .map(toPublicPlayer);
  const unsoldPlayers = players.filter((p) => p.isUnsold).map(toPublicPlayer);
  const availablePlayers = players
    .filter((p) => !p.teamId && !p.isUnsold)
    .map(toPublicPlayer);

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const publicMatches: PublicMatch[] = matches.map((m) => ({
    id:             m.id,
    team1Name:      teamNameById.get(m.team1Id) ?? 'Unknown team',
    team2Name:      teamNameById.get(m.team2Id) ?? 'Unknown team',
    team1Score:     m.team1Score,
    team2Score:     m.team2Score,
    winnerTeamName: m.winnerTeamId ? teamNameById.get(m.winnerTeamId) ?? null : null,
    matchDate:      m.matchDate,
    played:         !!(m.team1Score || m.team2Score || m.winnerTeamId),
  }));

  const standings: PublicStanding[] = calcStandings(teams, matches).map((s) => ({
    teamId:   s.team.id,
    teamName: s.team.name,
    colorHex: s.team.colorHex,
    played:   s.played,
    won:      s.won,
    lost:     s.lost,
    tied:     s.tied,
    points:   s.points,
  }));

  // "Complete" means the auction ran and left nobody waiting to be called.
  const auctionStatus: PublicLeagueView['auctionStatus'] =
    soldPlayers.length === 0 ? 'not-started'
      : availablePlayers.length > 0 ? 'in-progress'
      : 'complete';

  return {
    id:                 league.id,
    name:               league.name,
    conductedBy:        league.conductedBy,
    logoUrl:            league.logoUrl,
    totalPlayers:       league.totalPlayers,
    registrationClosed: league.registrationClosed,
    createdAt:          league.createdAt,
    teams:              publicTeams,
    soldPlayers,
    unsoldPlayers,
    availablePlayers,
    matches:            publicMatches,
    standings,
    sponsors:           sponsors.map((s) => ({
      id: s.id, name: s.name, logoUrl: s.logoUrl, website: s.website,
    })),
    auctionStatus,
    liveAuction,
    registeredPlayers:  players.length,
    totalSpend:         soldPlayers.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0),
  };
}

export async function getLeagueByJoinCode(joinCode: string): Promise<League | null> {
  const row = await LeagueModel.findOne({ where: { joinCode: joinCode.toUpperCase() } });
  return row ? toLeague(row) : null;
}

export async function createLeague(data: {
  name: string;
  totalPlayers: number;
  conductedBy: string;
  creatorId: string;
  creatorEmail: string;
  templateId?: string;
  logoUrl?: string;
  isPublic?: boolean;
  pickPreference?: League['pickPreference'];
  idProofRequired?: boolean;
  paymentProofRequired?: boolean;
  rosterVisibleToPlayers?: boolean;
  playersCanDeleteCards?: boolean;
}): Promise<League> {
  await ensureUser(data.creatorId, data.creatorEmail);
  const joinCode = data.isPublic ? generateJoinCode() : null;
  const row = await LeagueModel.create({
    id:           uuidv4(),
    name:         data.name,
    totalPlayers: data.totalPlayers,
    conductedBy:  data.conductedBy,
    creatorId:    data.creatorId,
    templateId:   data.templateId ?? 'classic-green',
    logoUrl:      data.logoUrl ?? '',
    isPublic:     data.isPublic ?? false,
    joinCode,
    pickPreference: data.pickPreference ?? null,
    idProofRequired: data.idProofRequired ?? false,
    paymentProofRequired: data.paymentProofRequired ?? false,
    // Permissive by default — an organizer opts *into* a closed roster
    rosterVisibleToPlayers: data.rosterVisibleToPlayers ?? true,
    playersCanDeleteCards: data.playersCanDeleteCards ?? true,
  });
  return toLeague(row);
}

/**
 * Generic league-settings update. `certificatesReleasedAt` is deliberately not
 * updatable here — it's a timestamp the app stamps rather than a value callers
 * supply, so it goes through `setCertificatesReleased` instead.
 */
export async function updateLeague(
  id: string,
  data: Partial<Omit<League, 'id' | 'creatorId' | 'createdAt' | 'certificatesReleasedAt'>>
): Promise<League | null> {
  const row = await LeagueModel.findByPk(id);
  if (!row) return null;
  // Auto-generate joinCode when making public if not already set
  if (data.isPublic && !row.joinCode) {
    (data as Record<string, unknown>).joinCode = generateJoinCode();
  }
  await row.update(data);
  return toLeague(row);
}

export async function deleteLeague(id: string): Promise<boolean> {
  const deleted = await LeagueModel.destroy({ where: { id } });
  return deleted > 0;
}

/**
 * Clone a league into a brand-new one owned by `creatorId`.
 *
 * The clone starts a fresh season: the new league is always private (no join
 * code), and matches and live-auction state are never carried over. By
 * default every copied player has their auction result cleared — icon
 * players keep their pre-assigned team (remapped to the clone's new team
 * rows), everyone else resets to unsold. If `preserveAuctionResults` is set,
 * every player instead keeps their sold price, sold/unsold status, and team
 * assignment (remapped); this only takes effect when teams are also
 * included, since a sold player needs a team to point to. `overrides` lets
 * the caller edit the league's details at clone time; whatever is omitted
 * falls back to the source league's value.
 *
 * Teams/players/officials are each opt-in. Officials need teams, so they're
 * only copied when teams are too. Player contact numbers are private to the
 * organiser, so they're copied only when `copyContactNumbers` is set (the
 * route allows this solely when the cloner owns the source league).
 *
 * Returns the new league, or null if the source doesn't exist.
 */
export async function cloneLeague(
  sourceId: string,
  creatorId: string,
  creatorEmail: string,
  overrides: Partial<Pick<League, 'name' | 'conductedBy' | 'totalPlayers' | 'templateId' | 'logoUrl' | 'pickPreference'>> = {},
  options: {
    includeTeams?: boolean;
    includePlayers?: boolean;
    includeOfficials?: boolean;
    copyContactNumbers?: boolean;
    preserveAuctionResults?: boolean;
  } = {}
): Promise<League | null> {
  const source = await LeagueModel.findByPk(sourceId);
  if (!source) return null;

  await ensureUser(creatorId, creatorEmail);

  const includeTeams = options.includeTeams ?? true;
  const includePlayers = options.includePlayers ?? true;
  // Officials live on teams, so they can only come along when teams do
  const includeOfficials = (options.includeOfficials ?? true) && includeTeams;
  // A preserved sale needs a team to point to, so this only applies when
  // teams are coming along too
  const preserveAuctionResults = (options.preserveAuctionResults ?? false) && includeTeams;

  return sequelize.transaction(async (t) => {
    const newLeague = await LeagueModel.create(
      {
        id:           uuidv4(),
        name:         overrides.name ?? source.name,
        totalPlayers: overrides.totalPlayers ?? source.totalPlayers,
        conductedBy:  overrides.conductedBy ?? source.conductedBy,
        creatorId,
        templateId:   overrides.templateId ?? source.templateId,
        logoUrl:      overrides.logoUrl ?? source.logoUrl,
        // A clone always starts as a private league with no auction history
        isPublic:     false,
        joinCode:     null,
        registrationClosed: false,
        // A clone is a fresh season, so its players start with no certificate
        certificatesReleasedAt: null,
        // Pick preference carries over from the source league by default
        pickPreference: overrides.pickPreference !== undefined ? overrides.pickPreference : (source.pickPreference as League['pickPreference']),
        // A league that vets its players keeps doing so in the next season
        idProofRequired: source.idProofRequired ?? false,
        paymentProofRequired: source.paymentProofRequired ?? false,
        // …and one that runs a closed roster keeps running one
        rosterVisibleToPlayers: source.rosterVisibleToPlayers ?? true,
        playersCanDeleteCards: source.playersCanDeleteCards ?? true,
      },
      { transaction: t }
    );

    // Map each source team id to its freshly-created clone so icon players and
    // officials can be re-pointed at the new rows
    const teamIdMap = new Map<string, string>();
    if (includeTeams) {
      const teams = await TeamModel.findAll({ where: { leagueId: sourceId }, order: [['createdAt', 'ASC']], transaction: t });
      for (const team of teams) {
        const newId = uuidv4();
        teamIdMap.set(team.id, newId);
        await TeamModel.create(
          {
            id:         newId,
            leagueId:   newLeague.id,
            name:       team.name,
            colorHex:   team.colorHex,
            budget:     team.budget,
            maxPlayers: team.maxPlayers,
          },
          { transaction: t }
        );
      }
    }

    if (includePlayers) {
      const players = await PlayerModel.findAll({ where: { leagueId: sourceId }, order: [['createdAt', 'ASC']], transaction: t });
      for (const p of players) {
        // Icon players are pinned to a team before the auction, so they keep
        // their team (remapped) even on a fresh season. When preserving
        // auction results, every sold player keeps their team the same way;
        // otherwise everyone but icons resets to unsold.
        const keepTeam = (preserveAuctionResults || p.isIcon) && p.teamId
          ? teamIdMap.get(p.teamId) ?? null
          : null;
        await PlayerModel.create(
          {
            id:             uuidv4(),
            leagueId:       newLeague.id,
            // The clone's players aren't "joined" by the original owners, and
            // a fresh token means only the new organiser controls these cards
            userId:         p.userId,
            creatorToken:   uuidv4(),
            name:           p.name,
            photo:          p.photo,
            battingType:    p.battingType,
            bowlingType:    p.bowlingType,
            role:           p.role,
            isWicketKeeper: p.isWicketKeeper,
            contactNumber:  options.copyContactNumbers ? p.contactNumber : null,
            // A receipt proves a fee was paid for *that* league — the clone is a
            // new season with its own fee, so it always starts unpaid, both the
            // player's receipt and the organizer's confirmation of it
            paymentProofUrl: null,
            paymentReceived: false,
            isIcon:         p.isIcon,
            teamId:         keepTeam,
            soldPrice:      preserveAuctionResults ? p.soldPrice : null,
            isUnsold:       preserveAuctionResults ? p.isUnsold : false,
            statsMatches:   p.statsMatches,
            statsRuns:      p.statsRuns,
            statsWickets:   p.statsWickets,
            statsAverage:   p.statsAverage,
            statsSR:        p.statsSR,
          },
          { transaction: t }
        );
      }
    }

    if (includeOfficials) {
      const officials = await TeamOfficialModel.findAll({ where: { leagueId: sourceId }, order: [['createdAt', 'ASC']], transaction: t });
      for (const o of officials) {
        const newTeamId = teamIdMap.get(o.teamId!);
        // An official whose team didn't come across has nowhere to live
        if (!newTeamId) continue;
        await TeamOfficialModel.create(
          {
            id:            uuidv4(),
            leagueId:      newLeague.id,
            teamId:        newTeamId,
            name:          o.name,
            contactNumber: options.copyContactNumbers ? o.contactNumber : null,
            role:          o.role,
            photo:         o.photo,
          },
          { transaction: t }
        );
      }
    }

    return toLeague(newLeague);
  });
}

// ── Co-organizers ─────────────────────────────────────────────────────────────

/** Co-organizer rule violation (already added, is the creator, …) — safe to show to the user. */
export class CoOrganizerError extends Error {}

function toCoOrganizer(row: LeagueCoOrganizerModel, user: UserModel | undefined): CoOrganizer {
  return {
    userId:  row.userId!,
    name:    user?.name || '',
    email:   user?.email ?? null,
    photo:   user?.photo ?? '',
    addedAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getCoOrganizers(leagueId: string): Promise<CoOrganizer[]> {
  const rows = await LeagueCoOrganizerModel.findAll({ where: { leagueId }, order: [['createdAt', 'ASC']] });
  if (rows.length === 0) return [];
  const users = await UserModel.findAll({ where: { id: { [Op.in]: rows.map((r) => r.userId!) } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => toCoOrganizer(r, byId.get(r.userId!)));
}

export async function isCoOrganizer(leagueId: string, userId: string): Promise<boolean> {
  const row = await LeagueCoOrganizerModel.findOne({ where: { leagueId, userId }, attributes: ['id'] });
  return !!row;
}

/**
 * The shared authorization check for league management: the creator and every
 * co-organizer may manage the league (run the auction, mark players sold,
 * edit teams/settings). Creator-only actions — deleting the league, managing
 * the co-organizer list — must check `league.creatorId` directly instead.
 */
export async function canManageLeague(userId: string | null | undefined, league: League): Promise<boolean> {
  if (!userId) return false;
  if (userId === league.creatorId) return true;
  return isCoOrganizer(league.id, userId);
}

/**
 * Membership — a weaker tier than management, for content that belongs to the
 * league's participants rather than the public: the organizers plus anyone with
 * a player card in this league. Deliberately independent of `league.isPublic`,
 * so a public league's ledger still isn't world-readable.
 */
export async function isLeagueMember(userId: string | null | undefined, league: League): Promise<boolean> {
  if (!userId) return false;
  // The creator is free to check; the other two are one indexed lookup each, so
  // run them together rather than short-circuiting through canManageLeague
  if (userId === league.creatorId) return true;
  const [player, coOrganizer] = await Promise.all([
    PlayerModel.findOne({ where: { leagueId: league.id, userId }, attributes: ['id'] }),
    isCoOrganizer(league.id, userId),
  ]);
  return !!player || coOrganizer;
}

export async function addCoOrganizer(league: League, userId: string, addedBy: string): Promise<CoOrganizer> {
  if (userId === league.creatorId) {
    throw new CoOrganizerError('The creator already manages this league');
  }
  const user = await UserModel.findByPk(userId);
  if (!user) throw new CoOrganizerError('User not found');
  // findOrCreate + the DB unique index on (league_id, user_id) makes a double
  // add safe even when two requests race
  const [row, created] = await LeagueCoOrganizerModel.findOrCreate({
    where:    { leagueId: league.id, userId },
    defaults: { id: uuidv4(), leagueId: league.id, userId, addedBy },
  });
  if (!created) {
    throw new CoOrganizerError(`${user.name || user.email} is already a co-organizer`);
  }
  return toCoOrganizer(row, user);
}

export async function removeCoOrganizer(leagueId: string, userId: string): Promise<boolean> {
  const deleted = await LeagueCoOrganizerModel.destroy({ where: { leagueId, userId } });
  return deleted > 0;
}

export async function getLeaguesCoOrganizedByUser(userId: string): Promise<League[]> {
  const rows = await LeagueCoOrganizerModel.findAll({ where: { userId }, attributes: ['leagueId'] });
  if (rows.length === 0) return [];
  const leagues = await LeagueModel.findAll({
    where: { id: { [Op.in]: rows.map((r) => r.leagueId!) } },
    order: [['createdAt', 'DESC']],
  });
  return leagues.map(toLeague);
}

/**
 * Search existing accounts to add as co-organizers, by name, email or phone
 * (case-insensitive substring). The creator and anyone already co-organizing
 * this league are excluded — results are only ever people who *can* be added.
 */
export async function searchUsersForCoOrganizer(
  league: League,
  query: string,
  limit = 8
): Promise<Array<{ id: string; name: string; email: string; photo: string }>> {
  const existing = await LeagueCoOrganizerModel.findAll({ where: { leagueId: league.id }, attributes: ['userId'] });
  const excluded = [league.creatorId, ...existing.map((r) => r.userId!)];
  const q = `%${query}%`;
  const rows = await UserModel.findAll({
    where: {
      id: { [Op.notIn]: excluded },
      [Op.or]: [
        { name:          { [Op.iLike]: q } },
        { email:         { [Op.iLike]: q } },
        { contactNumber: { [Op.iLike]: q } },
      ],
    },
    order: [['name', 'ASC']],
    limit,
  });
  return rows.map((u) => ({ id: u.id, name: u.name ?? '', email: u.email, photo: u.photo ?? '' }));
}

/**
 * Search PickBid accounts that could be added to `leagueId` as players —
 * powers the organizer's "add from accounts" picker.
 *
 * Unlike `searchPlayersByCreator`, which looks through cards the organizer has
 * typed before, this looks at the `users` table: the account already holds the
 * cricket profile its owner maintains, so picking one copies a card straight
 * out of it and links the card to a real person who can claim it.
 *
 * Two rows are skipped on purpose:
 *  - anyone already holding a card in this league — they're on the roster, so
 *    offering them again only invites a duplicate;
 *  - accounts with no name or no email. Those are the stubs
 *    `findOrCreateUserIdByEmail` mints for on-behalf-of cards; there is no
 *    profile behind one to build a card from, and no address to link it by.
 */
export async function searchUserCandidatesForLeague(
  leagueId: string,
  query: string,
  limit = 8
): Promise<LeagueUserCandidate[]> {
  const rostered = await PlayerModel.findAll({ where: { leagueId }, attributes: ['userId'] });
  const rosteredUserIds = rostered.map((r) => r.userId).filter((v): v is string => !!v);

  const q = `%${query}%`;
  const rows = await UserModel.findAll({
    where: {
      name:  { [Op.ne]: '' },
      email: { [Op.ne]: '' },
      ...(rosteredUserIds.length > 0 ? { id: { [Op.notIn]: rosteredUserIds } } : {}),
      [Op.or]: [
        { name:          { [Op.iLike]: q } },
        { email:         { [Op.iLike]: q } },
        { contactNumber: { [Op.iLike]: q } },
      ],
    },
    order: [['name', 'ASC']],
    limit,
  });

  return rows.map((u) => ({
    userId:         u.id,
    name:           u.name,
    email:          u.email,
    photo:          u.photo ?? '',
    battingType:    (u.battingType ?? 'Right-Hand Bat') as Player['battingType'],
    bowlingType:    (u.bowlingType ?? 'N/A') as Player['bowlingType'],
    role:           (u.role ?? 'Batter') as Player['role'],
    isWicketKeeper: u.isWicketKeeper ?? false,
    contactNumber:  u.contactNumber ?? null,
  }));
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function getTeams(leagueId: string): Promise<Team[]> {
  const rows = await TeamModel.findAll({ where: { leagueId }, order: [['createdAt', 'ASC']] });
  return rows.map(toTeam);
}

export async function createTeam(data: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
  const row = await TeamModel.create({
    id:         uuidv4(),
    leagueId:   data.leagueId,
    name:       data.name,
    colorHex:   data.colorHex,
    budget:     data.budget,
    maxPlayers: data.maxPlayers,
  });
  return toTeam(row);
}

export async function updateTeam(id: string, data: Partial<Omit<Team, 'id' | 'leagueId' | 'createdAt'>>): Promise<Team | null> {
  const row = await TeamModel.findByPk(id);
  if (!row) return null;
  await row.update(data);
  return toTeam(row);
}

export async function deleteTeam(id: string): Promise<boolean> {
  const deleted = await TeamModel.destroy({ where: { id } });
  return deleted > 0;
}

// ── Team Officials ──────────────────────────────────────────────────────────────

function toOfficial(row: TeamOfficialModel): TeamOfficial {
  return {
    id:            row.id,
    leagueId:      row.leagueId!,
    teamId:        row.teamId!,
    name:          row.name,
    contactNumber: row.contactNumber ?? null,
    role:          row.role ?? 'Official',
    photo:         row.photo ?? '',
    createdAt:     row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getOfficials(leagueId: string): Promise<TeamOfficial[]> {
  const rows = await TeamOfficialModel.findAll({ where: { leagueId }, order: [['createdAt', 'ASC']] });
  return rows.map(toOfficial);
}

export async function getOfficial(id: string): Promise<TeamOfficial | null> {
  const row = await TeamOfficialModel.findByPk(id);
  return row ? toOfficial(row) : null;
}

export async function createOfficial(data: Omit<TeamOfficial, 'id' | 'createdAt'>): Promise<TeamOfficial> {
  const row = await TeamOfficialModel.create({
    id:            uuidv4(),
    leagueId:      data.leagueId,
    teamId:        data.teamId,
    name:          data.name,
    contactNumber: data.contactNumber ?? null,
    role:          data.role,
    photo:         data.photo ?? '',
  });
  return toOfficial(row);
}

export async function updateOfficial(
  id: string,
  data: Partial<Omit<TeamOfficial, 'id' | 'leagueId' | 'teamId' | 'createdAt'>>
): Promise<TeamOfficial | null> {
  const row = await TeamOfficialModel.findByPk(id);
  if (!row) return null;
  await row.update(data);
  return toOfficial(row);
}

export async function deleteOfficial(id: string): Promise<boolean> {
  const deleted = await TeamOfficialModel.destroy({ where: { id } });
  return deleted > 0;
}

// ── Sponsors ──────────────────────────────────────────────────────────────────

function toSponsor(row: SponsorModel): Sponsor {
  return {
    id:        row.id,
    leagueId:  row.leagueId!,
    name:      row.name,
    logoUrl:   row.logoUrl ?? '',
    website:   row.website ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getSponsors(leagueId: string): Promise<Sponsor[]> {
  const rows = await SponsorModel.findAll({ where: { leagueId }, order: [['createdAt', 'ASC']] });
  return rows.map(toSponsor);
}

export async function getSponsor(id: string): Promise<Sponsor | null> {
  const row = await SponsorModel.findByPk(id);
  return row ? toSponsor(row) : null;
}

export async function createSponsor(data: Omit<Sponsor, 'id' | 'createdAt'>): Promise<Sponsor> {
  const row = await SponsorModel.create({
    id:       uuidv4(),
    leagueId: data.leagueId,
    name:     data.name,
    logoUrl:  data.logoUrl ?? '',
    website:  data.website ?? null,
  });
  return toSponsor(row);
}

export async function updateSponsor(
  id: string,
  data: Partial<Omit<Sponsor, 'id' | 'leagueId' | 'createdAt'>>
): Promise<Sponsor | null> {
  const row = await SponsorModel.findByPk(id);
  if (!row) return null;
  await row.update(data);
  return toSponsor(row);
}

export async function deleteSponsor(id: string): Promise<boolean> {
  const deleted = await SponsorModel.destroy({ where: { id } });
  return deleted > 0;
}

// ── Ledger (income & expense) ─────────────────────────────────────────────────

function toLedger(row: LeagueLedgerModel, updatedByName: string | null): LeagueLedger {
  return {
    leagueId:      row.leagueId!,
    content:       row.content ?? '',
    published:     row.published ?? false,
    updatedByName,
    createdAt:     row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt:     row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getLedger(leagueId: string): Promise<LeagueLedger | null> {
  const row = await LeagueLedgerModel.findByPk(leagueId);
  if (!row) return null;
  const author = row.updatedBy ? await UserModel.findByPk(row.updatedBy, { attributes: ['name', 'email'] }) : null;
  return toLedger(row, author ? author.name || author.email || null : null);
}

/**
 * Cheap "is there something for members to read?" check, used by the league
 * payload to decide whether to surface the Ledger link. Selects no content.
 */
export async function hasPublishedLedger(leagueId: string): Promise<boolean> {
  const row = await LeagueLedgerModel.findOne({
    where: { leagueId, published: true },
    attributes: ['leagueId'],
  });
  return !!row;
}

/**
 * Create-or-update the league's ledger. `content` and `published` are both
 * optional so the editor can save a draft, publish an unchanged draft, or
 * unpublish, all through one call. `updatedAt` is stamped here rather than by
 * Sequelize because these models run with `timestamps: false`.
 */
export async function saveLedger(
  leagueId: string,
  data: { content?: string; published?: boolean; updatedBy: string }
): Promise<LeagueLedger> {
  const [row] = await LeagueLedgerModel.findOrCreate({
    where:    { leagueId },
    defaults: {
      leagueId,
      content:   data.content ?? '',
      published: data.published ?? false,
      updatedBy: data.updatedBy,
    },
  });
  await row.update({
    ...(data.content   !== undefined ? { content: data.content }     : {}),
    ...(data.published !== undefined ? { published: data.published } : {}),
    updatedBy: data.updatedBy,
    updatedAt: new Date(),
  });
  const author = await UserModel.findByPk(data.updatedBy, { attributes: ['name', 'email'] });
  return toLedger(row, author ? author.name || author.email || null : null);
}

export async function deleteLedger(leagueId: string): Promise<boolean> {
  const deleted = await LeagueLedgerModel.destroy({ where: { leagueId } });
  return deleted > 0;
}

// ── Participation certificates ────────────────────────────────────────────────
//
// Certificates are gated on one league-level timestamp rather than a per-player
// row: an organizer "releases" the whole league at once, and every player who
// holds a card in it can then download theirs. Nothing is generated or stored
// up front — the certificate is rendered on demand from the card and the league.

function toCertificate(
  league: LeagueModel,
  player: PlayerModel,
  team: TeamModel | null
): LeagueCertificate {
  return {
    leagueId:     league.id,
    leagueName:   league.name,
    conductedBy:  league.conductedBy,
    logoUrl:      league.logoUrl ?? '',
    templateId:   league.templateId ?? 'classic-green',
    playerId:     player.id,
    playerName:   player.name,
    role:         player.role as LeagueCertificate['role'],
    teamName:     team?.name ?? null,
    teamColorHex: team?.colorHex ?? null,
    // Callers only reach this mapper for a released league, so the timestamp is set
    releasedAt:   league.certificatesReleasedAt?.toISOString() ?? new Date().toISOString(),
  };
}

/**
 * Release certificates for a league, or withdraw them again. Releasing stamps
 * the current time — that stamp is the issue date printed on every certificate,
 * so re-releasing after a withdrawal deliberately re-dates them.
 */
export async function setCertificatesReleased(
  leagueId: string,
  released: boolean
): Promise<League | null> {
  const row = await LeagueModel.findByPk(leagueId);
  if (!row) return null;
  await row.update({ certificatesReleasedAt: released ? new Date() : null });
  return toLeague(row);
}

/**
 * Every certificate this user can download, newest league first. Matches on the
 * `userId` stamped on a player card at join time, so it follows the account
 * rather than the device, and skips leagues whose organizers haven't released.
 */
export async function getCertificatesForUser(userId: string): Promise<LeagueCertificate[]> {
  const user = await UserModel.findByPk(userId);
  if (!user) return [];
  const players = await PlayerModel.findAll({ where: { userId } });
 if (players.length === 0) return [];

  const leagues = await LeagueModel.findAll({
    where: {
      id: { [Op.in]: players.map((p) => p.leagueId!) },
      certificatesReleasedAt: { [Op.ne]: null },
    },
    order: [['certificatesReleasedAt', 'DESC']],
  });
  if (leagues.length === 0) return [];

  const teamIds = players.map((p) => p.teamId).filter((t): t is string => !!t);
  const teams = teamIds.length
    ? await TeamModel.findAll({ where: { id: { [Op.in]: teamIds } } })
    : [];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playersByLeague = new Map<string, PlayerModel>();
  for (const p of players) {
    // One card per league per user in practice; keep the first if that ever breaks
    if (!playersByLeague.has(p.leagueId!)) playersByLeague.set(p.leagueId!, p);
  }

  return leagues.flatMap((league) => {
    const player = playersByLeague.get(league.id);
    if (!player) return [];
    return [toCertificate(league, player, player.teamId ? teamById.get(player.teamId) ?? null : null)];
  });
}

/**
 * One certificate, for the route that renders the PNG. Returns null when the
 * league hasn't released certificates or the player isn't in it, so an
 * unreleased certificate is a 404 rather than a rendered image.
 *
 * `playerUserId` comes back alongside so the caller can check ownership without
 * a second query — the route only serves the player themselves or an organizer.
 */
export async function getCertificateForPlayer(
  leagueId: string,
  playerId: string
): Promise<{ certificate: LeagueCertificate; playerUserId: string | null } | null> {
  const [league, player] = await Promise.all([
    LeagueModel.findByPk(leagueId),
    PlayerModel.findByPk(playerId),
  ]);
  if (!league || !league.certificatesReleasedAt) return null;
  if (!player || player.leagueId !== leagueId) return null;
  const team = player.teamId ? await TeamModel.findByPk(player.teamId) : null;
  return {
    certificate: toCertificate(league, player, team),
    playerUserId: player.userId ?? null,
  };
}

// ── Players ───────────────────────────────────────────────────────────────────

export async function getPlayers(leagueId: string): Promise<Player[]> {
  const rows = await PlayerModel.findAll({ where: { leagueId }, order: [['createdAt', 'ASC']] });
  return rows.map(toPlayer);
}

/**
 * Counts the league sidebar needs, and nothing else — it decides whether to
 * offer *Release Certificates* (needs at least one card) and *Reset Auction*
 * (needs results to clear). Two `COUNT(*)`s rather than the full roster read
 * the league GET does: the sidebar renders on every league screen, so paying
 * ~100 KB of player cards for two booleans would undo the point of it.
 */
export async function getLeagueNavCounts(
  leagueId: string
): Promise<{ players: number; hasAuctionData: boolean }> {
  const [players, auctionResults] = await Promise.all([
    PlayerModel.count({ where: { leagueId } }),
    // Mirrors `hasAuctionData` on the league page: a non-icon player sitting on
    // a team, or anyone flagged unsold. Icon players are pre-assigned, so they
    // survive a reset and don't count as something to clear.
    PlayerModel.count({
      where: {
        leagueId,
        [Op.or]: [
          { teamId: { [Op.ne]: null }, isIcon: false },
          { isUnsold: true },
        ],
      },
    }),
  ]);
  return { players, hasAuctionData: auctionResults > 0 };
}

export async function getPlayer(id: string): Promise<Player | null> {
  const row = await PlayerModel.findByPk(id);
  return row ? toPlayer(row) : null;
}

/**
 * Search players this creator has previously added, across every league they
 * run — powers the "search & select" picker on the Add Player page so a
 * recurring player (same person, new season) doesn't need re-typing.
 * Matches by name (case-insensitive substring), skips the league being added
 * to, and collapses the same person's repeat cards (matched by name + phone)
 * down to their most recent one.
 */
export async function searchPlayersByCreator(
  creatorId: string,
  query: string,
  excludeLeagueId: string,
  limit = 8
): Promise<Player[]> {
  const leagues = await LeagueModel.findAll({ where: { creatorId }, attributes: ['id'] });
  const leagueIds = leagues.map((l) => l.id).filter((leagueId) => leagueId !== excludeLeagueId);
  if (leagueIds.length === 0) return [];

  const rows = await PlayerModel.findAll({
    where: {
      leagueId: { [Op.in]: leagueIds },
      name: { [Op.iLike]: `%${query}%` },
    },
    order: [['createdAt', 'DESC']],
    limit: limit * 4,
  });

  const seen = new Set<string>();
  const deduped: PlayerModel[] = [];
  for (const row of rows) {
    const key = `${row.name.trim().toLowerCase()}|${row.contactNumber ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }

  return deduped.map(toPlayer);
}

/**
 * Find-or-create a user account for a player being added by their league
 * creator, so the player row links to its own account instead of the
 * creator's. Never returns the creator's own id.
 */
export async function findOrCreateUserIdByEmail(email: string): Promise<string> {
  const trimmed = email.trim();
  const [user] = await UserModel.findOrCreate({ where: { email: trimmed }, defaults: { id: uuidv4(), email: trimmed } });
  return user.id;
}

/**
 * Resolves the userId to reuse when a creator picks an existing player from
 * `searchPlayersByCreator` instead of typing a new one in — avoids creating a
 * duplicate user for someone already in the system. Re-checks league
 * ownership server-side (rather than trusting a client-supplied userId) so a
 * creator can only reuse identities from their own players.
 * Returns undefined if playerId doesn't resolve to one of this creator's own players.
 */
export async function getCreatorOwnedPlayerUserId(
  creatorId: string,
  playerId: string
): Promise<string | null | undefined> {
  const player = await PlayerModel.findByPk(playerId);
  if (!player) return undefined;
  const league = await LeagueModel.findByPk(player.leagueId);
  if (!league || league.creatorId !== creatorId) return undefined;
  return player.userId ?? null;
}

export async function createPlayer(data: Omit<Player, 'id' | 'createdAt'>): Promise<Player> {
  const row = await PlayerModel.create({
    id:             uuidv4(),
    leagueId:       data.leagueId,
    userId:         data.userId ?? null,
    name:           data.name,
    photo:          data.photo,
    battingType:    data.battingType,
    bowlingType:    data.bowlingType,
    role:           data.role,
    isWicketKeeper: data.isWicketKeeper,
    creatorToken:   data.creatorToken,
    contactNumber:  data.contactNumber ?? null,
    paymentProofUrl: data.paymentProofUrl ?? null,
    teamId:         data.teamId ?? null,
    soldPrice:      data.soldPrice ?? null,
    isUnsold:       data.isUnsold ?? false,
    isIcon:         data.isIcon ?? false,
    statsMatches:   data.statsMatches ?? null,
    statsRuns:      data.statsRuns ?? null,
    statsWickets:   data.statsWickets ?? null,
    statsAverage:   data.statsAverage ?? null,
    statsSR:        data.statsSR ?? null,
  });
  return toPlayer(row);
}

export async function updatePlayer(
  id: string,
  data: Partial<Omit<Player, 'id' | 'leagueId' | 'creatorToken' | 'createdAt'>>
): Promise<Player | null> {
  const row = await PlayerModel.findByPk(id);
  if (!row) return null;
  await row.update(data);
  return toPlayer(row);
}

export async function deletePlayer(id: string): Promise<boolean> {
  const deleted = await PlayerModel.destroy({ where: { id } });
  return deleted > 0;
}

/** Auction rule violation (squad full, over budget, unknown team) — safe to show to the user. */
export class AuctionRuleError extends Error {}

/**
 * Assign a player to a team, enforcing squad-size and budget rules atomically.
 *
 * The team row is locked for the duration of the transaction so two
 * simultaneous sales to the same team can't both pass validation and
 * oversell the squad or overspend the purse.
 */
export async function assignPlayerToTeam(
  playerId: string,
  teamId: string,
  soldPrice: number | null,
  extra: Partial<Omit<Player, 'id' | 'leagueId' | 'creatorToken' | 'createdAt' | 'teamId' | 'soldPrice'>> = {}
): Promise<Player | null> {
  return sequelize.transaction(async (t) => {
    const row = await PlayerModel.findByPk(playerId, { transaction: t });
    if (!row) return null;
    const team = await TeamModel.findOne({
      where: { id: teamId, leagueId: row.leagueId! },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!team) throw new AuctionRuleError('Team not found in this league');

    const squad = await PlayerModel.findAll({
      where: { teamId, id: { [Op.ne]: playerId } },
      attributes: ['soldPrice'],
      transaction: t,
    });
    if (squad.length >= (team.maxPlayers ?? 11)) {
      throw new AuctionRuleError(`${team.name} squad is already full`);
    }
    if (soldPrice != null) {
      const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
      if (spent + soldPrice > team.budget) {
        throw new AuctionRuleError(`Exceeds ${team.name}'s remaining budget`);
      }
    }

    await row.update({ ...extra, teamId, soldPrice }, { transaction: t });
    return toPlayer(row);
  });
}

/**
 * Clear auction results for a league so it can be re-run from scratch.
 *
 * Un-assigns every sold player and clears unsold flags. Pre-assigned icon
 * players keep their team — they were pinned before the auction, not won in
 * it. Returns how many players were reset.
 */
export async function resetAuction(leagueId: string): Promise<number> {
  const [count] = await PlayerModel.update(
    { teamId: null, soldPrice: null, isUnsold: false },
    { where: { leagueId, isIcon: false } }
  );
  return count;
}

// ── Global leaderboard ──────────────────────────────────────────────────────────

/** One row of the raw candidate pool behind the global leaderboard. */
interface TopBidRow {
  id: string;
  name: string;
  photo: string | null;
  sold_price: number | string;
  budget: number | string;
  purse_share: number | string;
  is_icon: boolean;
  league_id: string;
  league_name: string;
  team_name: string;
  team_color: string | null;
}

/**
 * How many candidate buys to pull per board slot. The board shows one row per
 * *person*, and the regulars who dominate it turn up in three or four leagues
 * each, so the pool has to be several times the slot count for twenty distinct
 * players to survive the grouping — and wide enough that a player's other big
 * buys are in it to be counted.
 */
const TOP_BID_POOL_FACTOR = 10;

/**
 * Bucket the candidate pool into one list per person, best buy first.
 *
 * **The name is the only identity available.** `players.user_id` is whoever
 * *created* the card, not who the player is — an organizer who bulk-adds their
 * whole league while signed in stamps their own id on every card (one account
 * here owns 144 cards under 144 different names), and `contact_number` gets
 * reused as a placeholder across players. Matching on either merged whole
 * leagues into a single "player". So two buys are the same person when their
 * names match once punctuation, digits and case are stripped, and the cost of
 * that is namesakes: two different Rahuls in different leagues share a row.
 *
 * Only the best buy per league survives in a bucket, so a namesake inside one
 * league can't inflate the badge — the count is leagues, not sales.
 */
function groupBuysByPerson(rows: TopBidRow[]): TopBidRow[][] {
  const byPerson = new Map<string, TopBidRow[]>();
  for (const row of rows) {
    const key = playerNameKey(row.name) || `id:${row.id}`; // a nameless card merges with nothing
    const bucket = byPerson.get(key);
    if (!bucket) { byPerson.set(key, [row]); continue; }
    if (bucket.some((b) => b.league_id === row.league_id)) continue;
    bucket.push(row);
  }
  // Rows arrive best-first, so each bucket leads with the person's best buy and
  // the map's insertion order is already the board's order.
  return [...byPerson.values()];
}

/**
 * The biggest buys across the entire system, ranked by **share of the buying
 * team's purse** rather than raw rupees, one row per player.
 *
 * Every league sets its own budgets — a ₹1 lakh street tournament and a ₹10
 * crore corporate league both live here — so ordering on `sold_price` only ever
 * surfaced whoever picked the biggest numbers. `sold_price / budget` puts every
 * auction on the same 0–1 scale, and price breaks ties inside it.
 *
 * The same regulars then went big in several leagues each and took three slots
 * apiece, so buys are grouped by person and only the best one is ranked; the
 * rest ride along in `otherBuys` for the badge and its tooltip. Counts are
 * therefore over the candidate pool, not a player's whole career — a small buy
 * that never came near the board isn't in it.
 *
 * Raw SQL because the ordering key spans two tables and there is no
 * Player↔Team association to lean on; the alternative is pulling every sold
 * player into JS to rank them. Both divisor and dividend are INTEGER columns,
 * hence the float cast — Postgres would otherwise floor the ratio to 0.
 */
export async function getTopBids(limit = 20): Promise<TopBid[]> {
  const rows = await sequelize.query<TopBidRow>(
    `SELECT p.id,
            p.name,
            p.photo,
            p.sold_price,
            p.is_icon,
            p.league_id,
            t.budget,
            t.name       AS team_name,
            t.color_hex  AS team_color,
            l.name       AS league_name,
            p.sold_price::float8 / t.budget AS purse_share
       FROM players p
       JOIN teams   t ON t.id = p.team_id
       JOIN leagues l ON l.id = p.league_id
      WHERE p.sold_price > 0 AND t.budget > 0
      ORDER BY purse_share DESC, p.sold_price DESC
      LIMIT :pool`,
    { replacements: { pool: limit * TOP_BID_POOL_FACTOR }, type: QueryTypes.SELECT }
  );

  return groupBuysByPerson(rows).slice(0, limit).map(([best, ...others]) => ({
    playerId:   best.id,
    playerName: best.name,
    photo:      best.photo ?? '',
    soldPrice:  Number(best.sold_price),
    teamBudget: Number(best.budget),
    purseShare: Number(best.purse_share),
    isIcon:     best.is_icon ?? false,
    leagueId:   best.league_id,
    leagueName: best.league_name ?? '—',
    teamName:   best.team_name ?? '—',
    teamColor:  best.team_color ?? '#64748b',
    otherBuys:  others.map((o) => ({
      leagueId:   o.league_id,
      leagueName: o.league_name ?? '—',
      teamName:   o.team_name ?? '—',
      soldPrice:  Number(o.sold_price),
      purseShare: Number(o.purse_share),
    })),
  }));
}

/**
 * Whole-platform totals for the landing page's stats strip. "Sold" uses the
 * same definition as the bid leaderboard: assigned to a team at a price > 0.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [leagues, players, teams, playersSold] = await Promise.all([
    LeagueModel.count(),
    PlayerModel.count(),
    TeamModel.count(),
    PlayerModel.count({ where: { teamId: { [Op.ne]: null }, soldPrice: { [Op.gt]: 0 } } }),
  ]);
  return { leagues, players, teams, playersSold };
}

// ── Live auction state ──────────────────────────────────────────────────────────
// One ephemeral JSON blob per league, written by the creator's auction page on
// each transition and polled by spectators to mirror the auction in real time.

export async function getAuctionLive(leagueId: string): Promise<LiveAuctionState | null> {
  const row = await AuctionLiveModel.findByPk(leagueId);
  return (row?.state as LiveAuctionState | undefined) ?? null;
}

export async function setAuctionLive(leagueId: string, state: LiveAuctionState): Promise<void> {
  await AuctionLiveModel.upsert({ leagueId, state, updatedAt: new Date() });
}

export async function clearAuctionLive(leagueId: string): Promise<void> {
  await AuctionLiveModel.destroy({ where: { leagueId } });
}

/**
 * Row → "is an auction being run right now" summary, or null.
 *
 * The row's own `updatedAt` is stamped server-side on every broadcast, so it —
 * not the auctioneer's clock inside the blob — decides staleness. A finished
 * auction doesn't count as live either: `done` sits on the board until someone
 * resets the auction or clears the broadcast.
 */
function toLiveSummary(
  state: unknown,
  updatedAt: Date | string | null | undefined
): LiveAuctionSummary | null {
  const live = (state ?? null) as LiveAuctionState | null;
  if (!live || live.phase === 'done' || live.phase === 'lobby') return null;
  const stamp = updatedAt ? new Date(updatedAt) : null;
  if (!stamp || Number.isNaN(stamp.getTime())) return null;
  if (Date.now() - stamp.getTime() > LIVE_AUCTION_TTL_MS) return null;
  return {
    phase:     live.phase,
    round:     live.progress?.round ?? 1,
    sold:      live.progress?.sold ?? 0,
    total:     live.progress?.total ?? 0,
    updatedAt: stamp.toISOString(),
  };
}

/** Whether an auction is being run right now in one league. */
export async function getAuctionLiveSummary(leagueId: string): Promise<LiveAuctionSummary | null> {
  const row = await AuctionLiveModel.findByPk(leagueId);
  return row ? toLiveSummary(row.state, row.updatedAt) : null;
}

/**
 * The subset of `leagueIds` with an auction running right now — one query for a
 * whole dashboard, so the league list can flag them without N round trips.
 */
export async function getLiveLeagueIds(leagueIds: string[]): Promise<string[]> {
  if (leagueIds.length === 0) return [];
  const rows = await AuctionLiveModel.findAll({
    where: { leagueId: { [Op.in]: leagueIds } },
    attributes: ['leagueId', 'state', 'updatedAt'],
    raw: true,
  });
  return rows.filter((r) => toLiveSummary(r.state, r.updatedAt)).map((r) => r.leagueId as string);
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function getMatches(leagueId: string): Promise<Match[]> {
  const rows = await MatchModel.findAll({ where: { leagueId }, order: [['matchDate', 'DESC'], ['createdAt', 'DESC']] });
  return rows.map(toMatch);
}

export async function createMatch(data: Omit<Match, 'id' | 'createdAt'>): Promise<Match> {
  const row = await MatchModel.create({
    id:           uuidv4(),
    leagueId:     data.leagueId,
    team1Id:      data.team1Id,
    team2Id:      data.team2Id,
    team1Score:   data.team1Score ?? null,
    team2Score:   data.team2Score ?? null,
    winnerTeamId: data.winnerTeamId ?? null,
    matchDate:    data.matchDate ?? null,
  });
  return toMatch(row);
}

/**
 * Inserts a generated fixture list in one statement. `createdAt` is staggered a
 * millisecond per fixture, in the order given: undated fixtures have nothing
 * else to sort on, and identical stamps would shuffle the rounds.
 */
export async function createMatches(
  leagueId: string,
  fixtures: { team1Id: string; team2Id: string; matchDate: string | null }[],
): Promise<Match[]> {
  const base = Date.now();
  const rows = await MatchModel.bulkCreate(fixtures.map((f, i) => ({
    id:        uuidv4(),
    leagueId,
    team1Id:   f.team1Id,
    team2Id:   f.team2Id,
    matchDate: f.matchDate,
    createdAt: new Date(base + i),
  })));
  return rows.map(toMatch);
}

export async function updateMatch(id: string, data: Partial<Omit<Match, 'id' | 'leagueId' | 'createdAt'>>): Promise<Match | null> {
  const row = await MatchModel.findByPk(id);
  if (!row) return null;
  await row.update(data);
  return toMatch(row);
}

export async function deleteMatch(id: string): Promise<boolean> {
  const deleted = await MatchModel.destroy({ where: { id } });
  return deleted > 0;
}

// ── User Profiles ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const row = await UserModel.findByPk(userId);
  return row ? toProfile(row) : null;
}

export async function setProfile(
  userId: string, email: string,
  data: Omit<UserProfile, 'userId' | 'updatedAt'>
): Promise<UserProfile> {
  const [row] = await UserModel.upsert({
    id:               userId, email,
    name:             data.name,
    photo:            data.photo,
    battingType:      data.battingType,
    bowlingType:      data.bowlingType,
    role:             data.role,
    isWicketKeeper:   data.isWicketKeeper,
    contactNumber:    data.contactNumber ?? null,
    idProofType:      data.idProofType ?? null,
    idProofUrl:       data.idProofUrl ?? null,
    profileCompleted: true,
  });
  return toProfile(row)!;
}

export async function updateProfile(
  userId: string, email: string,
  data: Partial<Omit<UserProfile, 'userId' | 'updatedAt'>>
): Promise<UserProfile | null> {
  const row = await UserModel.findByPk(userId);
  if (!row) return null;
  await row.update({
    email,
    name:             data.name ?? row.name,
    photo:            data.photo ?? row.photo,
    battingType:      data.battingType ?? row.battingType,
    bowlingType:      data.bowlingType ?? row.bowlingType,
    role:             data.role ?? row.role,
    isWicketKeeper:   data.isWicketKeeper ?? row.isWicketKeeper,
    contactNumber:    data.contactNumber ?? row.contactNumber,
    idProofType:      data.idProofType ?? row.idProofType,
    idProofUrl:       data.idProofUrl ?? row.idProofUrl,
    profileCompleted: true,
  });
  return toProfile(row)!;
}

// ── Image cleanup ─────────────────────────────────────────────────────────────

/**
 * Delete Cloudinary assets that are no longer referenced anywhere.
 *
 * Photo URLs are shared across records (joining a league copies the profile
 * photo URL onto the player card), so an asset is only destroyed once no
 * player, user profile, or league logo still points at it. Best-effort:
 * failures are logged, never thrown.
 */
// ── Identity proof ─────────────────────────────────────────────────────
// The document lives on the user, uploaded once from their profile. Both
// functions here return organizer-grade PII, so their callers gate on
// `requireLeagueManager` — nothing below authorizes itself.

/** Whether this account has an identity document on file. Null userId → false. */
export async function hasIdentityProof(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const row = await UserModel.findByPk(userId, { attributes: ['idProofUrl'] });
  return !!row?.idProofUrl;
}

/**
 * The organizer's document register for one league: every player card with its
 * entry-fee receipt, and the identity document from the account it belongs to.
 *
 * The payment receipt is a column on the card, so it comes back with the first
 * query. The identity document isn't — it lives on the user — so it takes a
 * second lookup, keyed on the account ids actually present rather than joined,
 * because there is no Player↔User association. Two round trips however many
 * players a league has. Cards sharing an account (the same person registered
 * twice) resolve to the same ID, which is correct; their receipts stay separate,
 * which is also correct.
 */
export async function getLeagueDocuments(leagueId: string): Promise<PlayerDocuments[]> {
  const players = await PlayerModel.findAll({
    where: { leagueId },
    attributes: ['id', 'name', 'photo', 'userId', 'paymentProofUrl', 'paymentReceived', 'teamId'],
    order: [['createdAt', 'ASC']],
  });
  if (players.length === 0) return [];

  const userIds = [...new Set(players.map((p) => p.userId).filter((v): v is string => !!v))];
  const users = userIds.length
    ? await UserModel.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'idProofType', 'idProofUrl', 'updatedAt'],
      })
    : [];
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  return players.map((p) => {
    const owner = p.userId ? userById[p.userId] : undefined;
    return {
      playerId:       p.id,
      playerName:     p.name,
      photo:          p.photo ?? '',
      linked:         !!owner,
      idProofType:    (owner?.idProofType ?? null) as IdProofType | null,
      idProofUrl:     owner?.idProofUrl || null,
      idSubmittedAt:  owner?.idProofUrl ? (owner.updatedAt?.toISOString() ?? null) : null,
      paymentProofUrl: p.paymentProofUrl || null,
      paymentReceived: p.paymentReceived,
      teamId:         p.teamId ?? null,
    };
  });
}

/**
 * Tick (or untick) the organizer's confirmation that a player's entry fee
 * arrived. Scoped by league as well as card id, so a manager of one league
 * can't flip a card that lives in another; returns false when the card isn't
 * in this league, which the route answers as a 404.
 */
export async function setPlayerPaymentReceived(
  leagueId: string,
  playerId: string,
  received: boolean
): Promise<boolean> {
  const [updated] = await PlayerModel.update(
    { paymentReceived: received },
    { where: { id: playerId, leagueId } }
  );
  return updated > 0;
}

export async function cleanupImages(urls: Array<string | null | undefined>): Promise<void> {
  const { deleteFromCloudinary, cloudinaryPublicId } = await import('./cloudinary');
  const candidates = [...new Set(urls.filter((u): u is string => !!u && !!cloudinaryPublicId(u)))];

  await Promise.allSettled(
    candidates.map(async (url) => {
      const [playerRefs, profileRefs, idRefs, payRefs, logoRefs, officialRefs, sponsorRefs] = await Promise.all([
        PlayerModel.count({ where: { photo: url } }),
        UserModel.count({ where: { photo: url } }),
        UserModel.count({ where: { idProofUrl: url } }),
        PlayerModel.count({ where: { paymentProofUrl: url } }),
        LeagueModel.count({ where: { logoUrl: url } }),
        TeamOfficialModel.count({ where: { photo: url } }),
        SponsorModel.count({ where: { logoUrl: url } }),
      ]);
      if (playerRefs + profileRefs + idRefs + payRefs + logoRefs + officialRefs + sponsorRefs === 0) {
        await deleteFromCloudinary(url);
      }
    })
  );
}

// ── Rewards: streaks and badges ───────────────────────────────────────────────
// Badges are derived from tables the app already keeps, so nothing on a hot
// path (a sale, a match result) has to remember to award one. These three
// functions are the whole database side; `rewards.ts` composes them with the
// catalog in `badges.ts`.

/** Weeks start on Monday in this zone — the app's players are in India. */
const STREAK_TIME_ZONE = 'Asia/Kolkata';
/** Bits of week history kept in `user_streaks.history`. Must stay under 53. */
const STREAK_HISTORY_WEEKS = 52;

export interface StreakState {
  current: number;
  longest: number;
  /** Week bitmask, bit 0 = this week. */
  history: number;
}

/**
 * Count the current week towards the user's weekly streak, and return it.
 *
 * One statement, whatever the history: a visit in the week right after the last
 * counted one extends the run, a longer gap restarts it at 1, and `history`
 * shifts left by the gap with bit 0 set. Bits are masked *before* the shift so
 * nothing ever reaches the sign bit. Repeat visits within a week match the
 * `WHERE` and write nothing, which is why this is safe to call on every
 * check-in.
 *
 * When that no-op happens the upsert returns no row, so the fallback branch
 * reads the stored one. Its snapshot predates any concurrent insert, which is
 * the one case that can come back empty — and a first-ever visit is a
 * one-week streak anyway.
 */
export async function recordWeeklyActivity(userId: string): Promise<StreakState> {
  const gap = '((EXCLUDED.last_period - s.last_period) / 7)';
  const rows = await sequelize.query<{ current_count: number; longest_count: number; history: string }>(
    `WITH this_week AS (
       SELECT date_trunc('week', now() AT TIME ZONE :tz)::date AS d
     ),
     counted AS (
       INSERT INTO user_streaks AS s (user_id, kind, current_count, longest_count, last_period, history, updated_at)
       SELECT :userId, 'weekly', 1, 1, d, 1, now() FROM this_week
       ON CONFLICT (user_id, kind) DO UPDATE SET
         current_count = CASE WHEN s.last_period = EXCLUDED.last_period - 7 THEN s.current_count + 1 ELSE 1 END,
         longest_count = GREATEST(
           s.longest_count,
           CASE WHEN s.last_period = EXCLUDED.last_period - 7 THEN s.current_count + 1 ELSE 1 END
         ),
         history = CASE
           WHEN ${gap} >= ${STREAK_HISTORY_WEEKS} THEN 1
           ELSE ((s.history & ((1::bigint << (${STREAK_HISTORY_WEEKS} - ${gap})) - 1)) << ${gap}) | 1
         END,
         last_period = EXCLUDED.last_period,
         updated_at  = now()
       WHERE s.last_period < EXCLUDED.last_period
       RETURNING s.current_count, s.longest_count, s.history
     )
     SELECT current_count, longest_count, history::text AS history FROM counted
     UNION ALL
     SELECT current_count, longest_count, history::text AS history
       FROM user_streaks
      WHERE user_id = :userId AND kind = 'weekly' AND NOT EXISTS (SELECT 1 FROM counted)`,
    { replacements: { userId, tz: STREAK_TIME_ZONE }, type: QueryTypes.SELECT }
  );
  const row = rows[0];
  if (!row) return { current: 1, longest: 1, history: 1 };
  return {
    current: Number(row.current_count),
    longest: Number(row.longest_count),
    history: Number(row.history),
  };
}

/**
 * Every metric `getRewardMetrics` reads. A `Record` rather than a list so the
 * compiler rejects a `StoredRewardMetrics` key that the query forgot — each one
 * must also be a column alias in the SELECT below, spelled the same.
 */
const STORED_METRICS: Record<keyof StoredRewardMetrics, true> = {
  cards: true, profileCompleted: true, idProofOnFile: true, uploadedPhotos: true,
  feesConfirmed: true, leaguesJoined: true, clubLoyalty: true, earlyBirds: true,
  playerManager: true, timesBought: true, bestPurseShare: true, recordBuys: true,
  steals: true, iconPicks: true, matchesPlayed: true, matchWins: true, tableTops: true,
  invincibles: true, certificates: true,
  contactOnFile: true, organizersPlayedFor: true, biggestLeagueJoined: true,
  publicLeaguesJoined: true, lastManIn: true, earlyCards: true, partnerLeagues: true,
  teammates: true, receiptsAttached: true,
  franchiseBuys: true, premiumBuys: true, unsoldCount: true, paceBuys: true, spinBuys: true,
  keeperBuys: true, batterBuys: true, allRounderBuys: true, bowlerBuys: true, leftHandBuys: true,
  broadcastBuys: true,
  bestTeamScore: true, bigWins: true, ties: true, runnerUps: true, weekendMatches: true,
  monsoonMatches: true, winterMatches: true, summerMatches: true, rivalMeetings: true,
  teamPoints: true,
  leaguesCreated: true, publicLeagues: true, leaguesWithLogo: true, proofLeagues: true,
  fullHouses: true, biggestLeague: true, teamsBuilt: true, officialsAdded: true,
  sponsorsAdded: true, coOrganizersAdded: true, coOrganizing: true, auctionsRun: true,
  playersSold: true, soldOuts: true, feesConfirmedForLeagues: true, ledgersPublished: true,
  resultsRecorded: true, certificatesReleased: true,
  closedRegistrations: true, pickPlans: true, templatesUsed: true, rapidFills: true,
  fullStrengths: true, fixturesScheduled: true, seasonsCompleted: true, distinctPlayers: true,
  returningPlayers: true, maxSponsorsInLeague: true, iconsNamed: true, broadcasts: true,
  biggestAuction: true, allPaidLeagues: true, staffedLeagues: true, leagueAgeDays: true,
};

/**
 * Everything a badge can be earned on, for one user, in one round trip.
 *
 * Every sub-select starts from this user — their cards (`players.user_id`) or
 * their leagues (`leagues.creator_id`) — and reaches the rest through
 * `league_id` indexes, so the cost tracks this user's history rather than the
 * platform's. The definitions match the rest of the app: a *buy* is a non-icon
 * card on a team at a price (the bid leaderboard's rule), a match counts once it
 * has a score or a winner, and the points table is `calcStandings`' — 2 for a
 * win, 1 each for a tie or no-result.
 *
 * Scores are free text an organizer types ("152/6", "152/6 (20)"), so the
 * scoring badges read only the leading run total and skip anything that has
 * none. A match's date is its `match_date`, or the day it was recorded.
 *
 * Three metrics come back raw for `rewards.ts` to measure:
 * - `pickSequence` — one character per auction held in a league this user had
 *   a card in, '1' when they were picked (bought or icon), oldest first. League
 *   creation date stands in for the auction date, which isn't stored.
 * - `winSequences` — one run of results per team this user played for, '1' for
 *   a win, in match order.
 * - `months` — every 'YYYY-MM' in which a league this user played in started.
 */
export async function getRewardMetrics(
  userId: string
): Promise<{ metrics: StoredRewardMetrics; pickSequence: string; winSequences: string[]; months: string[] }> {
  const PLAYED = `(m.winner_team_id IS NOT NULL
                   OR nullif(m.team1_score, '') IS NOT NULL
                   OR nullif(m.team2_score, '') IS NOT NULL)`;
  const [row] = await sequelize.query<Record<string, number | string | null>>(
    `WITH me AS (
       SELECT profile_completed, id_proof_url, contact_number FROM users WHERE id = :userId
     ),
     cards AS (
       SELECT p.id,
              p.league_id,
              p.team_id,
              p.is_icon,
              p.is_unsold,
              p.sold_price,
              p.photo,
              p.role,
              p.batting_type,
              p.bowling_type,
              p.is_wicket_keeper,
              p.payment_received,
              p.payment_proof_url,
              p.created_at,
              (p.team_id IS NOT NULL AND p.sold_price > 0 AND NOT p.is_icon) AS bought,
              CASE WHEN p.sold_price > 0 AND t.budget > 0 THEN p.sold_price::float8 / t.budget END AS purse_share,
              l.creator_id,
              l.total_players,
              l.is_public AS league_public,
              l.created_at AS league_created_at,
              l.certificates_released_at IS NOT NULL AS certified
         FROM players p
         JOIN leagues l ON l.id = p.league_id
         LEFT JOIN teams t ON t.id = p.team_id
        WHERE p.user_id = :userId
     ),
     auctions AS (
       SELECT c.league_id,
              bool_or(c.bought OR (c.is_icon AND c.team_id IS NOT NULL)) AS picked,
              min(c.league_created_at) AS held_at
         FROM cards c
        WHERE EXISTS (
          SELECT 1 FROM players s
           WHERE s.league_id = c.league_id AND s.team_id IS NOT NULL AND s.sold_price > 0
        )
        GROUP BY c.league_id
     ),
     -- Played matches in the leagues where this user is on a team
     results AS (
       SELECT m.id, m.league_id, m.team1_id, m.team2_id, m.winner_team_id, m.match_date, m.created_at,
              substring(m.team1_score FROM '^[[:space:]]*([0-9]+)')::int AS team1_runs,
              substring(m.team2_score FROM '^[[:space:]]*([0-9]+)')::int AS team2_runs
         FROM matches m
        WHERE m.league_id IN (SELECT league_id FROM cards WHERE team_id IS NOT NULL)
          AND ${PLAYED}
     ),
     my_results AS (
       SELECT c.team_id AS my_team, r.id, r.league_id, r.winner_team_id, r.match_date, r.created_at,
              CASE WHEN c.team_id = r.team1_id THEN r.team2_id ELSE r.team1_id END AS opponent,
              CASE WHEN c.team_id = r.team1_id THEN r.team1_runs ELSE r.team2_runs END AS my_runs,
              CASE WHEN c.team_id = r.team1_id THEN r.team2_runs ELSE r.team1_runs END AS their_runs,
              coalesce(r.match_date, r.created_at::date) AS played_on
         FROM cards c
         JOIN results r ON r.league_id = c.league_id AND c.team_id IN (r.team1_id, r.team2_id)
     ),
     -- Every team's row of the points table, in those leagues
     standings AS (
       SELECT t.league_id,
              t.id AS team_id,
              count(*) AS played,
              count(*) FILTER (WHERE r.winner_team_id = t.id) AS won,
              sum(CASE WHEN r.winner_team_id = t.id THEN 2 WHEN r.winner_team_id IS NULL THEN 1 ELSE 0 END) AS points
         FROM teams t
         JOIN results r ON r.league_id = t.league_id AND t.id IN (r.team1_id, r.team2_id)
        GROUP BY t.league_id, t.id
     ),
     owned AS (
       SELECT l.id, l.total_players, l.is_public, l.logo_url, l.id_proof_required,
              l.payment_proof_required, l.certificates_released_at, l.registration_closed,
              l.pick_preference, l.template_id, l.created_at,
              (SELECT count(*) FROM players p WHERE p.league_id = l.id) AS registered
         FROM leagues l
        WHERE l.creator_id = :userId
     )
     SELECT
       -- As a player
       (SELECT count(*) FROM cards)::int AS "cards",
       (SELECT profile_completed::int FROM me) AS "profileCompleted",
       (SELECT (coalesce(id_proof_url, '') <> '')::int FROM me) AS "idProofOnFile",
       (SELECT count(*) FROM cards WHERE photo LIKE 'https://res.cloudinary.com/%')::int AS "uploadedPhotos",
       (SELECT count(*) FROM cards WHERE payment_received)::int AS "feesConfirmed",
       (SELECT count(DISTINCT league_id) FROM cards)::int AS "leaguesJoined",
       (SELECT coalesce(max(n), 0)
          FROM (SELECT count(DISTINCT league_id) AS n
                  FROM cards WHERE creator_id <> :userId GROUP BY creator_id) per_organizer)::int AS "clubLoyalty",
       (SELECT count(DISTINCT c.league_id)
          FROM cards c
         WHERE c.creator_id <> :userId
           AND (SELECT count(*) FROM players o
                 WHERE o.league_id = c.league_id AND o.created_at < c.created_at) < 3)::int AS "earlyBirds",
       (SELECT count(DISTINCT c.league_id)
          FROM cards c
         WHERE c.creator_id = :userId
            OR EXISTS (SELECT 1 FROM league_co_organizers co
                        WHERE co.league_id = c.league_id AND co.user_id = :userId))::int AS "playerManager",
       (SELECT count(*) FROM cards WHERE bought)::int AS "timesBought",
       (SELECT coalesce(max(purse_share), 0) FROM cards WHERE bought)::float8 AS "bestPurseShare",
       (SELECT count(DISTINCT c.league_id)
          FROM cards c
         WHERE c.bought
           AND c.sold_price = (SELECT max(s.sold_price) FROM players s
                                WHERE s.league_id = c.league_id AND s.team_id IS NOT NULL
                                  AND s.sold_price > 0 AND NOT s.is_icon))::int AS "recordBuys",
       (SELECT count(*) FROM cards WHERE bought AND purse_share <= 0.05)::int AS "steals",
       (SELECT count(*) FROM cards WHERE is_icon)::int AS "iconPicks",
       (SELECT count(*) FROM my_results)::int AS "matchesPlayed",
       (SELECT count(*) FROM my_results WHERE winner_team_id = my_team)::int AS "matchWins",
       (SELECT count(DISTINCT s.league_id)
          FROM standings s
         WHERE s.team_id IN (SELECT team_id FROM cards)
           AND s.points = (SELECT max(x.points) FROM standings x WHERE x.league_id = s.league_id)
           AND (SELECT count(*) FROM results r WHERE r.league_id = s.league_id) >= 3)::int AS "tableTops",
       (SELECT count(DISTINCT s.league_id)
          FROM standings s
         WHERE s.team_id IN (SELECT team_id FROM cards)
           AND s.played >= 3 AND s.won = s.played)::int AS "invincibles",
       (SELECT count(DISTINCT league_id) FROM cards WHERE certified)::int AS "certificates",
       (SELECT (coalesce(contact_number, '') <> '')::int FROM me) AS "contactOnFile",
       (SELECT count(DISTINCT creator_id) FROM cards WHERE creator_id <> :userId)::int AS "organizersPlayedFor",
       (SELECT coalesce(max(n), 0)
          FROM (SELECT DISTINCT c.league_id,
                       (SELECT count(*) FROM players p WHERE p.league_id = c.league_id) AS n
                  FROM cards c) joined)::int AS "biggestLeagueJoined",
       (SELECT count(DISTINCT league_id) FROM cards WHERE league_public)::int AS "publicLeaguesJoined",
       (SELECT count(DISTINCT c.league_id)
          FROM cards c
         WHERE c.total_players > 0
           AND 1 + (SELECT count(*) FROM players o
                     WHERE o.league_id = c.league_id
                       AND (o.created_at < c.created_at
                            OR (o.created_at = c.created_at AND o.id < c.id))) = c.total_players)::int AS "lastManIn",
       (SELECT count(*) FROM cards WHERE created_at < :earlyCutoff)::int AS "earlyCards",
       (SELECT coalesce(max(n), 0)
          FROM (SELECT count(DISTINCT c.league_id) AS n
                  FROM cards c
                  JOIN players o ON o.team_id = c.team_id AND o.user_id IS NOT NULL AND o.user_id <> :userId
                 GROUP BY o.user_id) partners)::int AS "partnerLeagues",
       (SELECT count(DISTINCT o.user_id)
          FROM cards c
          JOIN players o ON o.team_id = c.team_id AND o.user_id IS NOT NULL AND o.user_id <> :userId)::int AS "teammates",
       (SELECT count(*) FROM cards WHERE coalesce(payment_proof_url, '') <> '')::int AS "receiptsAttached",

       -- At auction
       (SELECT count(*)
          FROM cards c
         WHERE c.bought
           AND c.sold_price = (SELECT max(s.sold_price) FROM players s
                                WHERE s.team_id = c.team_id AND s.sold_price > 0 AND NOT s.is_icon))::int AS "franchiseBuys",
       (SELECT count(*)
          FROM cards c
         WHERE c.bought
           AND c.sold_price > (SELECT avg(s.sold_price) FROM players s
                                WHERE s.league_id = c.league_id AND s.team_id IS NOT NULL
                                  AND s.sold_price > 0 AND NOT s.is_icon))::int AS "premiumBuys",
       (SELECT count(*) FROM cards WHERE is_unsold)::int AS "unsoldCount",
       (SELECT count(*) FROM cards
         WHERE bought AND bowling_type IN ('Right-Arm Fast', 'Right-Arm Medium', 'Left-Arm Fast', 'Left-Arm Medium'))::int AS "paceBuys",
       (SELECT count(*) FROM cards
         WHERE bought AND bowling_type IN ('Right-Arm Off-Spin', 'Right-Arm Leg-Spin', 'Left-Arm Spin'))::int AS "spinBuys",
       (SELECT count(*) FROM cards WHERE bought AND (is_wicket_keeper OR role = 'Wicket-Keeper Batter'))::int AS "keeperBuys",
       (SELECT count(*) FROM cards WHERE bought AND role = 'Batter')::int AS "batterBuys",
       (SELECT count(*) FROM cards WHERE bought AND role = 'All-Rounder')::int AS "allRounderBuys",
       (SELECT count(*) FROM cards WHERE bought AND role = 'Bowler')::int AS "bowlerBuys",
       (SELECT count(*) FROM cards WHERE bought AND batting_type = 'Left-Hand Bat')::int AS "leftHandBuys",
       (SELECT count(*)
          FROM cards c
         WHERE c.bought AND EXISTS (SELECT 1 FROM auction_live a WHERE a.league_id = c.league_id))::int AS "broadcastBuys",

       -- On the field
       (SELECT coalesce(max(my_runs), 0) FROM my_results)::int AS "bestTeamScore",
       (SELECT count(*) FROM my_results
         WHERE winner_team_id = my_team AND my_runs - their_runs >= 50)::int AS "bigWins",
       (SELECT count(*) FROM my_results
         WHERE winner_team_id IS NULL AND my_runs IS NOT NULL AND my_runs = their_runs)::int AS "ties",
       (SELECT count(DISTINCT s.league_id)
          FROM standings s
         WHERE s.team_id IN (SELECT team_id FROM cards)
           AND (SELECT count(*) FROM results r WHERE r.league_id = s.league_id) >= 3
           AND (SELECT count(*) FROM standings x WHERE x.league_id = s.league_id AND x.points > s.points) = 1
           AND (SELECT count(*) FROM standings x WHERE x.league_id = s.league_id AND x.points = s.points) = 1)::int AS "runnerUps",
       (SELECT count(*) FROM my_results WHERE extract(isodow FROM played_on) IN (6, 7))::int AS "weekendMatches",
       (SELECT count(*) FROM my_results WHERE extract(month FROM played_on) IN (6, 7, 8, 9))::int AS "monsoonMatches",
       (SELECT count(*) FROM my_results WHERE extract(month FROM played_on) IN (11, 12, 1, 2))::int AS "winterMatches",
       (SELECT count(*) FROM my_results WHERE extract(month FROM played_on) IN (3, 4, 5))::int AS "summerMatches",
       (SELECT coalesce(max(n), 0)
          FROM (SELECT count(*) AS n FROM my_results GROUP BY my_team, opponent) rivals)::int AS "rivalMeetings",
       (SELECT coalesce(sum(CASE WHEN winner_team_id = my_team THEN 2 WHEN winner_team_id IS NULL THEN 1 ELSE 0 END), 0)
          FROM my_results)::int AS "teamPoints",

       -- As an organizer
       (SELECT count(*) FROM owned)::int AS "leaguesCreated",
       (SELECT count(*) FROM owned WHERE is_public)::int AS "publicLeagues",
       (SELECT count(*) FROM owned WHERE logo_url <> '')::int AS "leaguesWithLogo",
       (SELECT count(*) FROM owned WHERE id_proof_required OR payment_proof_required)::int AS "proofLeagues",
       (SELECT count(*) FROM owned WHERE total_players > 0 AND registered >= total_players)::int AS "fullHouses",
       (SELECT coalesce(max(registered), 0) FROM owned)::int AS "biggestLeague",
       (SELECT count(*) FROM teams x JOIN owned o ON o.id = x.league_id)::int AS "teamsBuilt",
       (SELECT count(*) FROM team_officials x JOIN owned o ON o.id = x.league_id)::int AS "officialsAdded",
       (SELECT count(*) FROM sponsors x JOIN owned o ON o.id = x.league_id)::int AS "sponsorsAdded",
       (SELECT count(*) FROM league_co_organizers x JOIN owned o ON o.id = x.league_id)::int AS "coOrganizersAdded",
       (SELECT count(*) FROM league_co_organizers WHERE user_id = :userId)::int AS "coOrganizing",
       (SELECT count(*)
          FROM owned o
         WHERE EXISTS (SELECT 1 FROM players p
                        WHERE p.league_id = o.id AND p.team_id IS NOT NULL AND p.sold_price > 0))::int AS "auctionsRun",
       (SELECT count(*)
          FROM players p JOIN owned o ON o.id = p.league_id
         WHERE p.team_id IS NOT NULL AND p.sold_price > 0 AND NOT p.is_icon)::int AS "playersSold",
       (SELECT count(*)
          FROM owned o
         WHERE (SELECT count(*) FROM players p WHERE p.league_id = o.id AND NOT p.is_icon) >= 8
           AND NOT EXISTS (SELECT 1 FROM players p
                            WHERE p.league_id = o.id AND NOT p.is_icon
                              AND NOT (p.team_id IS NOT NULL AND p.sold_price > 0)))::int AS "soldOuts",
       (SELECT count(*)
          FROM players p JOIN owned o ON o.id = p.league_id
         WHERE p.payment_received)::int AS "feesConfirmedForLeagues",
       (SELECT count(*)
          FROM league_ledgers x JOIN owned o ON o.id = x.league_id
         WHERE x.published)::int AS "ledgersPublished",
       (SELECT count(*) FROM matches m JOIN owned o ON o.id = m.league_id WHERE ${PLAYED})::int AS "resultsRecorded",
       (SELECT count(*) FROM owned WHERE certificates_released_at IS NOT NULL)::int AS "certificatesReleased",
       (SELECT count(*) FROM owned WHERE registration_closed)::int AS "closedRegistrations",
       (SELECT count(*) FROM owned WHERE pick_preference IS NOT NULL)::int AS "pickPlans",
       (SELECT count(DISTINCT template_id) FROM owned)::int AS "templatesUsed",
       (SELECT count(*)
          FROM owned o
         WHERE o.total_players > 0
           AND (SELECT count(*) FROM players p
                 WHERE p.league_id = o.id
                   AND p.created_at <= o.created_at + interval '7 days') >= o.total_players)::int AS "rapidFills",
       (SELECT count(*)
          FROM owned o
         WHERE (SELECT count(*) FROM teams t WHERE t.league_id = o.id) >= 2
           AND NOT EXISTS (SELECT 1 FROM teams t
                            WHERE t.league_id = o.id
                              AND (SELECT count(*) FROM players p WHERE p.team_id = t.id) < t.max_players))::int AS "fullStrengths",
       (SELECT count(*) FROM matches m JOIN owned o ON o.id = m.league_id
         WHERE m.match_date IS NOT NULL)::int AS "fixturesScheduled",
       (SELECT count(*)
          FROM owned o
         WHERE (SELECT count(*) FROM matches m WHERE m.league_id = o.id) >= 5
           AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.league_id = o.id AND NOT ${PLAYED}))::int AS "seasonsCompleted",
       (SELECT count(DISTINCT p.user_id) FROM players p JOIN owned o ON o.id = p.league_id
         WHERE p.user_id IS NOT NULL AND p.user_id <> :userId)::int AS "distinctPlayers",
       (SELECT count(*)
          FROM (SELECT p.user_id FROM players p JOIN owned o ON o.id = p.league_id
                 WHERE p.user_id IS NOT NULL AND p.user_id <> :userId
                 GROUP BY p.user_id
                HAVING count(DISTINCT p.league_id) >= 2) regulars)::int AS "returningPlayers",
       (SELECT coalesce(max(n), 0)
          FROM (SELECT count(*) AS n FROM sponsors x JOIN owned o ON o.id = x.league_id
                 GROUP BY x.league_id) per_league)::int AS "maxSponsorsInLeague",
       (SELECT count(*) FROM players p JOIN owned o ON o.id = p.league_id WHERE p.is_icon)::int AS "iconsNamed",
       (SELECT count(*) FROM auction_live a JOIN owned o ON o.id = a.league_id)::int AS "broadcasts",
       (SELECT coalesce(max(n), 0)
          FROM (SELECT count(*) AS n FROM players p JOIN owned o ON o.id = p.league_id
                 WHERE p.team_id IS NOT NULL AND p.sold_price > 0 AND NOT p.is_icon
                 GROUP BY p.league_id) per_auction)::int AS "biggestAuction",
       (SELECT count(*)
          FROM owned o
         WHERE o.registered >= 8
           AND NOT EXISTS (SELECT 1 FROM players p WHERE p.league_id = o.id AND NOT p.payment_received))::int AS "allPaidLeagues",
       (SELECT count(*)
          FROM owned o
         WHERE (SELECT count(*) FROM teams t WHERE t.league_id = o.id) >= 2
           AND NOT EXISTS (SELECT 1 FROM teams t
                            WHERE t.league_id = o.id
                              AND NOT EXISTS (SELECT 1 FROM team_officials x WHERE x.team_id = t.id)))::int AS "staffedLeagues",
       (SELECT coalesce(max(extract(epoch FROM now() - created_at) / 86400), 0) FROM owned)::int AS "leagueAgeDays",

       -- Sequences, measured in rewards.ts
       (SELECT coalesce(string_agg(CASE WHEN picked THEN '1' ELSE '0' END, '' ORDER BY held_at, league_id), '')
          FROM auctions) AS "pickSequence",
       (SELECT coalesce(string_agg(seq, '|'), '')
          FROM (SELECT string_agg(CASE WHEN winner_team_id = my_team THEN '1' ELSE '0' END, ''
                                  ORDER BY match_date NULLS LAST, created_at, id) AS seq
                  FROM my_results
                 GROUP BY my_team) per_team) AS "winSequences",
       (SELECT coalesce(string_agg(DISTINCT to_char(league_created_at, 'YYYY-MM'), ','), '')
          FROM cards) AS "months"`,
    { replacements: { userId, earlyCutoff: EARLY_ADOPTER_CUTOFF }, type: QueryTypes.SELECT }
  );

  const metrics = Object.fromEntries(
    Object.keys(STORED_METRICS).map((key) => [key, Number(row?.[key] ?? 0)])
  ) as unknown as StoredRewardMetrics;
  const list = (key: string, separator: string) => {
    const value = String(row?.[key] ?? '');
    return value ? value.split(separator) : [];
  };
  return {
    metrics,
    pickSequence: String(row?.pickSequence ?? ''),
    winSequences: list('winSequences', '|'),
    months: list('months', ','),
  };
}

/**
 * Award badge tiers, and return the user's whole cabinet.
 *
 * Offers every tier the user qualifies for; `ON CONFLICT DO NOTHING` drops the
 * ones already held without writing anything, so `RETURNING` yields exactly the
 * tiers that are new *as of this statement*. That is the "just unlocked" set —
 * two concurrent check-ins can't both see the same tier as new, so a badge is
 * celebrated once. The second branch adds the rows that already existed; the
 * statement's snapshot can't see the ones it just inserted, so nothing is
 * listed twice.
 */
export async function awardBadges(
  userId: string,
  candidates: { badgeId: string; tier: BadgeTier }[]
): Promise<{ earned: EarnedBadge[]; unlocked: EarnedBadge[] }> {
  type Row = { badge_id: string; tier: number; earned_at: Date; fresh: boolean };
  const rows = candidates.length
    ? await sequelize.query<Row>(
        `WITH awarded AS (
           INSERT INTO user_badges (user_id, badge_id, tier, earned_at)
           SELECT :userId, c.badge_id, c.tier, now()
             FROM unnest(ARRAY[:badgeIds]::varchar[], ARRAY[:tiers]::smallint[]) AS c(badge_id, tier)
           ON CONFLICT (user_id, badge_id, tier) DO NOTHING
           RETURNING badge_id, tier, earned_at
         )
         SELECT badge_id, tier, earned_at, true AS fresh FROM awarded
         UNION ALL
         SELECT badge_id, tier, earned_at, false AS fresh FROM user_badges WHERE user_id = :userId
         ORDER BY earned_at`,
        {
          replacements: {
            userId,
            badgeIds: candidates.map((c) => c.badgeId),
            tiers: candidates.map((c) => c.tier),
          },
          type: QueryTypes.SELECT,
        }
      )
    : await sequelize.query<Row>(
        `SELECT badge_id, tier, earned_at, false AS fresh
           FROM user_badges WHERE user_id = :userId ORDER BY earned_at`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      );

  const earned = rows.map((r) => ({
    badgeId:  r.badge_id,
    tier:     Number(r.tier) as BadgeTier,
    earnedAt: new Date(r.earned_at).toISOString(),
  }));
  return { earned, unlocked: earned.filter((_, i) => rows[i].fresh) };
}

/**
 * Share of all accounts holding each badge tier, keyed `badgeId:tier`.
 *
 * Counts across every user, but returns nothing that identifies one. The
 * GROUP BY is an index-only scan of `user_badges_badge_tier_idx`; even so it
 * grows with the platform, so callers cache it (`rewards.ts`) instead of
 * running it per page view.
 */
export async function getBadgeRarity(): Promise<Record<string, number>> {
  const [holders, accounts] = await Promise.all([
    sequelize.query<{ badge_id: string; tier: number; holders: number }>(
      'SELECT badge_id, tier, count(*)::int AS holders FROM user_badges GROUP BY badge_id, tier',
      { type: QueryTypes.SELECT }
    ),
    UserModel.count(),
  ]);
  if (accounts === 0) return {};
  return Object.fromEntries(
    holders.map((h) => [`${h.badge_id}:${h.tier}`, Number(h.holders) / accounts])
  );
}

// ── Super-admin analytics ─────────────────────────────────────────────────────
// Platform-wide reads for the owner dashboard. Every function here crosses
// league boundaries and returns data (creator emails, private leagues) that no
// organizer-facing endpoint may expose, so all of them are gated by
// `requireAdmin` in their route handlers — nothing below authorizes itself.

/** A player counts as "sold" only when a team paid for them — icons aren't sales. */
const SOLD_WHERE = { teamId: { [Op.ne]: null }, soldPrice: { [Op.gt]: 0 } };
const SOLD_SQL = 'team_id IS NOT NULL AND sold_price > 0';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** YYYY-MM-DD in UTC, so a day bucket means the same thing for every viewer. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Buckets timestamps into one entry per day across the trailing `days` window,
 * emitting the empty days too so the growth chart has no gaps.
 */
function bucketByDay(days: number, leagueDates: Date[], playerDates: Date[]): AdminTrendPoint[] {
  const leagues = new Map<string, number>();
  const players = new Map<string, number>();
  for (const d of leagueDates) {
    const k = dayKey(d);
    leagues.set(k, (leagues.get(k) ?? 0) + 1);
  }
  for (const d of playerDates) {
    const k = dayKey(d);
    players.set(k, (players.get(k) ?? 0) + 1);
  }

  const out: AdminTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(daysAgo(i));
    out.push({ date: key, leagues: leagues.get(key) ?? 0, players: players.get(key) ?? 0 });
  }
  return out;
}

/** Headline numbers, growth windows, the 30-day trend and the biggest sales. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);

  const [
    leagues, users, players, teams, matches, sponsors, publicLeagues,
    playersSold, auctionValue, auctionsRun,
    leagues7d, leagues30d, players7d, players30d,
    leagueDateRows, playerDateRows, roleRows, topBids,
  ] = await Promise.all([
    LeagueModel.count(),
    UserModel.count(),
    PlayerModel.count(),
    TeamModel.count(),
    MatchModel.count(),
    SponsorModel.count(),
    LeagueModel.count({ where: { isPublic: true } }),
    PlayerModel.count({ where: SOLD_WHERE }),
    PlayerModel.sum('soldPrice', { where: SOLD_WHERE }),
    PlayerModel.count({ where: SOLD_WHERE, distinct: true, col: 'leagueId' }),
    LeagueModel.count({ where: { createdAt: { [Op.gte]: since7 } } }),
    LeagueModel.count({ where: { createdAt: { [Op.gte]: since30 } } }),
    PlayerModel.count({ where: { createdAt: { [Op.gte]: since7 } } }),
    PlayerModel.count({ where: { createdAt: { [Op.gte]: since30 } } }),
    LeagueModel.findAll({ where: { createdAt: { [Op.gte]: since30 } }, attributes: ['createdAt'], raw: true }),
    PlayerModel.findAll({ where: { createdAt: { [Op.gte]: since30 } }, attributes: ['createdAt'], raw: true }),
    PlayerModel.findAll({
      attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true,
    }),
    getTopBids(10),
  ]);

  const toDates = (rows: unknown[]) =>
    (rows as { createdAt: string | Date }[]).map((r) => new Date(r.createdAt));

  return {
    totals: {
      leagues, users, players, teams, matches, sponsors, publicLeagues, playersSold,
      // `sum` answers null on an empty set rather than 0
      auctionValue: Number(auctionValue ?? 0),
      auctionsRun,
    },
    recent: { leagues7d, leagues30d, players7d, players30d },
    trend: bucketByDay(30, toDates(leagueDateRows), toDates(playerDateRows)),
    roleSplit: (roleRows as unknown as { role: string; count: string | number }[])
      .map((r) => ({ role: r.role, count: Number(r.count) }))
      .sort((a, b) => b.count - a.count),
    topBids,
  };
}

/**
 * Every league on the platform with its rollups, newest first. Player and team
 * counts come from grouped aggregates rather than a query per league, so this
 * stays a fixed number of round trips however many leagues exist.
 */
export async function getAdminLeagues(): Promise<AdminLeagueRow[]> {
  const leagueRows = await LeagueModel.findAll({ order: [['createdAt', 'DESC']] });
  if (leagueRows.length === 0) return [];

  const leagueIds = leagueRows.map((l) => l.id);
  const creatorIds = [...new Set(leagueRows.map((l) => l.creatorId!))];

  const [playerAgg, teamAgg, creators, liveRows] = await Promise.all([
    PlayerModel.findAll({
      where: { leagueId: { [Op.in]: leagueIds } },
      attributes: [
        'leagueId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'playerCount'],
        [sequelize.literal('SUM(CASE WHEN ' + SOLD_SQL + ' THEN 1 ELSE 0 END)'), 'soldCount'],
        [sequelize.literal('COALESCE(SUM(CASE WHEN ' + SOLD_SQL + ' THEN sold_price ELSE 0 END), 0)'), 'auctionValue'],
      ],
      group: ['leagueId'],
      raw: true,
    }),
    TeamModel.findAll({
      where: { leagueId: { [Op.in]: leagueIds } },
      attributes: ['leagueId', [sequelize.fn('COUNT', sequelize.col('id')), 'teamCount']],
      group: ['leagueId'],
      raw: true,
    }),
    UserModel.findAll({ where: { id: { [Op.in]: creatorIds } }, attributes: ['id', 'email', 'name'], raw: true }),
    AuctionLiveModel.findAll({ where: { leagueId: { [Op.in]: leagueIds } }, attributes: ['leagueId'], raw: true }),
  ]);

  type PlayerAgg = { leagueId: string; playerCount: string; soldCount: string | null; auctionValue: string };
  const playersBy = new Map((playerAgg as unknown as PlayerAgg[]).map((r) => [r.leagueId, r]));
  const teamsBy = new Map(
    (teamAgg as unknown as { leagueId: string; teamCount: string }[]).map((r) => [r.leagueId, Number(r.teamCount)])
  );
  const creatorBy = new Map(
    (creators as unknown as { id: string; email: string; name: string }[]).map((u) => [u.id, u])
  );
  const liveIds = new Set((liveRows as unknown as { leagueId: string }[]).map((r) => r.leagueId));

  return leagueRows.map((row) => {
    const agg = playersBy.get(row.id);
    const creator = creatorBy.get(row.creatorId!);
    return {
      id:           row.id,
      name:         row.name,
      conductedBy:  row.conductedBy,
      logoUrl:      row.logoUrl ?? '',
      creatorId:    row.creatorId!,
      creatorEmail: creator?.email ?? '—',
      creatorName:  creator?.name || creator?.email || '—',
      totalPlayers: row.totalPlayers,
      playerCount:  Number(agg?.playerCount ?? 0),
      teamCount:    teamsBy.get(row.id) ?? 0,
      soldCount:    Number(agg?.soldCount ?? 0),
      auctionValue: Number(agg?.auctionValue ?? 0),
      isPublic:     row.isPublic ?? false,
      registrationClosed: row.registrationClosed ?? false,
      certificatesReleasedAt: row.certificatesReleasedAt?.toISOString() ?? null,
      hasLiveAuction: liveIds.has(row.id),
      createdAt:    row.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  });
}

/** Every registered account, with how much of the platform each one has used. */
export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const userRows = await UserModel.findAll({ order: [['updatedAt', 'DESC']] });
  if (userRows.length === 0) return [];

  const userIds = userRows.map((u) => u.id);
  const [leagueAgg, playerAgg] = await Promise.all([
    LeagueModel.findAll({
      where: { creatorId: { [Op.in]: userIds } },
      attributes: ['creatorId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['creatorId'],
      raw: true,
    }),
    PlayerModel.findAll({
      where: { userId: { [Op.in]: userIds } },
      attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['userId'],
      raw: true,
    }),
  ]);

  const leaguesBy = new Map(
    (leagueAgg as unknown as { creatorId: string; count: string }[]).map((r) => [r.creatorId, Number(r.count)])
  );
  const cardsBy = new Map(
    (playerAgg as unknown as { userId: string; count: string }[]).map((r) => [r.userId, Number(r.count)])
  );

  return userRows.map((u) => ({
    id:               u.id,
    email:            u.email,
    name:             u.name ?? '',
    photo:            u.photo ?? '',
    leaguesCreated:   leaguesBy.get(u.id) ?? 0,
    playerCards:      cardsBy.get(u.id) ?? 0,
    profileCompleted: u.profileCompleted ?? false,
    updatedAt:        u.updatedAt?.toISOString() ?? null,
  }));
}
