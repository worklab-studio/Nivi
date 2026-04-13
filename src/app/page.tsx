import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'
import { ParticleHero } from '@/components/landing/ParticleHero'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/overview')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* ──── NAV ──── */}
      <nav className="relative z-20 flex items-center justify-between px-5 sm:px-6 py-4">
        <span className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-6 h-6" />
          <span className="font-sans text-xl font-semibold tracking-tight">hello nivi</span>
        </span>
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

      {/* ──── HERO — Particle Face ──── */}
      <ParticleHero />

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

          <FeaturesGrid />
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

      {/* ──── TWO WAYS TO WORK ──── */}
      <section className="border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#555] uppercase tracking-[0.2em] text-center mb-3">Two ways to work</p>
          <h2 className="text-[32px] sm:text-[40px] font-bold text-center mb-4">Same brain. Your choice.</h2>
          <p className="text-[#777] text-center text-[15px] mb-14 max-w-lg mx-auto">Every preference, every memory, every voice trait — shared across both interfaces.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dashboard card */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-7 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-white">Dashboard</p>
                    <p className="text-[11px] text-[#666]">For deep work</p>
                  </div>
                </div>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">Full control</span>
              </div>
              <div className="space-y-2.5 flex-1">
                {[
                  ['Compose', 'AI editor with inline rewrites, formatting, emoji picker'],
                  ['Calendar', 'Drag-and-drop scheduling with 15-min snap zones'],
                  ['Engage', 'Split-pane comment drafting on target accounts'],
                  ['Inspire', 'Browse 100+ creators, remix posts in your voice'],
                  ['Analyze', 'Impressions, engagement rate, hook performance'],
                  ['Identity', 'Voice DNA, content pillars, brand story'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3 group">
                    <div className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#252525] flex items-center justify-center shrink-0 mt-0.5 group-hover:border-blue-500/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    <div>
                      <p className="text-[13px] text-white font-medium">{title}</p>
                      <p className="text-[11px] text-[#666] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp card */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-7 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-white">WhatsApp</p>
                    <p className="text-[11px] text-[#666]">For speed</p>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">Zero friction</span>
              </div>
              <div className="space-y-2.5 flex-1">
                {[
                  ['Morning brief', 'Polished post draft delivered at 9 AM daily'],
                  ['One-word publish', 'Reply POST and it&apos;s live on LinkedIn'],
                  ['Edit by chat', '"Make it shorter" — Nivi rewrites instantly'],
                  ['Engage', 'Comment opportunities with pre-drafted replies'],
                  ['Voice notes', 'Record a thought, Nivi turns it into a post'],
                  ['Strategy', 'Ask anything about your brand, audience, or content'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3 group">
                    <div className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#252525] flex items-center justify-center shrink-0 mt-0.5 group-hover:border-emerald-500/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[13px] text-white font-medium">{title}</p>
                      <p className="text-[11px] text-[#666] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
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
          <span className="flex items-center gap-1.5">
            <img src="/logo.svg" alt="" className="w-4 h-4 opacity-40" />
            <span className="font-sans text-sm font-semibold text-[#444]">hello nivi</span>
          </span>
          <div className="flex items-center gap-6 text-[12px] text-[#555]">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/sign-up" className="hover:text-white transition-colors">Get started</Link>
          </div>
          <p className="text-xs text-[#444]">&copy; 2026 hello nivi. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
