import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getPublicLeagues } from '@/lib/store';
import type { League } from '@/lib/types';

// Served per-request: public league entries come from the database, which
// isn't reachable at build time. Static entries carry no lastModified —
// stamping "now" on every request teaches crawlers to ignore it.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/leagues/discover`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];

  // Public leagues are indexable (see leagues/[id]/layout.tsx); private and
  // management pages stay out of the sitemap and are noindexed or disallowed.
  let publicLeagues: League[] = [];
  try {
    publicLeagues = await getPublicLeagues(50);
  } catch {
    // Database hiccup — serve the static entries rather than a 500.
  }

  return [
    ...staticEntries,
    ...publicLeagues.map((league) => ({
      url: `${SITE_URL}/leagues/${league.id}`,
      lastModified: new Date(league.createdAt),
      changeFrequency: 'daily' as const,
      priority: 0.5,
    })),
  ];
}
