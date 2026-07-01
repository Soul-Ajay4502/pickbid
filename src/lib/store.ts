import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { sequelize } from './db';
import { UserModel, LeagueModel, PlayerModel, TeamModel, MatchModel, TeamOfficialModel, AuctionLiveModel } from './models';
import type { League, Player, Team, Match, UserProfile, TeamOfficial, LiveAuctionState, TopBid } from './types';

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
  });
  return toLeague(row);
}

export async function updateLeague(
  id: string,
  data: Partial<Omit<League, 'id' | 'creatorId' | 'createdAt'>>
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
 * code), matches and live-auction state are never carried over, and every
 * copied player has their auction result cleared. Icon players keep their
 * pre-assigned team (remapped to the clone's new team rows); everyone else is
 * reset to unsold. `overrides` lets the caller edit the league's details at
 * clone time; whatever is omitted falls back to the source league's value.
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
  overrides: Partial<Pick<League, 'name' | 'conductedBy' | 'totalPlayers' | 'templateId' | 'logoUrl'>> = {},
  options: {
    includeTeams?: boolean;
    includePlayers?: boolean;
    includeOfficials?: boolean;
    copyContactNumbers?: boolean;
  } = {}
): Promise<League | null> {
  const source = await LeagueModel.findByPk(sourceId);
  if (!source) return null;

  await ensureUser(creatorId, creatorEmail);

  const includeTeams = options.includeTeams ?? true;
  const includePlayers = options.includePlayers ?? true;
  // Officials live on teams, so they can only come along when teams do
  const includeOfficials = (options.includeOfficials ?? true) && includeTeams;

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
        // their team (remapped). Everyone else resets to unsold.
        const keepTeam = p.isIcon && p.teamId ? teamIdMap.get(p.teamId) ?? null : null;
        await PlayerModel.create(
          {
            id:             uuidv4(),
            leagueId:       newLeague.id,
            // The clone's players aren't "joined" by the original owners, and
            // a fresh token means only the new organiser controls these cards
            userId:         null,
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
            soldPrice:      null,
            isUnsold:       false,
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

// ── Players ───────────────────────────────────────────────────────────────────

export async function getPlayers(leagueId: string): Promise<Player[]> {
  const rows = await PlayerModel.findAll({ where: { leagueId }, order: [['createdAt', 'ASC']] });
  return rows.map(toPlayer);
}

export async function getPlayer(id: string): Promise<Player | null> {
  const row = await PlayerModel.findByPk(id);
  return row ? toPlayer(row) : null;
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
      const [playerRefs, profileRefs, logoRefs, officialRefs] = await Promise.all([
        PlayerModel.count({ where: { photo: url } }),
        UserModel.count({ where: { photo: url } }),
        LeagueModel.count({ where: { logoUrl: url } }),
        TeamOfficialModel.count({ where: { photo: url } }),
      ]);
      if (playerRefs + profileRefs + logoRefs + officialRefs === 0) {
        await deleteFromCloudinary(url);
      }
    })
  );
}
