-- ═══════════════════════════════════════════════
-- NIVI — Compose author cache (2026-04-09)
-- Paste in Supabase SQL editor.
-- ═══════════════════════════════════════════════
--
-- Caches the user's actual LinkedIn name + headline + avatar URL so the
-- /compose page LinkedIn preview shows the real profile instead of a
-- generic name. Refreshed via getCachedLinkedInProfile() with a 24h TTL,
-- backed by a Unipile /api/v1/users/me call. Falls back to Clerk values
-- if Unipile is unreachable.

alter table users
  add column if not exists linkedin_display_name text,
  add column if not exists linkedin_headline text,
  add column if not exists linkedin_avatar_url text,
  add column if not exists linkedin_profile_fetched_at timestamptz;
