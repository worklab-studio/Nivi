-- ═══════════════════════════════════════════════
-- Phase E — Identity + Writing Style
-- Run in Supabase SQL editor
-- ═══════════════════════════════════════════════

create table if not exists brand_identity (
  user_id text primary key references users on delete cascade,
  about_you text,
  your_story text,
  offers jsonb default '[]'::jsonb,
  target_audience jsonb default '[]'::jsonb,
  personal_info jsonb default '[]'::jsonb,
  active_template_id text,
  writing_preferences jsonb default '[]'::jsonb,
  hook_style text,
  sentence_style text,
  ending_style text,
  content_pillars jsonb default '[]'::jsonb,
  linkedin_imported_at timestamptz,
  domain_url text,
  domain_imported_at timestamptz,
  memory_imported_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists writing_template (
  id text primary key,
  user_id text references users on delete cascade,
  name text not null,
  author_name text,
  author_headline text,
  source_posts text[],
  hook_style text,
  sentence_style text,
  ending_style text,
  voice_attributes jsonb default '{}'::jsonb,
  is_curated boolean default false,
  created_at timestamptz default now()
);

create index if not exists writing_template_user_idx on writing_template(user_id);
create index if not exists writing_template_curated_idx on writing_template(is_curated);

-- Curated template seed
insert into writing_template (id, name, author_name, author_headline, hook_style, sentence_style, ending_style, voice_attributes, is_curated)
values
  ('justin-welsh', 'Justin Welsh', 'Justin Welsh', 'The Solopreneur Thought Leader', 'Bold contrarian one-liner followed by a single-word "Why?" hook', 'Short punchy sentences. Heavy line breaks. Listicle structure with arrows.', 'CTA to follow + value-add reminder', '{"tone":"direct","person":"first","paragraph_length":1}'::jsonb, true),
  ('jake-ward', 'Jake Ward', 'Jake Ward', 'The Leading SEO Creator', 'Stat-driven hook with concrete client outcome', 'Mix of short and medium sentences. Numbers everywhere.', 'Soft pitch + lessons learned bullet', '{"tone":"data-driven","person":"first","paragraph_length":2}'::jsonb, true),
  ('codie-sanchez', 'Codie Sanchez', 'Codie Sanchez', 'The Business Buying Queen', 'Numbered "harsh truths" hook', 'Sharp, almost aphoristic. Dense business wisdom.', 'Quote + question to reader', '{"tone":"contrarian","person":"first","paragraph_length":2}'::jsonb, true),
  ('alex-hormozi', 'Alex Hormozi', 'Alex Hormozi', 'The Acquisition Master', 'Direct command or universal truth statement', 'Choppy. One thought per line. No filler.', 'Repeated key insight', '{"tone":"authoritative","person":"second","paragraph_length":1}'::jsonb, true),
  ('dickie-bush', 'Dickie Bush', 'Dickie Bush', 'The Writing Coach', 'Question hook that promises a framework', 'Step-by-step with numbered headers and clean spacing.', 'Recap + invitation to reply', '{"tone":"teacherly","person":"second","paragraph_length":2}'::jsonb, true),
  ('sahil-bloom', 'Sahil Bloom', 'Sahil Bloom', 'The Curiosity Chronicles', 'Intriguing fact or paradox hook', 'Storytelling with metaphors and historical references.', 'Lesson + share request', '{"tone":"thoughtful","person":"first","paragraph_length":3}'::jsonb, true),
  ('lara-acosta', 'Lara Acosta', 'Lara Acosta', 'The Personal Branding Expert', 'Vulnerable confession hook', 'Conversational with rhetorical questions.', 'Emotional payoff + soft CTA', '{"tone":"warm","person":"first","paragraph_length":2}'::jsonb, true),
  ('matt-gray', 'Matt Gray', 'Matt Gray', 'The Systems Builder', 'Bold framework reveal', 'Headers with bullet supports. Heavy on systems language.', 'Framework recap + free resource', '{"tone":"systematic","person":"first","paragraph_length":1}'::jsonb, true)
on conflict (id) do nothing;
