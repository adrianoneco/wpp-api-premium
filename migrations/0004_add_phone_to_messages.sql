-- Add phone column to messages table
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Backfill phone for existing rows where possible (strip suffix like @c.us)
UPDATE messages SET phone = split_part(coalesce(author, chat_id, ''), '@', 1) WHERE phone IS NULL;
