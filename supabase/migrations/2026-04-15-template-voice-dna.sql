-- Phase E.13 — Deep voice DNA for writing templates
-- Adds voice_dna jsonb column and backfills the 7 curated templates
-- (Nivi default + 6 creators) with hand-crafted multi-dimensional DNA
-- based on their existing source_posts[0] sample post.

alter table writing_template add column if not exists voice_dna jsonb;

-- ─────────────────────────────────────────────────────────────
-- Nivi default
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Contrarian observation about the category the writer is in + quiet self-confession that they almost fell into the same trap",
    "example": "Most LinkedIn ghostwriters write the same 3 posts on rotation. I almost did the same thing.",
    "why_it_works": "Pairs insider credibility with vulnerability — the reader trusts the writer because they admit the temptation they overcame."
  },
  "logic_flow": [
    "Hook: contrarian observation about the writer's own category",
    "Confession: 'I almost did the same thing'",
    "Pivot: 'Then I noticed something'",
    "Insight reveal: what actually works, broken into 1-line beats",
    "Concrete receipts: the messy middle, the bad first try, the number that scared them",
    "Payoff: a sharp absolute ('X beats Y. Every time.')",
    "Reframe: optimize for replies over reach, DMs over likes",
    "Close: pointed self-identification question"
  ],
  "rhetorical_devices": [
    "Asyndeton — one-line beats stacked without connective tissue",
    "Antithesis — 'Polished posts get likes. Messy posts get DMs.'",
    "Confession hook — disarms the reader's skepticism before the pitch",
    "Epistrophe — 'Every time.' as a closing hammer"
  ],
  "sentence_rhythm": {
    "avg_line_length": "5-9 words",
    "paragraph_pattern": "1-1-1-1-1-1-1 with occasional 2-line expansions",
    "pacing": "Stark single-line beats throughout — every sentence earns its line"
  },
  "vocabulary_signature": {
    "signature_words": ["messy middle", "bad first try", "the number that scared them", "one person in the comments", "that person pays", "every time"],
    "avoided_words": ["excited", "thrilled", "journey", "grateful", "humbled", "leverage", "unlock", "seamless"]
  },
  "psychological_hooks": [
    "Insider credibility — writer admits being tempted by the cliché",
    "Contrarian authority — 'polished gets likes, messy gets DMs' inverts conventional wisdom",
    "Concrete scarcity — 'one person in the comments' is the real metric",
    "Self-identification — closing question forces the reader to name their own messy thing"
  ],
  "formatting_patterns": {
    "uses_bullets": false,
    "bullet_style": "none",
    "uses_bold": false,
    "whitespace": "blank line after every sentence — maximum breathing room",
    "line_breaks": "aggressive"
  },
  "closing_pattern": {
    "technique": "Self-identification question naming a specific emotional state",
    "example": "What's the messiest thing you've almost not posted?",
    "psychology": "Invites the reader to confess something they were already thinking about — the best replies write themselves."
  }
}
$$::jsonb where id = 'nivi-default';

