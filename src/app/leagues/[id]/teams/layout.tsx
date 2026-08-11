import { NOINDEX_METADATA } from '@/lib/seo';

/**
 * The team screens require a session, so a crawler — which never carries one —
 * gets an empty client shell here while a logged-out visitor is redirected to
 * sign in. Marking them noindex keeps that shell out of the index instead of
 * letting it inherit `index: true` from the root layout.
 *
 * Left crawlable on purpose: `robots.txt` must not disallow these paths, or the
 * tag below would never be fetched and read. `/teams/[teamId]/reveal` inherits
 * this too, which is harmless — it is already disallowed as a full-screen view.
 */
export const metadata = NOINDEX_METADATA;

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
