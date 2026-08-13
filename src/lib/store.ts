import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { sequelize } from './db';
import { UserModel, LeagueModel, PlayerModel, TeamModel, MatchModel, TeamOfficialModel, AuctionLiveModel, SponsorModel, LeagueCoOrganizerModel, LeagueLedgerModel } from './models';
import { calcStandings } from './standings';
import type { League, Player, Team, Match, UserProfile, TeamOfficial, LiveAuctionState, TopBid, PlatformStats, Sponsor, CoOrganizer, LeagueLedger, LeagueCertificate, PublicLeagueView, PublicPlayer, PublicTeam, PublicMatch, PublicStanding } from './types';

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

  const [players, teams, officials, matches, sponsors] = await Promise.all([
    getPlayers(id),
    getTeams(id),
    getOfficials(id),
    getMatches(id),
    getSponsors(id),
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

/**
 * The highest winning bids across the entire system — every sold player in
 * every league, ranked by price. There is no Player↔Team association, so the
 * league and team names are resolved with two follow-up lookups keyed on the
 * ids that appear in the top slice (never the whole table).
 */
export async function getTopBids(limit = 20): Promise<TopBid[]> {
  const rows = await PlayerModel.findAll({
    where: { teamId: { [Op.ne]: null }, soldPrice: { [Op.gt]: 0 } },
    order: [['soldPrice', 'DESC']],
    limit,
  });
  if (rows.length === 0) return [];

  const leagueIds = [...new Set(rows.map((r) => r.leagueId!))];
  const teamIds = [...new Set(rows.map((r) => r.teamId!))];
  const [leagues, teams] = await Promise.all([
    LeagueModel.findAll({ where: { id: { [Op.in]: leagueIds } }, attributes: ['id', 'name'] }),
    TeamModel.findAll({ where: { id: { [Op.in]: teamIds } }, attributes: ['id', 'name', 'colorHex'] }),
  ]);
  const leagueById = Object.fromEntries(leagues.map((l) => [l.id, l]));
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  return rows.map((r) => ({
    playerId:   r.id,
    playerName: r.name,
    photo:      r.photo ?? '',
    soldPrice:  r.soldPrice ?? 0,
    isIcon:     r.isIcon ?? false,
    leagueId:   r.leagueId!,
    leagueName: leagueById[r.leagueId!]?.name ?? '—',
    teamName:   teamById[r.teamId!]?.name ?? '—',
    teamColor:  teamById[r.teamId!]?.colorHex ?? '#64748b',
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
export async function cleanupImages(urls: Array<string | null | undefined>): Promise<void> {
  const { deleteFromCloudinary, cloudinaryPublicId } = await import('./cloudinary');
  const candidates = [...new Set(urls.filter((u): u is string => !!u && !!cloudinaryPublicId(u)))];

  await Promise.allSettled(
    candidates.map(async (url) => {
      const [playerRefs, profileRefs, logoRefs, officialRefs, sponsorRefs] = await Promise.all([
        PlayerModel.count({ where: { photo: url } }),
        UserModel.count({ where: { photo: url } }),
        LeagueModel.count({ where: { logoUrl: url } }),
        TeamOfficialModel.count({ where: { photo: url } }),
        SponsorModel.count({ where: { logoUrl: url } }),
      ]);
      if (playerRefs + profileRefs + logoRefs + officialRefs + sponsorRefs === 0) {
        await deleteFromCloudinary(url);
      }
    })
  );
}
