import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/seo';

const PAGE_TITLE = 'About';
const PAGE_DESCRIPTION =
  'Pickbid is the all-in-one platform for local cricket leagues — premium ' +
  'player cards, real-time auctions, live leaderboards and one-link sharing. ' +
  'Built for box cricket, tape ball and gully cricket communities.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} · ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: '/about',
    locale: 'en_US',
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-6">About Pickbid</h1>

      <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
        <p>
          Pickbid brings the thrill of a professional cricket auction to local leagues.
          Whether you run a box cricket tournament, a tape ball league or a weekend
          gully cricket series, Pickbid gives your league the same premium experience
          the big leagues get — without spreadsheets, WhatsApp chaos or paper chits.
        </p>

        <h2 className="text-lg font-bold text-foreground pt-2">What you can do with Pickbid</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Premium player cards</strong> — design
            IPL-style player cards with photos, roles and stats for every player in
            your league.
          </li>
          <li>
            <strong className="text-foreground">Live auctions</strong> — run a
            real-time auction where team owners bid for players, with budgets,
            icon players and a public watch screen for the crowd.
          </li>
          <li>
            <strong className="text-foreground">Leaderboards and squads</strong> —
            track the biggest bids, browse team squads and export PDF squad sheets
            you can share on WhatsApp with one tap.
          </li>
          <li>
            <strong className="text-foreground">One-link sharing</strong> — every
            league gets a link; make it public and anyone can find it on the{' '}
            <Link href="/leagues/discover" className="text-primary hover:underline underline-offset-2">
              Discover page
            </Link>{' '}
            or join with a code.
          </li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-2">Free to start</h2>
        <p>
          Pickbid is free to use — create a league, add players and run your auction
          in minutes from any modern browser. There is no app to install.
        </p>

        <p className="pt-2">
          See the biggest auction buys across all leagues on the{' '}
          <Link href="/leaderboard" className="text-primary hover:underline underline-offset-2">
            Global Leaderboard
          </Link>
          , or{' '}
          <Link href="/" className="text-primary hover:underline underline-offset-2">
            create your first league
          </Link>{' '}
          today.
        </p>
      </div>
    </div>
  );
}
