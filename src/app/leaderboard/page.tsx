import type { Metadata } from 'next';
import { getTopBids } from '@/lib/store';
import { SITE_NAME } from '@/lib/seo';
import type { TopBid } from '@/lib/types';
import LeaderboardClient from './LeaderboardClient';

// The board reflects sales as they happen and the database isn't reachable
// at build time — render per-request.
export const dynamic = 'force-dynamic';

const PAGE_TITLE = 'Global Leaderboard';
const PAGE_DESCRIPTION =
  'The top 20 winning bids across every cricket league on Pickbid — the ' +
  'biggest auction buys, their teams and their leagues, updated live.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: '/leaderboard',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} · ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: '/leaderboard',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} · ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

export default async function GlobalLeaderboardPage() {
  let bids: TopBid[] = [];
  try {
    bids = await getTopBids(20);
  } catch {
    // Database hiccup — render the empty state rather than a 500.
  }
  return <LeaderboardClient initialBids={bids} />;
}
