import type { BadgeTier, EarnedBadge, RewardGoal, RewardMetric, RewardMetrics } from './types';

/**
 * The badge catalog, and the pure arithmetic around it.
 *
 * Definitions live here rather than in a table: the database records only who
 * earned which tier and when (`user_badges`), so reading a user's cabinet is one
 * primary-key scan with no join, and a new badge ships without a migration.
 * No React and no server imports — the evaluator in `rewards.ts` and the client
 * components both read this file.
 *
 * `id` is persisted. Never rename or reuse one: drop a retired badge from the
 * list instead, and its rows simply stop being shown. Thresholds may change,
 * but earned rows are never revoked, so raising one grandfathers everyone who
 * already holds the tier.
 */

/**
 * Badges come in six groups, which are only how the cabinet is laid out —
 * nothing persists a badge's group, so moving one is free. `milestone` badges
 * count other badges, so the evaluator awards them in a second pass, after
 * everything else has landed.
 */
export type BadgeCategory = 'career' | 'auction' | 'match' | 'organizer' | 'streak' | 'milestone';

/** Icon names, mapped to components in `BadgeMedal` so this file stays React-free. */
export type BadgeIcon =
  // Career
  | 'sparkles' | 'shirt' | 'shield-check' | 'phone' | 'camera' | 'file-check' | 'receipt'
  | 'sprout' | 'route' | 'map' | 'heart-handshake' | 'sunrise' | 'door-open' | 'ticket' | 'eye'
  | 'calendar-days' | 'link' | 'messages-square' | 'briefcase' | 'scroll-text'
  // Auction
  | 'hand-coins' | 'chevrons-up' | 'sparkle' | 'trending-up' | 'gem' | 'coins' | 'tag' | 'crown'
  | 'heart' | 'radio' | 'target' | 'crosshair' | 'shuffle' | 'hand' | 'wind' | 'orbit'
  | 'arrow-left-right'
  // On the field
  | 'calendar-check' | 'trophy' | 'refresh-ccw' | 'plane-takeoff' | 'mountain' | 'bomb' | 'scale'
  | 'swords' | 'gauge' | 'ribbon' | 'medal' | 'shield' | 'sun' | 'thermometer-sun' | 'cloud-rain'
  | 'snowflake'
  // Organizer
  | 'flag' | 'history' | 'image' | 'palette' | 'globe' | 'clipboard-check' | 'list-ordered'
  | 'door-closed' | 'layers' | 'clipboard-list' | 'clipboard-pen' | 'handshake' | 'building-2'
  | 'users-round' | 'hand-helping' | 'users' | 'timer' | 'megaphone' | 'network' | 'user-check'
  | 'wallet' | 'piggy-bank' | 'wand-sparkles' | 'gavel' | 'cast' | 'hammer' | 'boxes'
  | 'badge-check' | 'shield-plus' | 'calendar-plus' | 'notebook-pen' | 'check-check' | 'book-open'
  | 'graduation-cap'
  // Streaks and milestones
  | 'flame' | 'infinity' | 'calendar-range' | 'log-in' | 'calendar-clock' | 'rocket'
  | 'circle-check-big' | 'zap' | 'award' | 'pickaxe' | 'cloud-sun' | 'star' | 'chart-pie';

export interface BadgeDefinition {
  id: string;
  name: string;
  category: BadgeCategory;
  icon: BadgeIcon;
  /** The number a tier is awarded on. */
  metric: RewardMetric;
  /**
   * The number progress towards the *next* tier is shown on, when that isn't
   * `metric`. Streak badges are awarded on the longest run but can only be
   * advanced by the current one — a broken run restarts the count.
   */
  progressMetric?: RewardMetric;
  /** Threshold per tier, ascending: three for bronze/silver/gold, one for a one-off badge. */
  thresholds: readonly number[];
  /** What a tier asks for, given its threshold. */
  goal: (n: number) => string;
  /** Noun for progress text — [singular, plural]. */
  unit: readonly [string, string];
  /** The metric is a 0–1 share, shown as a percentage. */
  percent?: boolean;
}

/** Cards made before this date earn Early Adopter — a badge that stops being earnable. */
export const EARLY_ADOPTER_CUTOFF = '2027-01-01';

/** "Get bought as a Batter" / "Get bought as a Batter 3 times". */
const boughtAs = (role: string) => (n: number) =>
  n === 1 ? `Get bought as ${role}` : `Get bought as ${role} ${n} times`;

/** "Play a match in March–May" / "Play 5 matches in March–May". */
const playedIn = (months: string) => (n: number) =>
  n === 1 ? `Play a match in ${months}` : `Play ${n} matches in ${months}`;

