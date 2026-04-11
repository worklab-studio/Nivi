# Nivi — Project Context (Living Document)

> **Last updated:** 2026-04-07 (tech-debt sweep: file renames, Whisper→Gemini audio, dep cleanup, single-plan Stripe, schema cleanup, 1h cache TTL)
> **Purpose:** Single source of truth for what Nivi is, how it's built, and the non-obvious gotchas. Every Claude Code / dev session should read this first. **Update this file in the same PR as any structural change** (new route, integration, worker, env var, table, or rename). Bump the date above.

---

## 1. Product (what Nivi is)

Nivi is an **AI-powered LinkedIn + X growth agent** for busy founders/creators. The user talks to "Nivi" over **WhatsApp** (primary surface) to brainstorm, draft, approve, and schedule posts. A Next.js **web dashboard** mirrors the content calendar, drafts, engagement inbox, analytics, knowledge base, and settings. Nivi writes in the user's voice (learned during onboarding), generates post images, publishes to LinkedIn/X via Unipile, pulls analytics back, and keeps long-term memory of preferences in Pinecone.

Plans: `starter`, `pro`, `agency` (Stripe).

---

## 2. Primary user flow

1. **Sign up** (Clerk) → Stripe checkout → `onboarding/` wizard.
2. **Onboarding**: answer voice/niche questions → Nivi `generate-context` builds a `context_files` row (writing style, hooks, sentence styling, post system, samples) → user approves → connect **LinkedIn via Unipile hosted auth** → link **WhatsApp** by messaging an opt-in code to Nivi's WhatsApp number.
3. **Daily loop on WhatsApp**:
   - **Morning brief** (cron at user's `posting_time`) — Nivi drafts today's post, sends on WhatsApp.
   - User replies: approve / edit / skip / voice-note / send image.
   - **Scheduling** — `schedule` handler parses time, inserts into `scheduled_posts`.
   - **Publishing** — scheduler cron picks due rows, publishes via Unipile, updates `posts.linkedin_post_id`.
   - **Engagement brief** (cron at `engagement_time`) — Nivi fetches LinkedIn feed, drafts comments on relevant posts, user approves via WhatsApp.
   - **Comment digest** — incoming comments on user's posts are surfaced; Nivi drafts replies.
4. **Analytics sync** every 30 min (impressions, likes, comments, shares → `post_analytics`).
5. **Weekly summary** Mondays 08:00 — Nivi texts a recap.
6. **Memory loop** — `extractMemory` pulls facts/preferences from conversations into `user_memory`, embedded with Gemini and stored in Supabase pgvector.
7. **Dashboard** — user can view/edit all of the above on the web.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2** App Router, Turbopack, React 19.2 |
| Language | TypeScript 5 |
| Styling | Tailwind v4, shadcn/ui (Radix + base-ui), lucide icons, framer-motion, sonner, recharts |
| Auth | **Clerk** (`@clerk/nextjs` v7) |
| DB | **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`), raw `pg` available |
| Payments | **Stripe** + `svix` for webhook verification |
| LLM | **Gemini 2.5 Flash** via `generativelanguage.googleapis.com` (see §5) |
| Vector / memory | **Supabase pgvector** (native, no extra vendor) with **Gemini `gemini-embedding-001`** (768 dim) |
| Transcription | **Gemini 2.5 Flash** multimodal audio (voice notes) |
| Images | **Ideogram** API |
| Social publishing & analytics | **Unipile** (LinkedIn + X + WhatsApp hosted) |
| WhatsApp | Unipile WhatsApp account (not Meta Cloud API) |
| Jobs | `node-cron` only (in-process scheduler). `bullmq` and `@upstash/redis` were removed 2026-04-07 — they were installed but never wired. |
| Process mgr | **PM2** (`ecosystem.config.js`): `nivi-web` + `nivi-scheduler` |
| Forms/validation | react-hook-form + zod |

---

## 4. Repo map

```
/
├── AGENTS.md / CLAUDE.md     # Agent instructions (Next 16 has breaking changes — read node_modules/next/dist/docs)
├── PROJECT_CONTEXT.md        # ← this file
├── ecosystem.config.js       # PM2: nivi-web, nivi-scheduler
├── next.config.ts
├── components.json           # shadcn config
├── supabase/
│   ├── migration.sql         # Full schema (10 tables + RLS + storage bucket)
│   └── reminders.sql         # reminders table (run separately)
└── src/
    ├── proxy.ts              # Clerk auth (Next 16 `proxy.ts` replaces the old `middleware.ts` convention); public: /, /pricing, /sign-in, /sign-up, /api/webhooks
    ├── instrumentation.ts    # In-process scheduler: /api/cron/tick every 60s, /api/cron/proactive every 4h
    ├── app/
    │   ├── layout.tsx · page.tsx · globals.css · error.tsx
    │   ├── (marketing)/      # Landing
    │   ├── pricing/          # Public pricing page
    │   ├── (auth)/sign-in · sign-up/
    │   ├── onboarding/       # Post-signup wizard
    │   ├── (dashboard)/      # Authenticated app shell + pages (see §7)
    │   └── api/              # Route handlers (see §8)
    ├── components/
    │   ├── ui/               # shadcn primitives
    │   ├── dashboard/        # Sidebar, TopBar, ContentCalendar, WeekStrip, PostCard, MetricCard, StreakRow, TodayStatus, PostStatusBadge
    │   ├── nivi/             # NiviAvatar, NiviMessage, NiviTyping (chat UI)
    │   └── onboarding/       # Wizard steps
    ├── hooks/
    ├── types/
    └── lib/
        ├── config.ts         # getEnv() with .env.local fallback (Turbopack workaround)
        ├── utils.ts · utils/
        ├── ai/
        │   ├── client.ts             # Native Gemini client
        │   └── anthropic-compat.ts   # Fake Anthropic class → Gemini (drop-in shim)
        ├── claude/           # LEGACY NAME — no Anthropic, uses the shim
        │   ├── client.ts
        │   ├── buildSystemPrompt.ts
        │   ├── generatePost.ts
        │   ├── extractMemory.ts
        │   └── performanceIntel.ts
        ├── supabase/         # client.ts (browser), server.ts (SSR), admin.ts (service role)
        ├── unipile/
        │   ├── client.ts
        │   ├── linkedin.ts   # LinkedIn account helpers
        │   ├── posts.ts      # publishToLinkedIn, comments
        │   ├── xPosting.ts   # X/Twitter publishing
        │   └── analytics.ts  # syncAllUserAnalytics
        ├── whatsapp/
        │   ├── send.ts       # Send via Unipile chat API
        │   ├── templates.ts  # Canned messages
        │   ├── router.ts     # (stub — routing lives in api/webhooks/whatsapp)
        │   └── handlers/
        │       ├── conversation.ts  # Main LLM turn (Gemini via shim, tool use)
        │       ├── post.ts · edit.ts · schedule.ts · cancel.ts · skip.ts
        │       ├── comments.ts · replies.ts
        │       ├── image.ts · media.ts · voiceNote.ts (Gemini 2.5 Flash multimodal audio)
        │       └── optIn.ts
        ├── queue/
        │   ├── scheduler.ts  # Standalone node-cron runner (PM2 nivi-scheduler)
        │   └── workers/
        │       ├── morningBrief.ts
        │       ├── engagementBrief.ts
        │       ├── commentDigest.ts
        │       ├── weeklySummary.ts
        │       └── publishPost.ts
        ├── ideogram/generate.ts      # Post image generation
        └── vector/memoryStore.ts     # Long-term memory + RAG via Supabase pgvector + Gemini gemini-embedding-001.
```

---

## 5. AI layer — hybrid router (Claude + Gemini)

Nivi runs on a **hybrid model matrix** routed by call role. Single source of truth is `src/lib/ai/router.ts` (`pickModel(role)`); the actual SDK routing lives in `src/lib/ai/anthropic-compat.ts` which checks the `model` string and forwards to either the real Anthropic SDK or Gemini.

### How to add an LLM call
```ts
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'

const res = await new Anthropic().messages.create({
  model: pickModel('whatsapp-conversation'),  // ← pick a role, never a raw model string
  max_tokens: 8192,
  system: [
    { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicPrompt },
  ],
  messages,
  tools,
})
```

### The model matrix (roles → models)

| Model | Roles |
|---|---|
| **Claude Sonnet 4.5** | `whatsapp-conversation`, `post-generation`, `comment-generation`, `engagement-brief`, `comment-digest`, `onboarding-context` — anything user-visible or publicly-posted prose |
| **Claude Haiku 4.5** | `morning-brief`, `weekly-summary`, `tool-router`, `edit-rewrite` — internal Nivi-to-user DMs, cheap classifiers, short-circuit for casual chat |
| **Gemini 2.5 Flash** | `memory-extraction`, `knowledge-extraction`, `image-prompt`, `multimodal-ocr` — structured JSON, throwaway, OCR / doc parsing |

### Graceful degradation
If `ANTHROPIC_API_KEY` is missing or empty, `pickModel` downgrades every Claude role to Gemini Flash with a startup warning. Nivi keeps working, voice quality drops. Set the env var back and redeploy to restore.

### Prompt caching (critical)
The WhatsApp chat handler splits its system prompt into **two blocks**:
- **STATIC** (cached via `cache_control: { type: 'ephemeral' }`): identity, voice files, post-writing rules, language style, read-the-room rules. Stable per user → cache hits across turns.
- **DYNAMIC** (not cached): memories, recent posts, performance intelligence, days-together counter, current time, history recap.

The user's current message is **not** duplicated in the system prompt — it's only in `messages`. Duplicating it there would bust the cache key.

`src/lib/claude/buildSystemPrompt.ts` returns `{ static, dynamic }` for the same reason; briefs and `generatePost.ts` pass them as two system blocks.

**Expected cache-hit behavior:** after the second turn per user, `cache_read_input_tokens` should be ~70%+ of `input_tokens`. Check in the Anthropic dashboard.

### Memory is retrieved via pgvector RAG (not dumped)
User memories are stored as pgvector rows on `user_memory.embedding` and retrieved per-turn via the `match_user_memories` RPC. Knowledge chunks use `knowledge_chunks.embedding` + `match_knowledge_chunks`. Embeddings use Gemini `gemini-embedding-001` (768 dim). See §10 (data model) and §12 gotcha #2. Hard cap ~13 facts per prompt regardless of total memory size.

### Other AI providers
- **OpenAI**: **None.** Removed 2026-04-07. `voiceNote.ts` now uses Gemini 2.5 Flash multimodal audio input. `openai` dependency is gone.
- **Ideogram**: image generation in `src/lib/ideogram/generate.ts`. The LLM prompt-engineering call uses Flash (role `image-prompt`).

### Legacy naming
- `src/lib/claude/` folder name is **legacy**. The files are prompt/orchestration logic — safe rename to `src/lib/llm/` later.
- `anthropic-compat.ts` name stays because it's the Anthropic-SDK-shaped facade everything imports.

---

## 6. Routes — pages

**Public** (exempt in `proxy.ts`):
- `/` — marketing landing (`(marketing)` group + `app/page.tsx`)
- `/pricing`
- `/sign-in`, `/sign-up` (Clerk catch-all)
- `/api/webhooks/*`

**Onboarding:**
- `/onboarding` — wizard (answers → context → LinkedIn → WhatsApp opt-in)

**Authenticated dashboard** (`(dashboard)/layout.tsx`):
- `/overview` · `/analytics` · `/calendar` · `/drafts` · `/posts` · `/engagement` · `/knowledge` · `/profile` · `/settings`

---

## 7. API surface (`src/app/api/**/route.ts`)

### Content / posts
- `POST /api/generate` — generate a post on demand (from dashboard)
- `GET /api/posts` · `POST /api/posts/update` · `/delete` · `/skip` · `/publish`
- `POST /api/schedule` — schedule a post

### Dashboard reads
- `/api/dashboard/{overview,analytics,calendar,drafts,posts,engagement,knowledge,profile,settings}`

### Engagement
- `POST /api/engagement/post-comment` · `/skip`

### Knowledge
- `POST /api/knowledge/add` · `/delete`

### Account
- `DELETE /api/account/delete`

### Onboarding
- `/api/onboarding/save-answers`
- `/api/onboarding/generate-context` — Gemini builds `context_files`
- `/api/onboarding/approve-context`
- `/api/onboarding/linkedin-auth` — Unipile hosted link
- `/api/onboarding/linkedin-callback`
- `/api/onboarding/check-linkedin` · `/check-whatsapp`
- `/api/onboarding/get-opt-in-code`

### Stripe
- `POST /api/stripe/checkout` (starter/pro/agency price IDs)
- `POST /api/stripe/portal`

### Cron (Bearer `CRON_SECRET`)
- `/api/cron/tick` — every 60s (from `instrumentation.ts`): reminders + scheduled posts + proactive
- `/api/cron/proactive` — every 4h: Nivi texts users if she has something to say
- `/api/cron/reminders`
- `/api/cron/morning-brief`
- `/api/cron/engagement-brief`
- `/api/cron/comment-digest`

### Webhooks (public)
- `/api/webhooks/clerk` — svix-verified user lifecycle → upserts `users`
- `/api/webhooks/stripe` — svix/Stripe-verified → sets `users.plan` from price IDs
- `/api/webhooks/linkedin` — Unipile LinkedIn notifications (comments → `comment_opportunities`, replies)
- `/api/webhooks/whatsapp` — **the main conversational entry point** — dispatches to `src/lib/whatsapp/handlers/*`

---

## 8. Background jobs

Two execution paths — both exist:

### A. In-process (Next.js `instrumentation.ts`)
Runs when Next server boots (`NEXT_RUNTIME === 'nodejs'`):
- `setInterval` → `GET /api/cron/tick` every 60s
- `setInterval` → `GET /api/cron/proactive` every 4h
- Authed with `Bearer ${CRON_SECRET}`, base URL from `NEXT_PUBLIC_APP_URL`.

### B. Standalone PM2 process (`nivi-scheduler`)
`src/lib/queue/scheduler.ts` launched via `npx tsx` (see `ecosystem.config.js`). Uses `node-cron`:

| Schedule | Job |
|---|---|
| `* * * * *` | Publish due `scheduled_posts` → `publishToLinkedIn` (retry up to 2x) |
| `* * * * *` | `sendMorningBrief(userId)` for users whose `posting_time` = now |
| `* * * * *` | `sendEngagementBrief(userId)` for users whose `engagement_time` = now |
| `0 8 * * 1` | `sendWeeklySummary(userId)` for all onboarded users |
| `*/30 * * * *` | `syncAllUserAnalytics(userId)` |

**Workers** (`src/lib/queue/workers/`): `morningBrief`, `engagementBrief`, `commentDigest`, `weeklySummary`, `publishPost`. Despite the `queue/` folder name, these are called **directly** as async functions — not via a real queue. The `bullmq` + `@upstash/redis` deps were uninstalled 2026-04-07 since they'd been installed but never wired.

---

## 9. Integrations

| Service | Purpose | Keys |
|---|---|---|
| **Clerk** | Auth, user mgmt | `CLERK_*`, `CLERK_WEBHOOK_SECRET` |
| **Supabase** | Primary DB, storage bucket `post-images`, RLS on all tables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Gemini** | All LLM calls (via shim) | `GEMINI_API_KEY` |
| ~~OpenAI~~ | Removed 2026-04-07. Voice transcription moved to Gemini multimodal. | — |
| **pgvector** (Supabase extension) | Long-term memory / RAG. `user_memory.embedding` + `knowledge_chunks.embedding` vector(768), HNSW indexes, `match_user_memories` / `match_knowledge_chunks` RPC functions. No extra vendor. | Uses the existing `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` + `GEMINI_API_KEY` for embeddings. |
| **Unipile** | LinkedIn + X publishing, analytics, WhatsApp chat API, LinkedIn hosted OAuth | `UNIPILE_BASE_URL`, `UNIPILE_API_KEY` |
| **Ideogram** | Post images | `IDEOGRAM_API_KEY` |
| **Stripe** | Billing (single $29/mo plan) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` |
| **Upstash Redis** | Installed (`@upstash/redis`) — not actively used yet | (tbd) |

---

## 10. Data model (Supabase — `supabase/migration.sql` + `reminders.sql`)

All tables have RLS enabled; service role bypasses. User IDs are `text` (Clerk IDs), not uuid.

| Table | Key columns | Purpose |
|---|---|---|
| `users` | `id` (Clerk), `email`, `whatsapp_number`, `whatsapp_opt_in_code`, `unipile_account_id`, `x_account_id`, `plan` (starter/pro/agency — **legacy, will collapse to single $29 plan**), `posting_time`, `engagement_time`, `timezone` (default `Asia/Kolkata`), `streak_count`, `onboarding_step`, `onboarding_complete`, `stripe_customer_id`, `brand_kit` jsonb, `pending_image_url`, `niche`, **`history_summary`** text (Tier 1 Step 6 — cached recap of earlier chat turns), **`history_summary_at`** timestamptz | User profile + settings |
| `context_files` | unique per user: `writing_style`, `hook_mechanics`, `sentence_styling`, `post_system`, `sample_posts`, `version` | The voice profile Nivi writes with |
| `knowledge_chunks` | `source_type` (transcript/article/post/note/video), `raw_content`, `extracted_insights` jsonb, **`embedding vector(768)`** (pgvector, HNSW-indexed) | RAG corpus. Retrieved via `match_knowledge_chunks` RPC. |
| `user_memory` | `fact`, `category` (preference/fact/goal/pattern/avoid), `confidence`, `source`, **`embedding vector(768)`** (pgvector, HNSW-indexed), `last_used_at` timestamptz, `use_count` int, `embedding_id` text (legacy Pinecone holdover, now unused/nullable) | Long-term memory. Retrieved per-turn via `match_user_memories` RPC. Top-K + always-include goal/avoid. |
| `posts` | `content`, `hook_type`, `content_pillar` (1–5), `status` (draft/scheduled/published/skipped), `scheduled_at`, `published_at`, `linkedin_post_id`, `image_url`, `edit_count` | Post lifecycle |
| `post_analytics` | unique per post: `impressions`, `likes`, `comments`, `shares`, `engagement_rate`, `synced_at` | Pulled every 30m from Unipile |
| `conversations` | `role` (user/assistant), `content`, `message_type` | WhatsApp chat history |
| `scheduled_posts` | `post_id`, `scheduled_at`, `status` (pending/processing/done/failed), `retry_count` | Publish queue |
| `comment_opportunities` | `linkedin_post_id`, `author_name`, `author_followers`, `post_preview`, `drafted_comment`, `status` (pending/approved/posted/skipped) | Engagement inbox |
| `onboarding_answers` | `step`, `question_key`, `answer` | Wizard responses |
| `reminders` | `reminder_text`, `remind_at`, `status` | Nivi-set reminders (run `reminders.sql` separately) |
| Storage bucket | `post-images` (public) | Generated post imagery |

**Performance indexes** exist on: `posts(user_id,status)`, `posts(user_id,published_at desc)`, `posts(linkedin_post_id)` partial, `post_analytics(post_id)`, `conversations(user_id,created_at desc)`, `user_memory(user_id)`, `comment_opportunities(user_id,status)`, `scheduled_posts(scheduled_at,status)` partial, `users(whatsapp_number)` partial, `onboarding_answers(user_id,step)`, `reminders(remind_at,status)` partial.

---

## 11. Environment variables (complete list found in code)

```
# Core
NEXT_PUBLIC_APP_URL
CRON_SECRET

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY          # (implicit via @clerk/nextjs)
CLERK_SECRET_KEY                            # (implicit via @clerk/nextjs)
CLERK_WEBHOOK_SECRET

# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# LLM
GEMINI_API_KEY                              # Flash (extraction, OCR, image prompts, memory)
ANTHROPIC_API_KEY                           # Sonnet + Haiku (conversation, post, briefs, comments)
                                            #   If unset: pickModel downgrades all Claude roles to Flash.
# (OPENAI_API_KEY removed 2026-04-07 — Nivi has no OpenAI dependency.)

# Vector — no env vars. Uses Supabase pgvector via the existing
# SUPABASE_SERVICE_ROLE_KEY and embeds through Gemini via GEMINI_API_KEY.
# (Previously required PINECONE_API_KEY / PINECONE_INDEX / OPENAI_API_KEY — removed 2026-04-07.)

# Unipile (LinkedIn + X + WhatsApp + analytics)
UNIPILE_BASE_URL
UNIPILE_API_KEY

# Images
IDEOGRAM_API_KEY

# Stripe — single $29/mo plan
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
```

`src/lib/config.ts` exposes `getEnv(key)` which falls back to parsing `.env.local` manually — workaround for a Next 16 Turbopack env-loading bug. Prefer `getEnv(...)` over `process.env.X!` in new code.

---

## 12. Conventions & gotchas

1. **Next.js 16 is not the Next.js you know.** Per `AGENTS.md`: read `node_modules/next/dist/docs/` before touching routing, caching, or config. Heed deprecation notices. (Note: the `middleware.ts` convention was renamed to `proxy.ts` in Next 16 — Nivi's file is at `src/proxy.ts`.)
2. **Memory retrieval, not dumping.** User memories live as `vector(768)` rows on `user_memory.embedding` (Supabase pgvector, HNSW-indexed) and are retrieved per-turn via `queryRelevantMemories(userId, currentMessage, 8)` which calls the `match_user_memories` RPC. Always-include top 2 `goal` and top 3 `avoid` facts are pulled separately via a normal Supabase filter. Hard cap ~13 facts injected per prompt. **Never** reintroduce a `.from('user_memory').limit(60)` dump into any prompt builder — cost then grows linearly with user tenure.
3. **Prompt caching depends on byte-identical static blocks.** If you touch `conversation.ts` system assembly, keep the STATIC block stable per user across turns. Any per-turn content (memories, time, performance numbers, days-together counter) must go in the DYNAMIC block. The user's current message is already in `messages[]` — never duplicate it into the system prompt.
4. **One source of truth for model choice.** `src/lib/ai/router.ts::pickModel(role)`. Never hardcode a raw `'claude-sonnet-...'` or `'gemini-...'` string in a call site. Add a new `CallRole` instead.
5. **Two-tier WhatsApp tool loop.** Casual short messages (`isCasualMessage(text)` returns true) get a cheap Haiku call and can short-circuit Sonnet entirely. Work/content/command messages always go to Sonnet with full tools. If you add a new content-intent keyword (e.g. "summarize"), update the `workKeywords` regex in `isCasualMessage`.
6. **No real job queue.** Jobs run via `node-cron` in a PM2 process. `bullmq` / `@upstash/redis` were uninstalled 2026-04-07. Don't assume retry/backoff semantics.
7. **WhatsApp is Unipile, not Meta Cloud API.** All chat send/receive goes through `UNIPILE_BASE_URL/api/v1/chats/...`.
8. **Two schedulers exist in parallel** (see §8): the in-process `instrumentation.ts` one and the standalone PM2 `nivi-scheduler`. Don't duplicate jobs between them.
9. **User IDs are Clerk strings**, not uuids. Every FK `user_id` is `text`.
10. **RLS policies use `auth.uid()::text = user_id`** — they only work from anon/auth contexts. Server code uses the **service role** client (`src/lib/supabase/admin.ts`) which bypasses RLS.
11. **Use `getEnv()`**, not `process.env.X!`, especially for anything loaded at import time — Turbopack misses some vars.
12. **Middleware public routes:** `/`, `/pricing`, `/sign-in*`, `/sign-up*`, `/api/webhooks/*`. Everything else requires Clerk auth.
13. **Default timezone** for new users is `Asia/Kolkata`.
14. **Folder name `src/lib/claude/` is legacy.** Both Claude and Gemini calls go through `@/lib/ai/anthropic-compat`; the `claude/` folder holds prompt/orchestration logic. Safe to rename to `src/lib/llm/` (see §13).

---

## 13. Known follow-ups / tech debt

### Done in the 2026-04-07 tech-debt sweep
- [x] ~~Backfill run against pgvector~~ → done, 349 rows embedded.
- [x] ~~Switch prompt cache TTL 5min → 1h~~ → all 9 `cache_control` sites now use `ttl: '1h'`.
- [x] ~~Drop OpenAI entirely~~ → `voiceNote.ts` uses Gemini 2.5 Flash multimodal audio. `openai` dep removed.
- [x] ~~Rename `src/lib/vector/pinecone.ts` → `memoryStore.ts`~~ → done.
- [x] ~~Drop legacy `user_memory.embedding_id` column~~ → in `2026-04-07-schema-cleanup.sql`.
- [x] ~~Single $29 plan migration~~ → `users.plan` collapsed to `active|inactive`, Stripe code simplified, env collapsed to `STRIPE_PRICE_ID`.
- [x] ~~Uninstall bullmq + @upstash/redis~~ → done (unused).
- [x] ~~Delete `src/lib/whatsapp/router.ts` stub~~ → done.
- [x] ~~Next 16 `middleware` → `proxy` rename~~ → `src/proxy.ts`.
- [x] ~~Fold `reminders.sql` into main schema~~ → done in `2026-04-07-schema-cleanup.sql`.

### Still pending
- [ ] **Tier 2 proper (needs data time):** performance-weighted memory retrieval (boost facts that correlated with high-performing posts — needs `post_memory_links` data to accumulate), memory decay flip from dry-run to live, voice profile evolution (weekly refresh of `context_files`), Anthropic Message Batches API for briefs (50% off), tune `isCasualMessage` using logged routing decisions.
- [ ] **Rename `src/lib/claude/` → `src/lib/llm/`** to match reality. Touches ~12 imports, separate PR.
- [ ] **Split 1600-line `conversation.ts`** into per-tool files. Mechanical but big diff.
- [ ] **Consolidate the two schedulers** (`instrumentation.ts` in-process ticks vs PM2 `nivi-scheduler`). Pick one.
- [ ] **Adopt a real migration runner** or at least numbered prefixes — we now have `supabase/migration.sql` + 3 dated migration files at the top level of `supabase/migrations/`.
- [ ] **Pin the 1M-context beta status on Sonnet 4.5.** The Aug-2025 blog post covers Sonnet 4 only; unclear if 4.5 inherits. Not needed for current prompt sizes (we're kilobytes, not 200k+), but worth knowing. Enabling requires `anthropic-beta: context-1m-2025-08-07` header and triggers 2× pricing above 200k tokens.
- [ ] **Rotate the Anthropic key** currently in `.env.local` — it was pasted in chat history and should be considered leaked.

---

## 14. How to keep this file fresh (update protocol)

**When you…**

| Change | Update section |
|---|---|
| Add/remove an `/api/...` route | §7 |
| Add/remove a page under `(dashboard)` or elsewhere | §6 |
| Add a new integration or SDK | §3, §9, §11 |
| Add/change a Supabase table or column | §10 |
| Add/change a cron or worker | §8 |
| Add/remove an env var | §11 |
| Rename a top-level folder | §4 |
| Swap or upgrade the LLM | §3, §5 |
| Discover a new gotcha | §12 |
| Resolve a tech-debt item | §13 |

**Always bump the `Last updated` date at the top.**

**For Claude Code sessions:** read this file as step 1 of any non-trivial task in this repo. If anything here contradicts what you see in code, **trust the code and fix this file in the same PR**.
