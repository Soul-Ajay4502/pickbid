import type { Metadata } from 'next';
import { getLeague } from '@/lib/store';
import { SITE_NAME } from '@/lib/seo';

// Titles, descriptions and indexing rules for every /leagues/[id]/* page.
// Public leagues are indexable and canonicalise to the league home; private
// leagues keep working via share links but are marked noindex.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  let league = null;
  try {
    league = await getLeague(id);
  } catch {
    // Database hiccup — fall through to the noindex fallback below.
  }
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

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
