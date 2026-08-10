import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

// Angle: the season-long operational work *after* squads exist — rosters,
// fixtures, results, points table, accounts. Tournament formats and scheduling
// belong to /cricket-tournament-management; auctions to /cricket-auction.
const CONTENT: SeoPageContent = {
  path: '/cricket-league-management',
  title: 'Cricket League Management Platform',
  metaDescription:
    'Manage a cricket league end to end — teams, squads, player registration, ' +
    'fixtures, results, points table and league accounts. ' +
    `${SITE_NAME} keeps a whole season in one shareable place, free.`,
  breadcrumb: 'Cricket League Management',
  kicker: 'Running a season',
  h1: 'Cricket League Management Platform',
  intro: [
    'Running a cricket league is mostly admin. Someone has to collect player details, ' +
      'split them into teams, agree the fixtures, chase the scores after every match, ' +
      'recalculate the table, and answer the same three questions in the group chat ' +
      'for four months.',
    `${SITE_NAME} is a free cricket league management platform that keeps all of that ` +
      'in one place, on one link. Players register themselves, squads stay current, ' +
      'and the points table updates itself as you record results.',
  ],
  sections: [
    {
      heading: 'Player registration without the spreadsheet',
      body: [
        'The first job of a season is collecting who is playing, and it is the job most ' +
          'likely to go wrong — details arrive over WhatsApp, in three formats, missing ' +
          'photos.',
        'Instead, share a registration link. Each player fills in their own name, role, ' +
          'batting and bowling style, stats and photo, and it lands in your league ' +
          'ready to use. They do not need an account to do it. When you have enough ' +
          'players, close registration and the list is frozen.',
      ],
    },
    {
      heading: 'Teams and squads that stay accurate',
      body: [
        'Every team gets a name, a colour, a budget and a squad size. Once players are ' +
          'assigned — by auction or by hand — the squad list is derived from that ' +
          'assignment, so there is exactly one version of who is in which team.',
      ],
      points: [
        {
          term: 'Team officials',
          description:
            'Coaches, managers and owners can be recorded against a team without ' +
            'taking up a playing slot or affecting the budget. They appear on the ' +
            'squad poster where they belong.',
        },
        {
          term: 'PDF squad sheets',
          description:
            'Export a formatted team-wise roster, or a poster per squad, and send it ' +
            'to the group in one tap instead of retyping the list.',
        },
        {
          term: 'Co-organizers',
          description:
            'Invite other people to help run the league. Co-organizers can manage ' +
            'players, teams, fixtures and the auction — everything except deleting ' +
            'the league itself.',
        },
      ],
    },
    {
      heading: 'Fixtures, results and the points table',
      body: [
        'Record each match with the two teams, the scores and the winner. The standings ' +
          'are computed from those results — played, won, lost, tied and points — so ' +
          'there is no separate table to maintain and no chance of the two disagreeing.',
        'Because the league page is one URL, the table people ask about is always the ' +
          'current one. If the league is public, they can check it themselves without ' +
          'asking you at all.',
      ],
    },
    {
      heading: 'League accounts, kept private by default',
      body: [
        'Money is the other thing organizers get asked about: registration fees ' +
          'collected, sponsorship received, ground rent, trophies, umpire fees.',
        'A league can keep an optional income and expense sheet written in plain ' +
          'markdown. It stays a private draft until an organizer publishes it, and even ' +
          'once published it is visible only to that league’s members — never on the ' +
          'public page, and never to search engines.',
      ],
    },
    {
      heading: 'Sharing the league',
      body: [
        'A league can be private — reachable only by people with the link — or public, ' +
          'which lists it in the public directory and lets anyone view the squads, ' +
          'auction results, fixtures and points table.',
        'Contact numbers are never shown to anyone outside the organizing team, on ' +
          'either setting. They exist for your records and stay there.',
      ],
    },
  ],
  faqs: [
    {
      question: `Can I organize a cricket league using ${SITE_NAME}?`,
      answer:
        `Yes — that is what it is for. You create the league, collect player ` +
        'registrations, set up teams with budgets and squad sizes, assign players ' +
        '(by running an auction or manually), then record fixtures and results ' +
        'through the season while the points table keeps itself up to date.',
    },
    {
      question: `Can ${SITE_NAME} manage cricket league fixtures?`,
      answer:
        'Yes. You can record each match with both teams, their scores, the date and ' +
        'the winner. Standings — played, won, lost, tied and points — are calculated ' +
        'from those results automatically, so you never maintain a separate table.',
    },
    {
      question: 'How do players join my league?',
      answer:
        'Share your league link. Players can fill in their own card — name, role, ' +
        'batting and bowling style, stats and photo — without creating an account. If ' +
        'your league is public you can also hand out a short join code. When you have ' +
        'enough players, close registration to stop further joins.',
    },
    {
      question: 'Can more than one person manage a league?',
      answer:
        'Yes. The creator can invite co-organizers, who get the same access to run the ' +
        'auction and manage players, teams, fixtures and settings. Only the creator can ' +
        'delete the league or change who the co-organizers are.',
    },
    {
      question: 'Can I reuse last season’s setup?',
      answer:
        'Yes. Cloning a league copies its teams and settings into a new league, so a ' +
        'returning tournament does not have to be rebuilt from scratch each year.',
    },
    {
      question: 'Is player contact information visible to the public?',
      answer:
        'No. Contact numbers are only ever visible to the league’s organizers. They are ' +
        'never shown on player cards, squad posters, the public league page or in ' +
        'search results.',
    },
  ],
  cta: {
    heading: 'Set your league up once',
    body:
      'Create the league, share the registration link, and let the squads, table and ' +
      'squad sheets look after themselves for the rest of the season.',
    href: '/leagues/new',
    label: 'Create a cricket league',
  },
  related: [
    {
      href: '/cricket-tournament-management',
      label: 'Manage a cricket tournament',
      description:
        'Formats, scheduling and budgets for a one-off tournament rather than a ' +
        'season-long league.',
    },
    {
      href: '/cricket-auction',
      label: 'Run a cricket auction to pick squads',
      description: 'How the auction format works and how to host one.',
    },
    {
      href: '/tools/cricket-fixture-generator',
      label: 'Cricket fixture generator',
      description:
        'Generate a round-robin schedule for your teams, with or without home and ' +
        'away legs.',
    },
    {
      href: '/leagues/discover',
      label: 'Browse public cricket leagues',
      description:
        'See how other organizers have set up their squads, fixtures and tables.',
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function CricketLeagueManagementPage() {
  return <SeoPage content={CONTENT} />;
}
