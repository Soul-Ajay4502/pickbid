import { NOINDEX_METADATA } from '@/lib/seo';

/**
 * Session-gated, so crawlers only ever see an empty client shell — noindex
 * rather than letting it inherit `index: true`. The league's fixtures and
 * results are already rendered publicly on the league page itself, which is the
 * URL worth indexing. See the note in `../teams/layout.tsx` on why this is not
 * a `robots.txt` disallow.
 */
export const metadata = NOINDEX_METADATA;

export default function MatchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
