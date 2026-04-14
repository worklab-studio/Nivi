-- Apify LinkedIn profile cache
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_profile_cache jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_profile_cached_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_public_identifier text;
