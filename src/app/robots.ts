import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Crawl rules. These keep private and management screens out of the index and
 * out of the crawl budget — they are *not* an access control. Authorization is
 * enforced by `auth()` in every API route and by `leagueAuth.ts`; this file only
 * tells well-behaved crawlers not to bother.
 *
 * Paths are checked against the real route structure in `src/app`, so each entry
 * below corresponds to a page that actually exists.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',

        // Signed-in-only screens. Crawlers never carry a session cookie, so `/`
        // always serves them the static landing page rather than the dashboard
        // it is rewritten to for members.
        '/dashboard',
        '/profile',
        '/login',

        // League creation and management.
        '/leagues/new',
        '/leagues/*/clone',
        '/leagues/*/players/new',
        '/leagues/*/players/*/edit',
        '/leagues/*/auction',
        '/leagues/*/analytics',
        '/leagues/*/sponsors/manage',

        // The income & expense sheet is members-only even for a public league.
        '/leagues/*/ledger',

        // Full-screen event views: no standalone content, and they canonicalise
        // to the league page, which is the one worth indexing.
        '/leagues/*/watch',
        '/leagues/*/wrapped',
        '/leagues/*/teams/*/reveal',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
