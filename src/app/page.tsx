import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { auth } from '@/auth';
import { getPlatformStats } from '@/lib/store';
import Landing from '@/components/landing/Landing';
import HomeDashboard from '@/components/HomeDashboard';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

// Platform-wide counts change slowly; one cached query an hour keeps the
// landing page from hitting the database on every anonymous visit.
const getCachedPlatformStats = unstable_cache(getPlatformStats, ['platform-stats'], {
  revalidate: 3600,
});

export default async function HomePage() {
  // Deciding between landing and dashboard on the server means signed-out
  // visitors — crawlers included — get the full marketing page as HTML
  // instead of a session-loading skeleton.
  const session = await auth();
  if (session?.user) return <HomeDashboard />;

  // The stats strip is decorative — never let it take the landing page down.
  const stats = await getCachedPlatformStats().catch(() => null);
  return <Landing stats={stats} />;
}
