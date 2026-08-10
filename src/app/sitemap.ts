import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getPublicLeagues } from '@/lib/store';
import type { League } from '@/lib/types';

// Served per-request: public league entries come from the database, which
// isn't reachable at build time. Static entries carry no lastModified —
// stamping "now" on every request teaches crawlers to ignore it.
export const dynamic = 'force-dynamic';

/**
 * Priorities are relative to each other, not absolute quality scores. Only the
 * home page gets 1.0; the keyword landing pages sit just below it because they
 * are the pages meant to win search traffic, and the legal pages sit at the
 * bottom because ranking them would be a waste of crawl budget.
 *
 * Everything private or management-only is deliberately absent — see robots.ts
 * for the matching disallow rules, and note that neither file is a substitute
 * for the auth checks in the API routes.
 */
const STATIC_ENTRIES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },

  // Search-intent landing pages.
  { url: `${SITE_URL}/cricket-auction`, changeFrequency: 'monthly', priority: 0.9 },
  { url: `${SITE_URL}/cricket-auction-platform`, changeFrequency: 'monthly', priority: 0.9 },
  { url: `${SITE_URL}/online-cricket-auction`, changeFrequency: 'monthly', priority: 0.9 },
  { url: `${SITE_URL}/cricket-league-management`, changeFrequency: 'monthly', priority: 0.9 },
  { url: `${SITE_URL}/cricket-tournament-management`, changeFrequency: 'monthly', priority: 0.9 },

  // Product pages.
  { url: `${SITE_URL}/features`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.8 },

  // Free tools — the pages most likely to earn links from organizers.
  { url: `${SITE_URL}/tools/cricket-auction-budget-calculator`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/tools/cricket-fixture-generator`, changeFrequency: 'monthly', priority: 0.8 },

  // Guides.
  { url: `${SITE_URL}/resources`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE_URL}/resources/how-to-organize-cricket-auction`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/resources/cricket-auction-rules`, changeFrequency: 'monthly', priority: 0.7 },

  // Live, database-backed directories.
  { url: `${SITE_URL}/leagues/discover`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.6 },

  { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public leagues are indexable and server-rendered (see leagues/[id]/page.tsx);
  // private and management pages stay out of the sitemap and are noindexed or
  // disallowed.
  let publicLeagues: League[] = [];
  try {
    publicLeagues = await getPublicLeagues(200);
  } catch {
    // Database hiccup — serve the static entries rather than a 500.
  }

  return [
    ...STATIC_ENTRIES,
    ...publicLeagues.map((league) => ({
      url: `${SITE_URL}/leagues/${league.id}`,
      lastModified: new Date(league.createdAt),
      changeFrequency: 'daily' as const,
      priority: 0.5,
    })),
  ];
}
