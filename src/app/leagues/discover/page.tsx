import { getPublicLeagues } from '@/lib/store';
import { SITE_NAME, buildPageMetadata } from '@/lib/seo';
import { JsonLd, webPageSchema, breadcrumbSchema, itemListSchema } from '@/lib/jsonLd';
import type { League } from '@/lib/types';
import DiscoverClient from './DiscoverClient';

// Prerendered and regenerated every 5 minutes rather than rendered per-request.
// The list is identical for every visitor, and rendering it on demand meant each
// visit paid a cold serverless start plus a database round-trip — measured at
// ~4.4s from a cold edge. Five minutes is well inside how often a crawler or a
// visitor needs the directory to be accurate.
export const revalidate = 300;

const PAGE_PATH = '/leagues/discover';
const PAGE_TITLE = 'Discover Leagues';
const PAGE_DESCRIPTION =
  'Browse public cricket leagues or join one with a code — premium player ' +
  'cards, live auctions and leaderboards, all on Player Hunt.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
});

export default async function DiscoverPage() {
  let leagues: League[] = [];
  try {
    leagues = await getPublicLeagues(50);
  } catch {
    // Database hiccup — render the page shell; join-by-code still works.
  }

  // Tell search engines this page is a list of the public leagues on the site.
  // League names are user-supplied, so this goes through the escaping serializer
  // in `JsonLd` rather than a raw JSON.stringify.
  const schemas = [
    webPageSchema({
      path: PAGE_PATH,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
    }),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: PAGE_TITLE, path: PAGE_PATH },
    ]),
    itemListSchema({
      name: `Public cricket leagues on ${SITE_NAME}`,
      items: leagues.map((league) => ({
        name: league.name,
        path: `/leagues/${league.id}`,
      })),
    }),
  ];

  return (
    <>
      <JsonLd data={schemas} />
      <DiscoverClient initialLeagues={leagues} />
    </>
  );
}
