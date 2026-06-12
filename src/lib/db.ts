import { Sequelize } from 'sequelize';

// Reuse connection across hot-reloads in dev
const g = global as typeof global & { _sequelize?: Sequelize };

function createSequelize() {
  return new Sequelize(process.env.DATABASE_URL!, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    pool: { max: 3, min: 0, idle: 20000, acquire: 30000 },
    logging: false,
  });
}

export const sequelize = g._sequelize ?? createSequelize();
if (process.env.NODE_ENV !== 'production') g._sequelize = sequelize;
