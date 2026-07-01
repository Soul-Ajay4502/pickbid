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

  return 'https://player-card-generator.vercel.app';
}

export const SITE_URL = resolveSiteUrl();

/** Display name used in title templates, OG site name and structured data. */
export const SITE_NAME = 'Pickbid';

/** Default <title> shown on the home page and as the template fallback. */
export const SITE_TITLE = 'Pickbid — Run cricket leagues like a pro';

/** Suffix appended to inner-page titles, e.g. "Discover · Pickbid". */
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`;

export const SITE_DESCRIPTION =
  'Design premium cricket player cards, host real-time auctions, track live ' +
  'leaderboards and share it all with a single link — beautifully, in one place. ' +
  'Free to start, no app to install.';

/** Shorter description for OG/Twitter cards where space is tight. */
export const SHORT_DESCRIPTION =
  'Premium player cards, live auctions and leaderboards for your cricket league — shared with one link.';

export const SITE_KEYWORDS = [
  'cricket league manager',
  'cricket player cards',
  'player card maker',
  'cricket auction',
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

export const TWITTER_HANDLE = '@cricketcards';

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
