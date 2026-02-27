-- 0002_seed_sample_contact.sql
-- Inserts a sample seed contact if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = '5511999999999@c.us') THEN
    INSERT INTO contacts (id, name, pushname, phone, raw)
    VALUES ('5511999999999@c.us', 'Seed Contact', 'Seed', '5511999999999', '{"seeded": true}'::jsonb);
  END IF;
END$$;
