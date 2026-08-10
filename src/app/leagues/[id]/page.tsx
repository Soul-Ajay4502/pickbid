import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getPublicLeagueView } from '@/lib/store';
import { SITE_NAME } from '@/lib/seo';
import { JsonLd, sportsEventSchema } from '@/lib/jsonLd';
import PublicLeagueView from '@/components/league/PublicLeagueView';
import LeagueWorkspace from './LeagueWorkspace';

/**
 * A league URL serves two audiences, and this component picks between them:
 *
 *   signed in                  → the interactive workspace, exactly as before
 *   signed out + public league → a server-rendered public page (indexable)
 *   signed out + private league → sign in, as before
 *
 * The split exists for two reasons. First, the workspace is a client component
 * that loads its data after hydration, so a crawler only ever saw an empty
 * shell — the league URLs in the sitemap had nothing to index. Second, and worse,
 * `proxy.ts` used to wave crawlers through while redirecting logged-out humans
 * to `/login`: Google indexed a league page that real visitors could not reach
 * without an account, which is cloaking. Now the crawler and the logged-out
 * visitor are served the identical public page.
 *
 * Private leagues keep their existing behaviour — they are unlisted, reachable
 * by anyone the organizer sent the link to *once signed in*. This route does not
 * widen that.
 *
 * Reads the session, so this renders per request.
 */
export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (session?.user) {
    return <LeagueWorkspace />;
  }

  // Returns null for a league that doesn't exist *or* isn't public, so this one
  // call covers both cases without leaking which it was.
  const publicLeague = await getPublicLeagueView(id).catch(() => null);

  if (!publicLeague) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/leagues/${id}`)}`);
  }

  const description =
    `${publicLeague.name} cricket league — ${publicLeague.teams.length} teams, ` +
    `${publicLeague.registeredPlayers} players, auction results, fixtures, results ` +
    `and points table on ${SITE_NAME}.`;

  return (
    <>
      <JsonLd
        data={sportsEventSchema({
          name: publicLeague.name,
          description,
          path: `/leagues/${publicLeague.id}`,
          // The league's creation date is the only date the schema can honestly
          // assert. Fixtures carry dates individually but a league has no
          // declared start, so nothing is invented here.
          startDate: publicLeague.createdAt,
          logoUrl: publicLeague.logoUrl || null,
          organizerName: publicLeague.conductedBy || null,
          teamNames: publicLeague.teams.map((team) => team.name),
        })}
      />
      <PublicLeagueView league={publicLeague} />
    </>
  );
}
