import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';

const CONTENT: SeoPageContent = {
  path: '/resources/cricket-auction-rules',
  title: 'Cricket Auction Rules',
  metaDescription:
    'A ready-to-share set of cricket auction rules: purses, base price, bid ' +
    'increments, squad minimums, icon players, unsold rounds, retention and ' +
    'tie-breaks. Copy them and adapt for your league.',
  breadcrumb: 'Cricket auction rules',
  kicker: 'Reference',
  h1: 'Cricket Auction Rules',
  intro: [
    'Almost every argument at an amateur cricket auction is about a rule nobody wrote ' +
      'down. This is a complete set you can adapt and send to your team owners before ' +
      'the night, so that the answer to "can they even do that?" is already settled.',
    'Nothing here is official — there is no governing body for a box cricket auction. ' +
      'These are the conventions that hold up in practice, with the reasoning, so you ' +
      'can change the ones that do not suit your league and know what you are trading ' +
      'away.',
  ],
  sections: [
    {
      heading: '1. Teams and squads',
      body: ['Settle the shape of the competition first; the money rules depend on it.'],
      points: [
        {
          term: 'Squad size',
          description:
            'Every team must end the auction with exactly the same number of players. ' +
            'State the number. A squad of eleven plus two reserves is common for a ' +
            'league playing eleven-a-side.',
        },
        {
          term: 'Maximum squad size',
          description:
            'No team may buy more than its squad size. Once a team is full it stops ' +
            'bidding, even with money left over.',
        },
        {
          term: 'Team officials',
          description:
            'Coaches, managers and owners are not players. They do not occupy a squad ' +
            'slot and do not cost anything from the purse.',
        },
      ],
    },
    {
      heading: '2. Money',
      body: [
        'The four numbers every owner must know before the first player is called. ' +
          'Publish them; do not leave them to be inferred.',
      ],
      points: [
        {
          term: 'Purse',
          description:
            'Each team receives an identical purse. Unspent money is not carried ' +
            'anywhere, converted into anything, or worth points — it is simply unspent.',
        },
        {
          term: 'Base price',
          description:
            'The opening bid for any player. No player may be sold below it.',
        },
        {
          term: 'Bid increment',
          description:
            'The minimum a new bid must exceed the current one by — around 10% of the ' +
            'base price works well. Bids that are not a valid increment are not bids.',
        },
        {
          term: 'Minimum reserve per unfilled slot',
          description:
            'A team must always retain at least the base price for each squad slot it ' +
            'has not filled. Its maximum legal bid is therefore its remaining purse ' +
            'minus (unfilled slots − 1) × base price. This single rule is what makes it ' +
            'impossible for a team to be unable to complete its squad.',
        },
      ],
    },
    {
      heading: '3. Icon and retained players',
      body: [
        'Optional, but if you use them, be explicit about the cost — this is the most ' +
          'common source of "that is not fair" on the night.',
      ],
      points: [
        {
          term: 'Icon players',
          description:
            'One marquee player may be pre-assigned to each team before the auction. ' +
            'Icon players do not go to auction and are announced in advance.',
        },
        {
          term: 'Do icons cost purse?',
          description:
            'Choose one and state it. Charging every team a fixed notional fee for its ' +
            'icon keeps purses equal and is the fairest option. Charging nothing is ' +
            'simpler but quietly advantages whichever team got the strongest icon.',
        },
        {
          term: 'Retention between seasons',
          description:
            'If teams may retain players from last season, cap the number and charge a ' +
            'fixed retention price against the purse. Uncapped retention makes an ' +
            'auction pointless within two seasons.',
        },
      ],
    },
    {
      heading: '4. Bidding',
      body: ['How a sale actually happens, and what counts.'],
      points: [
        {
          term: 'One player at a time',
          description:
            'Players are called individually in an order the organizer sets. No ' +
            'package deals and no bidding on a player who has not been called.',
        },
        {
          term: 'Who may bid',
          description:
            'One nominated representative per team. If an owner is absent, they may ' +
            'nominate a proxy in writing before the auction, with a maximum per player.',
        },
        {
          term: 'The auctioneer’s call is final',
          description:
            'When the auctioneer declares a player sold, the sale stands. Disputes are ' +
            'raised before the next player is called, not later.',
        },
        {
          term: 'Withdrawn bids',
          description:
            'A bid may not be withdrawn. A team that bids and wins has bought the player.',
        },
      ],
    },
    {
      heading: '5. Unsold players',
      body: [
        'The rule that most often goes unwritten, and the one that most often causes ' +
          'trouble at the end of the evening.',
      ],
      points: [
        {
          term: 'Unsold in the first round',
          description:
            'A player nobody bids for at base price is marked unsold and returns in a ' +
            'later round.',
        },
        {
          term: 'The unsold round',
          description:
            'After the first pass, unsold players are re-offered at base price. Run this ' +
            'as a distinct round after a short break so owners can recount.',
        },
        {
          term: 'Filling short squads',
          description:
            'If teams are still short after the unsold round, remaining players are ' +
            'allocated at base price, offered to the team with the fewest players ' +
            'first. State this in advance — improvising an allocation order at 10pm is ' +
            'how auctions end badly.',
        },
        {
          term: 'Players who go entirely unsold',
          description:
            'Decide in advance whether they sit out the season or are added to squads ' +
            'as reserves. Tell the players, not just the owners.',
        },
      ],
    },
    {
      heading: '6. Tie-breaks and edge cases',
      body: [
        'Rare, but each one has stalled a real auction. Two lines each now saves twenty ' +
          'minutes later.',
      ],
      points: [
        {
          term: 'Simultaneous identical bids',
          description:
            'The auctioneer decides which was first. If genuinely simultaneous, invite ' +
            'one further increment from both; if neither raises, a coin toss.',
        },
        {
          term: 'A team bids beyond its legal maximum',
          description:
            'The bid is void and the previous bid stands. It is not a sale at the ' +
            'illegal price.',
        },
        {
          term: 'A player withdraws after being sold',
          description:
            'The purchasing team’s money is refunded to its purse and it may buy a ' +
            'replacement from any remaining players at base price.',
        },
        {
          term: 'Technology failure',
          description:
            'Auction state is held on the server, so reopening the auction resumes it. ' +
            'If a sale is lost, the auctioneer’s written record is the authority — keep ' +
            'a paper note of each sale as you go.',
        },
      ],
    },
    {
      heading: 'Adapting these rules',
      body: [
        'Change what you like, but change it before the auction and in writing. The one ' +
          'rule worth keeping exactly as written is the minimum reserve per unfilled ' +
          'slot: every other rule here prevents an argument, and that one prevents a ' +
          'league that cannot be played.',
      ],
    },
  ],
  faqs: [
    {
      question: 'Are there official rules for a cricket player auction?',
      answer:
        'No. Amateur and local cricket auctions have no governing body, so each league ' +
        'sets its own rules. The set on this page reflects the conventions most local ' +
        'leagues converge on, and is meant to be adapted rather than followed exactly.',
    },
    {
      question: 'How do I stop a team spending its whole purse on two players?',
      answer:
        'Require each team to retain at least the base price for every squad slot it ' +
        'has not yet filled. A team’s maximum legal bid becomes its remaining purse ' +
        'minus the base price times its remaining unfilled slots after this one, which ' +
        'makes an unfillable squad arithmetically impossible.',
    },
    {
      question: 'Should icon players cost money from the purse?',
      answer:
        'Charging every team the same notional fee for its icon is the fairest option, ' +
        'because it keeps purses equal regardless of which icon a team received. ' +
        'Charging nothing is simpler but advantages whoever got the strongest icon. ' +
        'Either way, decide before the auction and tell everyone.',
    },
    {
      question: 'What is a reasonable bid increment?',
      answer:
        'About 10% of the base price. Smaller increments make the auction drag; larger ' +
        'ones push mid-tier players past what anyone intended to pay.',
    },
    {
      question: 'What happens if two teams bid the same amount at the same time?',
      answer:
        'The auctioneer decides which bid came first, and that call is final. If they ' +
        'were genuinely simultaneous, invite one further increment from both teams, and ' +
        'settle with a coin toss if neither raises.',
    },
    {
      question: 'Can a team refuse a player it has won?',
      answer:
        'No. A winning bid is binding — that is what makes bidding meaningful. If a ' +
        'player later withdraws from the league themselves, refund the purchase to the ' +
        'team’s purse and let it sign a replacement at base price.',
    },
  ],
  cta: {
    heading: 'Put these rules into practice',
    body:
      'Squad sizes, purses, icon players and the reserve-per-slot rule are all settings ' +
      'on a league, so the rules you agree are the rules the auction enforces.',
    href: '/leagues/new',
    label: 'Create a cricket league',
  },
  related: [
    {
      href: '/resources/how-to-organize-cricket-auction',
      label: 'How to organize a cricket auction',
      description: 'The timeline and the running order for auction night.',
    },
    {
      href: '/tools/cricket-auction-budget-calculator',
      label: 'Cricket auction budget calculator',
      description:
        'Check your purse, base price and squad size work together before you publish them.',
    },
    {
      href: '/cricket-auction',
      label: 'How a cricket auction works',
      description: 'The format explained from scratch, if you are new to it.',
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function CricketAuctionRulesPage() {
  return <SeoPage content={CONTENT} />;
}
