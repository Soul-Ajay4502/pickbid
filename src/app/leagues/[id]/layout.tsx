import type { Metadata } from 'next';
import { cache } from 'react';
import { getLeague } from '@/lib/store';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import type { League } from '@/lib/types';

// One DB hit per request, shared between generateMetadata and the layout body.
const loadLeague = cache(async (id: string): Promise<League | null> => {
  try {
    return await getLeague(id);
  } catch {
    return null;
  }
});

// Titles, descriptions and indexing rules for every /leagues/[id]/* page.
// Public leagues are indexable and canonicalise to the league home; private
// leagues keep working via share links but are marked noindex.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const league = await loadLeague(id);
  if (!league) {
    return { robots: { index: false, follow: false } };
  }

  const title = league.name;
  const description =
    `${league.name} — a cricket league by ${league.conductedBy} on ${SITE_NAME}. ` +
    `${league.totalPlayers} players, premium player cards, live auction, squads and leaderboard.`;

  return {
    title,
    description,
    ...(league.isPublic
      ? { alternates: { canonical: `/leagues/${league.id}` } }
      : { robots: { index: false, follow: false } }),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description,
      url: `/leagues/${league.id}`,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
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

  // Breadcrumb trail for search results — only for leagues that are indexable.
  const breadcrumbs = league?.isPublic
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Discover Leagues', item: `${SITE_URL}/leagues/discover` },
          { '@type': 'ListItem', position: 3, name: league.name, item: `${SITE_URL}/leagues/${league.id}` },
        ],
      }
    : null;

  return (
    <>
      {breadcrumbs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
        />
      )}
      {children}
    </>
  );
}