-- ─────────────────────────────────────────────────────────────
-- Justin Welsh
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Concrete dollar amount + timeframe → period-separated self-disqualifiers → 'here's the truth no one talks about' contrarian pivot",
    "example": "I made $5.4M in 4 years. Solo. No team. No office. No VC.",
    "why_it_works": "The number is specific enough to feel real; the period-separated fragments are ego-bait and reading-rhythm in one move — each fragment is a breath."
  },
  "logic_flow": [
    "Hook: concrete achievement with surprising specificity",
    "Qualifiers: period-separated fragments disqualifying easy explanations",
    "Pivot: insider framing ('here's the truth no one talks about')",
    "Timeline breakdown: 3-5 arrow beats showing year-by-year progression",
    "Direct address: 'if you're in year one right now, please read this carefully'",
    "Payoff: short absolute statement ('That's the deal.')",
    "Reward framing: 'most people won't pay it' + 'that's why the reward is so large'",
    "Close: binary self-placement question"
  ],
  "rhetorical_devices": [
    "Asyndeton — period fragments without conjunctions create velocity",
    "Anaphora — 'The first year / The second year' repeated openings build momentum",
    "Interrogatio — closes with a question that demands self-categorization",
    "Contrarian authority — 'the truth no one talks about' creates insider status"
  ],
  "sentence_rhythm": {
    "avg_line_length": "6-10 words",
    "paragraph_pattern": "1-1-1-4-1-1-1-1-1 lines per paragraph",
    "pacing": "Stark-stark-stark-expansion-stark — compression builds tension, expansion releases it"
  },
  "vocabulary_signature": {
    "signature_words": ["Solo", "That's the deal", "boring", "repetitive", "unsexy", "compounded", "overnight success"],
    "avoided_words": ["excited", "thrilled", "journey", "grateful", "humbled", "blessed", "leverage"]
  },
  "psychological_hooks": [
    "Curiosity gap — the number invites the reader to find out how",
    "Social proof — $5.4M as self-evident credential, no external validation needed",
    "Contrarian authority — positions the writer as seeing through the hype",
    "Self-identification — the closing question forces the reader into the story"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "arrow (→)",
    "uses_bold": false,
    "whitespace": "blank line between every 1-2 lines",
    "line_breaks": "aggressive"
  },
  "closing_pattern": {
    "technique": "Binary rhetorical question forcing the reader into a specific category",
    "example": "What year are you in?",
    "psychology": "Categorical self-placement has a much higher reply rate than open-ended questions — the reader already has an answer the moment they read the hook."
  }
}
$$::jsonb where id = 'justin-welsh';

-- ─────────────────────────────────────────────────────────────
-- Jake Ward
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Conventional wisdom as the premise → concrete outsized result that breaks it → 'here's the exact playbook' promise",
    "example": "SEO is supposed to take 12+ months. We hit 1.2M monthly organic visitors in 8.",
    "why_it_works": "Frames the writer as the exception to a rule the reader has already accepted — curiosity + utility in one move."
  },
  "logic_flow": [
    "Hook: state the conventional timeline, then break it with a number",
    "Utility promise: 'here's the exact playbook (steal this)'",
    "Numbered breakdown: 5 tactics, each with a bold header + 1-2 sentence explanation",
    "Each tactic contrasts with what everyone else does ('Everyone says X. We didn't.')",
    "Recap: the one-line lesson ('The teams that still believe SEO is slow are the ones still doing SEO the slow way.')",
    "Close: pointed question asking the reader to name their misconception"
  ],
  "rhetorical_devices": [
    "Antithesis — 'Everyone says X. We didn't.' used in every tactic",
    "Specificity as credibility — 40,000 keywords, 260 posts, 1.2M visitors",
    "Imperative framing — 'steal this' gives permission to use the playbook",
    "Parallel structure — each numbered tactic follows the same format"
  ],
  "sentence_rhythm": {
    "avg_line_length": "10-14 words",
    "paragraph_pattern": "1-1-1 then numbered blocks with 2-3 lines each, closing 1-1 beats",
    "pacing": "Declarative punch lines with short explanatory follow-ups"
  },
  "vocabulary_signature": {
    "signature_words": ["exact playbook", "steal this", "Everyone says", "We didn't", "crawl depth", "high-intent", "either/or"],
    "avoided_words": ["leverage", "synergy", "thought leadership", "content strategy"]
  },
  "psychological_hooks": [
    "Utility bait — 'exact playbook (steal this)' promises copy-paste value",
    "Specificity as proof — the numbers feel verifiable",
    "Contrarian authority — each tactic inverts a best practice",
    "Tribal signaling — readers who agree feel like insiders"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "numbered (1. 2. 3.)",
    "uses_bold": true,
    "whitespace": "blank line between each numbered tactic",
    "line_breaks": "moderate"
  },
  "closing_pattern": {
    "technique": "Ask the reader to name something they believe that the post just disproved",
    "example": "What's your biggest SEO misconception?",
    "psychology": "Once a reader has seen the counter-evidence, naming their own misconception is a low-friction way to engage."
  }
}
$$::jsonb where id = 'jake-ward';

