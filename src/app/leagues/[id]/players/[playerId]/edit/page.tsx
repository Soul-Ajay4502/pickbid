'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import { ArrowLeft, PencilLine } from 'lucide-react';
import { sanitizeFolder, uploadFile } from '@/lib/utils';
import type { Player, LeagueWithPlayers } from '@/lib/types';
import { toast } from 'sonner';

export default function EditPlayerPage() {
  const router = useRouter();
  const { id, playerId } = useParams<{ id: string; playerId: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
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
          const lg: LeagueWithPlayers = await leagueRes.json();
          setLeague(lg);

          const playerToken = typeof window !== 'undefined'
            ? localStorage.getItem(`creator_player_${playerId}`)
            : null;
          const isLeagueCreator = lg.isCreator;
          const isPlayerCreator = !!playerToken && playerToken === p.creatorToken;

          if (!isLeagueCreator && !isPlayerCreator) {
            toast.error('You do not have permission to edit this card');
            router.push(`/leagues/${id}`);
            return;
          }
          setHasPermission(true);
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
        <div className="h-8 w-48 bg-muted rounded-lg mb-4 shimmer" />
        <div className="h-96 bg-muted rounded-2xl shimmer" />
      </div>
    );
  }

  if (!player || !hasPermission) return null;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in-up">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Back to League
      </button>

      <div className="mb-7 space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-gradient-green">Edit Player Card</h1>
        <p className="text-muted-foreground text-sm">Update {player.name}&apos;s cricket details.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            <PencilLine className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{player.name}</p>
            <p className="text-xs text-muted-foreground">Changes apply to this league&apos;s card</p>
          </div>
        </div>
        <div className="p-6">
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
        </div>
      </div>
    </div>
  );
}
