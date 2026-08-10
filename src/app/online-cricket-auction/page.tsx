import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

// Angle: the practical run-through of auction night, including remote bidders
// and the venue setup. The format itself is explained on /cricket-auction and
// the software criteria on /cricket-auction-platform.
const CONTENT: SeoPageContent = {
  path: '/online-cricket-auction',
  title: 'Run Your Cricket Player Auction Online',
  metaDescription:
    'Host your cricket player auction online — set up teams and purses, run live ' +
    'bidding from one screen, let spectators and remote team owners follow along, ' +
    `then share the squads. Free on ${SITE_NAME}.`,
  breadcrumb: 'Online Cricket Auction',
  kicker: 'Auction night',
  h1: 'Run Your Cricket Player Auction Online',
  intro: [
    'You do not need everyone in one hall to hold a proper auction. What you need is ' +
      'a single source of truth for who is on the block and what every team has left — ' +
      'and once that lives on a screen instead of a whiteboard, it stops mattering ' +
      'whether team owners are in the room or on a call.',
    'This is the practical version: what to do before the night, how to run the ' +
      'bidding, and how to handle owners who cannot attend.',
  ],
  sections: [
    {
      heading: 'Before the night',
      body: [
        'Almost every auction that goes badly goes badly because of something that was ' +
          'not settled beforehand. An hour of setup buys you a calm evening.',
      ],
      points: [
        {
          term: 'Get the player list closed',
          description:
            'Share the registration link early so players enter their own details and ' +
            'photos, then close registration. Adding players mid-auction is possible ' +
            'but it changes the arithmetic everyone has planned around.',
        },
        {
          term: 'Create the teams with real numbers',
          description:
            'Name, colour, purse and squad size for each. Keep purses identical unless ' +
            'you have a deliberate reason not to — unequal budgets need explaining to ' +
            'every owner individually.',
        },
        {
          term: 'Assign icon players',
          description:
            'Pre-assign one marquee player per team so no side starts from nothing. ' +
            'Icon players skip the auction entirely.',
        },
        {
          term: 'Agree the rules in writing',
          description:
            'Bid increments, whether unsold players return, what happens if a team ' +
            'cannot fill its squad. Send them round before the auction, not during it.',
        },
        {
          term: 'Do a full rehearsal',
          description:
            'Run the whole auction once with the real player list, then reset it. ' +
            'Resetting clears every sale and restores all purses, so nothing carries ' +
            'over into the real thing.',
        },
      ],
    },
    {
      heading: 'Setting up the two screens',
      body: [
        'An online auction works on a two-screen model, and getting this right is most ' +
          'of the job.',
        'The auctioneer drives the auction from their own device — calling players, ' +
          'recording the winning bid and the buying team. Everyone else watches the ' +
          'public watch screen, which mirrors the same auction: the player currently on ' +
          'the block, the current bid, and every team’s remaining purse.',
        'In a hall, put the watch screen on a projector or a TV. Remote owners open the ' +
          'same link on their phones. Nobody except the auctioneer needs an account, and ' +
          'nobody can accidentally change anything.',
      ],
    },
    {
      heading: 'Running the bidding',
      body: [
        'The auctioneer calls a player, the room bids, and the auctioneer records the ' +
          'winner and the price. Purses and squad counts update immediately on both ' +
          'screens, so there is never a pause to reconcile totals.',
        'A team’s maximum legal bid is calculated for it — the platform holds back a ' +
          'minimum for each slot the team still has to fill — so a side physically ' +
          'cannot buy three stars and then be unable to field eleven.',
        'Keep the pace up. The single biggest difference between an auction people ' +
          'remember and one they endure is dead time between players.',
      ],
    },
    {
      heading: 'Including owners who cannot attend',
      body: [
        'Two approaches work. The simpler one: the remote owner joins a voice or video ' +
          'call, watches the public screen, and bids out loud like everyone else — the ' +
          'auctioneer records it identically.',
        'The other: the owner nominates a proxy in the room with a written maximum per ' +
          'player. Agree in advance which of the two you are using, and tell every team ' +
          'the same thing.',
      ],
    },
    {
      heading: 'Closing it out',
      body: [
        'Run a second round for unsold players once the big purses are spent — this is ' +
          'where teams fill their squads cheaply, and it is usually the most competitive ' +
          'part of the evening.',
        'When the last player is sold you have complete squads with prices. Share the ' +
          'recap, export PDF squad sheets to the group chat, and generate the fixtures. ' +
          'If the league is public, the squads and full auction results stay readable on ' +
          'its page for anyone who wants to look back at what a player went for.',
      ],
    },
  ],
  faqs: [
    {
      question: 'Can I run a cricket auction online instead of in person?',
      answer:
        'Yes. The auctioneer runs the auction from their own screen while everyone else ' +
        'follows a public watch link that mirrors the current player, current bid and ' +
        'every team’s remaining purse. Team owners can be in the room, on a call, or ' +
        'both — the auction works the same way.',
    },
    {
      question: 'Do remote team owners need accounts?',
      answer:
        'No. Only the organizer running the auction signs in. Team owners and ' +
        'spectators open the public watch link, which needs no account on any device.',
    },
    {
      question: 'How long does an online cricket auction take?',
      answer:
        'Budget roughly one to two minutes per player once you are moving, plus setup ' +
        'and a second unsold round. A sixty-player auction typically runs ninety ' +
        'minutes to two hours. Rehearsing once beforehand is the most reliable way to ' +
        'make the real one fast.',
    },
    {
      question: 'What if I make a mistake during the auction?',
      answer:
        'Individual sales can be corrected, and the whole auction can be reset — which ' +
        'clears every sale and restores all team purses to their starting values. That ' +
        'is also how a rehearsal is cleaned up before the real auction begins.',
    },
    {
      question: 'Can people watch the auction who are not in any team?',
      answer:
        'Yes, and they usually do. The watch screen is a plain link with no sign-in, so ' +
        'family, players and anyone else following the league can see the bidding live.',
    },
    {
      question: 'What do I get at the end of the auction?',
      answer:
        'Complete squads for every team with the price paid for each player, a ' +
        'leaderboard of the biggest buys, a shareable recap of the auction, and PDF ' +
        'squad sheets you can send to the group chat. Fixtures and the points table ' +
        'carry on from the same league page.',
    },
  ],
  cta: {
    heading: 'Run your auction online',
    body:
      'Create the league, add teams and purses, and rehearse the whole thing tonight. ' +
      'Reset it when you are done and the real auction starts clean.',
    href: '/leagues/new',
    label: 'Start your cricket auction',
  },
  related: [
    {
      href: '/resources/how-to-organize-cricket-auction',
      label: 'How to organize a cricket auction, step by step',
      description: 'The full run sheet, from the invite list to the final unsold round.',
    },
    {
      href: '/resources/cricket-auction-rules',
      label: 'Cricket auction rules to agree first',
      description:
        'Bid increments, unsold rounds, squad minimums — settled before the night.',
    },
    {
      href: '/cricket-auction-platform',
      label: 'What to look for in a cricket auction platform',
      description: 'The criteria any auction software should meet.',
    },
    {
      href: '/leaderboard',
      label: 'See the biggest auction buys',
      description:
        `The highest winning bids across every public league on ${SITE_NAME}.`,
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function OnlineCricketAuctionPage() {
  return <SeoPage content={CONTENT} />;
}
