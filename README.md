# 🏏 Cricket Cards

**Run cricket leagues like a pro.** Design premium player cards, host real-time auctions, track live leaderboards, and share it all with a single link — beautifully, in one place.

Cricket Cards is a full-stack [Next.js](https://nextjs.org) app for organisers of local and amateur cricket leagues. Create a league, build broadcast-quality player cards, run a live auction that spectators can follow from any browser, record match results, and export squad sheets — all without anyone needing to install an app.

> Live: https://player-card-generator.vercel.app

---

## Features

| Area | What it does |
| --- | --- |
| 🎴 **Player cards** | Upload a photo, add stats and ratings, and get gorgeous cards rendered from 12 colour templates. |
| 🔨 **Live auctions** | Put players under the hammer in a real-time bidding room. Budgets, squads and reserve-per-slot limits update instantly. |
| 📺 **Watch mode** | Broadcast a public link so fans mirror every bid and reveal live — no sign-in required. |
| 🏆 **Leaderboard** | Standings that recompute the moment a match result lands. |
| 📊 **Analytics** | Squad spend, balance and value at a glance. |
| 👥 **Teams & officials** | Manage rosters, owners and non-playing team officials (coach, manager) with budget tracking. |
| 🗓️ **Matches** | Record fixtures, scores and winners. |
| 📄 **Export & share** | One-tap PDF squad sheets and WhatsApp sharing for cards, results and links. |
| 🌍 **Discover** | A public directory of leagues that opt in. |
| 🌓 **Polish** | Installable PWA, light/dark themes, Google sign-in, full SEO/OG image support. |

## Tech stack

- **Framework** — Next.js 16 (App Router, React 19, TypeScript)
- **Styling** — Tailwind CSS v4, `tw-animate-css`, shadcn/ui + Base UI primitives, Motion, Lucide icons
- **Auth** — NextAuth v5 (Auth.js) with Google as the sole provider
- **Database** — PostgreSQL ([Neon](https://neon.tech)) via **Sequelize**; `sequelize-cli` for migrations
- **Media** — Cloudinary for image upload/transforms
- **Messaging** — WhatsApp Cloud API for card/result broadcasts
- **PDF** — `jspdf` + `html2canvas-pro`
- **Hosting** — Vercel (Analytics + Speed Insights)

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (a free [Neon](https://neon.tech) project works well)
- Google OAuth credentials, and Cloudinary credentials for image upload

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file (see variables below)
cp .env.example .env.local   # then fill in the values

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string (SSL required). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth for sign-in. |
| `AUTH_SECRET` | ✅ | NextAuth session encryption secret. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ✅ | Image uploads and transforms. |
| `NEXT_PUBLIC_SITE_URL` | – | Canonical site URL; set when using a custom domain. Falls back to the Vercel production URL. |
| `WHATSAPPAPIKEY` / `WHATSAPPAPIURL` / `FROM_NUMBER` | – | WhatsApp Cloud API broadcasts. |
| `WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANG` | – | WhatsApp message template config. |
| `GOOGLE_SITE_VERIFICATION` | – | Google Search Console verification tag. |
| `MIGRATE_ADMIN_EMAIL` | – | Gate for the one-off Redis→Postgres import endpoint. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | – | Source for the legacy Redis import only. |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |

## Project structure

```
src/
├── app/                       # App Router — pages + API routes
│   ├── api/                   # Route handlers
│   │   ├── auth/[...nextauth] # NextAuth handlers
│   │   ├── leagues/           # League CRUD, players, teams, officials,
│   │   │                      #   matches, auction live/reset, clone, join, public
│   │   ├── profile/           # User profile
│   │   ├── upload/            # Cloudinary image upload
│   │   └── migrate/           # One-off Redis→Postgres import (admin-gated)
│   ├── leagues/[id]/          # Squad, auction, watch, leaderboard, analytics,
│   │                          #   matches, teams, players (new/edit), clone
│   ├── leagues/discover/      # Public league directory
│   ├── leagues/new/           # Create a league
│   ├── profile/               # Player profile page
│   └── (layout, manifest, sitemap, robots, OG/twitter images, icons)
├── components/                # PlayerCard, PlayerForm, NavBar, landing, ui/ (shadcn)
├── lib/                       # db, models, types, templates, store, seo,
│                              #   cloudinary, whatsapp, squadPdf, utils
└── types/                     # next-auth type augmentation
config/                        # Sequelize CLI database config
migrations/                    # Sequelize migrations
scripts/                       # favicon gen, redis import, migrate helpers
data/                          # Seed JSON (leagues, players)
```

## Data model

PostgreSQL tables (see [src/lib/models.ts](src/lib/models.ts)):

- **users** — Google-authenticated accounts and their default player profile.
- **leagues** — a tournament; owned by a creator, optionally public with a join code.
- **teams** — squads within a league, each with a budget, colour and max size.
- **players** — cards within a league; carry batting/bowling type, role, stats, and auction state (team, sold price, icon/unsold flags).
- **team_officials** — non-playing members (coach, manager, owner).
- **matches** — fixtures with scores and a winner.
- **auction_live** — one ephemeral JSON blob per league holding live auction state, written by the creator and polled by spectators.

### Auth model

Sign-in is Google-only via NextAuth. **Player and upload APIs do not require a session** — anonymous players create cards using a per-card `creatorToken`, so anyone with a league's join link can add their own card. Don't add session gating to those routes.

## Deployment

Deployed to **Vercel**. The production deploy is pushed from the working tree via the Vercel CLI (not auto-deployed from git), so environment-variable changes require a redeploy to take effect.

Releases are automated with [release-please](https://github.com/googleapis/release-please) (see [.github/workflows/release-please.yml](.github/workflows/release-please.yml)); use Conventional Commit messages.

---

## Note for AI agents

This project pins **Next.js 16**, which has breaking changes relative to older training data. Before writing code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices. See [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt).
