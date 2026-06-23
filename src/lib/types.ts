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
  role: 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper Batter';
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
  /** True when the requesting user has a card in this league (matched by userId) */
  hasJoined: boolean;
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
