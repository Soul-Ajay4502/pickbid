import { getLeague, getPlayers, getTeams, getOfficials, getCoOrganizers, hasPublishedLedger, getAuctionLiveSummary } from './store';
import { stripOrganizerFields, visibleRoster } from './utils';
import type { LeagueWithPlayers } from './types';

/**
 * The league workspace payload — everything the signed-in league page renders —
 * shaped for one particular viewer.
 *
 * Two callers, one answer: `api/leagues/[id]` GET (the page's refreshes) and
 * `leagues/[id]/page.tsx`, which renders the workspace with this already in hand
 * so the cards arrive in the HTML instead of after hydration and a second round
 * trip. Every visibility rule lives here so the two can't drift: whatever the
 * API would withhold from a viewer, the server-rendered page withholds too.
 *
 * `userId` is the Auth.js user, `platformAdmin` the owner-console session (see
 * `adminAuth.ts`). Returns null when the league doesn't exist.
 */
export async function getLeagueView(
  id: string,
  { userId, platformAdmin }: { userId: string | null | undefined; platformAdmin: boolean }
): Promise<LeagueWithPlayers | null> {
  const league = await getLeague(id);
  if (!league) return null;

  const [players, teams, officials, coOrganizers, ledgerPublished, liveAuction] = await Promise.all([
    getPlayers(id), getTeams(id), getOfficials(id), getCoOrganizers(id), hasPublishedLedger(id),
    getAuctionLiveSummary(id),
  ]);
  const isCreator = !!userId && userId === league.creatorId;
  // Creator or co-organizer — either can manage the league and run its
  // auction. The owner console is folded in here so the owner opening a
  // league from `/admin` gets the full organizer view of it; `isCreator`
  // stays strictly true-creator, so the creator-only actions don't move.
  const canManage = isCreator || platformAdmin || (!!userId && coOrganizers.some((c) => c.userId === userId));
  // Whether the requester has joined: matched by userId stamped at join time,
  // so it stays consistent across devices (unlike the old localStorage check)
  const hasJoined = !!userId && players.some((p) => p.userId === userId);
  const { creatorId, ...safeLeague } = league;
  // Resolve each icon player to the team they're pre-assigned to, so cards can show the badge
  const teamById = new Map(teams.map((tm) => [tm.id, tm]));
  const withIconTeam = players.map((p) => {
    const team = p.isIcon && p.teamId ? teamById.get(p.teamId) : null;
    return {
      ...p,
      iconOfTeam: team ? { id: team.id, name: team.name, colorHex: team.colorHex } : null,
    };
  });
  // A league running a closed roster shows a player only their own card and
  // the icon signings. Computed after `hasJoined` above, which must keep
  // looking at the whole roster to answer "have I joined?" correctly.
  const rosterHidden = !canManage && !league.rosterVisibleToPlayers;
  const roster = rosterHidden ? visibleRoster(withIconTeam, userId) : withIconTeam;
  // Contact numbers and payment receipts are for the organisers' records only
  // — never expose them to anyone who isn't running this league
  const safePlayers = canManage ? roster : roster.map(stripOrganizerFields);
  const safeOfficials = canManage ? officials : officials.map((o) => ({ ...o, contactNumber: null }));
  // Co-organizer names/photos are public (they're shown as badges), but their
  // emails are only the creator's business — they power the manage list
  const safeCoOrganizers = (isCreator || platformAdmin)
    ? coOrganizers
    : coOrganizers.map((c) => ({ ...c, email: null }));
  // isCreator/canManage/hasJoined first, before the (potentially large) players
  // array, so they're easy to find in the response rather than buried after it
  // Only whether a *published* ledger exists — the sheet itself, and the
  // existence of any draft, stay behind /api/leagues/[id]/ledger
  // `liveAuction` is non-null only while an auction is actually being run —
  // it's what puts the LIVE banner (and the only in-app route back into a
  // running auction) on the league page.
  // `registeredPlayers` is the true signup count even when `players` has been
  // trimmed — the slots-filled meter reads it rather than `players.length`.
  return {
    ...safeLeague, isCreator, canManage, hasJoined, ledgerPublished, liveAuction,
    registeredPlayers: players.length, rosterHidden, coOrganizers: safeCoOrganizers,
    players: safePlayers, teams, officials: safeOfficials,
  };
}
