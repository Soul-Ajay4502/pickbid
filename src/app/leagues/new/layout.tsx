import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

/**
 * The create-league form is a client component, so it cannot export metadata and
 * was falling back to the site-wide default title — despite being linked from
 * the footer on every page. It stays disallowed in `robots.txt` (it is a
 * signed-in form, not content); this supplies the title and an explicit noindex.
 */
export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Create a League',
  description:
    'Set up a new cricket league on Pickbid — name it, set the team budget and squad rules.',
};

export default function NewLeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
