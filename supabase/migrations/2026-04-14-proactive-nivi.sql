-- Proactive Nivi: posting goals, activity tracking, dashboard events

-- Add posting goal and activity tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_goal integer DEFAULT 4;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nivi_outreach_at timestamptz;

-- Track dashboard events that Nivi can react to
CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  nivi_reacted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_unreacted ON user_events(user_id, nivi_reacted) WHERE nivi_reacted = false;

-- RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_own" ON user_events FOR ALL USING (auth.uid()::text = user_id);

-- Relax user_memory category constraint to allow new categories
ALTER TABLE user_memory DROP CONSTRAINT IF EXISTS user_memory_category_check;