export const BADGES: readonly BadgeDefinition[] = [
  // ── Career ────────────────────────────────────────────────────────────────
  // Roughly the order a player meets them: sign up, join, settle in, finish.
  {
    id: 'debut', name: 'Debut', category: 'career', icon: 'sparkles',
    metric: 'cards', thresholds: [1],
    goal: () => 'Make your first player card', unit: ['card', 'cards'],
  },
  {
    id: 'kitted-out', name: 'Kitted Out', category: 'career', icon: 'shirt',
    metric: 'profileCompleted', thresholds: [1],
    goal: () => 'Complete your cricket profile', unit: ['profile', 'profiles'],
  },
  {
    id: 'verified', name: 'Verified', category: 'career', icon: 'shield-check',
    metric: 'idProofOnFile', thresholds: [1],
    goal: () => 'Add an identity proof to your profile', unit: ['document', 'documents'],
  },
  {
    id: 'on-call', name: 'On Call', category: 'career', icon: 'phone',
    metric: 'contactOnFile', thresholds: [1],
    goal: () => 'Add a contact number to your profile', unit: ['number', 'numbers'],
  },
  {
    id: 'picture-perfect', name: 'Picture Perfect', category: 'career', icon: 'camera',
    metric: 'uploadedPhotos', thresholds: [1],
    goal: () => 'Put your own photo on a player card', unit: ['photo', 'photos'],
  },
  {
    id: 'receipt-ready', name: 'Receipt Ready', category: 'career', icon: 'file-check',
    metric: 'receiptsAttached', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Register with an entry-fee receipt attached' : `Attach a receipt in ${n} leagues`),
    unit: ['receipt', 'receipts'],
  },
  {
    id: 'paid-up', name: 'Paid Up', category: 'career', icon: 'receipt',
    metric: 'feesConfirmed', thresholds: [1, 5, 10],
    goal: (n) => (n === 1 ? 'Have an entry fee confirmed by the organizer' : `Have ${n} entry fees confirmed`),
    unit: ['fee', 'fees'],
  },
  {
    id: 'early-adopter', name: 'Early Adopter', category: 'career', icon: 'sprout',
    metric: 'earlyCards', thresholds: [1],
    goal: () => 'Make a player card before 2027', unit: ['card', 'cards'],
  },
  {
    id: 'journeyman', name: 'Journeyman', category: 'career', icon: 'route',
    metric: 'leaguesJoined', thresholds: [2, 5, 10],
    goal: (n) => `Play in ${n} leagues`, unit: ['league', 'leagues'],
  },
  {
    id: 'globetrotter', name: 'Globetrotter', category: 'career', icon: 'map',
    metric: 'organizersPlayedFor', thresholds: [3, 6, 12],
    goal: (n) => `Play for ${n} different organizers`, unit: ['organizer', 'organizers'],
  },
  {
    id: 'club-regular', name: 'Club Regular', category: 'career', icon: 'heart-handshake',
    metric: 'clubLoyalty', thresholds: [2, 3, 5],
    goal: (n) => `Play in ${n} leagues run by the same organizer`, unit: ['league', 'leagues'],
  },
  {
    id: 'first-in', name: 'First In', category: 'career', icon: 'sunrise',
    metric: 'earlyBirds', thresholds: [1, 3, 10],
    goal: (n) => (n === 1
      ? "Be one of the first three to join someone's league"
      : `Be one of the first three in ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'last-man-in', name: 'Last Man In', category: 'career', icon: 'door-open',
    metric: 'lastManIn', thresholds: [1],
    goal: () => "Take the final spot in a league's player list", unit: ['league', 'leagues'],
  },
  {
    id: 'big-stage', name: 'Big Stage', category: 'career', icon: 'ticket',
    metric: 'biggestLeagueJoined', thresholds: [30, 60, 100],
    goal: (n) => `Play in a league of ${n} players`, unit: ['player', 'players'],
  },
  {
    id: 'on-show', name: 'On Show', category: 'career', icon: 'eye',
    metric: 'publicLeaguesJoined', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Play in a public league' : `Play in ${n} public leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'season-ticket', name: 'Season Ticket', category: 'career', icon: 'calendar-days',
    metric: 'monthsPlayed', thresholds: [3, 6, 12],
    goal: (n) => `Play in leagues from ${n} different months`, unit: ['month', 'months'],
  },
  {
    id: 'old-partners', name: 'Old Partners', category: 'career', icon: 'link',
    metric: 'partnerLeagues', thresholds: [2, 3, 5],
    goal: (n) => `Share a team with the same player in ${n} leagues`, unit: ['league', 'leagues'],
  },
  {
    id: 'dressing-room', name: 'Dressing Room', category: 'career', icon: 'messages-square',
    metric: 'teammates', thresholds: [10, 30, 75],
    goal: (n) => `Share a dressing room with ${n} players`, unit: ['teammate', 'teammates'],
  },
  {
    id: 'player-manager', name: 'Player-Manager', category: 'career', icon: 'briefcase',
    metric: 'playerManager', thresholds: [1],
    goal: () => 'Play in a league you help run', unit: ['league', 'leagues'],
  },
  {
    id: 'certified', name: 'Certified', category: 'career', icon: 'scroll-text',
    metric: 'certificates', thresholds: [1, 3, 6],
    goal: (n) => (n === 1 ? 'Earn a participation certificate' : `Earn ${n} participation certificates`),
    unit: ['certificate', 'certificates'],
  },

  // ── Auction ───────────────────────────────────────────────────────────────
  {
    id: 'under-the-hammer', name: 'Under the Hammer', category: 'auction', icon: 'hand-coins',
    metric: 'timesBought', thresholds: [1, 3, 8],
    goal: (n) => (n === 1 ? 'Get bought at an auction' : `Get bought at ${n} auctions`),
    unit: ['buy', 'buys'],
  },
  {
    id: 'premium-pick', name: 'Premium Pick', category: 'auction', icon: 'chevrons-up',
    metric: 'premiumBuys', thresholds: [1, 3, 8],
    goal: (n) => (n === 1 ? "Go for more than your auction's average buy" : `Beat the average buy ${n} times`),
    unit: ['buy', 'buys'],
  },
  {
    id: 'franchise-player', name: 'Franchise Player', category: 'auction', icon: 'sparkle',
    metric: 'franchiseBuys', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? "Be your team's most expensive buy" : `Be your team's top buy ${n} times`),
    unit: ['buy', 'buys'],
  },
  {
    id: 'record-buy', name: 'Record Buy', category: 'auction', icon: 'trending-up',
    metric: 'recordBuys', thresholds: [1, 2, 4],
    goal: (n) => (n === 1 ? "Be your auction's most expensive buy" : `Be the top buy at ${n} auctions`),
    unit: ['auction', 'auctions'],
  },
  {
    id: 'big-ticket', name: 'Big Ticket', category: 'auction', icon: 'gem',
    metric: 'bestPurseShare', thresholds: [0.1, 0.2, 0.35], percent: true,
    goal: (n) => `Go for ${pct(n)} of a team's purse in one buy`, unit: ['', ''],
  },
  {
    id: 'all-in', name: 'All In', category: 'auction', icon: 'coins',
    metric: 'bestPurseShare', thresholds: [0.5], percent: true,
    goal: () => "Take half a team's purse in one buy", unit: ['', ''],
  },
  {
    id: 'steal', name: 'Steal of the Auction', category: 'auction', icon: 'tag',
    metric: 'steals', thresholds: [1, 3, 5],
    goal: (n) => (n === 1
      ? "Get bought for 5% of a team's purse or less"
      : `Be a steal ${n} times — 5% of a purse or less`),
    unit: ['steal', 'steals'],
  },
  {
    id: 'marquee', name: 'Marquee', category: 'auction', icon: 'crown',
    metric: 'iconPicks', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Be named an icon player' : `Be named an icon player ${n} times`),
    unit: ['icon pick', 'icon picks'],
  },
  {
    id: 'back-yourself', name: 'Back Yourself', category: 'auction', icon: 'heart',
    metric: 'unsoldCount', thresholds: [1],
    goal: () => 'Go unsold at an auction — and stay in the game', unit: ['auction', 'auctions'],
  },
  {
    id: 'live-on-air', name: 'Live on Air', category: 'auction', icon: 'radio',
    metric: 'broadcastBuys', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Get bought at an auction streamed live' : `Get bought at ${n} live-streamed auctions`),
    unit: ['buy', 'buys'],
  },
  {
    id: 'top-order', name: 'Top Order', category: 'auction', icon: 'target',
    metric: 'batterBuys', thresholds: [1, 3, 5], goal: boughtAs('a Batter'), unit: ['buy', 'buys'],
  },
  {
    id: 'strike-bowler', name: 'Strike Bowler', category: 'auction', icon: 'crosshair',
    metric: 'bowlerBuys', thresholds: [1, 3, 5], goal: boughtAs('a Bowler'), unit: ['buy', 'buys'],
  },
  {
    id: 'utility-player', name: 'Utility Player', category: 'auction', icon: 'shuffle',
    metric: 'allRounderBuys', thresholds: [1, 3, 5], goal: boughtAs('an All-Rounder'), unit: ['buy', 'buys'],
  },
  {
    id: 'safe-hands', name: 'Safe Hands', category: 'auction', icon: 'hand',
    metric: 'keeperBuys', thresholds: [1, 3, 5], goal: boughtAs('a wicketkeeper'), unit: ['buy', 'buys'],
  },
  {
    id: 'pace-merchant', name: 'Pace Merchant', category: 'auction', icon: 'wind',
    metric: 'paceBuys', thresholds: [1, 3, 5], goal: boughtAs('a pace bowler'), unit: ['buy', 'buys'],
  },
  {
    id: 'spin-wizard', name: 'Spin Wizard', category: 'auction', icon: 'orbit',
    metric: 'spinBuys', thresholds: [1, 3, 5], goal: boughtAs('a spinner'), unit: ['buy', 'buys'],
  },
  {
    id: 'southpaw', name: 'Southpaw', category: 'auction', icon: 'arrow-left-right',
    metric: 'leftHandBuys', thresholds: [1, 3, 5], goal: boughtAs('a left-hand bat'), unit: ['buy', 'buys'],
  },

  // ── On the field ──────────────────────────────────────────────────────────
  {
    id: 'match-day', name: 'Match Day', category: 'match', icon: 'calendar-check',
    metric: 'matchesPlayed', thresholds: [5, 25, 60],
    goal: (n) => `Play ${n} matches`, unit: ['match', 'matches'],
  },
  {
    id: 'match-winner', name: 'Match Winner', category: 'match', icon: 'trophy',
    metric: 'matchWins', thresholds: [1, 10, 25],
    goal: (n) => (n === 1 ? 'Win a match with your team' : `Win ${n} matches with your team`),
    unit: ['win', 'wins'],
  },
  {
    id: 'bounce-back', name: 'Bounce Back', category: 'match', icon: 'refresh-ccw',
    metric: 'bounceBacks', thresholds: [1, 5, 10],
    goal: (n) => (n === 1 ? 'Win straight after a loss' : `Bounce back from a loss ${n} times`),
    unit: ['comeback', 'comebacks'],
  },
  {
    id: 'flying-start', name: 'Flying Start', category: 'match', icon: 'plane-takeoff',
    metric: 'flyingStarts', thresholds: [1],
    goal: () => "Win your team's first three matches of a league", unit: ['league', 'leagues'],
  },
  {
    id: 'big-hitters', name: 'Big Hitters', category: 'match', icon: 'mountain',
    metric: 'bestTeamScore', thresholds: [150, 200, 250],
    goal: (n) => `Be in a team that posts ${n}`, unit: ['run', 'runs'],
  },
  {
    id: 'demolition', name: 'Demolition', category: 'match', icon: 'bomb',
    metric: 'bigWins', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Win a match by 50 runs or more' : `Win by 50+ runs ${n} times`),
    unit: ['win', 'wins'],
  },
  {
    id: 'honours-even', name: 'Honours Even', category: 'match', icon: 'scale',
    metric: 'ties', thresholds: [1],
    goal: () => 'Play out a tied match', unit: ['tie', 'ties'],
  },
  {
    id: 'old-rivals', name: 'Old Rivals', category: 'match', icon: 'swords',
    metric: 'rivalMeetings', thresholds: [3, 5, 8],
    goal: (n) => `Face the same team ${n} times`, unit: ['meeting', 'meetings'],
  },
  {
    id: 'points-machine', name: 'Points Machine', category: 'match', icon: 'gauge',
    metric: 'teamPoints', thresholds: [10, 40, 100],
    goal: (n) => `Earn ${n} points-table points with your teams`, unit: ['point', 'points'],
  },
  {
    id: 'so-close', name: 'So Close', category: 'match', icon: 'ribbon',
    metric: 'runnerUps', thresholds: [1, 2, 4],
    goal: (n) => (n === 1 ? "Be second on a league's points table" : `Be second in ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'table-topper', name: 'Table Topper', category: 'match', icon: 'medal',
    metric: 'tableTops', thresholds: [1, 2, 4],
    goal: (n) => (n === 1 ? "Top a league's points table" : `Top the table in ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'invincibles', name: 'Invincibles', category: 'match', icon: 'shield',
    metric: 'invincibles', thresholds: [1],
    goal: () => 'Win every match your team plays in a league (three or more)',
    unit: ['league', 'leagues'],
  },
  {
    id: 'weekend-warrior', name: 'Weekend Warrior', category: 'match', icon: 'sun',
    metric: 'weekendMatches', thresholds: [5, 20, 50],
    goal: (n) => `Play ${n} weekend matches`, unit: ['match', 'matches'],
  },
  {
    id: 'summer-heat', name: 'Summer Heat', category: 'match', icon: 'thermometer-sun',
    metric: 'summerMatches', thresholds: [1, 5, 15], goal: playedIn('March–May'), unit: ['match', 'matches'],
  },
  {
    id: 'monsoon-cricket', name: 'Monsoon Cricket', category: 'match', icon: 'cloud-rain',
    metric: 'monsoonMatches', thresholds: [1, 5, 15], goal: playedIn('June–September'), unit: ['match', 'matches'],
  },
  {
    id: 'winter-nets', name: 'Winter Nets', category: 'match', icon: 'snowflake',
    metric: 'winterMatches', thresholds: [1, 5, 15], goal: playedIn('November–February'), unit: ['match', 'matches'],
  },

  // ── Organizer ─────────────────────────────────────────────────────────────
  // Set up, fill, auction, run the season, wrap it up.
  {
    id: 'founder', name: 'Founder', category: 'organizer', icon: 'flag',
    metric: 'leaguesCreated', thresholds: [1, 3, 10],
    goal: (n) => (n === 1 ? 'Create a league' : `Create ${n} leagues`), unit: ['league', 'leagues'],
  },
  {
    id: 'old-hand', name: 'Old Hand', category: 'organizer', icon: 'history',
    metric: 'leagueAgeDays', thresholds: [365],
    goal: () => 'Run leagues on Pickbid for a year', unit: ['day', 'days'],
  },
  {
    id: 'crest', name: 'Crest', category: 'organizer', icon: 'image',
    metric: 'leaguesWithLogo', thresholds: [1],
    goal: () => 'Give a league its own logo', unit: ['league', 'leagues'],
  },
  {
    id: 'designer', name: 'Designer', category: 'organizer', icon: 'palette',
    metric: 'templatesUsed', thresholds: [2, 4, 8],
    goal: (n) => `Use ${n} different card designs`, unit: ['design', 'designs'],
  },
  {
    id: 'going-public', name: 'Going Public', category: 'organizer', icon: 'globe',
    metric: 'publicLeagues', thresholds: [1],
    goal: () => 'List a league in Discover', unit: ['league', 'leagues'],
  },
  {
    id: 'by-the-book', name: 'By the Book', category: 'organizer', icon: 'clipboard-check',
    metric: 'proofLeagues', thresholds: [1],
    goal: () => 'Require an ID or entry-fee proof to register', unit: ['league', 'leagues'],
  },
  {
    id: 'game-plan', name: 'Game Plan', category: 'organizer', icon: 'list-ordered',
    metric: 'pickPlans', thresholds: [1],
    goal: () => 'Set a pick order for an auction draw', unit: ['league', 'leagues'],
  },
  {
    id: 'doors-closed', name: 'Doors Closed', category: 'organizer', icon: 'door-closed',
    metric: 'closedRegistrations', thresholds: [1],
    goal: () => 'Close registration for a league', unit: ['league', 'leagues'],
  },
  {
    id: 'architect', name: 'Architect', category: 'organizer', icon: 'layers',
    metric: 'teamsBuilt', thresholds: [4, 12, 30],
    goal: (n) => `Set up ${n} teams`, unit: ['team', 'teams'],
  },
  {
    id: 'backroom', name: 'Backroom Staff', category: 'organizer', icon: 'clipboard-list',
    metric: 'officialsAdded', thresholds: [1, 10, 25],
    goal: (n) => (n === 1 ? 'Add a team official' : `Add ${n} team officials`),
    unit: ['official', 'officials'],
  },
  {
    id: 'coaching-staff', name: 'Coaching Staff', category: 'organizer', icon: 'clipboard-pen',
    metric: 'staffedLeagues', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Give every team in a league an official' : `Staff every team in ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'deal-maker', name: 'Deal Maker', category: 'organizer', icon: 'handshake',
    metric: 'sponsorsAdded', thresholds: [1, 5, 15],
    goal: (n) => (n === 1 ? 'Bring in a sponsor' : `Bring in ${n} sponsors`),
    unit: ['sponsor', 'sponsors'],
  },
  {
    id: 'sponsor-wall', name: 'Sponsor Wall', category: 'organizer', icon: 'building-2',
    metric: 'maxSponsorsInLeague', thresholds: [3, 6, 10],
    goal: (n) => `Bring ${n} sponsors into one league`, unit: ['sponsor', 'sponsors'],
  },
  {
    id: 'committee', name: 'Committee', category: 'organizer', icon: 'users-round',
    metric: 'coOrganizersAdded', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Add a co-organizer to your league' : `Add ${n} co-organizers`),
    unit: ['co-organizer', 'co-organizers'],
  },
  {
    id: 'right-hand', name: 'Right Hand', category: 'organizer', icon: 'hand-helping',
    metric: 'coOrganizing', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? "Co-organize someone else's league" : `Co-organize ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'full-house', name: 'Full House', category: 'organizer', icon: 'users',
    metric: 'fullHouses', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Fill a league to its player target' : `Fill ${n} leagues to their player target`),
    unit: ['full league', 'full leagues'],
  },
  {
    id: 'rapid-fill', name: 'Rapid Fill', category: 'organizer', icon: 'timer',
    metric: 'rapidFills', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Fill a league within a week of creating it' : `Fill ${n} leagues within a week`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'crowd-puller', name: 'Crowd Puller', category: 'organizer', icon: 'megaphone',
    metric: 'biggestLeague', thresholds: [20, 50, 100],
    goal: (n) => `Get ${n} players into one league`, unit: ['player', 'players'],
  },
  {
    id: 'community-builder', name: 'Community Builder', category: 'organizer', icon: 'network',
    metric: 'distinctPlayers', thresholds: [25, 100, 300],
    goal: (n) => `Bring ${n} players into your leagues`, unit: ['player', 'players'],
  },
  {
    id: 'loyal-following', name: 'Loyal Following', category: 'organizer', icon: 'user-check',
    metric: 'returningPlayers', thresholds: [5, 15, 40],
    goal: (n) => `Have ${n} players come back for another of your leagues`, unit: ['player', 'players'],
  },
  {
    id: 'treasurer', name: 'Treasurer', category: 'organizer', icon: 'wallet',
    metric: 'feesConfirmedForLeagues', thresholds: [10, 50, 150],
    goal: (n) => `Confirm ${n} entry fees`, unit: ['fee', 'fees'],
  },
  {
    id: 'all-paid-up', name: 'All Paid Up', category: 'organizer', icon: 'piggy-bank',
    metric: 'allPaidLeagues', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Collect every entry fee in a league of 8 or more' : `Collect every fee in ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'kingmaker', name: 'Kingmaker', category: 'organizer', icon: 'wand-sparkles',
    metric: 'iconsNamed', thresholds: [1, 5, 15],
    goal: (n) => (n === 1 ? 'Name an icon player' : `Name ${n} icon players`),
    unit: ['icon player', 'icon players'],
  },
  {
    id: 'auctioneer', name: 'Auctioneer', category: 'organizer', icon: 'gavel',
    metric: 'auctionsRun', thresholds: [1, 3, 10],
    goal: (n) => (n === 1 ? 'Run an auction' : `Run ${n} auctions`), unit: ['auction', 'auctions'],
  },
  {
    id: 'on-air', name: 'On Air', category: 'organizer', icon: 'cast',
    metric: 'broadcasts', thresholds: [1, 3, 10],
    goal: (n) => (n === 1 ? 'Stream an auction live' : `Stream ${n} auctions live`),
    unit: ['auction', 'auctions'],
  },
  {
    id: 'hammer-time', name: 'Hammer Time', category: 'organizer', icon: 'hammer',
    metric: 'playersSold', thresholds: [25, 100, 250],
    goal: (n) => `Sell ${n} players at your auctions`, unit: ['player', 'players'],
  },
  {
    id: 'mega-auction', name: 'Mega Auction', category: 'organizer', icon: 'boxes',
    metric: 'biggestAuction', thresholds: [30, 60, 100],
    goal: (n) => `Sell ${n} players in one auction`, unit: ['player', 'players'],
  },
  {
    id: 'sold-out', name: 'Sold Out', category: 'organizer', icon: 'badge-check',
    metric: 'soldOuts', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Sell every player in an auction of 8 or more' : `Sell out ${n} auctions`),
    unit: ['auction', 'auctions'],
  },
  {
    id: 'full-strength', name: 'Full Strength', category: 'organizer', icon: 'shield-plus',
    metric: 'fullStrengths', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? "Fill every team's squad in a league" : `Fill every squad in ${n} leagues`),
    unit: ['league', 'leagues'],
  },
  {
    id: 'fixture-maker', name: 'Fixture Maker', category: 'organizer', icon: 'calendar-plus',
    metric: 'fixturesScheduled', thresholds: [5, 20, 50],
    goal: (n) => `Schedule ${n} fixtures`, unit: ['fixture', 'fixtures'],
  },
  {
    id: 'scorekeeper', name: 'Scorekeeper', category: 'organizer', icon: 'notebook-pen',
    metric: 'resultsRecorded', thresholds: [5, 25, 100],
    goal: (n) => `Record ${n} match results`, unit: ['result', 'results'],
  },
  {
    id: 'season-complete', name: 'Season Complete', category: 'organizer', icon: 'check-check',
    metric: 'seasonsCompleted', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Record every result of a season of 5+ fixtures' : `Complete ${n} seasons`),
    unit: ['season', 'seasons'],
  },
  {
    id: 'open-books', name: 'Open Books', category: 'organizer', icon: 'book-open',
    metric: 'ledgersPublished', thresholds: [1],
    goal: () => 'Publish a league ledger', unit: ['ledger', 'ledgers'],
  },
  {
    id: 'graduation-day', name: 'Graduation Day', category: 'organizer', icon: 'graduation-cap',
    metric: 'certificatesReleased', thresholds: [1, 3, 5],
    goal: (n) => (n === 1 ? 'Release certificates for a league' : `Release certificates for ${n} leagues`),
    unit: ['league', 'leagues'],
  },

  // ── Streaks ───────────────────────────────────────────────────────────────
  {
    id: 'on-a-roll', name: 'On a Roll', category: 'streak', icon: 'flame',
    metric: 'weeklyStreakLongest', progressMetric: 'weeklyStreakCurrent', thresholds: [4, 12, 26],
    goal: (n) => `Keep a ${n}-week streak`, unit: ['week', 'weeks'],
  },
  {
    id: 'unbreakable', name: 'Unbreakable', category: 'streak', icon: 'infinity',
    metric: 'weeklyStreakLongest', progressMetric: 'weeklyStreakCurrent', thresholds: [52],
    goal: () => 'Keep a streak going for a whole year', unit: ['week', 'weeks'],
  },
  {
    id: 'ever-present', name: 'Ever Present', category: 'streak', icon: 'calendar-range',
    metric: 'activeWeeks', thresholds: [10, 26, 40],
    goal: (n) => `Be active ${n} weeks out of 52`, unit: ['week', 'weeks'],
  },
  {
    id: 'welcome-back', name: 'Welcome Back', category: 'streak', icon: 'log-in',
    metric: 'welcomeBacks', thresholds: [1],
    goal: () => 'Come back after eight weeks away', unit: ['return', 'returns'],
  },
  {
    id: 'month-after-month', name: 'Month After Month', category: 'streak', icon: 'calendar-clock',
    metric: 'monthRunLongest', progressMetric: 'monthRunCurrent', thresholds: [3, 6, 12],
    goal: (n) => `Play in leagues ${n} months running`, unit: ['month', 'months'],
  },
  {
    id: 'hot-property', name: 'Hot Property', category: 'streak', icon: 'rocket',
    metric: 'pickStreakLongest', progressMetric: 'pickStreakCurrent', thresholds: [2, 3, 5],
    goal: (n) => `Get picked in ${n} auctions in a row`, unit: ['auction', 'auctions'],
  },
  {
    id: 'never-unsold', name: 'Never Unsold', category: 'streak', icon: 'circle-check-big',
    metric: 'cleanPickRecord', thresholds: [3],
    goal: () => 'Get picked at every auction you enter — three or more', unit: ['auction', 'auctions'],
  },
  {
    id: 'purple-patch', name: 'Purple Patch', category: 'streak', icon: 'zap',
    metric: 'winRunLongest', progressMetric: 'winRunCurrent', thresholds: [3, 5, 8],
    goal: (n) => `Win ${n} matches in a row`, unit: ['win', 'wins'],
  },

  // ── Milestones ────────────────────────────────────────────────────────────
  {
    id: 'collector', name: 'Collector', category: 'milestone', icon: 'award',
    metric: 'badgeLevels', thresholds: [10, 40, 100],
    goal: (n) => `Earn ${n} badge levels`, unit: ['level', 'levels'],
  },
  {
    id: 'bronze-age', name: 'Bronze Age', category: 'milestone', icon: 'pickaxe',
    metric: 'bronzeMedals', thresholds: [5, 20, 40],
    goal: (n) => `Earn ${n} bronze badges`, unit: ['bronze badge', 'bronze badges'],
  },
  {
    id: 'silver-lining', name: 'Silver Lining', category: 'milestone', icon: 'cloud-sun',
    metric: 'silverMedals', thresholds: [1, 10, 20],
    goal: (n) => (n === 1 ? 'Earn a silver badge' : `Earn ${n} silver badges`),
    unit: ['silver badge', 'silver badges'],
  },
  {
    id: 'gold-standard', name: 'Gold Standard', category: 'milestone', icon: 'star',
    metric: 'goldMedals', thresholds: [1, 5, 15],
    goal: (n) => (n === 1 ? 'Earn a gold badge' : `Earn ${n} gold badges`),
    unit: ['gold badge', 'gold badges'],
  },
  {
    id: 'well-rounded', name: 'Well Rounded', category: 'milestone', icon: 'chart-pie',
    metric: 'categoriesCovered', thresholds: [5],
    goal: () => 'Earn a badge in all five groups', unit: ['group', 'groups'],
  },
];

