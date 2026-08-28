import { Sequelize } from 'sequelize';
// Static import so the bundler and output file tracing include the driver —
// Sequelize's own require('pg') is dynamic and invisible to static analysis.
import pg from 'pg';

// Reuse connection across hot-reloads in dev
const g = global as typeof global & { _sequelize?: Sequelize };

function createSequelize() {
  return new Sequelize(process.env.DATABASE_URL!, {
    dialect: 'postgres',
    dialectModule: pg,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: true },
    },
    // Per warm serverless instance. `DATABASE_URL` should be Neon's *pooled*
    // endpoint (the `-pooler` host) — direct endpoints cap out near 110
    // connections, which a busy auction's fan-out can reach; PgBouncer in front
    // of them does not. Migrations use `DATABASE_URL_UNPOOLED` instead.
    pool: { max: 3, min: 0, idle: 20000, acquire: 30000 },
    logging: false,
  });
}

export const sequelize = g._sequelize ?? createSequelize();
if (process.env.NODE_ENV !== 'production') g._sequelize = sequelize;
