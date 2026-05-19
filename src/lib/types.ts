export interface League {
  id: string;
  name: string;
  totalPlayers: number;
  conductedBy: string;
  creatorToken: string;
  templateId: string;
  logoUrl: string; // base64 data URL or empty string
  createdAt: string;
}

export interface Player {
  id: string;
  leagueId: string;
  name: string;
  photo: string; // base64 data URL
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
}

export interface LeagueWithPlayers extends League {
  players: Player[];
}