export const BADGE_BY_ID: ReadonlyMap<string, BadgeDefinition> = new Map(BADGES.map((b) => [b.id, b]));

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  career: 'Career',
  auction: 'Auction',
  match: 'On the field',
  organizer: 'Organizer',
  streak: 'Streaks',
  milestone: 'Milestones',
};

/** How many weeks the streak calendar shows. `user_streaks.history` keeps 52. */
export const STREAK_CALENDAR_WEEKS = 26;

const TIER_NAMES = ['Bronze', 'Silver', 'Gold'] as const;

export type MedalTone = 'bronze' | 'silver' | 'gold' | 'emerald' | 'locked';

export function badgeKey(badgeId: string, tier: number): string {
  return `${badgeId}:${tier}`;
}

export function isTiered(def: BadgeDefinition): boolean {
  return def.thresholds.length > 1;
}

/** "Silver" — or "" for a one-off badge, which has no tiers to name. */
export function tierName(def: BadgeDefinition, tier: number): string {
  return isTiered(def) && tier >= 1 ? TIER_NAMES[tier - 1] ?? '' : '';
}

/** One-off badges wear the brand green; tiered ones their metal; unearned ones nothing. */
export function medalTone(def: BadgeDefinition, tier: number): MedalTone {
  if (tier <= 0) return 'locked';
  if (!isTiered(def)) return 'emerald';
  return (['bronze', 'silver', 'gold'] as const)[Math.min(tier, 3) - 1];
}

