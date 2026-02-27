async function run() {
  try {
    try { require('dotenv').config(); } catch {}
    const mongo = await import('./mongo');
    const instance = process.env.SESSION_NAME || 'default';
    const { Contact } = await mongo.getModels(instance);

    console.info('Running Mongo DB seed...');

    const sampleId = '5511999999999@c.us';
    const existing = await Contact.findOne({ wa_id: sampleId }).lean();
    if (!existing) {
      await Contact.create({ wa_id: sampleId, name: 'Seed Contact', pushname: 'Seed', phone: '5511999999999', raw: { seeded: true } });
      console.info('Inserted sample contact', sampleId);
    } else {
      console.info('Sample contact already present');
    }

    console.info('Mongo DB seed finished');
    process.exit(0);
  } catch (e: any) {
    console.error('DB seed failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

run();
