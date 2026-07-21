import { NextResponse, userAgent } from 'next/server';
import type { NextRequest } from 'next/server';

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
// paths requires a session. `/`, `/leaderboard` and other top-level routes are
// simply left out of the matcher, so they're always public.
function isPublicPath(pathname: string): boolean {
  // Browse public leagues / join by code
  if (pathname === '/leagues/discover') return true;
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

  if (isPublicPath(pathname) || isAuthenticated(request)) {
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
  // Auth.js API, `/`, and `/leaderboard` are never matched, so they stay public.
  matcher: ['/leagues/:path*', '/profile/:path*'],
};
