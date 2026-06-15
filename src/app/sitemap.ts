import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Only stable, public, content-bearing pages belong here. Individual leagues
// live behind sign-in / share links and render client-side, so they're left
// out to avoid listing thin or gated URLs.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/leagues/discover`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];
}
