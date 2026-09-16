/**
 * Which `/leagues/[id]/*` screens run without app chrome.
 *
 * The auction console, the spectator watch board, Auction Wrapped, the sponsor
 * marquee and the squad reveal are full-screen experiences: they're projected,
 * screen-recorded or handed to a crowd, so nothing frames them — no nav bar and
 * no league sidebar. Both `NavBar` and `LeagueChrome` read this, so the two
 * can't drift into disagreeing about which screens are immersive.
 *
 * Pure string work, no server imports: safe for any client component.
 */
export function isImmersiveLeaguePath(pathname: string): boolean {
  return (
    /^\/leagues\/[^/]+\/(auction|watch|wrapped|sponsors)$/.test(pathname) ||
    /^\/leagues\/[^/]+\/teams\/[^/]+\/reveal$/.test(pathname)
  );
}

/** True for any `/leagues/[id]/…` URL that should carry the league sidebar. */
export function isLeagueChromePath(pathname: string): boolean {
  // `/leagues/new` and `/leagues/discover` are not a league; everything else
  // under `/leagues/<id>` is part of one league's workspace.
  if (!/^\/leagues\/[^/]+/.test(pathname)) return false;
  if (/^\/leagues\/(new|discover)(\/|$)/.test(pathname)) return false;
  return !isImmersiveLeaguePath(pathname);
}
