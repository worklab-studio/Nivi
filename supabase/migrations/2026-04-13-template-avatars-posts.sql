-- Phase E.9 — Template avatars + stronger sample posts
-- Adds avatar_url column, upserts Nivi default, and replaces source_posts
-- for all curated templates with substantive multi-paragraph examples.
-- Avatars use unavatar.io which proxies from LinkedIn / Twitter / generic.

alter table writing_template add column if not exists avatar_url text;

-- 1. Nivi default (idempotent — insert or update)
insert into writing_template (
  id, name, author_name, author_headline, hook_style, sentence_style,
  ending_style, voice_attributes, is_curated, avatar_url, source_posts
) values (
  'nivi-default',
  'Nivi',
  'Nivi',
  'The Nivi house style — sharp, founder-voice, no fluff',
  'Confessional or contrarian one-liner. Short, specific, never generic.',
  'One thought per line. Heavy white space. Contractions always. Specific numbers, never vague.',
  'A real question the reader has a strong opinion on. Never "what do you think?".',
  '{"tone":"warm-direct","person":"first","paragraph_length":1}'::jsonb,
  true,
  null,
  array[
    'Most LinkedIn ghostwriters write the same 3 posts on rotation.

I almost did the same thing.

Then I noticed: the posts that actually moved my clients weren''t the polished ones. They were the ones where I left in the messy middle.

The bad first try.

The thing they almost quit.

The number that scared them.

Posts with friction outperform posts with frameworks. Every time.

What''s the messiest thing you''ve almost not posted?'
  ]
) on conflict (id) do update set
  name = excluded.name,
  author_name = excluded.author_name,
  author_headline = excluded.author_headline,
  hook_style = excluded.hook_style,
  sentence_style = excluded.sentence_style,
  ending_style = excluded.ending_style,
  voice_attributes = excluded.voice_attributes,
  source_posts = excluded.source_posts;

