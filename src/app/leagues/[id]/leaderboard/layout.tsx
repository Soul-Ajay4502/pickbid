import { NOINDEX_METADATA } from '@/lib/seo';

/**
 * Session-gated, so crawlers only ever see an empty client shell — noindex
 * rather than letting it inherit `index: true`. The public `/leaderboard` is the
 * indexable board; this one is the per-league view for members. See the note in
 * `../teams/layout.tsx` on why this is not a `robots.txt` disallow.
 */
export const metadata = NOINDEX_METADATA;

export default function LeagueLeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
