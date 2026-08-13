<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pickbid

Cricket auction & league management app: organizers create a league, players add
their own cards, the organizer runs a live auction that spectators follow from a
public link, and results feed a leaderboard. Next.js 16 (App Router) + React 19 +
TypeScript, Postgres (Neon) via Sequelize, deployed on Vercel.

[README.md](README.md) covers setup, env vars and the data model.
[llms.txt](llms.txt) is the file-by-file codebase map — read it before hunting
for where something lives.

## Commands

```bash
npm run dev            # dev server
npm run build          # production build — the only real typecheck (tsc has noEmit)
npm run lint           # eslint
npm run db:migrate     # apply sequelize migrations
npm run db:status      # show migration state
```

There is no test suite. Verify changes with `npm run build` plus the dev server.

## Next.js 16 specifics that bite

- **`middleware.ts` is now `proxy.ts`** — the file is [src/proxy.ts](src/proxy.ts)
  and exports `proxy()`, not `middleware()`.
- **Route params are Promises.** Every handler and page takes
  `{ params }: { params: Promise<{ id: string }> }` and must `await params`.
  Match the existing signature; don't destructure `params.id` directly.
- **Sequelize/`pg` are external packages** (`serverExternalPackages` in
  [next.config.ts](next.config.ts)) because Sequelize's dialect loader uses
  dynamic `require()`. Never import `@/lib/store`, `@/lib/models` or `@/lib/db`
  from a client component or from `proxy.ts`.

## Architecture rules

**All database access goes through [src/lib/store.ts](src/lib/store.ts).** Route
handlers import named functions from it and never touch `models.ts` directly —
the sole exception is the one-off admin import at
[src/app/api/migrate/route.ts](src/app/api/migrate/route.ts). `store.ts` also
owns the row→domain-type mappers (`toLeague`, `toPlayer`, …) so API responses
never leak raw Sequelize rows.

**Authorization has three distinct tiers** — pick the right one:

| Tier | Helper | Used for |
| --- | --- | --- |
| Creator only | `requireLeagueCreator` ([leagueAuth.ts](src/lib/leagueAuth.ts)) | Deleting the league, managing co-organizers |
| Creator or co-organizer | `requireLeagueManager` | All other management endpoints |
| League member | `isLeagueMember` ([store.ts](src/lib/store.ts)) | Ledger reads |

Manager status is re-checked on *every* request so revoking a co-organizer takes
effect immediately.

**Player and upload APIs are deliberately anonymous.** Players create cards with
a per-card `creatorToken`, so anyone holding a join link can add a card without
signing in. Do not add session gating to
[api/leagues/[id]/players](src/app/api/leagues/[id]/players/route.ts) or
[api/upload](src/app/api/upload/route.ts).

**`contactNumber` is organizer-only.** The players GET handler strips it for
everyone who can't manage the league. Any new endpoint returning players must do
the same.

**Ledger visibility is membership-based, not `isPublic`-based.** Organizers read
and write drafts, league members read once published, everyone else gets 403 —
even on a public league. A league with no ledger answers `200 { exists: false }`,
not 404.

**Participation certificates are gated on one league timestamp.**
`leagues.certificatesReleasedAt` is null until an organizer hits *Release
Certificates*; only then can players download theirs from `/profile`. That same
stamp is the issue date printed on the certificate, so it goes through
`setCertificatesReleased` rather than `updateLeague` (which deliberately can't
write it). The certificate PNG is **not** public like `/wrapped/poster` — it
names an individual, so serve it only to that player or a league manager, and
404 anything unreleased.

**Publicly shareable routes must be whitelisted in `isPublicPath`** in
[src/proxy.ts](src/proxy.ts). `/watch`, `/wrapped`, `/wrapped/poster`,
`/sponsors` and the OG image routes are public today. The proxy is
defence-in-depth for navigation only — real enforcement lives in the API
handlers via `auth()`.

## Conventions

- API handlers wrap their body in `try/catch`, `console.error` the failure, and
  return `NextResponse.json({ error: '…' }, { status })`. Validate and clamp
  every field from the request body inline before it reaches `store.ts` — see
  the players POST handler for the pattern.
- Path alias is `@/*` → `src/*`.
- Pages default to server components; interactive league screens opt in with
  `'use client'`.
- Metadata, OG images, sitemap and robots all read from
  [src/lib/seo.ts](src/lib/seo.ts) — change site-wide SEO there, not per page.
- **Two different `llms.txt` files.** Root [llms.txt](llms.txt) is the codebase
  map for agents. [src/app/llms.txt/route.ts](src/app/llms.txt/route.ts) serves
  the product-facing `/llms.txt`. Keep both current when features change.

## Images and downloads

Downloads that must look identical across devices are **server-rendered**: the
Auction Wrapped poster is a PNG produced by
[wrapped/poster/route.ts](src/app/leagues/[id]/wrapped/poster/route.ts). Don't
reach for `html2canvas` there — client rasterisation picks up the device's font
fallbacks and breaks the layout on mobile. `html2canvas-pro` is used only in
[DownloadPDFButton.tsx](src/components/DownloadPDFButton.tsx) for card PDFs.

Player cards animate on entry. Keep `cardDropIn` off the element carrying
`transform: scale(...)` — stacking both transforms causes a WebKit-only shift on
mobile.

## Database changes

Schema changes are Sequelize migrations in [migrations/](migrations/), named
`YYYYMMDD00000N-description.js`, applied with `npm run db:migrate`. Never edit a
migration that has already run — add a new one. Update the model in
[src/lib/models.ts](src/lib/models.ts), the domain type in
[src/lib/types.ts](src/lib/types.ts), and the mapper in `store.ts` together;
missing any one of the three silently drops the field from API responses.

## Git and deploys

- **Conventional Commits** — releases and [CHANGELOG.md](CHANGELOG.md) are
  automated by release-please
  ([.github/workflows/release-please.yml](.github/workflows/release-please.yml)).
- Production is deployed **from the working tree via the Vercel CLI**, not from
  git. Merging to `main` does not deploy, and environment-variable changes need
  a redeploy to take effect. Production domain: `pickbid.vercel.app`.
