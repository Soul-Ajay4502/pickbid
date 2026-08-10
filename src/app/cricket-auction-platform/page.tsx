import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

// Angle: choosing the software. This page is about what an auction *platform*
// has to do — the comparison/evaluation page. The mechanics of an auction are
// explained on /cricket-auction, so this one stays on tooling.
const CONTENT: SeoPageContent = {
  path: '/cricket-auction-platform',
  title: 'Online Cricket Auction Platform',
  metaDescription:
    'What to look for in a cricket auction platform: live purse tracking, squad ' +
    'limits, player cards, a spectator screen and shareable results. ' +
    `${SITE_NAME} does all of it free, in any browser.`,
  breadcrumb: 'Cricket Auction Platform',
  kicker: 'Choosing your tooling',
  h1: 'Online Cricket Auction Platform',
  intro: [
    'Most local cricket auctions are run on a spreadsheet, a calculator and one ' +
      'person with very good handwriting. It works, right up until two teams are ' +
      'bidding quickly and nobody can say for certain what either of them has left ' +
      'to spend.',
    'An auction platform exists to remove that doubt. This page covers what the ' +
      'software actually has to do, so you can judge any option — including this ' +
      'one — against the same list.',
  ],
  sections: [
    {
      heading: 'Why spreadsheets break down',
      body: [
        'A spreadsheet is a fine record of an auction after the fact. It is a poor ' +
          'way to run one live, for three reasons that only show up on the night.',
      ],
      points: [
        {
          term: 'Nobody else can see it',
          description:
            'The purse column lives on one laptop. Team owners are bidding on trust, ' +
            'and every few players someone asks for a total — which stops the auction.',
        },
        {
          term: 'It lets you overspend',
          description:
            'Nothing prevents a team from bidding past its budget, or from buying ' +
            'twelve players for an eleven-player squad. You find out later, and then ' +
            'you have to unwind sales.',
        },
        {
          term: 'It produces no artefacts',
          description:
            'At the end you have a grid of names. Not squad sheets, not shareable ' +
            'results, nothing anyone wants to forward to the group chat.',
        },
      ],
    },
    {
      heading: 'What a cricket auction platform should do',
      body: [
        'Judge any platform on whether it holds up during the fastest ten minutes of ' +
          'the evening, not on its feature list.',
      ],
      points: [
        {
          term: 'Track purses in real time',
          description:
            'Every team’s remaining budget should update the instant a player is sold, ' +
            'and be visible to everyone — not just the organizer.',
        },
        {
          term: 'Enforce squad rules by construction',
          description:
            'If a team must fill eleven slots, the platform should cap its maximum bid ' +
            'so it always has enough left for the rest. Overspending should be ' +
            'impossible rather than merely discouraged.',
        },
        {
          term: 'Give the room something to look at',
          description:
            'A separate spectator screen showing the current player, the current bid ' +
            'and all the purses. This is the difference between an auction and a ' +
            'meeting about an auction.',
        },
        {
          term: 'Handle icon players and unsold rounds',
          description:
            'Pre-assigning marquee players and re-running unsold players are how real ' +
            'auctions work. A platform that only supports a single linear pass ' +
            'will not survive contact with your league.',
        },
        {
          term: 'Produce output worth sharing',
          description:
            'Squad sheets, per-team rosters, a leaderboard of biggest buys and a link ' +
            'that previews properly when pasted into WhatsApp.',
        },
        {
          term: 'Work on the hardware you actually have',
          description:
            'A browser on a borrowed laptop, connected to a projector, on venue ' +
            'wifi. Anything that needs an install or a specific device is a risk on ' +
            'the night.',
        },
      ],
    },
    {
      heading: `How ${SITE_NAME} approaches it`,
      body: [
        `${SITE_NAME} is built around the two-screen model: the organizer runs the ` +
          'auction from their own device, and a public watch link mirrors it for the ' +
          'room and for anyone following remotely. Purses, squad counts and the ' +
          'maximum legal bid per team are computed server-side, so the spectator view ' +
          'and the auctioneer view can never disagree.',
        'Team budgets, squad sizes, icon assignments and a reserve-per-slot rule are ' +
          'all set up before the auction, which means during the auction there is only ' +
          'one decision to make: who bid, and how much.',
        'It is free, including every feature above. There is no paid tier, no per-league ' +
          'charge and no player limit to run into halfway through registration.',
      ],
    },
    {
      heading: 'Questions worth asking before you commit',
      body: [
        'Whatever you choose, get answers to these before you build your league in it: ' +
          'Can spectators follow along without an account? Can you reset the auction ' +
          'after a rehearsal? Can you export squads once it is done? And if the ' +
          'organizer’s laptop dies mid-auction, is the state on the server or in that ' +
          'browser tab?',
      ],
    },
  ],
  faqs: [
    {
      question: `Is ${SITE_NAME} free to use?`,
      answer:
        'Yes. Every feature — player cards, live auctions, the spectator screen, ' +
        'leaderboards, fixtures, results and PDF squad sheets — is free. There is no ' +
        'paid tier, no trial period and no per-league or per-player charge.',
    },
    {
      question: 'Do team owners need to install anything?',
      answer:
        'No. The auction and the spectator screen both run in a normal browser on ' +
        'any modern phone, tablet or laptop. Only the organizer signs in; everyone ' +
        'else just opens a link.',
    },
    {
      question: 'Can spectators watch the auction without an account?',
      answer:
        'Yes. Each league has a public watch screen you can share as a plain link. It ' +
        'mirrors the live auction — current player, current bid and every team’s ' +
        'remaining purse — and needs no sign-in.',
    },
    {
      question: 'Can a team accidentally overspend?',
      answer:
        'No. Each team’s maximum bid is capped by what it has left after reserving a ' +
        'minimum for its remaining squad slots, so a team can never bid itself into ' +
        'an unfillable squad.',
    },
    {
      question: 'What happens if the organizer’s device disconnects mid-auction?',
      answer:
        'Auction state is stored server-side, not in the browser tab. Reopening the ' +
        'auction page restores the auction where it left off, and the spectator screen ' +
        'picks it back up automatically.',
    },
    {
      question: 'Can I run more than one league or season?',
      answer:
        'Yes, and you can clone an existing league to reuse last season’s teams and ' +
        'settings instead of setting everything up again. You can also add ' +
        'co-organizers who can help run the auction and manage the league with you.',
    },
  ],
  cta: {
    heading: `Try ${SITE_NAME} for your next auction`,
    body:
      'Set up a league, add a few test players and run a practice auction end to end. ' +
      'If it does not hold up, you have lost ten minutes.',
    href: '/leagues/new',
    label: 'Create a league free',
  },
  related: [
    {
      href: '/cricket-auction',
      label: 'How a cricket auction works',
      description:
        'Purses, base prices, icon players and unsold rounds — the format explained ' +
        'from scratch.',
    },
    {
      href: '/features',
      label: 'View cricket auction features',
      description: `The full feature list across cards, auctions, squads and sharing.`,
    },
    {
      href: '/pricing',
      label: 'See pricing',
      description: 'Short version: it is free. The page explains why.',
    },
    {
      href: '/cricket-league-management',
      label: 'Manage the league after the auction',
      description:
        'Squads, fixtures, results and the points table once bidding is finished.',
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function CricketAuctionPlatformPage() {
  return <SeoPage content={CONTENT} />;
}
