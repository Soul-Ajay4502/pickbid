import type { Metadata } from 'next';
import { getPublicLeagues } from '@/lib/store';
import { SITE_NAME } from '@/lib/seo';
import type { League } from '@/lib/types';
import DiscoverClient from './DiscoverClient';

// The league list comes from the database, which isn't reachable at build
// time and should be fresh on every crawl — render per-request.
export const dynamic = 'force-dynamic';

const PAGE_TITLE = 'Discover Leagues';
const PAGE_DESCRIPTION =
  'Browse public cricket leagues or join one with a code — premium player ' +
  'cards, live auctions and leaderboards, all on Pickbid.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: '/leagues/discover',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} · ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: '/leagues/discover',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} · ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

export default async function DiscoverPage() {
  let leagues: League[] = [];
  try {
    leagues = await getPublicLeagues(50);
  } catch {
    // Database hiccup — render the page shell; join-by-code still works.
  }
  return <DiscoverClient initialLeagues={leagues} />;
}
