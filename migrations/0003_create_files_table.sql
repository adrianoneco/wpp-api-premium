-- 0003_create_files_table.sql
-- Create files table to store uploaded file metadata
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  original_name TEXT,
  stored_path TEXT NOT NULL,
  session TEXT,
  mime TEXT,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Note: UUID generation on insert can use gen_random_uuid() if pgcrypto is available,
-- or you can provide UUIDs from the application (recommended for portability).
