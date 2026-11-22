import type { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { auth } from '@/auth';
import { getLeague } from '@/lib/store';
import RegisterForm from './RegisterForm';

/**
 * The shareable registration form — `/leagues/[id]/register`, whitelisted in
 * `proxy.ts` so a player can open it from WhatsApp with no account and add
 * their own card. It posts to the same anonymous players POST as everything
 * else, so every rule there (photo, duplicates, closed registration) applies.
 *
 * Rendered here rather than fetched by the client: the form needs four
 * scalars, not the league GET's whole roster, and deciding which screen to show
 * on the server means a closed or ID-gated league never flashes the form first.
 */
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [league, session] = await Promise.all([getLeague(id), auth()]);

  if (!league) {
    return (
      <Notice title="League not found" body="The registration link may be invalid, or the league has been removed.">
        <Link href="/leagues/discover" className={BUTTON}>Browse Leagues</Link>
      </Notice>
    );
  }

  // A private league's page sends a signed-out visitor to /login, so only
  // offer the way back to it when it will actually open.
  const canViewLeague = league.isPublic || !!session?.user;
  const leagueLink = canViewLeague
    ? <Link href={`/leagues/${id}`} className={BUTTON}>View League</Link>
    : null;

  if (league.registrationClosed) {
    return (
      <Notice
        title="Registration closed"
        body={`The organizers have closed registration for ${league.name}. No new players can register at this time.`}
      >
        {leagueLink}
      </Notice>
    );
  }

  // The identity proof lives on an account (`users.idProofUrl`), so an
  // anonymous card can never satisfy it and the POST would refuse the card
  // only after the whole form was filled. The account-backed form already
  // walks a player through adding one; the proxy sends them to sign in first.
  if (league.idProofRequired) {
    return (
      <Notice
        icon={<ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />}
        title={`${league.name} needs an identity proof`}
        body="This league asks every player for a photo of their ID, which is kept on your account. Sign in to register. You add the ID once, and only the organizers can open it."
      >
        <Link href={`/leagues/${id}/players/new?self=1`} className={BUTTON}>Sign in to register</Link>
      </Notice>
    );
  }

  return (
    <RegisterForm
      leagueId={id}
      leagueName={league.name}
      paymentProofRequired={league.paymentProofRequired}
      canViewLeague={canViewLeague}
    />
  );
}

const BUTTON = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn-premium mt-6';

function Notice({ icon, title, body, children }: { icon?: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 text-center">
      <div className="rounded-2xl border border-border bg-card p-8 animate-rise-in">
        {icon && (
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            {icon}
          </div>
        )}
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{body}</p>
        {children}
      </div>
    </div>
  );
}
