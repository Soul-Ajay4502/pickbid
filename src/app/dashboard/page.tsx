import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import HomeDashboard from '@/components/HomeDashboard';

/**
 * The signed-in home screen. Visitors reach this through a rewrite from `/` in
 * `proxy.ts`, so the URL in their address bar stays `/` — this route exists so
 * that the session read lives here instead of on `/`, which lets the landing
 * page prerender to static HTML and be served from the CDN.
 */

export const metadata: Metadata = {
  title: 'Your Leagues',
  // Private, and a duplicate of `/` as far as a crawler is concerned.
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await auth();

  // The proxy rewrites here on the mere *presence* of a session cookie, which a
  // stale or expired cookie also satisfies. Re-check for a real session and
  // send those visitors back through sign-in, landing them on `/` afterwards.
  if (!session?.user) redirect('/login?callbackUrl=%2F');

  return <HomeDashboard />;
}
