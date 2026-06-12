import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from 'sequelize';
import { sequelize } from './db';

// ── User ──────────────────────────────────────────────────────────────────────
export class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel, { omit: 'updatedAt' }>
> {
  declare id: string;
  declare email: string;
  declare name: CreationOptional<string>;
  declare photo: CreationOptional<string>;
  declare battingType: CreationOptional<string>;
  declare bowlingType: CreationOptional<string>;
  declare role: CreationOptional<string>;
  declare isWicketKeeper: CreationOptional<boolean>;
  declare profileCompleted: CreationOptional<boolean>;
  declare updatedAt: CreationOptional<Date>;
}

UserModel.init(
  {
    id:               { type: DataTypes.STRING,  primaryKey: true },
    email:            { type: DataTypes.STRING,  allowNull: false, defaultValue: '' },
    name:             { type: DataTypes.STRING,  allowNull: false, defaultValue: '' },
    photo:            { type: DataTypes.TEXT,    allowNull: false, defaultValue: '' },
    battingType:      { type: DataTypes.STRING,  allowNull: false, defaultValue: 'Right-Hand Bat' },
    bowlingType:      { type: DataTypes.STRING,  allowNull: false, defaultValue: 'N/A' },
    role:             { type: DataTypes.STRING,  allowNull: false, defaultValue: 'Batter' },
    isWicketKeeper:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    profileCompleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    updatedAt:        { type: DataTypes.DATE,    allowNull: true,  defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'users', timestamps: false, underscored: true }
);

// ── League ────────────────────────────────────────────────────────────────────
export class LeagueModel extends Model<
  InferAttributes<LeagueModel>,
  InferCreationAttributes<LeagueModel, { omit: 'createdAt' }>
> {
  declare id: string;
  declare name: string;
  declare totalPlayers: number;
  declare conductedBy: string;
  declare creatorId: ForeignKey<UserModel['id']>;
  declare templateId: CreationOptional<string>;
  declare logoUrl: CreationOptional<string>;
  declare isPublic: CreationOptional<boolean>;
  declare joinCode: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

LeagueModel.init(
  {
    id:           { type: DataTypes.STRING,  primaryKey: true },
    name:         { type: DataTypes.STRING,  allowNull: false },
    totalPlayers: { type: DataTypes.INTEGER, allowNull: false },
    conductedBy:  { type: DataTypes.STRING,  allowNull: false },
    creatorId:    { type: DataTypes.STRING,  allowNull: false },
    templateId:   { type: DataTypes.STRING,  allowNull: false, defaultValue: 'classic-green' },
    logoUrl:      { type: DataTypes.TEXT,    allowNull: false, defaultValue: '' },
    isPublic:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    joinCode:     { type: DataTypes.STRING(8), allowNull: true, defaultValue: null },
    createdAt:    { type: DataTypes.DATE,    allowNull: true,  defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'leagues', timestamps: false, underscored: true }
);

// ── Team ──────────────────────────────────────────────────────────────────────
export class TeamModel extends Model<
  InferAttributes<TeamModel>,
  InferCreationAttributes<TeamModel, { omit: 'createdAt' }>
> {
  declare id: string;
  declare leagueId: ForeignKey<LeagueModel['id']>;
  declare name: string;
  declare colorHex: CreationOptional<string>;
  declare budget: CreationOptional<number>;
  declare maxPlayers: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
}

TeamModel.init(
  {
    id:         { type: DataTypes.STRING,  primaryKey: true },
    leagueId:   { type: DataTypes.STRING,  allowNull: false },
    name:       { type: DataTypes.STRING,  allowNull: false },
    colorHex:   { type: DataTypes.STRING,  allowNull: false, defaultValue: '#22c55e' },
    budget:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10000000 },
    maxPlayers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 11 },
    createdAt:  { type: DataTypes.DATE,    allowNull: true,  defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'teams', timestamps: false, underscored: true }
);

// ── Player ────────────────────────────────────────────────────────────────────
export class PlayerModel extends Model<
  InferAttributes<PlayerModel>,
  InferCreationAttributes<PlayerModel, { omit: 'createdAt' }>
> {
  declare id: string;
  declare leagueId: ForeignKey<LeagueModel['id']>;
  declare userId: CreationOptional<string | null>;
  declare name: string;
  declare photo: CreationOptional<string>;
  declare battingType: string;
  declare bowlingType: string;
  declare role: string;
  declare isWicketKeeper: CreationOptional<boolean>;
  declare creatorToken: string;
  // Auction
  declare teamId: CreationOptional<string | null>;
  declare soldPrice: CreationOptional<number | null>;
  declare isUnsold: CreationOptional<boolean>;
  declare isIcon: CreationOptional<boolean>;
  // Stats
  declare statsMatches: CreationOptional<number | null>;
  declare statsRuns: CreationOptional<number | null>;
  declare statsWickets: CreationOptional<number | null>;
  declare statsAverage: CreationOptional<number | null>;
  declare statsSR: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
}

PlayerModel.init(
  {
    id:             { type: DataTypes.STRING,  primaryKey: true },
    leagueId:       { type: DataTypes.STRING,  allowNull: false },
    userId:         { type: DataTypes.STRING,  allowNull: true,  defaultValue: null },
    name:           { type: DataTypes.STRING,  allowNull: false },
    photo:          { type: DataTypes.TEXT,    allowNull: false, defaultValue: '' },
    battingType:    { type: DataTypes.STRING,  allowNull: false },
    bowlingType:    { type: DataTypes.STRING,  allowNull: false },
    role:           { type: DataTypes.STRING,  allowNull: false },
    isWicketKeeper: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    creatorToken:   { type: DataTypes.STRING,  allowNull: false },
    teamId:         { type: DataTypes.STRING,  allowNull: true,  defaultValue: null },
    soldPrice:      { type: DataTypes.INTEGER, allowNull: true,  defaultValue: null },
    isUnsold:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isIcon:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    statsMatches:   { type: DataTypes.INTEGER, allowNull: true,  defaultValue: null },
    statsRuns:      { type: DataTypes.INTEGER, allowNull: true,  defaultValue: null },
    statsWickets:   { type: DataTypes.INTEGER, allowNull: true,  defaultValue: null },
    statsAverage:   { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: null },
    statsSR:        { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: null, field: 'stats_sr' },
    createdAt:      { type: DataTypes.DATE,    allowNull: true,  defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'players', timestamps: false, underscored: true }
);

// ── Match ─────────────────────────────────────────────────────────────────────
export class MatchModel extends Model<
  InferAttributes<MatchModel>,
  InferCreationAttributes<MatchModel, { omit: 'createdAt' }>
> {
  declare id: string;
  declare leagueId: ForeignKey<LeagueModel['id']>;
  declare team1Id: string;
  declare team2Id: string;
  declare team1Score: CreationOptional<string | null>;
  declare team2Score: CreationOptional<string | null>;
  declare winnerTeamId: CreationOptional<string | null>;
  declare matchDate: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

MatchModel.init(
  {
    id:            { type: DataTypes.STRING,   primaryKey: true },
    leagueId:      { type: DataTypes.STRING,   allowNull: false },
    team1Id:       { type: DataTypes.STRING,   allowNull: false },
    team2Id:       { type: DataTypes.STRING,   allowNull: false },
    team1Score:    { type: DataTypes.STRING,   allowNull: true },
    team2Score:    { type: DataTypes.STRING,   allowNull: true },
    winnerTeamId:  { type: DataTypes.STRING,   allowNull: true },
    matchDate:     { type: DataTypes.DATEONLY, allowNull: true },
    createdAt:     { type: DataTypes.DATE,     allowNull: true, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'matches', timestamps: false, underscored: true }
);

// ── Associations ──────────────────────────────────────────────────────────────
UserModel.hasMany(LeagueModel,  { foreignKey: 'creatorId', onDelete: 'CASCADE' });
LeagueModel.belongsTo(UserModel, { foreignKey: 'creatorId' });

LeagueModel.hasMany(TeamModel,   { foreignKey: 'leagueId', onDelete: 'CASCADE' });
TeamModel.belongsTo(LeagueModel, { foreignKey: 'leagueId' });

LeagueModel.hasMany(PlayerModel,  { foreignKey: 'leagueId', onDelete: 'CASCADE' });
PlayerModel.belongsTo(LeagueModel, { foreignKey: 'leagueId' });

LeagueModel.hasMany(MatchModel,   { foreignKey: 'leagueId', onDelete: 'CASCADE' });
MatchModel.belongsTo(LeagueModel, { foreignKey: 'leagueId' });
