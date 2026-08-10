import SeoPage, { seoPageMetadata, type SeoPageContent } from '@/components/seo/SeoPage';
import { SITE_NAME } from '@/lib/seo';

const CONTENT: SeoPageContent = {
  path: '/resources/how-to-organize-cricket-auction',
  title: 'How to Organize a Cricket Auction',
  metaDescription:
    'A run sheet for organizing a cricket player auction: timeline, team purses, ' +
    'base prices, icon players, the running order on the night, and what to do ' +
    'when it overruns.',
  breadcrumb: 'How to organize a cricket auction',
  kicker: 'Guide',
  h1: 'How to Organize a Cricket Auction',
  intro: [
    'This is the guide we wish existed the first time we ran one: a timeline working ' +
      'backwards from auction night, the numbers you have to decide, and the three ' +
      'things that go wrong every single time.',
    'It assumes an amateur league of roughly six to ten teams and forty to a hundred ' +
      'players. Scale the numbers, keep the order.',
  ],
  sections: [
    {
      heading: 'Three weeks out: fix the shape of the league',
      body: [
        'Decide the number of teams and the squad size before you take a single ' +
          'registration, because together they set the number of players you need. Eight ' +
          'teams of eleven is eighty-eight players; if you only have sixty registrations ' +
          'you are running six teams, and it is far easier to know that now than to ' +
          'explain it later.',
        'At the same time, find your team owners. Owners recruit players, so having them ' +
          'in place early is what fills the registration list.',
      ],
    },
    {
      heading: 'Two weeks out: open registration',
      body: [
        'Share a registration link and let players enter their own name, role, batting ' +
          'and bowling style, a photo and their stats. Doing this yourself from WhatsApp ' +
          'messages is the single largest time sink in organizing a league, and the data ' +
          'is worse.',
        'Chase the photos specifically. A player list with photos makes the auction feel ' +
          'like an event; a list of names feels like a meeting.',
      ],
    },
    {
      heading: 'One week out: set the money',
      body: [
        'Now decide the purse, the base price and the bid increment. These three numbers ' +
          'determine the character of the auction more than anything else you do.',
      ],
      points: [
        {
          term: 'Purse per team',
          description:
            'Keep it identical for every team unless you have a specific reason not to. ' +
            'A good rule of thumb: a purse of roughly 10–15× the base price, multiplied ' +
            'by the squad size, gives teams room for two or three expensive players ' +
            'while still filling the squad.',
        },
        {
          term: 'Base price',
          description:
            'The opening bid for every player. A single base price for everyone is ' +
            'simplest and works well. Tiered base prices (higher for stronger players) ' +
            'reduce bidding wars but need a selection committee, which needs a meeting.',
        },
        {
          term: 'Bid increment',
          description:
            'Roughly 10% of the base price. Too small and the auction takes four hours; ' +
            'too large and mid-tier players jump past what anyone wanted to pay.',
        },
        {
          term: 'Minimum reserve per slot',
          description:
            'The amount a team must keep back for each unfilled squad slot — normally ' +
            'the base price. This is what stops a team spending everything on stars and ' +
            'arriving at the last round unable to field a side.',
        },
      ],
    },
    {
      heading: 'Three days out: close registration and seed the icons',
      body: [
        'Close registration so the player list stops moving. Create the teams with their ' +
          'names, colours, purses and squad sizes.',
        'Then assign icon players — one marquee name pre-allocated to each team so every ' +
          'side starts with someone recognisable. Icon players skip the auction. Announce ' +
          'who they are before the night, not during it.',
      ],
    },
    {
      heading: 'The night before: rehearse the whole thing',
      body: [
        'Run the auction end to end on your own, quickly, with the real player list. You ' +
          'are not testing the software, you are testing yourself: where the controls are, ' +
          'how long a player takes, what you say when nobody bids.',
        `Then reset the auction. On ${SITE_NAME} a reset clears every sale and restores ` +
          'all team purses, so nothing from the rehearsal carries into the real auction.',
        'Also test the venue setup if you can: laptop, projector or TV, and the spectator ' +
          'screen open on the venue wifi. Discovering the HDMI adapter is missing at 7pm ' +
          'with forty people waiting is a specific kind of misery.',
      ],
    },
    {
      heading: 'On the night: the running order',
      body: [
        'A rhythm that works, and roughly how long each part takes for eighty players.',
      ],
      points: [
        {
          term: '1. Read the rules out loud (5 minutes)',
          description:
            'Purse, base price, increment, squad size, what happens to unsold players. ' +
            'Everyone has read them; read them anyway. It ends arguments before they ' +
            'start.',
        },
        {
          term: '2. Confirm the icon players (5 minutes)',
          description:
            'Show each team with its pre-assigned icon and its starting purse, so ' +
            'everyone can see the sides begin level.',
        },
        {
          term: '3. First round (60–90 minutes)',
          description:
            'Work through the player list. Call the player, show the card, take bids, ' +
            'record the sale. Keep moving — dead air between players is what makes an ' +
            'auction drag.',
        },
        {
          term: '4. Break (10 minutes)',
          description:
            'Right after the first round. Owners need it to recount their purse and ' +
            'work out what they still need.',
        },
        {
          term: '5. Unsold round (20–30 minutes)',
          description:
            'Bring unsold players back. Purses are depleted and squads have holes, so ' +
            'this is where the bargains are — and it is usually the most competitive ' +
            'part of the evening.',
        },
        {
          term: '6. Fill the gaps (10 minutes)',
          description:
            'Any team short of its squad size takes remaining players at base price. ' +
            'Agree the order beforehand — fewest players first is the fairest.',
        },
      ],
    },
    {
      heading: 'What goes wrong, every time',
      body: [
        'Three failure modes account for nearly every auction that runs badly.',
      ],
      points: [
        {
          term: 'It overruns',
          description:
            'Almost always because the first fifteen players took forty minutes while ' +
            'everyone found their nerve. Fix it by starting with two or three ' +
            'mid-tier players rather than the biggest name — the room warms up on ' +
            'players nobody is agonising over.',
        },
        {
          term: 'A team cannot fill its squad',
          description:
            'This is what the minimum reserve per slot prevents. If you are running ' +
            'without one, check every team’s remaining purse against its remaining ' +
            'slots at the break, not at the end.',
        },
        {
          term: 'Nobody can follow the purses',
          description:
            'If the only record is on the organizer’s laptop, the auction stops every ' +
            'few players for someone to ask a total. Put the spectator screen where ' +
            'everyone can see it and this disappears entirely.',
        },
      ],
    },
    {
      heading: 'Afterwards, the same evening',
      body: [
        'Momentum is worth more than polish. Before people leave, share the recap and the ' +
          'squad sheets — a PDF per team into the group chat takes a minute and is the ' +
          'thing everyone forwards.',
        'Then generate the fixtures while the enthusiasm is still there, so the first ' +
          'match has a date before anyone has gone home.',
      ],
    },
  ],
  faqs: [
    {
      question: 'How long does a cricket auction take?',
      answer:
        'Budget one to two minutes per player once the room is warmed up, plus about ' +
        'twenty minutes of setup and a thirty-minute unsold round. Eighty players ' +
        'typically runs a little over two hours including a break.',
    },
    {
      question: 'How much should each team’s purse be?',
      answer:
        'A workable rule of thumb is 10–15 times the base price, multiplied by the ' +
        'squad size. That leaves room for two or three genuinely expensive players ' +
        'while still filling the rest of the squad near the base price. The exact ' +
        'figure matters less than making it the same for every team.',
    },
    {
      question: 'Should every player have the same base price?',
      answer:
        'For a first auction, yes — a single base price is simpler to explain and ' +
        'removes any argument about who was graded where. Tiered base prices work ' +
        'well but require a selection committee to rank players in advance.',
    },
    {
      question: 'How many icon players should each team get?',
      answer:
        'One is standard. The purpose is to make sure no side starts with an empty ' +
        'squad sheet, not to distribute half the talent before bidding opens.',
    },
    {
      question: 'What if a team runs out of money before filling its squad?',
      answer:
        'Set a minimum reserve per unfilled slot — usually the base price — so a ' +
        'team’s maximum bid is capped at whatever it can spend while still affording ' +
        'the rest of its squad. With that rule in place the situation cannot occur.',
    },
    {
      question: 'Do I need to be in the same room as the team owners?',
      answer:
        'No. Owners can join a call and watch the public spectator screen on their own ' +
        'devices, bidding out loud exactly as they would in person. Agree in advance ' +
        'whether remote owners bid live or nominate a proxy with written limits.',
    },
  ],
  cta: {
    heading: 'Set your auction up',
    body:
      'Create the league, add your teams and purses, and rehearse tonight. Reset it ' +
      'afterwards and the real auction starts clean.',
    href: '/leagues/new',
    label: 'Create a league free',
  },
  related: [
    {
      href: '/resources/cricket-auction-rules',
      label: 'Cricket auction rules template',
      description: 'The rules from this guide, written out so you can send them to owners.',
    },
    {
      href: '/tools/cricket-auction-budget-calculator',
      label: 'Cricket auction budget calculator',
      description:
        'Enter your purse, squad size and base price and check the arithmetic holds.',
    },
    {
      href: '/online-cricket-auction',
      label: 'Run your auction online',
      description: 'The two-screen setup, and how to include owners who cannot attend.',
    },
    {
      href: '/tools/cricket-fixture-generator',
      label: 'Generate fixtures after the auction',
      description: 'A round-robin schedule for your new squads.',
    },
  ],
};

export const metadata = seoPageMetadata(CONTENT);

export default function HowToOrganizeCricketAuctionPage() {
  return <SeoPage content={CONTENT} />;
}
