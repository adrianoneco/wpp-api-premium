import { Pool } from 'pg';
import config from '../../config';

const connectionString =
  process.env.DATABASE_URL || process.env.PG_CONNECTION || null;

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'wppconnect',
      }
);

export default pool;
