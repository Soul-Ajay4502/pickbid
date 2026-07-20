'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import SponsorsMarquee3D from '@/components/SponsorsMarquee3D';
import type { Sponsor } from '@/lib/types';

export default function SponsorsMarqueePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);

  const fetchData = useCallback(async () => {
    const leagueRes = await fetch(`/api/leagues/${id}`);
    if (!leagueRes.ok) { router.push('/'); return; }
    const league = await leagueRes.json();
    // Sponsors are a public display board — private leagues stay creator-only
    if (!league.canManage && !league.isPublic) { router.push(`/leagues/${id}`); return; }

    const sponsorsRes = await fetch(`/api/leagues/${id}/sponsors`);
    setSponsors(sponsorsRes.ok ? await sponsorsRes.json() : []);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="fixed inset-0 bg-black">
      {sponsors === null ? null : sponsors.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-white/40 text-sm">No sponsors yet</p>
        </div>
      ) : (
        <SponsorsMarquee3D sponsors={sponsors} />
      )}
    </div>
  );
}
