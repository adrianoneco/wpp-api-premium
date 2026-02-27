import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION || null;

// Resolve host and prefer IPv4 loopback to avoid systems where localhost resolves to ::1
let pgHost = process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost';
if (pgHost === 'localhost') pgHost = '127.0.0.1';
const pgPort = Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432);
const pgUser = process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
const pgPassword = String(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '');
const pgDatabase = process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres';

// Helpful debug log (do not print password)
try {
  // eslint-disable-next-line no-console
  console.info(`[postgres] host=${pgHost} port=${pgPort} user=${pgUser} database=${pgDatabase}`);
} catch (e) {}

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: pgHost,
        port: pgPort,
        user: pgUser,
        password: pgPassword,
        database: pgDatabase,
      }
);

export default pool;
