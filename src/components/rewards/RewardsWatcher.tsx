'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { bindRewardsUser, checkInRewards } from './rewardsStore';

/**
 * Sends the rewards check-in for a signed-in user: on arrival, on navigation
 * and when the tab comes back into view, each throttled by the store. Rendered
 * by the nav bar, so it never mounts on the immersive screens — `/watch` in
 * particular, which a whole hall opens at once.
 */
export default function RewardsWatcher({ userId }: { userId: string }) {
  const pathname = usePathname();

  // Declared first so the store knows the account before the first check-in
  useEffect(() => {
    bindRewardsUser(userId);
  }, [userId]);

  useEffect(() => {
    checkInRewards();
  }, [userId, pathname]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') checkInRewards();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
