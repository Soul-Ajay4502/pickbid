'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import { generateToken, sanitizeFolder, uploadFile } from '@/lib/utils';
import type { LeagueWithPlayers, UserProfile } from '@/lib/types';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, UserPlus, Users } from 'lucide-react';

export default function NewPlayerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fetching, setFetching] = useState(true);
  // Bumped after each creator-mode add so the form remounts blank
  const [formKey, setFormKey] = useState(0);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (status === 'loading') return;
    const leagueReq = fetch(`/api/leagues/${id}`).then((r) => (r.ok ? r.json() : null));
    const profileReq = status === 'authenticated'
      ? fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      : Promise.resolve(null);

    Promise.all([leagueReq, profileReq])
      .then(([lg, prof]) => {
        setLeague(lg);
        if (prof) setProfile(prof);
      })
      .catch(() => {/* non-critical — form still usable, folder falls back to league id */})
      .finally(() => setFetching(false));
  }, [id, status]);

  const isCreatorMode = !!league?.isCreator;

  async function handleSubmit(data: PlayerFormData) {
    setLoading(true);
    const creatorToken = generateToken();

    try {
      // Upload photo to Cloudinary if a new file was selected
      let photoUrl = data.photo;
      if (data.photoFile) {
        const leagueName = league?.name ?? id;
        const folder = `${sanitizeFolder(leagueName)}/players`;
        photoUrl = await uploadFile(data.photoFile, folder);
      }

      const res = await fetch(`/api/leagues/${id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          photo: photoUrl,
          battingType: data.battingType,
          bowlingType: data.bowlingType,
          role: data.role,
          isWicketKeeper: data.isWicketKeeper,
          contactNumber: data.contactNumber.trim() || null,
          creatorToken,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to add player');
      }

      const player = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`creator_player_${player.id}`, creatorToken);
      }

      if (isCreatorMode) {
        // Stay on the page so the creator can keep adding players
        toast.success(`${data.name} added — add the next player or go back when done`);
        setLeague((prev) => prev ? { ...prev, players: [...prev.players, player] } : prev);
        setAddedCount((c) => c + 1);
        setFormKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.success('Player card added!');
        router.push(`/leagues/${id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (fetching || status === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="h-5 w-32 bg-muted rounded-lg mb-6 shimmer" />
        <div className="h-8 w-56 bg-muted rounded-lg mb-2 shimmer" />
        <div className="h-4 w-72 bg-muted rounded-lg mb-7 shimmer" />
        <div className="h-96 bg-muted rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in-up">
      <button
        onClick={() => router.push(`/leagues/${id}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Back to League
      </button>

      <div className="mb-7 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-black tracking-tight text-gradient-green">
            {isCreatorMode ? 'Add a Player' : 'Add Your Player Card'}
          </h1>
          {isCreatorMode && addedCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 animate-badge-pop">
              {addedCount} added
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {isCreatorMode
            ? 'Add players on their behalf — they don’t need an account. The form clears after each player so you can add several in a row.'
            : profile
            ? 'Pre-filled from your cricket profile — edit anything before saving.'
            : 'Fill in your cricket details and upload a photo.'}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            {isCreatorMode || !profile
              ? <UserPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
              : <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{league?.name ?? 'Player Details'}</p>
            <p className="text-xs text-muted-foreground">
              {isCreatorMode ? 'Adding as league creator' : profile ? 'Auto-filled from your profile' : 'Your card appears in the league grid'}
            </p>
          </div>
          {isCreatorMode && league && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums shrink-0">
              <Users className="w-3.5 h-3.5" />
              {league.players.length}/{league.totalPlayers}
            </span>
          )}
        </div>
        <div className="p-6">
          <PlayerForm
            key={formKey}
            initial={!isCreatorMode && profile ? {
              name: profile.name,
              photo: profile.photo,
              battingType: profile.battingType,
              bowlingType: profile.bowlingType,
              role: profile.role,
              isWicketKeeper: profile.isWicketKeeper,
            } : undefined}
            onSubmit={handleSubmit}
            submitLabel={isCreatorMode ? 'Add Player' : 'Add Card'}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
