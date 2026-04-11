-- Phase E.7 — Writing template sample posts + Nivi default template
-- Adds the Nivi house style as the first template, and seeds 1 sample post
-- per existing curated template so the writing-style page can show
-- LinkedIn-style previews.

-- 1. Insert Nivi template (first/default)
insert into writing_template (id, name, author_name, author_headline, hook_style, sentence_style, ending_style, voice_attributes, is_curated, source_posts)
values (
  'nivi-default',
  'Nivi',
  'Nivi',
  'The Nivi house style — sharp, founder-voice, no fluff',
  'Confessional or contrarian one-liner. Short, specific, never generic.',
  'One thought per line. Heavy white space. Contractions always. Specific numbers, never vague.',
  'A real question the reader has a strong opinion on. Never "what do you think?".',
  '{"tone":"warm-direct","person":"first","paragraph_length":1}'::jsonb,
  true,
  array[
    'Most LinkedIn ghostwriters write the same 3 posts on rotation.

I almost did the same thing.

Then I noticed: the posts that actually moved my clients weren''t the polished ones. They were the ones where I left in the messy middle.

The bad first try. The thing they almost quit. The number that scared them.

Posts with friction outperform posts with frameworks. Every time.

What''s the messiest thing you''ve almost not posted?'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  hook_style = excluded.hook_style,
  sentence_style = excluded.sentence_style,
  ending_style = excluded.ending_style,
  source_posts = excluded.source_posts;

-- 2. Backfill sample posts for the existing 8 curated templates
update writing_template set source_posts = array['Most people don''t fail at business building.

They simply never start.

Why?

Because it feels safer to:

→ Read another book
→ Watch another course
→ Listen to another podcast
→ Plan one more spreadsheet

But here''s the thing: research is a form of procrastination dressed in productivity clothes.

The people who win aren''t the ones who know the most.

They''re the ones who started before they were ready.

What did you almost not start?']
where id = 'justin-welsh';

update writing_template set source_posts = array['SEO takes at least 6-12 months.

That''s what every agency tells you.

My client: 425,000 new SEO visitors in 12 months.

Here''s exactly how:

70,000+ traffic in the first 5 months alone.
10,634 leads and 3,786 paid signups total.

We didn''t do anything magical.

We just refused to wait.

Pillar pages from week 1.
Internal links from week 2.
Programmatic SEO from week 4.

If you''re still "building authority" in month 6, you''re doing it wrong.

What''s your fastest SEO win?']
where id = 'jake-ward';

update writing_template set source_posts = array['3 harsh truths I''ve been thinking about lately:

1. Most successful people I''ve met aren''t that smart. They move fast, they take risks, they work a lot. That''s it.

2. The "passion economy" is mostly cope. Boring businesses that solve real problems make 10x the money of "passionate" ones that don''t.

3. Your network is your net worth — but only if you''re actually useful to it. Lurkers don''t get rich.

The world rewards action over IQ. Always has.

Which one stings the most?']
where id = 'codie-sanchez';

update writing_template set source_posts = array['Stop trying to find your passion.

Find a problem you can solve.

Solve it 100 times.

Get good at it.

Then charge more for it.

Then hire someone to do it.

Then build a system around it.

Then sell the system.

That''s it. That''s the whole game.

Passion comes from competence. Not the other way around.

Which step are you stuck on?']
where id = 'alex-hormozi';

update writing_template set source_posts = array['How do you become a great writer in 90 days?

Here''s the framework I used:

Step 1 — Write every day, no exceptions.
30 minutes minimum. Bad days count.

Step 2 — Steal structure, not voice.
Find 3 writers you love. Reverse-engineer their hooks.

Step 3 — Publish weekly.
Posting forces clarity. Drafts hide bad thinking.

Step 4 — Track what lands.
Save your top 10 posts. Notice the pattern.

Step 5 — Repeat the pattern, not the post.
Reuse the structure with new ideas.

That''s it. No course, no coach.

What''s stopping you from writing today?']
where id = 'dickie-bush';

update writing_template set source_posts = array['Marcus Aurelius woke up at 4am to write a private journal nobody was supposed to read.

2,000 years later, it''s the most quoted self-help book in history.

The lesson isn''t "wake up early" or "journal daily".

It''s this: the most valuable things you create are usually the ones you make for an audience of one.

Your best ideas live in the spaces between obligations.

The shower thoughts. The walk-home musings. The notebook nobody asked for.

Build the habit of capturing them. The audience comes later.

What''s in your notebook this week?']
where id = 'sahil-bloom';

update writing_template set source_posts = array['I almost didn''t post for a year.

Imposter syndrome ate me alive. Every time I opened LinkedIn I thought: "who am I to say this?"

Then I noticed something.

The creators I admired weren''t the smartest. They were the most vulnerable.

So I tried it. I posted about a client meeting that went badly. I posted about a rejection. I posted about doubting myself.

Those posts got 10x my normal engagement.

Vulnerability isn''t weakness. It''s the only thing that breaks through the noise.

What''s the post you''re scared to publish?']
where id = 'lara-acosta';

update writing_template set source_posts = array['Here''s the system I used to grow from 0 → 100k followers in 18 months:

→ Pick 3 content pillars. Stick to them for 90 days.
→ Write 5 posts per week. Same days, same times.
→ Reply to every comment in the first hour.
→ Repurpose top performers across 3 platforms.
→ Track engagement weekly. Double down on what works.

That''s the entire system. No tricks, no growth hacks.

The boring system beats the exciting tactic every time.

What''s in your weekly system?']
where id = 'matt-gray';
