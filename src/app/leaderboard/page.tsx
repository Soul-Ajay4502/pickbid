import { getTopBids } from '@/lib/store';
import { buildPageMetadata } from '@/lib/seo';
import { JsonLd, webPageSchema, breadcrumbSchema } from '@/lib/jsonLd';
import type { TopBid } from '@/lib/types';
import LeaderboardClient from './LeaderboardClient';

// The board reflects sales as they happen and the database isn't reachable
// at build time — render per-request.
export const dynamic = 'force-dynamic';

const PAGE_PATH = '/leaderboard';
const PAGE_TITLE = 'Global Leaderboard';
const PAGE_DESCRIPTION =
  'The top 20 winning bids across every cricket league on Player Hunt — the ' +
  'biggest auction buys, their teams and their leagues, updated live.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
});

export default async function GlobalLeaderboardPage() {
  let bids: TopBid[] = [];
  try {
    bids = await getTopBids(20);
  } catch {
    // Database hiccup — render the empty state rather than a 500.
  }
  return (
    <>
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
      <LeaderboardClient initialBids={bids} />
    </>
  );
}
