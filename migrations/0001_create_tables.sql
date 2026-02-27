-- 0001_create_tables.sql
-- Creates contacts and messages tables
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
