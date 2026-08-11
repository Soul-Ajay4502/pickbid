import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

/**
 * The FAQ hub. The home page carries a short FAQ aimed at a visitor deciding
 * whether to sign up; this page is the complete set, including the questions
 * that only come up once someone is actually organizing a league.
 *
 * Answers lead with the direct answer and then add context, which is both what
 * a reader skimming wants and what an answer engine can quote without mangling.
 * Every answer is checked against what the product actually does — there is
 * nothing here about capacity, uptime, integrations or roadmap that the app
 * cannot currently back up.
 */
const CONTENT: SeoPageContent = {
  path: '/faq',
  title: 'Frequently Asked Questions',
  metaDescription:
    `Answers about ${SITE_NAME}: what it is, what it costs, whether players and ` +
    'spectators need accounts, how cricket auctions and leagues work on it, and ' +
    'who can see your league.',
  breadcrumb: 'FAQ',
  kicker: 'Questions & answers',
  h1: 'Frequently asked questions',
  intro: [
    `Everything organizers, players and spectators ask about ${SITE_NAME}, in ` +
      'one place. If you are new here, the short version is below and the ' +
      'step-by-step walkthrough is on the how it works page.',
  ],
  sections: [
    {
      heading: `What ${SITE_NAME} is, in one paragraph`,
      body: [
        `${SITE_NAME} is a free web app for running amateur cricket leagues. ` +
          'Organizers use it to design premium player cards, host an IPL-style ' +
          'live player auction that spectators can watch in real time, and then ' +
          'track squads, fixtures, results and leaderboards for the season — all ' +
          'shared through a single link.',
        'It is built for local cricket: box cricket, tape ball, gully cricket, ' +
          'corporate and community tournaments. It runs in any modern browser ' +
          'with nothing to install, and it is not a fantasy cricket game or a ' +
          'betting product.',
      ],
    },
  ],
  faqs: [
    {
      question: `What is ${SITE_NAME}?`,
      answer:
        `${SITE_NAME} is a free cricket auction and league management platform. ` +
        'It covers the whole life of an amateur league: player cards, a live ' +
        'player auction, team and squad management, fixtures and results, and ' +
        'leaderboards — with a public link for anything you want to share.',
    },
    {
      question: `Is ${SITE_NAME} free?`,
      answer:
        'Yes, and every feature is included. There is no credit card, no trial ' +
        'period, no paid tier to upgrade to and nothing metered — leagues, ' +
        'players, teams and auctions are all unlimited.',
    },
    {
      question: `Who is ${SITE_NAME} for?`,
      answer:
        'Anyone organizing amateur cricket: box cricket and tape ball leagues, ' +
        'gully cricket series, corporate tournaments, society and community ' +
        'leagues, and college competitions. It suits organizers who want a ' +
        'professional auction and player cards without running the whole thing ' +
        'through spreadsheets and WhatsApp threads.',
    },
    {
      question: 'How do I create a cricket auction?',
      answer:
        'Create a league, add your players, create the teams and give each one ' +
        'a purse, then open the auction. You call players one at a time and the ' +
        'live bid, the buying team and every remaining purse update as you go, ' +
        'mirrored to a public watch screen for the room.',
    },
    {
      question: 'How does player bidding work?',
      answer:
        'One player is on the block at a time and teams bid against each other ' +
        'until nobody goes higher. The winning amount comes straight out of that ' +
        `team's purse, so a team can never spend more than its budget. Players ` +
        'nobody bids on are marked unsold and can be brought back in a later ' +
        'round.',
    },
    {
      question: 'How do teams take part in the auction?',
      answer:
        'The organizer runs the bidding from one screen, and team owners follow ' +
        'along on the public watch link — on a projector in the hall, or on ' +
        'their own phones if they are not in the room. Owners call their bids ' +
        'and the organizer records them, which keeps one authoritative version ' +
        'of the auction.',
    },
    {
      question: 'Do players need an account to join a league?',
      answer:
        'No. Organizers share a registration link, and players open it, enter ' +
        'their details and photo, and their card is created — no sign-in. Only ' +
        'organizers need an account, and the organizer still controls the final ' +
        'roster.',
    },
    {
      question: 'Can spectators watch the auction without signing in?',
      answer:
        'Yes. Every auction has a public watch link that mirrors the current ' +
        'player, live bids, sales and team purses in any browser, with no ' +
        'account needed. The post-auction recap and squad reveals are shareable ' +
        'the same way.',
    },
    {
      question: 'Who can see my league?',
      answer:
        'You choose. A private league is unlisted and only reachable by people ' +
        'you send the link to once they are signed in. Making a league public ' +
        'lists it in the discover directory and lets anyone view its squads, ' +
        'auction results and points table without an account.',
    },
    {
      question: 'How do I manage a cricket league after the auction?',
      answer:
        'Record fixtures and results as matches are played, and the points ' +
        'table and league leaderboard update themselves. You can also manage ' +
        'team officials, export PDF squad sheets, keep an optional income and ' +
        'expense ledger, and add co-organizers to share the work.',
    },
    {
      question: 'What do I need to start a league?',
      answer:
        'A Google account to sign in, your list of players, and two decisions: ' +
        'how much each team can spend and how many players a squad needs. ' +
        'Everything else can be filled in later.',
    },
    {
      question: 'Is real money involved in the auctions?',
      answer:
        `No. Auctions use the budget you set for each team inside your league. ` +
        `${SITE_NAME} does not process payments, is not a betting product and is ` +
        'not a fantasy cricket game.',
    },
    {
      question: `Does ${SITE_NAME} work on phones?`,
      answer:
        'Yes. It runs in any modern browser on phone, tablet or desktop, and ' +
        'can be installed to your home screen for a full-screen experience. ' +
        'There is no separate app to download.',
    },
    {
      question: 'Can I reuse last season’s setup?',
      answer:
        'Yes — clone the league and you get its structure back without ' +
        'rebuilding it. It is the usual way organizers start a new season or run ' +
        'a second division alongside the first.',
    },
    {
      question: 'Can I run a practice auction first?',
      answer:
        'Yes. Run the auction and then reset it, which clears every sale and ' +
        'restores each team’s purse. Most organizers do a dry run the night ' +
        'before to check their budgets and squad rules hold up.',
    },
    {
      question: 'Can I show sponsors at my event?',
      answer:
        'Yes. Add sponsor logos and links to the league, then display them as a ' +
        'full-screen animated 3D marquee — usually on a second screen at the ' +
        'venue or in a stream.',
    },
  ],
  related: [
    {
      href: '/how-it-works',
      label: 'How Player Hunt works, step by step',
      description:
        'The five steps from creating a league to sharing the finished squads.',
    },
    {
      href: '/features',
      label: 'Everything Player Hunt includes',
      description: 'The full feature list, grouped by what each part is for.',
    },
    {
      href: '/pricing',
      label: 'What it costs',
      description: 'Free, and what that covers.',
    },
    {
      href: '/resources/how-to-organize-cricket-auction',
      label: 'How to organize a cricket auction',
      description:
        'A run sheet for the weeks before auction night, and what tends to go wrong.',
    },
  ],
  cta: {
    heading: 'Still deciding?',
    body:
      'Browse leagues other organizers have already run, or start your own and ' +
      'see how far you get in a minute.',
    href: '/leagues/discover',
    label: 'Browse public leagues',
  },
};

export const metadata = seoPageMetadata(CONTENT);

export default function FaqPage() {
  return <SeoPage content={CONTENT} />;
}
