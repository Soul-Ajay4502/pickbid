#!/usr/bin/env node
/**
 * One-time import of legacy Redis data (pcs:leagues / pcs:players) into Postgres.
 * CLI equivalent of POST /api/migrate — no app session needed.
 *
 * Usage:
 *   npm run db:import-redis -- --creator-email=you@example.com
 *
 * The email decides who owns legacy leagues that have no creatorId stored.
 * That user must already exist in Postgres (sign in to the app once first).
 *
 * Env vars needed in .env.local:
 *   DATABASE_URL              → Postgres (Neon)
 *   UPSTASH_REDIS_REST_URL    → legacy Redis
 *   UPSTASH_REDIS_REST_TOKEN  → legacy Redis
 *
 * Idempotent: rows are inserted with ON CONFLICT DO NOTHING, so re-running is safe.
 */

import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const creatorEmailArg = process.argv.find((a) => a.startsWith('--creator-email='));
const creatorEmail = creatorEmailArg ? creatorEmailArg.split('=')[1] : null;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set — nothing to migrate from.');
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: true },
});

async function main() {
  await db.connect();

  // Resolve the fallback owner for leagues that predate Google sign-in
  let fallbackCreatorId = null;
  if (creatorEmail) {
    const res = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [creatorEmail]);
    if (res.rows.length === 0) {
      console.error(`No user with email ${creatorEmail} found in Postgres.`);
      console.error('Sign in to the app once with that Google account first, then re-run.');
      process.exit(1);
    }
    fallbackCreatorId = res.rows[0].id;
    console.log(`Fallback owner: ${creatorEmail} (${fallbackCreatorId})`);
  }

  const [legacyLeagues, legacyPlayers] = await Promise.all([
    redis.get('pcs:leagues'),
    redis.get('pcs:players'),
  ]);

  const leagues = Array.isArray(legacyLeagues) ? legacyLeagues : [];
  const players = Array.isArray(legacyPlayers) ? legacyPlayers : [];
  console.log(`Redis: ${leagues.length} leagues, ${players.length} players`);

  let importedLeagues = 0;
  let importedPlayers = 0;
  let skipped = 0;

  for (const ll of leagues) {
    let creatorId = ll.creatorId || fallbackCreatorId;
    const email = ll.creatorEmail || creatorEmail || '';

    // If an account with this email already exists, own the league with it —
    // legacy creator ids predate Google sign-in and would collide on the
    // users_email_unique constraint otherwise.
    if (email) {
      const existing = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (existing.rows.length > 0) creatorId = existing.rows[0].id;
    }

    if (!creatorId) {
      console.warn(`SKIP league "${ll.name}" (${ll.id}) — no creatorId in Redis and no --creator-email given`);
      skipped++;
      continue;
    }

    // Make sure the owner row exists (FK); ignore any conflict (id or email)
    await db.query(
      `INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [creatorId, email]
    );

    const res = await db.query(
      `INSERT INTO leagues (id, name, total_players, conducted_by, creator_id, template_id, logo_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
       ON CONFLICT (id) DO NOTHING`,
      [
        ll.id, ll.name, ll.totalPlayers ?? 0, ll.conductedBy ?? '',
        creatorId, ll.templateId ?? 'classic-green', ll.logoUrl ?? '', ll.createdAt ?? null,
      ]
    );
    importedLeagues += res.rowCount;
  }

  for (const p of players) {
    try {
      const res = await db.query(
        `INSERT INTO players (id, league_id, name, photo, batting_type, bowling_type, role, is_wicket_keeper, creator_token, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()))
         ON CONFLICT (id) DO NOTHING`,
        [
          p.id, p.leagueId, p.name, p.photo ?? '',
          p.battingType ?? 'Right-Hand Bat', p.bowlingType ?? 'N/A', p.role ?? 'Batter',
          p.isWicketKeeper ?? false, p.creatorToken ?? '', p.createdAt ?? null,
        ]
      );
      importedPlayers += res.rowCount;
    } catch (err) {
      // Most likely the parent league was skipped above
      console.warn(`SKIP player "${p.name}" (${p.id}): ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone. Imported ${importedLeagues} leagues and ${importedPlayers} players (existing rows untouched, ${skipped} skipped).`);
  await db.end();
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  try { await db.end(); } catch {}
  process.exit(1);
});
