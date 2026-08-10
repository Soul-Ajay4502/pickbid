/**
 * Central SEO configuration — single source of truth for metadata, OG images,
 * the sitemap and robots rules. Import from here everywhere so the canonical
 * site URL and brand copy never drift between files.
 *
 * The site URL is resolved in priority order:
 *   1. NEXT_PUBLIC_SITE_URL          — set this if you move to a custom domain
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel sets this automatically on prod
 *   3. the known production alias     — safe hard-coded fallback
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return 'https://pickbid.vercel.app';
}

export const SITE_URL = resolveSiteUrl();

/** Display name used in title templates, OG site name and structured data. */
export const SITE_NAME = 'Pickbid';

/**
 * Default <title> shown on the home page and as the template fallback.
 * Leads with what the product *is* rather than the brand tagline — "cricket
 * auction" and "league management" are the two phrases organizers actually
 * search for, and the home page is the one that has to rank for them.
 */
export const SITE_TITLE = `${SITE_NAME} — Cricket Auction & League Management Platform`;

/** Suffix appended to inner-page titles, e.g. "Discover · Pickbid". */
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`;

export const SITE_DESCRIPTION =
  `${SITE_NAME} is a cricket auction and league management platform for ` +
  'organizing player auctions, teams, squads, fixtures, results and ' +
  'tournaments. Free to start, no app to install.';

/** Shorter description for OG/Twitter cards where space is tight. */
export const SHORT_DESCRIPTION =
  'Premium player cards, live auctions and leaderboards for your cricket league — shared with one link.';

export const SITE_KEYWORDS = [
  'cricket auction',
  'cricket auction platform',
  'online cricket auction',
  'cricket league management',
  'cricket tournament management',
  'cricket league manager',
  'cricket player cards',
  'player card maker',
  'IPL style auction',
  'cricket auction software',
  'live cricket auction',
  'cricket tournament organizer',
  'cricket team management',
  'squad builder',
  'cricket leaderboard',
  'fantasy cricket auction',
  'box cricket league',
  'gully cricket',
  'tape ball cricket',
  'cricket squad poster',
];

export const AUTHOR = { name: 'Pickbid', url: SITE_URL };

/** Brand colours, reused by OG images, icons, the manifest and the theme tag. */
export const BRAND = {
  bg: '#0a0b10',
  green: '#22c55e',
  emerald: '#10b981',
  emeraldDark: '#059669',
  teal: '#0d9488',
  cyan: '#38bdf8',
  ball: '#c8102e',
} as const;

/** Bare host (no scheme) — handy for OG footers and verification copy. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

/**
 * Builds the metadata block every indexable page needs, so a page only has to
 * state its own title, description and path. Keeps the canonical URL, the OG
 * `url` and the Twitter card in step — the three that silently drift when each
 * page hand-rolls them.
 *
 * `path` must be a root-relative, canonical path with no query string and no
 * trailing slash (e.g. `/cricket-auction`). Query parameters are deliberately
 * dropped: filtered/paginated variants of a page all canonicalise to the clean
 * URL, which is what keeps duplicates out of the index. Relative paths are
 * resolved against `metadataBase` by Next, so they always come out absolute and
 * pointing at production.
 */
export function buildPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const fullTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website' as const,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: fullTitle,
      description,
    },
  };
}
