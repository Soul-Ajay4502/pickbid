import Link from 'next/link';
import { CreditCard, Gavel, Tv, Users, Share2 } from 'lucide-react';
import { SITE_NAME, buildPageMetadata } from '@/lib/seo';
import { JsonLd, webPageSchema, breadcrumbSchema } from '@/lib/jsonLd';

const PAGE_PATH = '/features';
const PAGE_TITLE = 'Features';
const PAGE_DESCRIPTION =
  'Everything Pickbid does: premium cricket player cards, real-time auctions, ' +
  'public watch mode, leaderboards, squad and match management, PDF squad ' +
  'sheets and one-link sharing — free, in any browser.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
});

type Section = {
  icon: React.ComponentType<{ className?: string }>;
  heading: string;
  intro: string;
  items: { title: string; body: string }[];
};

const SECTIONS: Section[] = [
  {
    icon: CreditCard,
    heading: 'Player cards',
    intro:
      'The part everyone screenshots. A photo and a few numbers become a card that looks like it came off a broadcast.',
    items: [
      {
        title: 'Premium card designs',
        body:
          'Upload a photo, set a role and add stats and ratings — the card is composed for you, no design work needed.',
      },
      {
        title: '12 colour templates',
        body:
          'Pick a template per league so every card in your tournament shares one look.',
      },
      {
        title: 'Players can build their own',
        body:
          'Send players a link and they fill in their own card without needing an account. Organizers stay in control of the final roster.',
      },
    ],
  },
  {
    icon: Gavel,
    heading: 'Live auctions',
    intro:
      'An IPL-style auction you can actually run in a hall, with the crowd watching the same screen you are.',
    items: [
      {
        title: 'Real-time bidding',
        body:
          'Move through players one at a time while the current bid, the bidding team and the remaining purse update live.',
      },
      {
        title: 'Team budgets and purses',
        body:
          'Give every team a budget and watch it draw down as they buy. Overspending is impossible by construction.',
      },
      {
        title: 'Icon players',
        body:
          'Pre-assign marquee players to teams before bidding opens, the way real leagues seed their squads.',
      },
      {
        title: 'Reset and re-run',
        body:
          'Undo an auction and start again — useful for a practice run the night before.',
      },
    ],
  },
  {
    icon: Tv,
    heading: 'For the crowd',
    intro:
      'Everything a spectator sees is a plain link. No app, no account, no install.',
    items: [
      {
        title: 'Public watch screen',
        body:
          'A full-screen spectator view that mirrors the auction as it happens — put it on a projector or share the link.',
      },
      {
        title: 'Auction Wrapped',
        body:
          'A shareable recap of the auction once it is done: the biggest buys, the bargains and the headline numbers.',
      },
      {
        title: 'Squad reveals',
        body:
          'Holographic pack-opening reveals for each team roster, built for sharing after the auction.',
      },
      {
        title: 'Sponsor marquee',
        body:
          'A rotating 3D sponsor board you can display on a second screen during the event.',
      },
    ],
  },
  {
    icon: Users,
    heading: 'Running the league',
    intro:
      'The unglamorous parts that usually live in a spreadsheet and a WhatsApp thread.',
    items: [
      {
        title: 'Teams, squads and officials',
        body:
          'Manage rosters, captains and team officials, and see each squad as it fills out.',
      },
      {
        title: 'Leaderboards',
        body:
          'Biggest buys within your league, plus a global leaderboard across every public league on the platform.',
      },
      {
        title: 'Matches and results',
        body:
          'Record fixtures, scores and winners so the league table keeps itself up to date.',
      },
      {
        title: 'League ledger',
        body:
          'An optional income and expense sheet for organizers, with drafts kept private until you publish.',
      },
      {
        title: 'Clone a league',
        body:
          'Duplicate last season’s setup instead of rebuilding it from scratch.',
      },
    ],
  },
  {
    icon: Share2,
    heading: 'Sharing and discovery',
    intro:
      'One link carries the whole league — that is the point of the product.',
    items: [
      {
        title: 'PDF squad sheets',
        body:
          'Export a formatted squad sheet and send it to the group chat in one tap.',
      },
      {
        title: 'Join by code',
        body:
          'Make a league public and hand out a short code for people to join.',
      },
      {
        title: 'Public league directory',
        body:
          'Public leagues are listed on the discover page so players can find yours.',
      },
      {
        title: 'Link previews that look right',
        body:
          'Every league link generates its own preview card, so shares in WhatsApp and Slack show the league, not a generic logo.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <JsonLd
        data={[
          webPageSchema({
            path: PAGE_PATH,
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: PAGE_TITLE, path: PAGE_PATH },
          ]),
        ]}
      />

      <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-3">
        Features
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-12 max-w-2xl">
        {SITE_NAME} covers a cricket league from the first player card to the
        post-auction recap. Everything below is included free — see{' '}
        <Link href="/pricing" className="text-primary hover:underline underline-offset-2">
          pricing
        </Link>
        .
      </p>

      <div className="space-y-12">
        {SECTIONS.map(({ icon: Icon, heading, intro, items }) => (
          <section key={heading}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/60 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{heading}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{intro}</p>

            <dl className="space-y-4 border-l border-border/60 pl-5">
              {items.map((item) => (
                <div key={item.title}>
                  <dt className="text-sm font-semibold text-foreground">{item.title}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-14 pt-8 border-t border-border/50">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ready to try it?{' '}
          <Link href="/leagues/new" className="text-primary hover:underline underline-offset-2">
            Create a league
          </Link>{' '}
          in a couple of minutes, or look at{' '}
          <Link href="/leagues/discover" className="text-primary hover:underline underline-offset-2">
            public leagues
          </Link>{' '}
          already running to see how it comes together.
        </p>
      </div>
    </div>
  );
}
