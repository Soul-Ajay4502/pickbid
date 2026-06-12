#!/usr/bin/env node
/**
 * Data migration tool for player-card-slides Redis databases.
 *
 * Usage (Node 20+):
 *   node --env-file=.env.local scripts/migrate.mjs <command>
 *
 * Commands:
 *   prod-to-dev   Copy all data from production Redis → dev Redis
 *   dev-to-prod   Copy all data from dev Redis → production Redis  ⚠️ careful!
 *   export        Export current UPSTASH_* database to migration.json
 *   import        Import migration.json into current UPSTASH_* database
 *
 * Env vars needed in .env.local:
 *   UPSTASH_REDIS_REST_URL   / UPSTASH_REDIS_REST_TOKEN   → dev database
 *   PROD_REDIS_URL           / PROD_REDIS_TOKEN            → production database
 */

import { Redis } from '@upstash/redis';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const KEYS = ['pcs:leagues', 'pcs:players'];
const EXPORT_FILE = 'migration.json';

const cmd = process.argv[2];
const COMMANDS = ['prod-to-dev', 'dev-to-prod', 'export', 'import'];

if (!cmd || !COMMANDS.includes(cmd)) {
  console.error(`Usage: node --env-file=.env.local scripts/migrate.mjs <${COMMANDS.join('|')}>`);
  process.exit(1);
}

function makeRedis(urlVar, tokenVar) {
  const url   = process.env[urlVar];
  const token = process.env[tokenVar];
  if (!url || !token || url.includes('your_')) {
    console.error(`\n✗ Missing or placeholder env vars: ${urlVar}, ${tokenVar}`);
    console.error('  Fill in the real values in .env.local and try again.\n');
    process.exit(1);
  }
  return new Redis({ url, token });
}

function label(key, data) {
  const count = Array.isArray(data) ? data.length : 0;
  return `${key}  (${count} record${count !== 1 ? 's' : ''})`;
}

async function copyBetween(src, dst) {
  for (const key of KEYS) {
    const data = await src.get(key);
    if (data && Array.isArray(data) && data.length > 0) {
      await dst.set(key, JSON.stringify(data));
      console.log(`  ✓  ${label(key, data)}`);
    } else {
      console.log(`  —  ${key}  (empty, skipped)`);
    }
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

if (cmd === 'prod-to-dev') {
  const prod = makeRedis('PROD_REDIS_URL', 'PROD_REDIS_TOKEN');
  const dev  = makeRedis('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  console.log('\n📦  Copying  prod → dev\n');
  await copyBetween(prod, dev);
  console.log('\n✅  Done!\n');
}

if (cmd === 'dev-to-prod') {
  console.log('\n⚠️   WARNING: this overwrites production data.');
  console.log('    Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise(r => setTimeout(r, 5000));
  const dev  = makeRedis('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  const prod = makeRedis('PROD_REDIS_URL', 'PROD_REDIS_TOKEN');
  console.log('📦  Copying  dev → prod\n');
  await copyBetween(dev, prod);
  console.log('\n✅  Done!\n');
}

if (cmd === 'export') {
  const redis = makeRedis('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  console.log(`\n📤  Exporting to ${EXPORT_FILE}...\n`);
  const out = {};
  for (const key of KEYS) {
    out[key] = await redis.get(key) ?? [];
    console.log(`  ✓  ${label(key, out[key])}`);
  }
  writeFileSync(EXPORT_FILE, JSON.stringify(out, null, 2));
  console.log(`\n✅  Saved to ${EXPORT_FILE}\n`);
}

if (cmd === 'import') {
  if (!existsSync(EXPORT_FILE)) {
    console.error(`\n✗  ${EXPORT_FILE} not found. Run 'export' first.\n`);
    process.exit(1);
  }
  const redis = makeRedis('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  const data  = JSON.parse(readFileSync(EXPORT_FILE, 'utf-8'));
  console.log(`\n📥  Importing from ${EXPORT_FILE}...\n`);
  for (const key of KEYS) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      await redis.set(key, JSON.stringify(data[key]));
      console.log(`  ✓  ${label(key, data[key])}`);
    } else {
      console.log(`  —  ${key}  (empty, skipped)`);
    }
  }
  console.log('\n✅  Done!\n');
}
