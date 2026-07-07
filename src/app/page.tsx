import type { Metadata } from 'next';
import { auth } from '@/auth';
import Landing from '@/components/landing/Landing';
import HomeDashboard from '@/components/HomeDashboard';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default async function HomePage() {
  // Deciding between landing and dashboard on the server means signed-out
  // visitors — crawlers included — get the full marketing page as HTML
  // instead of a session-loading skeleton.
  const session = await auth();
  return session?.user ? <HomeDashboard /> : <Landing />;
}