/** Every tier `value` reaches — what the evaluator offers to `user_badges`. */
export function qualifyingTiers(def: BadgeDefinition, value: number): BadgeTier[] {
  return def.thresholds.flatMap((t, i) => (value >= t ? [(i + 1) as BadgeTier] : []));
}

/** The highest earned tier of each badge. */
export function highestTiers(earned: readonly EarnedBadge[]): Map<string, BadgeTier> {
  const out = new Map<string, BadgeTier>();
  for (const e of earned) {
    if ((out.get(e.badgeId) ?? 0) < e.tier) out.set(e.badgeId, e.tier);
  }
  return out;
}

/**
 * What the milestone badges count, over the rest of the catalog: levels by
 * metal, and how many groups have a badge in them. Milestones are left out of
 * their own count, so earning one never tips over the next.
 */
export function milestoneMetrics(earned: readonly EarnedBadge[]): Pick<
  RewardMetrics, 'badgeLevels' | 'goldMedals' | 'silverMedals' | 'bronzeMedals' | 'categoriesCovered'
> {
  let badgeLevels = 0;
  const metals: Partial<Record<MedalTone, number>> = {};
  const groups = new Set<BadgeCategory>();
  for (const e of earned) {
    const def = BADGE_BY_ID.get(e.badgeId);
    if (!def || def.category === 'milestone') continue;
    badgeLevels++;
    groups.add(def.category);
    const tone = medalTone(def, e.tier);
    metals[tone] = (metals[tone] ?? 0) + 1;
  }
  return {
    badgeLevels,
    goldMedals: metals.gold ?? 0,
    silverMedals: metals.silver ?? 0,
    bronzeMedals: metals.bronze ?? 0,
    categoriesCovered: groups.size,
  };
}