-- 2. Justin Welsh
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/justinwelsh',
  source_posts = array['I made $5.4M in 4 years.

Solo. No team. No office. No VC.

Here''s the truth no one talks about:

→ The first year was painfully quiet
→ The second year I almost quit twice
→ The third year I finally "got" it
→ The fourth year compounded everything

If you''re in year one right now, please read this carefully:

Your "overnight success" is going to take 3-5 years of boring, repetitive, unsexy work.

That''s the deal.

Most people won''t pay it.

That''s why the reward is so large for the ones who do.

What year are you in?']
where id = 'justin-welsh';

-- 3. Jake Ward
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/jakemward',
  source_posts = array['SEO is supposed to take 12+ months.

We hit 1.2M monthly organic visitors in 8.

Here''s the exact playbook (steal this):

1. We skipped "authority building"
Everyone says build topical authority first. We didn''t. We went straight for high-intent transactional keywords on day one.

2. Programmatic SEO from week 2
1 template → 8,000 pages → ranking for 40,000 keywords.

3. Internal linking as a weapon
Every new page linked to 20+ existing ones. Our crawl depth dropped from 7 to 3.

4. We published every single day
Not once a week. Every day. 260 posts in year one.

5. We ignored "quality over quantity"
Quality AND quantity. Not either/or.

The teams that still believe SEO is slow are the ones still doing SEO the slow way.

What''s your biggest SEO misconception?']
where id = 'jake-ward';

-- 4. Codie Sanchez
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/codiesanchez',
  source_posts = array['I bought a laundromat for $150K.

Everyone said I was crazy.

It now cash flows $12K/month.

Here are 5 boring businesses that print money while everyone chases the next shiny startup:

1. Laundromats — recession proof, cash heavy, 25% margins
2. Car washes — recurring revenue, low staff, 35% margins
3. Vending routes — $500K+ per year, 4 hours a week
4. Self-storage — the quiet billion-dollar industry
5. Mobile home parks — boring + essential + underpriced

The secret nobody tells you:

Sexy businesses have 100 competitors fighting for scraps.

Boring businesses have 2 competitors who both want to retire.

Which one would you rather buy into?']
where id = 'codie-sanchez';

-- 5. Alex Hormozi
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/alexhormozi',
  source_posts = array['You don''t need more customers.

You need better offers.

I went from $3M → $100M using this one shift.

Old offer: "Join my gym, $99/month."
New offer: "6 weeks to your goal weight or your money back + $500."

Same gym. Same coaches. Same equipment.

10x the conversions.

Here''s the formula:

Value = (Dream Outcome × Perceived Likelihood) ÷ (Time × Effort)

To make your offer irresistible, you have 4 levers:

→ Increase the dream outcome
→ Increase perceived likelihood (guarantees, proof)
→ Decrease time to result
→ Decrease effort required

Most founders pull only one lever.

Pull all four. Watch what happens.

Which lever are you not pulling?']
where id = 'alex-hormozi';

-- 6. Dickie Bush
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/dickiebush',
  source_posts = array['I wrote online for 4 years before anyone cared.

Then I discovered the framework that took me from 0 → 500K followers in 18 months.

It''s called Ship 30 for 30.

Here it is, free:

Day 1-10: Write about what you know
Pick 3 topics you can talk about for hours. Write 1 post per day on each rotation.

Day 11-20: Write what confused you recently
The best writing comes from the gap between "I didn''t understand this" and "now I do."

Day 21-30: Write what people ask you
If 3 people have asked you the same thing, that''s a post.

The rule: ship every day. Bad ships count. Tired ships count. "This isn''t my best work" ships especially count.

Consistency beats perfection 100/100 times.

What stops you from shipping daily?']
where id = 'dickie-bush';

-- 7. Sahil Bloom
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/sahilbloom',
  source_posts = array['In 1968, a Stanford professor told 4-year-olds they could have one marshmallow now, or two if they waited 15 minutes.

Decades later, he tracked them down.

The kids who waited had better SAT scores, better jobs, and better lives.

The experiment became famous as "proof" that willpower is destiny.

But here''s what almost nobody mentions:

A 2018 replication found the original study was flawed. Family wealth predicted the outcomes far more than the marshmallow.

The real lesson isn''t about willpower.

It''s about environment.

The kids who waited came from homes where promises were kept. Where "I''ll be back in 15 minutes" meant someone came back.

Your discipline isn''t a character trait. It''s a function of the trust you''ve built — in others, and in yourself.

Build trustworthy environments. The willpower follows.

What promise have you been keeping to yourself lately?']
where id = 'sahil-bloom';

-- 8. Lara Acosta
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/laraacostam',
  source_posts = array['3 years ago I was a clueless marketing grad in Madrid with 200 followers.

Today: 250K+ followers, a 6-figure personal brand, and clients on 4 continents.

Here''s what nobody told me when I started:

1. You don''t need a big following to make big money.
My first $10K client came at 4,000 followers. The audience isn''t the product. The clarity is.

2. Vulnerability scales trust faster than expertise.
The post that changed my life was about failing my first launch. Not a framework. A failure.

3. Nobody cares about your niche until you care about one person in it.
Stop writing for "solopreneurs." Start writing for Sarah, who works at a bank and hates her job.

4. Consistency compounds in ways you can''t see until month 12.
I posted every single day for 18 months before anything clicked. Then everything clicked at once.

5. Your weirdness is your moat.
The things you were told to hide in your resume are the things people will follow you for online.

Which one did you need to hear today?']
where id = 'lara-acosta';

-- 9. Matt Gray
update writing_template set
  avatar_url = 'https://unavatar.io/linkedin/themattgray',
  source_posts = array['I built a $14M+ business working 4 hours a day.

Here''s the exact 5-step system (free):

Step 1 — The 80/20 Audit
Every Sunday I list every task I did that week and mark which ones produced revenue. 80% of the list gets eliminated, delegated, or automated by Monday.

Step 2 — The Content Flywheel
1 long-form piece per week → cut into 10 posts → cross-posted to 4 platforms. 1 creator, 40 touchpoints.

Step 3 — The Async Operating Rhythm
No meetings before 11am. No meetings on Fridays. Every "meeting" under 15 min is a Loom instead.

Step 4 — The Revenue Stack
3 products at 3 price points: $49, $997, $25K. Low-ticket builds audience, mid-ticket builds cash flow, high-ticket builds freedom.

Step 5 — The Boring Part
Show up every day for 1,000 days. Zero exceptions.

The system isn''t the magic. The consistency is.

Which step will you start with this week?']
where id = 'matt-gray';
