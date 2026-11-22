/**
 * Which `/leagues/[id]/*` screens run without app chrome.
 *
 * The auction console, the spectator watch board, Auction Wrapped, the sponsor
 * marquee and the squad reveal are full-screen experiences: they're projected,
 * screen-recorded or handed to a crowd, so nothing frames them — no nav bar and
 * no league sidebar. The ball-by-ball scorer joins them: it runs on a phone at
 * the boundary for three hours, and every pixel of chrome is a thumb's reach
 * lost from the keypad. Both `NavBar` and `LeagueChrome` read this, so the two
 * can't drift into disagreeing about which screens are immersive.
 *
 * Pure string work, no server imports: safe for any client component.
 */
export function isImmersiveLeaguePath(pathname: string): boolean {
  return (
    /^\/leagues\/[^/]+\/(auction|watch|wrapped|sponsors)$/.test(pathname) ||
    /^\/leagues\/[^/]+\/teams\/[^/]+\/reveal$/.test(pathname) ||
    /^\/leagues\/[^/]+\/matches\/[^/]+\/score$/.test(pathname)
  );
}

/**
 * League screens that keep the site nav bar but not the league sidebar.
 *
 * The public registration form is handed to people who have no account and
 * aren't in the league yet — nearly every rail link would bounce them to
 * `/login` — so it stands alone, like an ordinary form, under the nav bar.
 */
export function isStandaloneLeaguePath(pathname: string): boolean {
  return /^\/leagues\/[^/]+\/register$/.test(pathname);
}

/** True for any `/leagues/[id]/…` URL that should carry the league sidebar. */
export function isLeagueChromePath(pathname: string): boolean {
  // `/leagues/new` and `/leagues/discover` are not a league; everything else
  // under `/leagues/<id>` is part of one league's workspace.
  if (!/^\/leagues\/[^/]+/.test(pathname)) return false;
  if (/^\/leagues\/(new|discover)(\/|$)/.test(pathname)) return false;
  return !isImmersiveLeaguePath(pathname) && !isStandaloneLeaguePath(pathname);
}
