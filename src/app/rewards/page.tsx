import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getRewardsOverview } from '@/lib/rewards';
import RewardsClient from './RewardsClient';

export const metadata: Metadata = {
  title: 'Rewards',
  robots: { index: false, follow: false },
};

/**
 * The trophy cabinet — server-rendered with its data, so badges and the streak
 * calendar are in the HTML rather than arriving after hydration.
 *
 * Rendering evaluates: it counts the visit towards the streak and awards
 * anything newly earned, then celebrates whatever that award returned. The
 * sibling `loading.tsx` is what keeps a `<Link>` prefetch from doing the same —
 * a dynamic route is only prefetched down to its loading boundary, so the
 * evaluation (and its one-time "just unlocked" set) runs on a real visit only.
 */
export default async function RewardsPage() {
  const session = await auth();
  // The proxy already bounced signed-out visitors; a stale cookie lands here
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Frewards');

  const overview = await getRewardsOverview(session.user.id);
  return <RewardsClient userId={session.user.id} overview={overview} />;
}
