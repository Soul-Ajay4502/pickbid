// Load .env.local in development (Next.js doesn't expose it to CLI tools)
try { require('dotenv').config({ path: '.env.local' }); } catch {}

const ssl = { require: true, rejectUnauthorized: true };

const connection = {
  url: process.env.DATABASE_URL,
  dialect: 'postgres',
  dialectOptions: { ssl },
  logging: false,
};

module.exports = {
  development: connection,
  test:        connection,
  production:  connection,
};
