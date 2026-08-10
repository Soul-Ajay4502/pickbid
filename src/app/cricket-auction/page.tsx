import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

// Angle: what a cricket player auction *is* and how the mechanics work. This is
// the explainer page — the platform/software comparison lives on
// /cricket-auction-platform and the step-by-step run-through on
// /online-cricket-auction, so the three don't overlap.
const CONTENT: SeoPageContent = {
  path: '/cricket-auction',
  title: 'Cricket Auction Platform',
  metaDescription:
    'Run a cricket player auction the way the big leagues do — team purses, ' +
    'base prices, icon players and a live bidding screen. How cricket auctions ' +
    `work and how to host one with ${SITE_NAME}.`,
  breadcrumb: 'Cricket Auction',
  kicker: 'Player auctions',
  h1: 'Cricket Auction Platform',
  intro: [
    'A cricket auction turns squad selection into the best evening of your season. ' +
      'Instead of captains quietly picking names off a list, every team owner sits ' +
      'in the same room with a budget, and each player is called one at a time until ' +
      'someone is willing to pay for them.',
    `${SITE_NAME} is a free cricket auction platform built for that evening. You add ` +
      'the players, set the teams and their purses, and run the bidding from one ' +
      'screen while the room watches the same numbers you do.',
  ],
  sections: [
    {
      heading: 'How a cricket player auction works',
      body: [
        'The format is borrowed from the professional leagues, and it survives ' +
          'being scaled down to eight friends and a hall with a projector.',
      ],
      points: [
        {
          term: 'Every team gets a purse',
          description:
            'Each team starts with the same budget — real money, tokens, or an ' +
            'imaginary figure with a lot of zeroes. The purse is the only thing ' +
            'stopping one team from buying every good player, so it is the number ' +
            'that makes the whole format work.',
        },
        {
          term: 'Players come up one at a time',
          description:
            'A player is called, their card goes on the screen, and teams bid ' +
            'against each other. The highest bid wins and the amount comes ' +
            'straight out of that team’s purse.',
        },
        {
          term: 'Unsold players go back in the pool',
          description:
            'If nobody bids, the player is marked unsold and can be brought back ' +
            'in a later round — often much cheaper, once the big purses have been ' +
            'spent. Bargain hunting in the second round is half the fun.',
        },
        {
          term: 'Icon players are pre-assigned',
          description:
            'Most local leagues seed one marquee player per team before bidding ' +
            'opens, so every side has a recognisable name. Icon players never go ' +
            'to auction; they are assigned up front.',
        },
        {
          term: 'Squad limits keep it honest',
          description:
            'A team that has to fill eleven slots cannot spend its entire purse on ' +
            'three stars. Setting a squad size and holding back a minimum per ' +
            'remaining slot is what keeps the last round from being a formality.',
        },
      ],
    },
    {
      heading: 'Setting budgets and base prices',
      body: [
        'The two numbers organizers agonise over are the purse and the base price, ' +
          'and they are really one decision. A purse that is a large multiple of the ' +
          'base price produces wild bidding wars and a lopsided squad or two; a purse ' +
          'that barely covers the squad produces an orderly, slightly dull draft.',
        'A reasonable starting point for an amateur league: set the purse so a team ' +
          'could afford roughly two or three genuinely expensive players and fill the ' +
          'rest near the base price. If you want to sanity-check the arithmetic before ' +
          'the night itself, the budget calculator does it for you.',
      ],
    },
    {
      heading: 'What the room sees',
      body: [
        'An auction lives or dies on whether the room can follow it. If only the ' +
          'organizer knows how much a team has left, every bid needs a shouted ' +
          'clarification and the momentum drains away.',
        `On ${SITE_NAME} the auctioneer drives the auction from their own screen while ` +
          'a separate public watch screen mirrors it — current player, current bid and ' +
          'every team’s remaining purse. Put that on a projector or a TV and share ' +
          'the link with anyone who could not make it.',
      ],
    },
    {
      heading: 'After the hammer falls',
      body: [
        'The auction is the event, but the squads are the product. When bidding ends ' +
          'you have a full roster for every team, the price paid for every player, and ' +
          'a leaderboard of the biggest buys.',
        'From there you can export a squad sheet as a PDF for the group chat, generate ' +
          'the fixtures, and start recording results against a points table — the ' +
          'league carries on from the same place the auction finished.',
      ],
    },
  ],
  faqs: [
    {
      question: `What is ${SITE_NAME}?`,
      answer:
        `${SITE_NAME} is a free cricket auction and league management platform. You ` +
        'create a league, add players with photos and roles, run a live player ' +
        'auction with team budgets, then manage squads, fixtures, results and a ' +
        'points table from the same league page. It runs in a browser with no app ' +
        'to install.',
    },
    {
      question: 'How does a cricket player auction work?',
      answer:
        'Every team is given a purse. Players are called one at a time and teams bid ' +
        'against each other; the highest bid wins the player and that amount is ' +
        'deducted from the team’s purse. Players nobody bids for are marked unsold ' +
        'and can return in a later round. Icon players are assigned to teams before ' +
        'bidding starts, and a squad size limit stops a team spending everything early.',
    },
    {
      question: 'Can multiple teams participate in an auction?',
      answer:
        'Yes. You can add as many teams as your league needs, each with its own ' +
        'budget, squad size and colour. Every team’s remaining purse and maximum ' +
        'possible bid updates live as players are sold, on both the auctioneer’s ' +
        'screen and the public watch screen.',
    },
    {
      question: 'Do players need an account to be in the auction?',
      answer:
        'No. Organizers can add players themselves, or share a link that lets each ' +
        'player fill in their own details and photo without signing up. Only the ' +
        'organizer running the league needs an account.',
    },
    {
      question: 'What happens if a player goes unsold?',
      answer:
        'They are recorded as unsold and stay available. Most organizers run a second ' +
        'round for unsold players once the early bidding wars have drained the big ' +
        'purses, which is usually where teams find their bargains.',
    },
    {
      question: 'Can I practise the auction before the real one?',
      answer:
        'Yes. Run the auction end to end as a rehearsal, then reset it — resetting ' +
        'clears every sale and restores all team purses, so you can start the real ' +
        'auction from a clean slate on the night.',
    },
  ],
  cta: {
    heading: 'Host your own cricket auction',
    body:
      'Create a league, add your players and teams, and run the auction from your ' +
      'laptop while the room follows along. Free, and it takes a few minutes to set up.',
    href: '/leagues/new',
    label: 'Create a cricket league',
  },
  related: [
    {
      href: '/online-cricket-auction',
      label: 'Run your cricket player auction online',
      description:
        'The step-by-step version: what to prepare, how to run auction night and how ' +
        'to include people who cannot be in the room.',
    },
    {
      href: '/cricket-auction-platform',
      label: 'Compare cricket auction platforms',
      description:
        'What to look for in auction software, and why spreadsheets fall apart once ' +
        'the bidding starts.',
    },
    {
      href: '/tools/cricket-auction-budget-calculator',
      label: 'Cricket auction budget calculator',
      description:
        'Set a purse and squad size and see the minimum bid you must hold back per ' +
        'remaining slot.',
    },
    {
      href: '/resources/cricket-auction-rules',
      label: 'Cricket auction rules to agree before you start',
      description:
        'The handful of rules that prevent arguments on the night, written out so you ' +
        'can share them with team owners.',
    },
    {
      href: '/leagues/discover',
      label: 'Browse public cricket leagues',
      description: 'See squads and auction results from leagues already running.',
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function CricketAuctionPage() {
  return <SeoPage content={CONTENT} />;
}
