import { NOINDEX_METADATA } from '@/lib/seo';

/**
 * Session-gated like the league's bid leaderboard, so crawlers only ever see an
 * empty client shell — noindex rather than letting it inherit `index: true`.
 * See the note in `../teams/layout.tsx` on why this is not a `robots.txt`
 * disallow.
 */
export const metadata = NOINDEX_METADATA;

export default function LeagueStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
