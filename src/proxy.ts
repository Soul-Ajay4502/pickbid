import { NextResponse, userAgent } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/adminCookie';

// Next.js 16 renamed the `middleware` file convention to `proxy` (same feature,
// runs before a route renders). This gate is defence-in-depth for *navigation*
// only — every API route still enforces real auth/authorization via `auth()`.
// We check for the Auth.js session cookie rather than importing `@/auth`, so the
// proxy stays lightweight and never pulls Sequelize/`pg` into this layer.

// Auth.js (NextAuth v5) names the session cookie `authjs.session-token`, prefixed
// with `__Secure-` over HTTPS, and splits it into `.0`/`.1` chunks when the JWT is
// large. Matching by prefix covers every variant.
function isAuthenticated(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.endsWith('authjs.session-token') || c.name.includes('authjs.session-token.'));
}

// Pages that stay open to logged-out visitors. Everything else under the matched
// paths requires a session. `/leaderboard` and other top-level routes are simply
// left out of the matcher, so they're always public; `/` *is* matched, but only
// so signed-in visitors can be rewritten to their dashboard — it is handled
// first in `proxy` below and never gated.
/**
 * Literal segments under `/leagues/` that are pages in their own right rather
 * than league ids. `/leagues/[id]` is opened up to anonymous visitors below, and
 * without this list that pattern would also match `/leagues/new` and hand the
 * create-league form to someone with no session.
 */
const RESERVED_LEAGUE_SEGMENTS = new Set(['new', 'discover']);

function isPublicPath(pathname: string): boolean {
  // Browse public leagues / join by code
  if (pathname === '/leagues/discover') return true;
  // A league's own page decides what an anonymous visitor sees: a public league
  // renders its server-rendered public view, a private one redirects to /login
  // itself. That decision needs the league row, which this layer deliberately
  // can't read (no Sequelize here), so the page handles it — see
  // `app/leagues/[id]/page.tsx`. Only the league *root* is opened up; every
  // management sub-route below it stays gated by the checks that follow.
  const leagueRoot = pathname.match(/^\/leagues\/([^/]+)$/);
  if (leagueRoot && !RESERVED_LEAGUE_SEGMENTS.has(leagueRoot[1])) return true;
  // The live spectator screen for a league is meant to be shared publicly
  if (/^\/leagues\/[^/]+\/watch$/.test(pathname)) return true;
  // The Auction Wrapped recap (and its poster image) is deliberately shareable,
  // like /watch — it shows only what the spectator screen already broadcast
  if (/^\/leagues\/[^/]+\/wrapped(\/poster)?$/.test(pathname)) return true;
  // The sponsor marquee is a public display board, like /watch. Its /manage
  // sub-route is intentionally excluded — that one stays gated.
  if (/^\/leagues\/[^/]+\/sponsors$/.test(pathname)) return true;
  // Generated Open Graph / Twitter card images. Link-preview crawlers fetch
  // these without a session; the image shows nothing beyond league name/logo.
  if (/^\/leagues\/[^/]+\/(opengraph-image|twitter-image)(-\w+)?$/.test(pathname)) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // `/` is a statically prerendered landing page served from the CDN to everyone
  // without a session cookie — crawlers included. Signed-in visitors get their
  // dashboard rewritten onto the same URL, so `/` itself never reads the session
  // and never has to render dynamically. A rewrite rather than a redirect keeps
  // the URL, bookmarks and shared links pointing at `/`, exactly as before.
  // `/dashboard` re-checks the session for real, since a stale cookie also
  // satisfies the check below.
  if (pathname === '/') {
    return isAuthenticated(request)
      ? NextResponse.rewrite(new URL('/dashboard', request.url))
      : NextResponse.next();
  }

  // The super-admin area is a separate world from the Auth.js session: a normal
  // signed-in user must never satisfy it, so it's handled before the ordinary
  // check below and looks only at the admin cookie. As with the rest of this
  // file the real enforcement is in the handlers — `requireAdmin` verifies the
  // cookie's signature and expiry, which this layer deliberately can't do.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname === '/admin/login') return NextResponse.next();
    if (request.cookies.get(ADMIN_COOKIE)?.value) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // A signed-in owner-console session also opens every league screen, so the
  // owner can jump straight from `/admin` into any league's detail pages. It
  // carries no Auth.js cookie, so `isAuthenticated` would otherwise bounce it
  // to /login. As everywhere else here, the API handlers do the real check.
  // Scoped to league screens on purpose: the owner has no user profile, so
  // letting an admin cookie through to /profile would only render an empty one.
  const adminViewingLeague =
    pathname.startsWith('/leagues/') && Boolean(request.cookies.get(ADMIN_COOKIE)?.value);

  if (isPublicPath(pathname) || isAuthenticated(request) || adminViewingLeague) {
    return NextResponse.next();
  }

  // Link-preview crawlers (WhatsApp, Slack, Googlebot, …) never carry a
  // session cookie, so redirecting them lands on the Auth.js sign-in page and
  // every shared league link previews as "Sign In". Let bots render the page
  // shell instead: league pages are client components, so the HTML exposes
  // only <head> metadata — all real data still loads via the auth'd APIs.
  if (userAgent(request).isBot) {
    return NextResponse.next();
  }

  // Not signed in → hand off to our /login page (Google is the only provider)
  // and come back to the originally requested URL afterwards. We deliberately
  // avoid the built-in `/api/auth/signin` page: its form POST fails with
  // `MissingCSRF` for first-time visitors who arrive here without a CSRF
  // cookie. /login calls `signIn('google')` client-side, which sets the cookie
  // fresh right before the POST.
  const signInUrl = new URL('/login', request.url);
  signInUrl.searchParams.set('callbackUrl', pathname + search);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  // Narrow the proxy to the areas that contain protected pages. `isPublicPath`
  // then carves out the public exceptions (discover, watch). Static assets, the
  // Auth.js API and `/leaderboard` are never matched, so they stay public.
  // `/` is matched purely for the signed-in dashboard rewrite, never to gate it.
  matcher: ['/', '/leagues/:path*', '/profile/:path*', '/admin', '/admin/:path*'],
};
