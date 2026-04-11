import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/overview')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* ──── NAV ──── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <span className="font-sans text-2xl font-bold tracking-tight">Nivi</span>
        <div className="flex items-center gap-6">
          <Link href="#features" className="text-sm text-[#888] hover:text-white transition-colors hidden sm:block">Features</Link>
          <Link href="#how" className="text-sm text-[#888] hover:text-white transition-colors hidden sm:block">How it works</Link>
          <Link href="/pricing" className="text-sm text-[#888] hover:text-white transition-colors">Pricing</Link>
          <Link href="/sign-in" className="text-sm text-[#888] hover:text-white transition-colors">Sign in</Link>
          <Link href="/sign-up" className="bg-white text-black text-sm px-5 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      {/* ──── HERO ──── */}
      <section className="max-w-5xl mx-auto px-8 pt-24 pb-20 text-center relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 border border-[#333] rounded-full px-4 py-1.5 mb-8 relative">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs text-[#a0a0a0] font-sans">Your AI LinkedIn brand strategist</span>
        </div>

        <h1 className="font-sans text-[56px] sm:text-[72px] font-bold leading-[1.05] tracking-tight mb-6 relative">
          Your LinkedIn.
          <br />
          <span className="bg-gradient-to-r from-white via-white to-[#888] bg-clip-text text-transparent">On autopilot.</span>
        </h1>

        <p className="text-[#999] text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
          Nivi learns your voice, writes daily posts, drafts strategic comments,
          and delivers everything to your WhatsApp.{' '}
          <span className="text-white font-medium">Reply &quot;ok&quot; to publish.</span>
        </p>

        <div className="flex items-center justify-center gap-4 mb-4">
          <Link href="/sign-up" className="bg-white text-black text-sm px-8 py-3.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]">
            Start 7-day free trial
          </Link>
          <Link href="#how" className="border border-[#333] text-sm px-8 py-3.5 rounded-lg text-[#aaa] hover:text-white hover:border-[#555] transition-colors">
            See how it works
          </Link>
        </div>
        <p className="text-xs text-[#555] font-sans">No credit card required. Cancel anytime.</p>
      </section>

      {/* ──── SOCIAL PROOF BAR ──── */}
      <section className="border-t border-b border-[#1a1a1a] py-6">
        <div className="max-w-4xl mx-auto px-8 flex items-center justify-center gap-8 sm:gap-16 text-center">
          {[
            { number: '500+', label: 'Posts generated' },
            { number: '50+', label: 'Creators using Nivi' },
            { number: '10x', label: 'Faster than writing yourself' },
            { number: '24/7', label: 'Always-on strategist' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-xl sm:text-2xl font-bold text-white">{stat.number}</p>
              <p className="text-[11px] text-[#666] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──── WHATSAPP MOCKUP ──── */}
      <section className="max-w-3xl mx-auto px-8 py-20">
        <p className="font-sans text-xs text-[#555] uppercase tracking-[0.2em] text-center mb-3">The WhatsApp experience</p>
        <h2 className="text-[32px] sm:text-[40px] font-bold text-center mb-4">Your morning brief, delivered</h2>
        <p className="text-[#777] text-center text-[15px] mb-12 max-w-xl mx-auto">Every morning, Nivi sends a polished post draft to your WhatsApp. Review, edit, or publish — all without opening LinkedIn.</p>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-6 shadow-2xl shadow-black/50 max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1e1e1e]">
            <div className="w-9 h-9 rounded-full bg-[#22c55e] flex items-center justify-center">
              <span className="text-black text-sm font-bold">N</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Nivi</p>
              <p className="text-[10px] text-[#666]">9:00 AM · Your brand strategist</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[88%]">
              <p className="text-[13px] text-[#ccc] leading-relaxed">
                Good morning! Here&apos;s your Tuesday post — based on what&apos;s been performing best this week.
              </p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[88%]">
              <p className="text-[13px] text-[#ddd] leading-relaxed italic">
                &ldquo;I almost quit my startup 3 months in.
                <br /><br />
                Not because it was failing.
                <br />
                Because it was working — and I wasn&apos;t ready for that.
                <br /><br />
                Here&apos;s what nobody tells you about early traction...&rdquo;
              </p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-3 max-w-[88%]">
              <p className="text-[12px] text-[#888]">Reply: <span className="text-[#22c55e]">POST</span> · SCHEDULE 3PM · EDIT · SKIP</p>
            </div>
            <div className="flex justify-end">
              <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-4 py-2.5">
                <p className="text-[13px] text-white font-medium">POST</p>
              </div>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[88%]">
              <p className="text-[13px] text-[#ccc]">
                Done! Live on LinkedIn. I&apos;ll ping you when it hits 100 impressions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──── FEATURES GRID ──── */}
      <section id="features" className="border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#555] uppercase tracking-[0.2em] text-center mb-3">Features</p>
          <h2 className="text-[32px] sm:text-[40px] font-bold text-center mb-4">Everything you need to grow on LinkedIn</h2>
          <p className="text-[#777] text-center text-[15px] mb-16 max-w-xl mx-auto">From writing to publishing to engaging — Nivi handles the entire LinkedIn workflow so you can focus on your business.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: '✍️',
                title: 'AI Post Composer',
                desc: 'Interactive editor with inline AI edits. Select text, rewrite, expand, or punch it up. LinkedIn-accurate preview with formatting toolbar.',
              },
              {
                icon: '🧠',
                title: 'Voice DNA',
                desc: 'Nivi studies your writing samples, interview answers, and creator templates. Every post sounds like you — not AI.',
              },
              {
                icon: '📱',
                title: 'WhatsApp-First',
                desc: 'Morning briefs, post approvals, engagement alerts — all in WhatsApp. Publish with one word. No dashboard required.',
              },
              {
                icon: '💬',
                title: 'Strategic Engagement',
                desc: 'Auto-scrapes target accounts for new posts. Draft voice-matched comments on demand. Build relationships at scale.',
              },
              {
                icon: '📅',
                title: 'Content Calendar',
                desc: 'Drag-and-drop scheduling with 15-minute snap zones. Move posts between days, or back to drafts. Real-time red line.',
              },
              {
                icon: '💡',
                title: 'Inspiration Library',
                desc: '100+ top LinkedIn creators scraped weekly. Trending posts, creator archetypes, hook analysis. Remix any post in your voice.',
              },
              {
                icon: '🎯',
                title: 'Brand Identity',
                desc: 'Import from LinkedIn, define your story, offers, and target audiences. Nivi uses this context for every piece of content.',
              },
              {
                icon: '📊',
                title: 'Performance Analytics',
                desc: 'Track impressions, engagement rates, content pillar performance, and hook types. Data-driven content strategy.',
              },
              {
                icon: '🔄',
                title: 'Memory & Learning',
                desc: 'Same brain on WhatsApp and dashboard. Nivi remembers preferences, learns from edits, and gets smarter over time.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-[#111] border border-[#222] rounded-xl p-6 hover:border-[#333] transition-colors group">
                <span className="text-2xl mb-3 block">{f.icon}</span>
                <h3 className="text-[15px] font-semibold text-white mb-2 group-hover:text-white/90">{f.title}</h3>
                <p className="text-[13px] text-[#888] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── HOW IT WORKS ──── */}
      <section id="how" className="border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#555] uppercase tracking-[0.2em] text-center mb-3">How it works</p>
          <h2 className="text-[32px] sm:text-[40px] font-bold text-center mb-4">Set up in 10 minutes. Post daily forever.</h2>
          <p className="text-[#777] text-center text-[15px] mb-16 max-w-xl mx-auto">Connect your LinkedIn, tell Nivi about yourself, and let her take over your content strategy.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-14">
            {[
              {
                step: '01',
                title: 'Connect & onboard',
                desc: 'Link your LinkedIn account and share your brand story. Nivi imports your profile, past posts, and writing style.',
                time: '10 minutes',
              },
              {
                step: '02',
                title: 'Nivi writes your posts',
                desc: 'Using your voice DNA, content pillars, and performance data, Nivi generates daily LinkedIn posts that sound like you.',
                time: 'Every morning',
              },
              {
                step: '03',
                title: 'Review on WhatsApp',
                desc: 'Your draft arrives in WhatsApp at 9 AM. Reply POST to publish, EDIT to refine, SCHEDULE to set a time, or SKIP.',
                time: '30 seconds',
              },
              {
                step: '04',
                title: 'Engage & grow',
                desc: 'Nivi finds high-value posts to comment on, drafts strategic replies, and tracks your engagement streak.',
                time: 'Autopilot',
              },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-6">
                <div className="shrink-0">
                  <span className="font-sans text-[40px] font-extralight text-[#333] leading-none">{s.step}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[17px] font-semibold text-white">{s.title}</h3>
                    <span className="text-[10px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full font-medium">{s.time}</span>
                  </div>
                  <p className="text-[14px] text-[#888] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── DASHBOARD + WHATSAPP SPLIT ──── */}
      <section className="border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#555] uppercase tracking-[0.2em] text-center mb-3">Two interfaces, one brain</p>
          <h2 className="text-[32px] sm:text-[40px] font-bold text-center mb-4">Dashboard when you want depth.<br className="hidden sm:block" /> WhatsApp when you want speed.</h2>
          <p className="text-[#777] text-center text-[15px] mb-16 max-w-2xl mx-auto">Nivi shares the same memory, voice, and intelligence across both interfaces. Use the dashboard for deep work, WhatsApp for quick actions.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111] border border-[#222] rounded-xl p-8">
              <p className="text-[11px] text-[#555] uppercase tracking-widest mb-4 font-medium">Dashboard</p>
              <ul className="space-y-3">
                {[
                  'Interactive post composer with AI toolbar',
                  'Drag-and-drop content calendar',
                  'Split-pane engagement with comment drafting',
                  'Inspiration library with 100+ creators',
                  'Brand identity & voice DNA setup',
                  'Performance analytics & charts',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#aaa]">
                    <span className="text-[#22c55e] mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-8">
              <p className="text-[11px] text-[#555] uppercase tracking-widest mb-4 font-medium">WhatsApp</p>
              <ul className="space-y-3">
                {[
                  'Morning post brief — approve with one word',
                  'Edit posts conversationally ("make it shorter")',
                  'Schedule or skip with a message',
                  'Engagement opportunities with draft comments',
                  'Ask Nivi anything about your brand strategy',
                  'Voice notes → Nivi turns them into posts',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#aaa]">
                    <span className="text-[#22c55e] mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ──── TESTIMONIAL / QUOTE ──── */}
      <section className="border-t border-[#1a1a1a]">
        <div className="max-w-3xl mx-auto px-8 py-20 text-center">
          <p className="text-[24px] sm:text-[28px] text-[#ccc] leading-relaxed italic font-light">
            &ldquo;I went from posting once a month to daily — without spending more than 2 minutes a day. Nivi genuinely sounds like me.&rdquo;
          </p>
          <div className="mt-6">
            <p className="text-[14px] text-white font-medium">Deepak Yadav</p>
            <p className="text-[12px] text-[#666]">UI/UX Designer & Solopreneur</p>
          </div>
        </div>
      </section>

      {/* ──── FINAL CTA ──── */}
      <section className="border-t border-[#1a1a1a] relative">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-8 py-24 text-center relative">
          <h2 className="font-sans text-[36px] sm:text-[48px] font-bold mb-4 tracking-tight">
            Stop overthinking LinkedIn.
          </h2>
          <p className="text-[#888] text-lg mb-10 max-w-lg mx-auto">
            Let Nivi handle your content strategy while you build your business. Set up takes 10 minutes.
          </p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link href="/sign-up" className="inline-block bg-white text-black text-sm px-10 py-4 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]">
              Start your 7-day free trial
            </Link>
          </div>
          <p className="text-xs text-[#555]">No credit card · Cancel anytime · Setup in 10 minutes</p>
        </div>
      </section>

      {/* ──── FOOTER ──── */}
      <footer className="border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-sans text-lg font-bold text-[#444]">Nivi</span>
          <div className="flex items-center gap-6 text-[12px] text-[#555]">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/sign-up" className="hover:text-white transition-colors">Get started</Link>
          </div>
          <p className="text-xs text-[#444]">&copy; 2026 Nivi. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