-- ─────────────────────────────────────────────────────────────
-- Codie Sanchez
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Specific unglamorous purchase + dollar amount → 'Everyone said I was crazy' → current cash flow",
    "example": "I bought a laundromat for $150K. Everyone said I was crazy. It now cash flows $12K/month.",
    "why_it_works": "Boring asset + social rejection + quiet victory = the exact shape of a contrarian flex."
  },
  "logic_flow": [
    "Hook: unglamorous purchase with dollar amount",
    "Social disapproval beat: 'Everyone said I was crazy'",
    "Payoff: current cash flow as proof",
    "Setup for list: 'Here are X boring businesses that print money'",
    "Numbered list of assets with: margin, frequency, moat attribute",
    "Secret reveal: 'the secret nobody tells you'",
    "Antithesis: sexy vs boring business landscape",
    "Close: forced-choice rhetorical question"
  ],
  "rhetorical_devices": [
    "Antithesis — sexy vs boring, fighting for scraps vs want to retire",
    "Listicle structure with specificity — margins, hours, outcomes",
    "Social-disapproval framing — 'everyone said I was crazy' builds contrarian credibility",
    "Tactile specificity — laundromats, car washes, mobile home parks"
  ],
  "sentence_rhythm": {
    "avg_line_length": "8-12 words",
    "paragraph_pattern": "1-1-1-1 then numbered block then 1-1-1-1 close",
    "pacing": "Declarative fragments punctuated by occasional longer reveal lines"
  },
  "vocabulary_signature": {
    "signature_words": ["boring", "recession proof", "cash flows", "print money", "fighting for scraps", "the secret nobody tells you"],
    "avoided_words": ["disruptive", "innovative", "game-changing", "revolutionary"]
  },
  "psychological_hooks": [
    "Contrarian wealth — reframing boring as opportunity",
    "Social proof through rejection — 'everyone said I was crazy' is itself proof",
    "Tactile specificity — laundromats feel more real than SaaS",
    "Binary choice — sexy vs boring forces the reader to pick"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "numbered (1. 2. 3.)",
    "uses_bold": false,
    "whitespace": "blank line between hook, list, and close",
    "line_breaks": "moderate"
  },
  "closing_pattern": {
    "technique": "Forced-choice question between two framings the post has already contrasted",
    "example": "Which one would you rather buy into?",
    "psychology": "Binary choice questions convert passive readers into commenters who feel they've made a public commitment."
  }
}
$$::jsonb where id = 'codie-sanchez';

-- ─────────────────────────────────────────────────────────────
-- Dickie Bush
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Length of time writer struggled → discovery moment → specific result",
    "example": "I wrote online for 4 years before anyone cared. Then I discovered the framework that took me from 0 → 500K followers in 18 months.",
    "why_it_works": "The 4-years-of-nothing framing makes the reader feel the writer earned the insight — curiosity converts to trust."
  },
  "logic_flow": [
    "Hook: length of struggle + breakthrough moment",
    "Framework name drop (creates ownership of the insight)",
    "Utility promise: 'here it is, free'",
    "Numbered day ranges with explanatory beats (Day 1-10, 11-20, 21-30)",
    "Each range has: what to write + why it works",
    "The rule: one sharp constraint ('ship every day')",
    "Absolute close: 'Consistency beats perfection 100/100 times.'",
    "Pointed question about resistance"
  ],
  "rhetorical_devices": [
    "Parallel structure — each day range follows the same pattern",
    "Absolute statements — '100/100 times' removes hedging",
    "Permission framing — 'bad ships count, tired ships count' lowers the bar",
    "Framework naming — gives the insight a handle the reader can share"
  ],
  "sentence_rhythm": {
    "avg_line_length": "9-13 words",
    "paragraph_pattern": "Numbered blocks with 2-3 sub-lines, bookended by 1-line hook and 1-line close",
    "pacing": "Instructional with moments of imperative intensity"
  },
  "vocabulary_signature": {
    "signature_words": ["ship every day", "bad ships count", "consistency beats perfection", "the rule", "the framework"],
    "avoided_words": ["inspiration", "motivation", "mindset", "grind"]
  },
  "psychological_hooks": [
    "Earned insight — 4 years of struggle proves the framework works",
    "Utility bait — 'here it is, free' eliminates friction",
    "Permission — 'bad ships count' removes the perfection barrier",
    "Identity — naming the framework lets readers adopt it as a badge"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "numbered with day ranges (Day 1-10, Day 11-20)",
    "uses_bold": true,
    "whitespace": "blank line between each day range",
    "line_breaks": "moderate"
  },
  "closing_pattern": {
    "technique": "Question that forces the reader to name their own resistance",
    "example": "What stops you from shipping daily?",
    "psychology": "Once the reader has seen the framework, naming their own block is a natural next step — high engagement."
  }
}
$$::jsonb where id = 'dickie-bush';

