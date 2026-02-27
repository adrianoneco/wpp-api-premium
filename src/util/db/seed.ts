async function run() {
  try {
    // load env before importing postgres so .env values are available
    try {
      require('dotenv').config();
    } catch {}
    const postgresModule = await import('./postgres');
    const pool = postgresModule.default;

    console.info('Running DB push/seed...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT,
        pushname TEXT,
        phone TEXT,
        raw JSONB
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session TEXT,
        chat_id TEXT,
        author TEXT,
        body TEXT,
        timestamp BIGINT,
        is_media BOOLEAN,
        media_path TEXT,
        raw JSONB
      );
    `);

    // Insert a sample contact if not exists
    const sampleId = '5511999999999@c.us';
    const res = await pool.query('SELECT id FROM contacts WHERE id = $1', [sampleId]);
    if (res.rowCount === 0) {
      await pool.query(
        'INSERT INTO contacts(id,name,pushname,phone,raw) VALUES($1,$2,$3,$4,$5)',
        [sampleId, 'Seed Contact', 'Seed', '5511999999999', JSON.stringify({ seeded: true })]
      );
      console.info('Inserted sample contact', sampleId);
    } else {
      console.info('Sample contact already present');
    }

    console.info('DB push/seed finished');
    process.exit(0);
  } catch (e: any) {
    console.error('DB seed failed:', e?.message || e);
    process.exit(1);
  }
}

run();
