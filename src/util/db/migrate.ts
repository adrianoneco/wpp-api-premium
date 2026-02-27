#!/usr/bin/env tsx
/* Run SQL migration files in ./migrations in alphabetical order */

try { require('dotenv').config(); } catch {}
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function run() {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('No migrations directory found at', migrationsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('No SQL migrations to run.');
    process.exit(0);
  }

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || process.env.PGPORT || 5432),
    user: process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
    password: String(process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || ''),
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || 'postgres',
  });

  try {
    const client = await pool.connect();
    try {
      for (const file of files) {
        const full = path.join(migrationsDir, file);
        const sql = fs.readFileSync(full, 'utf8');
        console.log('Running migration', file);
        await client.query(sql);
      }
      console.log('Migrations applied successfully');
    } finally {
      client.release();
    }
    process.exit(0);
  } catch (err: any) {
    console.error('Migration failed:', err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
