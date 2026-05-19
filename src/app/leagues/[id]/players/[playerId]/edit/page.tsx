'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import { sanitizeFolder, uploadFile } from '@/lib/utils';
import type { Player, League } from '@/lib/types';
import { toast } from 'sonner';

export default function EditPlayerPage() {
  const router = useRouter();
  const { id, playerId } = useParams<{ id: string; playerId: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [playerRes, leagueRes] = await Promise.all([
          fetch(`/api/leagues/${id}/players/${playerId}`),
          fetch(`/api/leagues/${id}`),
        ]);

        if (!playerRes.ok) {
          toast.error('Player not found');
          router.push(`/leagues/${id}`);
          return;
        }

        const p: Player = await playerRes.json();
        setPlayer(p);

        if (leagueRes.ok) {
          const lg: League = await leagueRes.json();
          setLeague(lg);

          if (typeof window !== 'undefined') {
            const leagueToken = localStorage.getItem(`creator_league_${id}`);
            const playerToken = localStorage.getItem(`creator_player_${playerId}`);
            const isLeagueCreator = !!leagueToken && leagueToken === lg.creatorToken;
            const isPlayerCreator = !!playerToken && playerToken === p.creatorToken;

            if (!isLeagueCreator && !isPlayerCreator) {
              toast.error('You do not have permission to edit this card');
              router.push(`/leagues/${id}`);
              return;
            }
            setHasPermission(true);
          }
        }
      } catch {
        toast.error('Failed to load player');
        router.push(`/leagues/${id}`);
      } finally {
        setFetchLoading(false);
      }
    }
    load();
  }, [id, playerId, router]);

  async function handleSubmit(data: PlayerFormData) {
    setLoading(true);
    try {
      // Upload new photo to Cloudinary if user selected one
      let photoUrl = data.photo;
      if (data.photoFile) {
        const leagueName = league?.name ?? id;
        const folder = `${sanitizeFolder(leagueName)}/players`;
        photoUrl = await uploadFile(data.photoFile, folder);
      }

      const res = await fetch(`/api/leagues/${id}/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          photo: photoUrl,
          battingType: data.battingType,
          bowlingType: data.bowlingType,
          role: data.role,
          isWicketKeeper: data.isWicketKeeper,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to update player');
      }

      toast.success('Player card updated!');
      router.push(`/leagues/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (fetchLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!player || !hasPermission) return null;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-2 text-muted-foreground">
        ← Back to League
      </Button>
      <Card className="border border-border shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Edit Player Card</CardTitle>
          <CardDescription>Update {player.name}&apos;s cricket details.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerForm
            initial={{
              name: player.name,
              photo: player.photo,
              battingType: player.battingType,
              bowlingType: player.bowlingType,
              role: player.role,
              isWicketKeeper: player.isWicketKeeper,
            }}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
