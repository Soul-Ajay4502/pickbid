'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import { uploadFile } from '@/lib/utils';
import type { UserProfile } from '@/lib/types';
import { toast } from 'sonner';
import { ArrowLeft, UserCircle, CheckCircle2 } from 'lucide-react';

const SkeletonFallback = () => (
  <div className="max-w-lg mx-auto px-4 py-10">
    <div className="space-y-3">
      <div className="h-5 bg-muted rounded-lg w-16 shimmer" />
      <div className="h-10 bg-muted rounded-xl w-1/2 shimmer" />
      <div className="h-4 bg-muted rounded-lg w-3/4 shimmer" />
    </div>
    <div className="mt-8 rounded-2xl border border-border bg-card overflow-hidden">
      <div className="h-20 bg-muted shimmer" />
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-10 bg-muted rounded-xl shimmer" />
        ))}
      </div>
    </div>
  </div>
);

function ProfilePageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const callbackUrl = redirectTo
        ? `/profile?redirect=${encodeURIComponent(redirectTo)}`
        : '/profile';
      signIn('google', { callbackUrl });
      return;
    }
    if (status !== 'authenticated') return;

    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [status, redirectTo]);

  async function handleSubmit(data: PlayerFormData) {
    setLoading(true);
    try {
      let photoUrl = data.photo;
      if (data.photoFile) {
        photoUrl = await uploadFile(data.photoFile, 'profiles');
      }

      const res = await fetch('/api/profile', {
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

      if (!res.ok) throw new Error('Failed to save profile');

      const updated: UserProfile = await res.json();
      setProfile(updated);
      toast.success('Profile saved!');

      if (redirectTo) router.push(redirectTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || fetching) return <SkeletonFallback />;

  const isSetup = !profile;
  const submitLabel = redirectTo ? 'Save & Join League' : profile ? 'Update Profile' : 'Save Profile';

  const initial = profile
    ? {
        name: profile.name,
        photo: profile.photo,
        battingType: profile.battingType,
        bowlingType: profile.bowlingType,
        role: profile.role,
        isWicketKeeper: profile.isWicketKeeper,
      }
    : {
        name: session?.user?.name ?? '',
        photo: session?.user?.image ?? '',
      };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in-up">

      {/* Back + heading */}
      <div className="mb-7">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-gradient-green">
              Cricket Profile
            </h1>
            <p className="text-muted-foreground text-sm">
              {redirectTo
                ? 'Complete your profile to join the league — you only need to do this once.'
                : isSetup
                ? 'Set up your profile once and it auto-fills when you join any league.'
                : 'Your cricket details auto-fill when you join a league.'}
            </p>
          </div>
          {profile && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-500 dark:text-green-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Set up
            </div>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">

        {/* Card header: avatar + user name */}
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center gap-3">
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? ''}
              className="w-9 h-9 rounded-full ring-2 ring-primary/25 ring-offset-1 ring-offset-background"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserCircle className="w-9 h-9 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {session?.user?.name ?? 'Your Profile'}
            </p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          <PlayerForm
            initial={initial}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<SkeletonFallback />}>
      <ProfilePageInner />
    </Suspense>
  );
}
