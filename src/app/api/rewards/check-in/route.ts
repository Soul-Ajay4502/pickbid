import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkInRewards } from '@/lib/rewards';

/**
 * POST /api/rewards/check-in — count this week towards the signed-in user's
 * streak, award any badge tiers they've newly earned, and return the summary
 * the app shell shows (nav streak chip, unlock toast, dashboard strip).
 *
 * A POST because it writes, even though repeating it is harmless: a second call
 * in the same week changes nothing and unlocks nothing. Scoped to the session
 * user by construction — there is no id to tamper with. `RewardsWatcher` sends
 * it at most every few minutes per tab, and never from the immersive screens a
 * whole hall loads at once.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const result = await checkInRewards(session.user.id);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error checking in rewards:', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
