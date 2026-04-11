-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users ON DELETE CASCADE,
  reminder_text text NOT NULL,
  remind_at timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(remind_at, status) WHERE status = 'pending';