-- ─────────────────────────────────────────────────────────────
-- Sahil Bloom
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Specific date + Stanford-level credibility + concrete experimental setup",
    "example": "In 1968, a Stanford professor told 4-year-olds they could have one marshmallow now, or two if they waited 15 minutes.",
    "why_it_works": "Historical specificity signals rigor; the visceral experiment setup creates an immediate mental image."
  },
  "logic_flow": [
    "Hook: specific year + authoritative source + concrete experimental setup",
    "Story development: what happened / what researchers found",
    "The conventional takeaway everyone remembers",
    "Subversion: 'but here's what almost nobody mentions'",
    "New evidence that inverts the conventional reading",
    "Reframe: the real lesson isn't about X, it's about Y",
    "Application: concrete everyday translation of the new framing",
    "Close: personal question that bridges history to the reader's life"
  ],
  "rhetorical_devices": [
    "Narrative specificity — dates, institutions, numbers",
    "Subversion — 'but here's what almost nobody mentions' inverts conventional wisdom",
    "Metonymy — marshmallow stands for discipline, discipline for environment",
    "Bridge framing — from abstract history to concrete application"
  ],
  "sentence_rhythm": {
    "avg_line_length": "11-16 words",
    "paragraph_pattern": "1-1-1-1-2-1-1 with narrative expansion in the middle",
    "pacing": "Storytelling pacing — each sentence pulls the reader forward"
  },
  "vocabulary_signature": {
    "signature_words": ["almost nobody mentions", "the real lesson", "build trustworthy environments", "decades later", "famous as proof"],
    "avoided_words": ["hack", "hustle", "grind", "10x", "game-changer"]
  },
  "psychological_hooks": [
    "Authoritative specificity — Stanford + 1968 feels unverifiable but credible",
    "Contrarian knowledge — 'what almost nobody mentions' creates insider status",
    "Reframing — inverts something the reader already believed",
    "Bridge — connects abstract history to the reader's daily choices"
  ],
  "formatting_patterns": {
    "uses_bullets": false,
    "bullet_style": "none",
    "uses_bold": false,
    "whitespace": "blank line between narrative beats",
    "line_breaks": "moderate"
  },
  "closing_pattern": {
    "technique": "Personal question bridging the historical story to the reader's own behavior",
    "example": "What promise have you been keeping to yourself lately?",
    "psychology": "Converts abstract insight into a concrete self-audit — the reader has to answer internally before scrolling past."
  }
}
$$::jsonb where id = 'sahil-bloom';

