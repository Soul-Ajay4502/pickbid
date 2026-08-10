import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

// Angle: the one-off tournament — formats, scheduling against a fixed number of
// available days, budgets and sponsors. Distinct from
// /cricket-league-management, which covers season-long operations.
const CONTENT: SeoPageContent = {
  path: '/cricket-tournament-management',
  title: 'Cricket Tournament Management Platform',
  metaDescription:
    'Organize a cricket tournament — choose a format, schedule fixtures around ' +
    'the days you have, set team budgets, register players and publish results. ' +
    `${SITE_NAME} is free for local and corporate tournaments.`,
  breadcrumb: 'Cricket Tournament Management',
  kicker: 'One-off tournaments',
  h1: 'Cricket Tournament Management Platform',
  intro: [
    'A tournament is a league compressed into a weekend. The admin is the same, but ' +
      'you have far less room for error: one washed-out afternoon or one unclear rule ' +
      'and the whole schedule has to be redrawn between matches.',
    `${SITE_NAME} is a free cricket tournament management platform for exactly this ` +
      'kind of event — box cricket weekends, corporate tournaments, tape ball cups and ' +
      'community trophies. Register players, form teams, publish the schedule and keep ' +
      'the results on one link everyone already has.',
  ],
  sections: [
    {
      heading: 'Pick the format before anything else',
      body: [
        'The format decides how many matches you need, and therefore whether your ' +
          'tournament fits the days and grounds you have booked. Work this out first; ' +
          'everything else follows from it.',
      ],
      points: [
        {
          term: 'Round robin',
          description:
            'Everyone plays everyone. With N teams that is N×(N−1)/2 matches — six for ' +
            'four teams, fifteen for six, twenty-eight for eight. Fairest format, and ' +
            'the one most likely to overrun a single day.',
        },
        {
          term: 'Groups plus knockout',
          description:
            'Split into two groups, play round robin within each, then take the top two ' +
            'from each into semi-finals. The standard compromise: far fewer matches ' +
            'than a full round robin, and it still ends with a final.',
        },
        {
          term: 'Straight knockout',
          description:
            'N−1 matches for N teams, so eight teams need seven matches and one day. ' +
            'The catch is that half your teams play once and go home, which is a hard ' +
            'sell if people paid to enter.',
        },
        {
          term: 'Double elimination',
          description:
            'A losers’ bracket gives every team a second life. Roughly twice the ' +
            'matches of a straight knockout — good for a two-day event where a single ' +
            'bad over should not end someone’s tournament.',
        },
      ],
    },
    {
      heading: 'Building the schedule',
      body: [
        'Once the format is chosen, the match count is fixed and the only variables are ' +
          'overs per innings and how many grounds you have. Two things reliably cause ' +
          'trouble: back-to-back matches for the same team, and a final scheduled so ' +
          'late that fading light decides it.',
        'The fixture generator will produce a round-robin schedule for your teams and ' +
          'spread each team’s matches across the rounds, which handles the first ' +
          'problem. For the second, count backwards from sunset rather than forwards ' +
          'from the opening ceremony.',
      ],
    },
    {
      heading: 'Teams, players and budgets',
      body: [
        'For tournaments where teams are picked rather than pre-formed, an auction is ' +
          'the most popular way to do it — it distributes the strong players and gives ' +
          'the event an opening night. Set each team a purse and a squad size and the ' +
          'platform enforces both.',
        'Player registration works the same as for a league: share a link, players fill ' +
          'in their own details and photo without needing an account, and you close ' +
          'registration when the entry list is full.',
      ],
    },
    {
      heading: 'Sponsors and the money side',
      body: [
        'Local tournaments usually run on entry fees and a handful of sponsors, and both ' +
          'need to be visible to the right people.',
        'Sponsor logos can be shown in a rotating display board you can put on a second ' +
          'screen during the event, and each sponsor can link to its own site. Entry fees ' +
          'and costs can be tracked in an optional accounts sheet that stays private to ' +
          'the organizers until you choose to publish it to your members.',
      ],
    },
    {
      heading: 'Publishing results as you go',
      body: [
        'Record each result as the match finishes and the standings recalculate ' +
          'immediately. If the tournament is public, players and spectators can follow ' +
          'the table themselves on the tournament page rather than asking an organizer ' +
          'who is currently umpiring.',
        'When it is over, the same page holds the final table, every squad and — if you ' +
          'ran one — the full auction result, which is the thing people actually come ' +
          'back to look at.',
      ],
    },
  ],
  faqs: [
    {
      question: `Is ${SITE_NAME} suitable for local cricket tournaments?`,
      answer:
        'Yes. It is built for exactly this scale — box cricket weekends, tape ball ' +
        'cups, corporate tournaments, apartment and village leagues. There is no ' +
        'minimum size, no cost, and nothing to install: organizers work in a browser ' +
        'and everyone else just opens a link.',
    },
    {
      question: 'How many matches does my tournament need?',
      answer:
        'It depends on the format. A round robin needs N×(N−1)/2 matches for N teams ' +
        '(six for four teams, fifteen for six). A straight knockout needs N−1. Groups ' +
        'plus semi-finals and a final sits between the two, which is why it is the ' +
        'usual choice for a one-day event.',
    },
    {
      question: 'Can I generate a fixture list automatically?',
      answer:
        'Yes. The cricket fixture generator produces a round-robin schedule from your ' +
        'list of teams, optionally with home and away legs, and spreads each team’s ' +
        'matches across the rounds so nobody plays twice in a row.',
    },
    {
      question: 'Can I run a player auction to form the teams?',
      answer:
        'Yes. Set each team a purse and a squad size, then run a live auction where ' +
        'players are bought one at a time. Spectators can follow it on a public watch ' +
        'screen, and squads are created from the results automatically.',
    },
    {
      question: 'Can I show sponsor logos during the tournament?',
      answer:
        'Yes. Add your sponsors to the tournament and display them in a rotating ' +
        'sponsor board — designed for a second screen or a projector at the venue. ' +
        'Each logo can link to the sponsor’s own website.',
    },
    {
      question: 'Do spectators need an account to follow the tournament?',
      answer:
        'No. If you make the tournament public, its page — squads, auction results, ' +
        'fixtures, results and the points table — is readable by anyone with the link, ' +
        'with no sign-in.',
    },
  ],
  cta: {
    heading: 'Set up your tournament',
    body:
      'Create it, share the registration link, and have the schedule and the table ' +
      'ready before the first toss.',
    href: '/leagues/new',
    label: 'Create a cricket tournament',
  },
  related: [
    {
      href: '/tools/cricket-fixture-generator',
      label: 'Generate your tournament fixtures',
      description:
        'A round-robin schedule for your teams in a few seconds, ready to copy.',
    },
    {
      href: '/resources/how-to-organize-cricket-auction',
      label: 'How to organize a cricket auction',
      description:
        'A run sheet for auction night, from the invite list to the final unsold round.',
    },
    {
      href: '/cricket-league-management',
      label: 'Manage a season-long cricket league',
      description:
        'For competitions that run over months rather than a weekend.',
    },
    {
      href: '/tools/cricket-auction-budget-calculator',
      label: 'Cricket auction budget calculator',
      description: 'Work out team purses and the reserve you need per squad slot.',
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function CricketTournamentManagementPage() {
  return <SeoPage content={CONTENT} />;
}
