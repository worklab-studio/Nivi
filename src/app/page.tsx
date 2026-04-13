import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/overview')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* ──── NAV ──── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
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

      {/* ──── HERO ──── */}
      <section className="max-w-5xl mx-auto px-8 pt-24 pb-20 text-center relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 border border-[#333] rounded-full px-4 py-1.5 mb-8 relative">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs text-[#a0a0a0] font-sans">Your AI LinkedIn brand strategist — hellonivi.com</span>
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
        <div className="max-w-6xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#555] uppercase tracking-[0.2em] text-center mb-3">Two ways to work</p>
          <h2 className="text-[32px] sm:text-[40px] font-bold text-center mb-16">Same brain. Your choice of interface.</h2>

          {/* Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#252525] rounded-full px-3 py-1 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[11px] text-[#888] font-medium">Dashboard</span>
              </div>
              <h3 className="text-[24px] font-bold text-white mb-3">Deep work mode</h3>
              <p className="text-[15px] text-[#888] leading-relaxed mb-6">
                When you want full control — compose with the AI editor, drag posts across your calendar, analyze what&apos;s working, and build your brand identity.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'AI Post Composer',
                  'Content Calendar',
                  'Engagement Tools',
                  'Inspiration Library',
                  'Voice DNA Setup',
                  'Analytics & Charts',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[13px] text-[#aaa]">
                    <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-8 bg-[#1a1a1a] border-b border-[#252525] flex items-center px-3 gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
              </div>
              <div className="mt-10 space-y-3">
                <div className="h-3 bg-[#1a1a1a] rounded w-2/3" />
                <div className="h-3 bg-[#1a1a1a] rounded w-full" />
                <div className="h-3 bg-[#1a1a1a] rounded w-4/5" />
                <div className="h-3 bg-[#1a1a1a] rounded w-3/5" />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="h-16 bg-[#1a1a1a] rounded-lg" />
                  <div className="h-16 bg-[#1a1a1a] rounded-lg" />
                  <div className="h-16 bg-[#1a1a1a] rounded-lg" />
                </div>
                <div className="h-24 bg-[#1a1a1a] rounded-lg mt-2" />
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 order-2 md:order-1 max-w-sm mx-auto w-full">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#1e1e1e]">
                <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center">
                  <span className="text-black text-xs font-bold">N</span>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white">Nivi</p>
                  <p className="text-[9px] text-[#666]">Online</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-3 max-w-[85%]">
                  <p className="text-[12px] text-[#ccc] leading-relaxed">Your post is ready. Hook score: 9/10</p>
                </div>
                <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-3 max-w-[85%]">
                  <p className="text-[12px] text-[#ddd] italic leading-relaxed">&ldquo;I almost quit my startup 3 months in...&rdquo;</p>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-1.5">
                    <p className="text-[12px] text-white font-medium">POST</p>
                  </div>
                </div>
                <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-3 max-w-[85%]">
                  <p className="text-[12px] text-[#ccc]">Done! Live on LinkedIn 🚀</p>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#252525] rounded-full px-3 py-1 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-[11px] text-[#888] font-medium">WhatsApp</span>
              </div>
              <h3 className="text-[24px] font-bold text-white mb-3">Speed mode</h3>
              <p className="text-[15px] text-[#888] leading-relaxed mb-6">
                When you want zero friction — approve posts, give feedback, and manage your LinkedIn from the app you already use 50 times a day.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'One-word publishing',
                  'Voice note → post',
                  'Morning briefs',
                  'Engagement alerts',
                  'Edit conversationally',
                  'Strategy advice',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[13px] text-[#aaa]">
                    <div className="w-1 h-1 rounded-full bg-[#22c55e] shrink-0" />
                    {item}
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
