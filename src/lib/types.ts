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
  createdAt: string;
  // Auction
  teamId?: string | null;
  soldPrice?: number | null;
  isUnsold?: boolean;
  /** Star player pre-assigned to a team before the auction */
  isIcon?: boolean;
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
  updatedAt: string;
}

/** Shape returned by GET /api/leagues/[id] */
export interface LeagueWithPlayers extends Omit<League, 'creatorId'> {
  players: Player[];
  teams: Team[];
  isCreator: boolean;
}
