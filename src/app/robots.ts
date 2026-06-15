import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep API and private/management routes out of the index. Public
      // marketing and discovery pages stay crawlable.
      disallow: [
        '/api/',
        '/profile',
        '/leagues/new',
        '/leagues/*/edit',
        '/leagues/*/players/new',
        '/leagues/*/players/*/edit',
        '/leagues/*/auction',
        '/leagues/*/analytics',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
