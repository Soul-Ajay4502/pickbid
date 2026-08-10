import type { Metadata } from 'next';
import { cache } from 'react';
import { getLeague } from '@/lib/store';
import { SITE_NAME } from '@/lib/seo';
import { JsonLd, breadcrumbSchema } from '@/lib/jsonLd';
import type { League } from '@/lib/types';

// One DB hit per request, shared between generateMetadata and the layout body.
const loadLeague = cache(async (id: string): Promise<League | null> => {
  try {
    return await getLeague(id);
  } catch {
    return null;
  }
});

/**
 * Titles, descriptions and indexing rules for every /leagues/[id]/* page.
 *
 * Public leagues are indexable and canonicalise to the league home. Applying the
 * canonical at the layout means the sub-routes (teams, matches, watch, …) all
 * point at the league page — which is what we want: they're client-only screens
 * with no standalone content, so consolidating their signals onto the one page
 * that *does* have content is the right outcome. They can't set their own
 * metadata anyway, being client components.
 *
 * Private leagues keep working via share links but are marked noindex.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const league = await loadLeague(id);
  if (!league) {
    return { robots: { index: false, follow: false } };
  }

  const title = `${league.name} — Cricket League`;
  const description =
    `${league.name} cricket league${league.conductedBy ? ` by ${league.conductedBy}` : ''} — ` +
    `teams, players, auction results, fixtures, results and points table powered by ${SITE_NAME}.`;

  return {
    title,
    description,
    ...(league.isPublic
      ? { alternates: { canonical: `/leagues/${league.id}` } }
      : { robots: { index: false, follow: false } }),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${league.name} · ${SITE_NAME}`,
      description,
      url: `/leagues/${league.id}`,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${league.name} · ${SITE_NAME}`,
      description,
    },
  };
}

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const league = await loadLeague(id);

  return (
    <>
      {/* Breadcrumb trail for search results — only for leagues that are indexable. */}
      {league?.isPublic && (
        <JsonLd
          data={breadcrumbSchema([
            { name: SITE_NAME, path: '/' },
            { name: 'Discover Leagues', path: '/leagues/discover' },
            { name: league.name, path: `/leagues/${league.id}` },
          ])}
        />
      )}
      {children}
    </>
  );
}
