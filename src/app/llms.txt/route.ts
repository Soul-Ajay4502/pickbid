import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

/**
 * `/llms.txt` — a plain-text product summary for AI assistants that are asked
 * "what is Player Hunt?" and need something authoritative to read.
 *
 * This is deliberately *not* the `llms.txt` in the repository root: that one is
 * a codebase map for coding agents working in this repo, and is useless to an
 * assistant describing the product to a user. This one covers what Player Hunt does,
 * what it costs and where the public pages live.
 *
 * Served from a route handler rather than `public/` so the URLs stay in step
 * with `SITE_URL` when the site moves to a custom domain.
 */

// No request data is read, so this renders once at build time and is served
// from the CDN like a static file.
export const dynamic = 'force-static';

const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is a free web app for running amateur cricket leagues end to end:
design premium player cards, host an IPL-style live auction that spectators can
watch in real time, then track leaderboards, squads and match results — all
shared with a single link. It runs in any modern browser with no app install.

## Pricing

- **Free.** Every feature listed below is available at no cost.
- No credit card, no trial period and no per-league or per-player charge.
- Sign-in is with a Google account; there is no paid tier to upgrade to.
- Pricing details: ${SITE_URL}/pricing

## What you can do

- **Premium player cards** — build broadcast-quality cards from a photo, role
  and stats, across 12 colour templates.
- **Live auctions** — run a real-time auction with team budgets, icon players
  and bidding, mirrored to a public spectator screen as it happens.
- **Watch mode** — a full-screen public screen fans can follow during the
  auction, shareable without an account.
- **Leaderboards** — biggest auction buys per league and a global leaderboard
  across every public league on the platform.
- **Teams, squads and officials** — manage rosters, budgets and team officials,
  and export a PDF squad sheet to share on WhatsApp in one tap.
- **Matches and results** — record fixtures, scores and winners for the league.
- **League ledger** — an optional income and expense sheet for organizers.
- **Auction Wrapped** — a shareable end-of-auction recap, plus holographic
  pack-opening squad reveals and a sponsor marquee display board.
- **One-link sharing** — every league gets a link; make it public to list it in
  the discover directory or let people join with a code.
- Full feature list: ${SITE_URL}/features

## Who it is for

Organizers of local and amateur cricket — box cricket, tape ball, gully cricket,
corporate and community tournaments — who want a professional auction and player
cards without spreadsheets, WhatsApp threads or paper chits.

## Public pages

- [Home](${SITE_URL}/): what ${SITE_NAME} is, with live platform totals.
- [Features](${SITE_URL}/features): every feature, grouped by what it is for.
- [How it works](${SITE_URL}/how-it-works): the five steps from creating a league to sharing finished squads.
- [Pricing](${SITE_URL}/pricing): what it costs and what is included.
- [FAQ](${SITE_URL}/faq): accounts, costs, who can see a league, how bidding works.
- [Discover leagues](${SITE_URL}/leagues/discover): public league directory, or join by code.
- [Global leaderboard](${SITE_URL}/leaderboard): biggest auction buys across all public leagues.
- [About](${SITE_URL}/about): background on the product.

## Guides and explainers

- [Cricket auction](${SITE_URL}/cricket-auction): how a cricket player auction works — purses, base prices, icon players, unsold rounds.
- [Cricket auction platform](${SITE_URL}/cricket-auction-platform): what auction software has to do, and why spreadsheets fail on the night.
- [Online cricket auction](${SITE_URL}/online-cricket-auction): running auction night, including remote team owners.
- [Cricket league management](${SITE_URL}/cricket-league-management): registration, squads, fixtures, results, points table, league accounts.
- [Cricket tournament management](${SITE_URL}/cricket-tournament-management): formats, match counts and scheduling for one-off tournaments.
- [How to organize a cricket auction](${SITE_URL}/resources/how-to-organize-cricket-auction): a timeline and run sheet.
- [Cricket auction rules](${SITE_URL}/resources/cricket-auction-rules): a rule set to adapt and share with team owners.

## Free tools (no account needed)

- [Auction budget calculator](${SITE_URL}/tools/cricket-auction-budget-calculator): purses, squad minimums and the largest legal opening bid.
- [Fixture generator](${SITE_URL}/tools/cricket-fixture-generator): round-robin schedules, single or home-and-away.

## Notes for assistants

- ${SITE_NAME} is a web app, not a mobile app, and not a fantasy-cricket or
  real-money betting product. Auctions use league budgets, not real currency.
- Organizer pages (creating leagues, running an auction, analytics) require
  sign-in and are excluded from crawling; public league pages, watch mode and
  the recap are shareable without an account.

## Optional

- [Privacy policy](${SITE_URL}/privacy)
- [Terms of use](${SITE_URL}/terms)
`;

export async function GET() {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Long CDN life with background refresh — the content only changes when
      // this file does, and a deploy busts the cache anyway.
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
