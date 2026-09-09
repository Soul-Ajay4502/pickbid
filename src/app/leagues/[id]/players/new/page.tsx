'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import PlayerSearchPicker from '@/components/PlayerSearchPicker';
import { generateToken, sanitizeFolder, uploadFile } from '@/lib/utils';
import type { LeagueWithPlayers, UserProfile, Player } from '@/lib/types';
import { toast } from 'sonner';
import { ArrowLeft, Check, Sparkles, UserPlus, Users, ShieldCheck } from 'lucide-react';

/** Lets the header's action button submit the form it sits outside of. */
const FORM_ID = 'player-card-form';

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
  // Player picked from search — prefills the form below instead of a blank one
  const [searchSelection, setSearchSelection] = useState<Player | null>(null);

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

  const isCreatorMode = !!league?.canManage;
  // This league wants an ID and the person registering themselves doesn't have
  // one on file. The API refuses the POST either way; catching it here means
  // they don't fill the whole form before finding out. Organizers adding cards
  // on someone's behalf are not held to it — see the players POST handler.
  const needsIdProof = !!league?.idProofRequired && !isCreatorMode && !profile?.idProofUrl;

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
      // Receipts go to their own folder — they are never served next to the
      // public card photos.
      let paymentProofUrl = data.paymentProofUrl;
      if (data.paymentProofFile) {
        paymentProofUrl = await uploadFile(data.paymentProofFile, `${sanitizeFolder(league?.name ?? id)}/payments`);
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
          paymentProofUrl: paymentProofUrl || null,
          creatorToken,
          // Picking an existing player reuses their account — don't also send an email
          ...(searchSelection ? { sourcePlayerId: searchSelection.id } : { email: data.email }),
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
        setSearchSelection(null);
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

  function handleSelectExisting(player: Player) {
    setSearchSelection(player);
    setFormKey((k) => k + 1);
  }

  function handleStartBlank() {
    setSearchSelection(null);
    setFormKey((k) => k + 1);
  }

  if (fetching || status === 'loading') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="h-5 w-32 bg-muted rounded-lg mb-4 shimmer" />
        <div className="h-8 w-56 bg-muted rounded-lg mb-2 shimmer" />
        <div className="h-4 w-72 bg-muted rounded-lg mb-6 shimmer" />
        <div className="h-[26rem] bg-muted rounded-2xl shimmer" />
      </div>
    );
  }

  if (needsIdProof) {
    const back = `/leagues/${id}/players/new`;
    return (
      <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in-up">
        <button
          onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back to League
        </button>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-lg font-bold mt-4">{league?.name} needs an identity proof</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Add a photo of your ID to your profile once and every league you join can use it.
            Only a league&apos;s organizers can open it — it never appears on your player card.
          </p>
          <button
            onClick={() => router.push(`/profile?redirect=${encodeURIComponent(back)}`)}
            className="btn-premium inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm mt-6"
          >
            <ShieldCheck className="w-4 h-4" />Add identity proof
          </button>
        </div>
      </div>
    );
  }

  const submitLabel = isCreatorMode ? 'Add Player' : 'Add Card';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in-up">
      {/* Phones can't see the form's own submit button without scrolling past
          every field, so the action rides along in a bar that sticks under the
          navbar. Above `lg` the two-column form puts the button in view anyway. */}
      <div className="sticky top-16 z-30 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <button
          type="button"
          onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back to League
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={loading}
          className="btn-premium lg:hidden inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs shrink-0"
        >
          {loading
            ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Check className="w-3.5 h-3.5" />}
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>

      {/* Title and league context share one row so the form starts near the top
          of the viewport — the whole card should fit without scrolling. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
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
          <p className="text-muted-foreground text-sm mt-0.5">
            {isCreatorMode
              ? 'Add players on their behalf — they don’t need an account. The form clears after each one.'
              : profile
              ? 'Pre-filled from your cricket profile — edit anything before saving.'
              : 'Fill in your cricket details and upload a photo.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            {isCreatorMode || !profile
              ? <UserPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
              : <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{league?.name ?? 'Player Details'}</p>
            <p className="text-xs text-muted-foreground">
              {isCreatorMode ? 'Adding as league organizer' : profile ? 'Auto-filled from your profile' : 'Your card appears in the league grid'}
            </p>
          </div>
          {isCreatorMode && league && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums shrink-0 pl-2.5 ml-0.5 border-l border-border">
              <Users className="w-3.5 h-3.5" />
              {league.players.length}/{league.totalPlayers}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6">
        {isCreatorMode && (
          <div className="mb-5 space-y-2">
            <PlayerSearchPicker leagueId={id} onSelect={handleSelectExisting} />
            {searchSelection && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/8 text-xs">
                <span className="text-foreground">
                  Prefilled from <span className="font-semibold">{searchSelection.name}</span>&apos;s earlier card — review and add.
                </span>
                <button
                  type="button"
                  onClick={handleStartBlank}
                  className="text-muted-foreground hover:text-foreground shrink-0 underline underline-offset-2"
                >
                  Start blank
                </button>
              </div>
            )}
          </div>
        )}
        <PlayerForm
          key={formKey}
          layout="grid"
          formId={FORM_ID}
          initial={
            searchSelection ? {
              name: searchSelection.name,
              photo: searchSelection.photo,
              battingType: searchSelection.battingType,
              bowlingType: searchSelection.bowlingType,
              role: searchSelection.role,
              isWicketKeeper: searchSelection.isWicketKeeper,
              contactNumber: searchSelection.contactNumber ?? '',
            } : !isCreatorMode && profile ? {
              name: profile.name,
              photo: profile.photo,
              battingType: profile.battingType,
              bowlingType: profile.bowlingType,
              role: profile.role,
              isWicketKeeper: profile.isWicketKeeper,
              // The phone is a required field, so leaving it out of the
              // prefill made every joiner retype what their profile already has
              contactNumber: profile.contactNumber ?? '',
            } : undefined
          }
          showPaymentProof={!!league?.paymentProofRequired}
          requirePaymentProof={!!league?.paymentProofRequired && !isCreatorMode}
          onSubmit={handleSubmit}
          submitLabel={submitLabel}
          loading={loading}
          showEmailField={isCreatorMode && !searchSelection}
        />
      </div>
    </div>
  );
}
