-- Migration 017: Backfill email_verified for legacy users with password hashes
UPDATE users
SET email_verified = true
WHERE password_hash IS NOT NULL
  AND deleted_at IS NULL
  AND email_verified = false;
