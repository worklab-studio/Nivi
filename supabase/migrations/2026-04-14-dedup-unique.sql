-- Unique constraint on user_memory for dedup markers
-- Prevents race conditions in trial welcome, poll dedup, etc.
create unique index if not exists idx_user_memory_dedup
  on user_memory(user_id, category, fact)
  where category in ('trial_welcome_sent', 'trial_expiry_sent', 'poll_dedup');
