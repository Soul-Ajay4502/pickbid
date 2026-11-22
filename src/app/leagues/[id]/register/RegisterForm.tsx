'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, Users } from 'lucide-react';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { generateToken, sanitizeFolder, uploadFile } from '@/lib/utils';

interface RegisterFormProps {
  leagueId: string;
  leagueName: string;
  paymentProofRequired: boolean;
  /** Whether the league page will open for this visitor — see the page. */
  canViewLeague: boolean;
}

/** A card the API held back as a likely duplicate, waiting on "register anyway". */
interface HeldCard {
  message: string;
  /** The finished request, photo and receipt already uploaded, so confirming doesn't upload twice. */
  payload: Record<string, unknown>;
  name: string;
}

/**
 * The anonymous half of the public registration form. Identity-proof and
 * closed leagues never reach it (the page answers those), so the only document
 * it can be asked for is this league's entry-fee receipt.
 */
export default function RegisterForm({ leagueId, leagueName, paymentProofRequired, canViewLeague }: RegisterFormProps) {
  const [loading, setLoading] = useState(false);
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldCard | null>(null);

  async function handleSubmit(data: PlayerFormData) {
    setLoading(true);
    try {
      const folder = sanitizeFolder(leagueName);
      const photo = data.photoFile ? await uploadFile(data.photoFile, `${folder}/players`) : data.photo;
      // Receipts go to their own folder — never served next to the public card photos.
      const paymentProofUrl = data.paymentProofFile
        ? await uploadFile(data.paymentProofFile, `${folder}/payments`)
        : data.paymentProofUrl;

      await savePlayer({
        name: data.name.trim(),
        photo,
        battingType: data.battingType,
        bowlingType: data.bowlingType,
        role: data.role,
        isWicketKeeper: data.isWicketKeeper,
        contactNumber: data.contactNumber.trim() || null,
        paymentProofUrl: paymentProofUrl || null,
        creatorToken: generateToken(),
      }, data.name.trim(), false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Posts a finished card. A 409 naming a duplicate isn't an error to toast:
   * it parks the request behind the confirm dialog, which calls back in with
   * `confirmDuplicate` set. Throws for every other failure.
   */
  async function savePlayer(payload: Record<string, unknown>, name: string, confirmDuplicate: boolean) {
    const res = await fetch(`/api/leagues/${leagueId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, confirmDuplicate }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 409 && err.duplicate && !confirmDuplicate) {
        setHeld({ message: err.error, payload, name });
        return;
      }
      throw new Error(err.error ?? 'Failed to register player');
    }

    setHeld(null);
    const player = await res.json();
    // The token is what lets this browser edit the card later. Storage can
    // throw in a private window; the card is saved either way.
    try {
      localStorage.setItem(`creator_player_${player.id}`, String(payload.creatorToken));
    } catch { /* not fatal */ }

    setRegisteredName(name);
    toast.success(`${name} registered successfully!`);
    // The form was long and the confirmation is short — on a phone the
    // visitor would otherwise be left looking at empty space below it.
    window.scrollTo({ top: 0 });
  }

  const backLink = canViewLeague && (
    <Link
      href={`/leagues/${leagueId}`}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to league
    </Link>
  );

  if (registeredName !== null) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center animate-rise-in">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-lg font-bold mt-4">Player card created!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {registeredName} has been added to <strong>{leagueName}</strong>.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            You can close this page now and wait for the auction to begin.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            {canViewLeague && (
              <Link
                href={`/leagues/${leagueId}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm btn-premium"
              >
                View League
              </Link>
            )}
            <button
              onClick={() => setRegisteredName(null)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-foreground hover:bg-muted transition-colors"
            >
              Register another player
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* `rise-in`, not a fade: this header is server-rendered and above the
          fold, and an opacity-0 start would hold back LCP. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 animate-rise-in">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gradient-green">Player Registration</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Join {leagueName}. No account needed.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{leagueName}</p>
            <p className="text-xs text-muted-foreground">Your card appears in the league grid</p>
          </div>
        </div>
      </div>

      {/* A modal, not a banner above the form: on a phone the submit button is
          a long scroll below the top, and a banner up there went unseen. The
          dialog also holds itself disabled while the retry is in flight, so a
          double tap can't send two confirmed cards. */}
      <ConfirmDialog
        open={!!held}
        title="Already registered?"
        description={
          <>
            {held?.message}{' '}
            If you have already registered, you don&apos;t need a second card. Register this one only if it is a different person.
          </>
        }
        confirmLabel="Register anyway"
        pendingLabel="Registering…"
        cancelLabel="Don't register"
        destructive={false}
        onConfirm={async () => {
          if (!held) return;
          try {
            await savePlayer(held.payload, held.name, true);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Something went wrong');
          }
        }}
        onClose={() => setHeld(null)}
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6">
        <PlayerForm
          onSubmit={handleSubmit}
          submitLabel="Register"
          loading={loading}
          // Same rule the players POST enforces, caught before the upload.
          requirePhoto
          showPaymentProof={paymentProofRequired}
          requirePaymentProof={paymentProofRequired}
        />
      </div>

      {backLink && <div className="mt-6 text-center">{backLink}</div>}
    </div>
  );
}
