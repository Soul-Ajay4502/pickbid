'use client';

import { Suspense, useState } from 'react';
import { useParams } from 'next/navigation';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import { generateToken, sanitizeFolder, uploadFile } from '@/lib/utils';
import type { LeagueWithPlayers } from '@/lib/types';
import { toast } from 'sonner';
import { Check, ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

const SkeletonFallback = () => (
  <div className="max-w-2xl mx-auto px-4 py-6">
    <div className="h-5 w-32 bg-muted rounded-lg mb-4 shimmer" />
    <div className="h-8 w-56 bg-muted rounded-lg mb-2 shimmer" />
    <div className="h-4 w-72 bg-muted rounded-lg mb-6 shimmer" />
    <div className="h-[26rem] bg-muted rounded-2xl shimmer" />
  </div>
);

function RegisterFormInner() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [fetching, setFetching] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [registeredName, setRegisteredName] = useState('');
  const [duplicate, setDuplicate] = useState<{ message: string; payload: Record<string, unknown>; name: string } | null>(null);

  if (fetching) {
    // Fetch league once on mount
    if (league === null) {
      (async () => {
        try {
          const res = await fetch(`/api/leagues/${id}`);
          const data = res.ok ? await res.json() : null;
          setLeague(data);
        } catch (err) {
          console.error('Failed to fetch league:', err);
          setLeague(null);
        } finally {
          setFetching(false);
        }
      })();
    }
    return <SkeletonFallback />;
  }

  if (!league) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="text-lg font-bold">League not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The registration link may be invalid or the league has been removed.
          </p>
          <Link href="/leagues/discover" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn-premium mt-6">
            Browse Leagues
          </Link>
        </div>
      </div>
    );
  }

  if (league.registrationClosed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="text-lg font-bold">Registration closed</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The organizers have closed registration for {league.name}. No new players can register at this time.
          </p>
          <Link href={`/leagues/${id}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn-premium mt-6">
            View League
          </Link>
        </div>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center animate-fade-in-up">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-lg font-bold mt-4">Player card created!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {registeredName} has been added to <strong>{league.name}</strong>.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            You can now close this form and wait for the auction to begin.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <Link href={`/leagues/${id}`} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm btn-premium">
              View League
            </Link>
            <button
              onClick={() => {
                setRegistered(false);
                setRegisteredName('');
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-foreground hover:bg-muted transition-colors"
            >
              Register another player
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(data: PlayerFormData) {
    setLoading(true);
    const creatorToken = generateToken();

    try {
      if (!league) throw new Error('League data not available');

      let photoUrl = data.photo;
      if (data.photoFile) {
        const folder = `${sanitizeFolder(league.name)}/players`;
        photoUrl = await uploadFile(data.photoFile, folder);
      }

      if (typeof photoUrl !== 'string' || !photoUrl.trim()) {
        throw new Error('A player photo is required. Add a photo, then try again.');
      }

      const payload = {
        name: data.name.trim(),
        photo: photoUrl.trim(),
        battingType: data.battingType,
        bowlingType: data.bowlingType,
        role: data.role,
        isWicketKeeper: data.isWicketKeeper,
        contactNumber: data.contactNumber.trim() || null,
        creatorToken,
      };

      await savePlayer(payload, data.name, false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function savePlayer(
    payload: Record<string, unknown>,
    name: string,
    confirmDuplicate: boolean
  ) {
    const creatorToken = String(payload.creatorToken);
    const res = await fetch(`/api/leagues/${id}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, confirmDuplicate }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 409 && err.duplicate && !confirmDuplicate) {
        setDuplicate({ message: err.error, payload, name });
        return;
      }
      throw new Error(err.error ?? 'Failed to register player');
    }

    setDuplicate(null);
    const player = await res.json();

    if (typeof window !== 'undefined') {
      localStorage.setItem(`creator_player_${player.id}`, creatorToken);
    }

    setRegisteredName(name);
    setRegistered(true);
    toast.success(`${name} registered successfully!`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in-up">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-gradient-green">
              Player Registration
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Join {league.name} cricket league — no account needed.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{league.name}</p>
            <p className="text-xs text-muted-foreground">
              Public registration
            </p>
          </div>
        </div>
      </div>

      {duplicate && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm animate-fade-in-up">
          <p className="text-foreground font-semibold mb-2">Already registered?</p>
          <p className="text-muted-foreground">{duplicate.message}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => savePlayer(duplicate.payload, duplicate.name, true)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 font-semibold text-xs transition-colors"
              disabled={loading}
            >
              {loading ? 'Adding…' : 'Register anyway'}
            </button>
            <button
              onClick={() => setDuplicate(null)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted font-semibold text-xs transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <PlayerForm
        onSubmit={handleSubmit}
        submitLabel="Register"
        loading={loading}
        showEmailField={false}
        showIdProof={false}
        showPaymentProof={false}
      />

      <div className="mt-8 p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground text-center">
        <Link href={`/leagues/${id}`} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-3 h-3" />
          Back to league
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<SkeletonFallback />}>
      <RegisterFormInner />
    </Suspense>
  );
}
