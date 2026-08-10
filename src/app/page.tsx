import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getPlatformStats } from '@/lib/store';
import Landing from '@/components/landing/Landing';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

// This page reads no session, cookies or request headers, so it prerenders to
// static HTML and is served from the CDN — crawlers and first-time visitors get
// the full marketing page with no server render in the way. Signed-in visitors
// are rewritten to /dashboard by `proxy.ts`, which is what used to force this
// route to render dynamically for *everyone*.
//
// Regenerating every 10 minutes keeps the stats strip current without pinning
// the page to a database round-trip on each request.
export const revalidate = 600;

// Platform-wide counts change slowly; one cached query an hour keeps
// regenerations cheap even if the revalidation window shortens.
const getCachedPlatformStats = unstable_cache(getPlatformStats, ['platform-stats'], {
  revalidate: 3600,
});

export default async function HomePage() {
  // The stats strip is decorative — never let it take the landing page down.
  // `Landing` hides the strip entirely when stats are missing, so a failed
  // query costs a section rather than the page.
  const stats = await getCachedPlatformStats().catch(() => null);
  return <Landing stats={stats} />;
}
