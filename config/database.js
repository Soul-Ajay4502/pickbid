// Load .env.local in development (Next.js doesn't expose it to CLI tools)
try { require('dotenv').config({ path: '.env.local' }); } catch {}

const ssl = { require: true, rejectUnauthorized: true };

const connection = {
  // Migrations run DDL inside transactions, which PgBouncer's transaction
  // pooling handles badly — so the CLI prefers the direct endpoint.
  // `DATABASE_URL` is the *pooled* one, for the serverless app; this falls back
  // to it only when no direct URL is configured.
  url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  dialect: 'postgres',
  dialectOptions: { ssl },
  logging: false,
};

module.exports = {
  development: connection,
  test:        connection,
  production:  connection,
};
