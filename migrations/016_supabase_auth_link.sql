-- Migration 016: Supabase Auth Link and Verification
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS supabase_uid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_auth BOOLEAN DEFAULT true;

-- Update existing users to have legacy_auth = true if password_hash is present
UPDATE users SET legacy_auth = true WHERE password_hash IS NOT NULL AND legacy_auth IS NULL;