-- ─────────────────────────────────────────────────────────────
-- Lara Acosta
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Time frame + vulnerable starting point → dramatic current state → 'here's what nobody told me'",
    "example": "3 years ago I was a clueless marketing grad in Madrid with 200 followers. Today: 250K+ followers, a 6-figure personal brand, and clients on 4 continents.",
    "why_it_works": "Pairs vulnerability with proof — the reader sees the transformation and trusts the lessons that follow."
  },
  "logic_flow": [
    "Hook: before-state with vulnerability markers (location, role, follower count)",
    "After-state: concrete outcomes (revenue, followers, geography)",
    "Promise: 'here's what nobody told me when I started'",
    "Numbered list of counter-intuitive lessons, each with a personal anecdote",
    "Each lesson has: 1-line principle + 2-3 line personal story",
    "Bridge: name a specific person ('Sarah at a bank') to ground abstract audience advice",
    "Close: pointed question asking which lesson landed"
  ],
  "rhetorical_devices": [
    "Vulnerability hook — admits starting from nothing",
    "Concrete specificity — Madrid, bank, Sarah",
    "Numbered personal lessons — each is both a principle and a confession",
    "Metonymy — 'weirdness is your moat' replaces abstract 'authenticity'"
  ],
  "sentence_rhythm": {
    "avg_line_length": "10-14 words",
    "paragraph_pattern": "1-1-1 then 5 numbered blocks of 2-3 lines each, 1 close",
    "pacing": "Storytelling pacing with occasional one-line payoffs"
  },
  "vocabulary_signature": {
    "signature_words": ["clueless", "the clarity is", "weirdness is your moat", "Sarah who works at a bank", "Nobody told me"],
    "avoided_words": ["hustle", "grind", "crush it", "level up", "10x"]
  },
  "psychological_hooks": [
    "Vulnerability bait — starting point proves the writer earned the transformation",
    "Counter-intuitive framing — 'you don't need a big following' flips expectations",
    "Grounded specificity — 'Sarah at a bank' makes abstract audience advice feel real",
    "Permission — 'your weirdness is your moat' reframes insecurity as an asset"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "numbered with bold headers",
    "uses_bold": true,
    "whitespace": "blank line between each numbered lesson",
    "line_breaks": "moderate"
  },
  "closing_pattern": {
    "technique": "Ask the reader which specific lesson from the numbered list hit them",
    "example": "Which one did you need to hear today?",
    "psychology": "Invites the reader to self-diagnose their current blocker — replies self-categorize into the numbered lessons."
  }
}
$$::jsonb where id = 'lara-acosta';

-- ─────────────────────────────────────────────────────────────
-- Matt Gray
-- ─────────────────────────────────────────────────────────────
update writing_template set voice_dna = $$
{
  "hook_formula": {
    "pattern": "Concrete business outcome + unconventional working condition",
    "example": "I built a $14M+ business working 4 hours a day.",
    "why_it_works": "Pairs achievement with lifestyle — the reader wants to know how both can be true simultaneously."
  },
  "logic_flow": [
    "Hook: outcome + unconventional condition in one line",
    "Utility promise: 'here's the exact 5-step system (free)'",
    "Numbered steps with named frameworks ('The 80/20 Audit', 'The Content Flywheel')",
    "Each step: what it is + concrete rule or ratio",
    "Operating specificity: times, ratios, price points",
    "Inversion: the boring part — 'show up every day for 1,000 days'",
    "Meta-insight: 'the system isn't the magic, the consistency is'",
    "Close: action-oriented question"
  ],
  "rhetorical_devices": [
    "Named systems — turning process into proprietary framework",
    "Specificity as credibility — $49/$997/$25K price ladder, 4-hour days, 1,000-day rule",
    "Inversion — ending on 'the boring part' reframes the whole system",
    "Parallel structure — every step follows the same labeled format"
  ],
  "sentence_rhythm": {
    "avg_line_length": "10-15 words",
    "paragraph_pattern": "1-1 hook, 5 numbered step blocks of 2-3 lines, 1-1-1 close",
    "pacing": "Declarative with occasional short absolute lines for emphasis"
  },
  "vocabulary_signature": {
    "signature_words": ["the exact system", "80/20 audit", "flywheel", "async operating rhythm", "the boring part", "the consistency is"],
    "avoided_words": ["hustle", "grind", "crush it", "inspired", "passionate"]
  },
  "psychological_hooks": [
    "Contradiction hook — $14M + 4 hours forces curiosity",
    "Utility bait — numbered system with named components",
    "Meta-authority — 'the consistency is' reveals the writer sees through the system",
    "Action framing — the close asks which step to take, not whether to take one"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "numbered with named steps + em dash headers",
    "uses_bold": true,
    "whitespace": "blank line between each numbered step",
    "line_breaks": "moderate"
  },
  "closing_pattern": {
    "technique": "Action-oriented question forcing the reader to commit to a starting step",
    "example": "Which step will you start with this week?",
    "psychology": "Time-bounded action questions convert passive readers into implementers — replies become public commitments."
  }
}
$$::jsonb where id = 'matt-gray';
