import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { howToSchema } from '@/lib/jsonLd';
import { SITE_NAME } from '@/lib/seo';

/**
 * Angle: the *product* walkthrough — what an organizer actually does inside
 * Player Hunt, in order, from creating a league to sharing the recap.
 *
 * Deliberately distinct from the neighbouring pages so none of them reads as a
 * near-duplicate: /cricket-auction explains the auction *format*,
 * /online-cricket-auction covers running auction night itself, /features lists
 * capabilities without sequencing them, and this page is the sequence.
 */

/** The five steps, shared by the visible list and the HowTo schema below. */
const STEPS: { name: string; text: string }[] = [
  {
    name: 'Create your league',
    text:
      'Sign in with Google and give your league a name, a per-team budget and ' +
      'your squad rules. This is the only setup step that has to happen before ' +
      'anything else, and it takes about a minute.',
  },
  {
    name: 'Add players and build their cards',
    text:
      'Add players yourself, or send them a registration link so each player ' +
      'fills in their own details and photo — no account needed on their side. ' +
      'Each one becomes a player card in whichever of the 12 colour templates ' +
      'you picked for the league.',
  },
  {
    name: 'Set up teams and purses',
    text:
      'Create the teams, assign their owners and officials, and confirm each ' +
      'team’s purse. If you seed marquee players, assign them as icon players ' +
      'now so they are already on a roster before bidding opens.',
  },
  {
    name: 'Run the auction live',
    text:
      'Open the auction and move through players one at a time. You control ' +
      'the bidding from one screen while the public watch link mirrors the ' +
      'current player, the live bid and every team’s remaining purse for the ' +
      'room. Budgets are enforced as you go, so a team cannot overspend.',
  },
  {
    name: 'Share squads, then run the season',
    text:
      'When bidding ends, export PDF squad sheets, open the Auction Wrapped ' +
      'recap or let each team reveal its squad as a pack of cards. From there ' +
      'record fixtures and results, and the points table and leaderboards keep ' +
      'themselves up to date.',
  },
];

const CONTENT: SeoPageContent = {
  path: '/how-it-works',
  title: 'How Player Hunt Works',
  metaDescription:
    `How ${SITE_NAME} works, step by step: create a cricket league, add players ` +
    'and build their cards, set team purses, run a live auction spectators can ' +
    'watch, then track fixtures, results and leaderboards.',
  breadcrumb: 'How It Works',
  kicker: 'Step by step',
  h1: 'How Player Hunt works',
  intro: [
    `${SITE_NAME} takes a cricket league from a list of names to a finished ` +
      'season in five steps. You create the league, players build their cards, ' +
      'you set up the teams, you run the auction live, and then you record ' +
      'results as the season plays out.',
    'Everything runs in a browser. Organizers sign in with a Google account; ' +
      'players and spectators need no account at all, which is why each step ' +
      'below ends in a link you can paste into a group chat.',
  ],
  sections: [
    {
      heading: 'The five steps',
      body: [
        'In order, start to finish. You can pause at any point and come back — ' +
          'nothing has to be finished in one sitting, and players can keep ' +
          'registering right up until you open the auction.',
      ],
      points: STEPS.map((step, i) => ({
        term: `${i + 1}. ${step.name}`,
        description: step.text,
      })),
    },
    {
      heading: 'What each person sees',
      body: [
        'Three different people touch a league, and each one gets a different ' +
          'view of it. Knowing which is which saves explaining it on the night.',
      ],
      points: [
        {
          term: 'You, the organizer',
          description:
            'The full workspace: players, teams, purses, the auction controls, ' +
            'fixtures, results and an optional income and expense ledger. You ' +
            'can add co-organizers to share the work.',
        },
        {
          term: 'Players',
          description:
            'A registration link where they enter their own details and photo ' +
            'and see their finished card. No sign-in, and no access to your ' +
            'auction controls.',
        },
        {
          term: 'Team owners and spectators',
          description:
            'The public watch screen during the auction, and the league page ' +
            'afterwards with squads, results and the points table. Both are ' +
            'plain links that work without an account.',
        },
      ],
    },
    {
      heading: 'What you need before you start',
      body: [
        'Less than most organizers expect. A Google account to sign in, a list ' +
          'of players, and a decision on two numbers: how much each team gets ' +
          'to spend, and how many players a squad must end up with.',
        'You do not need a venue, a projector or everyone in one room — team ' +
          'owners can bid from wherever they are, and the watch link works on a ' +
          'phone. A projector just makes it more fun.',
      ],
    },
  ],
  faqs: [
    {
      question: 'How long does it take to set up a league?',
      answer:
        'Creating the league itself takes about a minute — a name, a team ' +
        'budget and your squad rules. Adding players takes as long as your ' +
        'roster needs, though you can hand that off by sharing the ' +
        'registration link and letting players fill in their own cards.',
    },
    {
      question: 'Do I have to run the auction on the same day I set the league up?',
      answer:
        'No. A league can sit half-built for as long as you like. Players can ' +
        'keep registering until you open the auction, and nothing expires in ' +
        'between.',
    },
    {
      question: 'Can I practise an auction before the real one?',
      answer:
        'Yes. Run the auction, then reset it to clear every sale and restore ' +
        'each team’s purse. A practice run the night before is the usual way ' +
        'organizers check their budgets and squad rules actually work.',
    },
    {
      question: 'What happens if I make a mistake during the auction?',
      answer:
        'Sales can be undone, and the whole auction can be reset if it needs ' +
        'to start over. Purses recalculate from the sales that remain, so the ' +
        'numbers stay consistent with what actually happened.',
    },
  ],
  related: [
    {
      href: '/cricket-auction',
      label: 'How a cricket auction works',
      description:
        'The format itself — purses, base prices, icon players and unsold rounds.',
    },
    {
      href: '/online-cricket-auction',
      label: 'Running your auction online',
      description:
        'The two-screen setup for auction night, including remote team owners.',
    },
    {
      href: '/features',
      label: 'Everything Player Hunt includes',
      description: 'The full feature list, grouped by what each part is for.',
    },
    {
      href: '/faq',
      label: 'Frequently asked questions',
      description: 'Accounts, sharing, costs and what spectators can see.',
    },
  ],
  cta: {
    heading: 'Start with step one',
    body:
      'Create your league, set a budget and share the registration link. ' +
      'Everything after that follows the order above.',
    href: '/leagues/new',
    label: 'Create your league',
  },
};

export const metadata = seoPageMetadata(CONTENT);

export default function HowItWorksPage() {
  return (
    <SeoPage
      content={CONTENT}
      // The visible step list above and this schema are generated from the same
      // STEPS array. No `totalTime` — the page only claims a duration for step
      // one, which is not the time for the whole procedure.
      extraSchemas={[
        howToSchema({
          name: `How to run a cricket league on ${SITE_NAME}`,
          description: CONTENT.metaDescription,
          path: CONTENT.path,
          steps: STEPS,
        }),
      ]}
    />
  );
}