/** Wins straight after a loss, across result sequences like "1011". */
export function countBounceBacks(sequences: readonly string[]): number {
  let n = 0;
  for (const s of sequences) {
    for (let i = 1; i < s.length; i++) if (s[i - 1] === '0' && s[i] === '1') n++;
  }
  return n;
}

/** Sequences that open with three straight wins. */
export function countFlyingStarts(sequences: readonly string[]): number {
  return sequences.filter((s) => s.startsWith('111')).length;
}

/**
 * Returns after `gap` or more empty weeks, read oldest-first across the 52-week
 * bitmask. Only a week *after* some earlier activity counts — the very first
 * visit is a debut, not a comeback.
 */
export function countReturns(history: number, gap = 8, weeks = 52): number {
  let returns = 0;
  let seen = false;
  let quiet = 0;
  for (let i = weeks - 1; i >= 0; i--) {
    if (Math.floor(history / 2 ** i) % 2 === 1) {
      if (seen && quiet >= gap) returns++;
      seen = true;
      quiet = 0;
    } else if (seen) {
      quiet++;
    }
  }
  return returns;
}

/** Longest and latest runs of consecutive calendar months in a 'YYYY-MM' list. */
export function monthRuns(months: readonly string[]): { current: number; longest: number } {
  const index = [...new Set(months.map((m) => {
    const [y, mo] = m.split('-').map(Number);
    return y * 12 + (mo - 1);
  }))].filter(Number.isFinite).sort((a, b) => a - b);
  let run = 0;
  let longest = 0;
  for (let i = 0; i < index.length; i++) {
    run = i > 0 && index[i] === index[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return { current: run, longest };
}

/** Set bits in a streak bitmask. Division, not `>>`: the mask is wider than 32 bits. */
export function countWeeks(history: number): number {
  let n = 0;
  for (let h = history; h > 0; h = Math.floor(h / 2)) n += h % 2;
  return n;
}

/** Badges with at least one earned tier that are still in the catalog. */
export function countEarnedBadges(earned: readonly EarnedBadge[]): number {
  return [...highestTiers(earned).keys()].filter((id) => BADGE_BY_ID.has(id)).length;
}

function pct(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
}

export function formatMetric(def: BadgeDefinition, value: number): string {
  return def.percent ? pct(value) : Math.floor(value).toLocaleString('en-IN');
}

/** "3 / 5 leagues", or "18% / 20%" for a share. */
export function progressLabel(def: BadgeDefinition, value: number, target: number): string {
  if (def.percent) return `${pct(value)} / ${pct(target)}`;
  const noun = target === 1 ? def.unit[0] : def.unit[1];
  return `${Math.min(Math.floor(value), target)} / ${target} ${noun}`.trim();
}

/** "2 more leagues" — or, for a share, how far short the best buy fell. */
export function remainingLabel(def: BadgeDefinition, value: number, target: number): string {
  if (def.percent) return value > 0 ? `${pct(Math.max(0, target - value))} short` : 'No buys yet';
  const left = Math.max(0, Math.ceil(target - value));
  return `${left} more ${left === 1 ? def.unit[0] : def.unit[1]}`;
}

/** Where one badge stands for one user. */
export interface BadgeStanding {
  def: BadgeDefinition;
  /** Highest earned tier, 0 while locked. */
  tier: number;
  /** The tier being worked towards, or null once every tier is earned. */
  nextTier: BadgeTier | null;
  target: number | null;
  /** The number progress is measured on (see `progressMetric`). */
  value: number;
  /** 0–1 towards `nextTier`; 1 once maxed. */
  progress: number;
}

export function badgeStanding(def: BadgeDefinition, metrics: RewardMetrics, tier = 0): BadgeStanding {
  const value = metrics[def.progressMetric ?? def.metric] ?? 0;
  if (tier >= def.thresholds.length) {
    return { def, tier, nextTier: null, target: null, value, progress: 1 };
  }
  const target = def.thresholds[tier];
  return {
    def,
    tier,
    nextTier: (tier + 1) as BadgeTier,
    target,
    value,
    progress: target > 0 ? Math.min(1, Math.max(0, value / target)) : 0,
  };
}

/**
 * The locked tier nearest completion — the "next up" nudge. Ties go to catalog
 * order, which is why `debut` leads the list: a brand-new account with nothing
 * in progress is pointed at making its first card.
 */
export function nextGoal(metrics: RewardMetrics, earned: readonly EarnedBadge[]): RewardGoal | null {
  const tiers = highestTiers(earned);
  let best: BadgeStanding | null = null;
  for (const def of BADGES) {
    const s = badgeStanding(def, metrics, tiers.get(def.id) ?? 0);
    // progress 1 on a locked tier means the award is pending the next check-in
    if (s.nextTier === null || s.target === null || s.progress >= 1) continue;
    if (!best || s.progress > best.progress) best = s;
  }
  if (!best || best.nextTier === null || best.target === null) return null;
  return { badgeId: best.def.id, tier: best.nextTier, value: best.value, target: best.target };
}

/** Current and longest runs of '1' in a sequence like "1101" (oldest first). */
export function runLengths(sequence: string): { current: number; longest: number } {
  let run = 0;
  let longest = 0;
  for (const c of sequence) {
    run = c === '1' ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return { current: run, longest };
}

/**
 * Unpack the streak bitmask into calendar flags, oldest first. Bit 0 is the
 * most recent counted week. Division rather than `>>`: JS bitwise operators
 * truncate to 32 bits and the mask holds 52.
 */
export function weekFlags(history: number, count = STREAK_CALENDAR_WEEKS): boolean[] {
  return Array.from({ length: count }, (_, i) => Math.floor(history / 2 ** (count - 1 - i)) % 2 === 1);
}
