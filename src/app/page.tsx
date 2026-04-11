import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/overview')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <span className="font-sans text-2xl font-bold tracking-tight">Nivi</span>
        <div className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="bg-white text-black text-sm px-5 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-8 pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 border border-[#333] rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs text-[#a0a0a0] font-sans">
            AI-powered LinkedIn ghostwriting
          </span>
        </div>

        <h1 className="font-sans text-[72px] font-bold leading-[1.05] tracking-tight mb-8">
          Your LinkedIn.
          <br />
          <span className="text-[#a0a0a0]">On autopilot.</span>
        </h1>

        <p className="text-[#a0a0a0] text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
          Nivi learns how you write, generates daily posts in your voice,
          and delivers them to WhatsApp every morning.
          <br className="hidden sm:block" />
          <span className="text-white font-medium">
            Reply &quot;POST&quot; to publish. That&apos;s it.
          </span>
        </p>

        <div className="flex items-center justify-center gap-4 mb-6">
          <Link
            href="/sign-up"
            className="bg-white text-black text-sm px-8 py-3.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]"
          >
            Start free trial
          </Link>
          <Link
            href="/pricing"
            className="border border-[#333] text-sm px-8 py-3.5 rounded-lg text-[#a0a0a0] hover:text-white hover:border-[#555] transition-colors"
          >
            See plans
          </Link>
        </div>
        <p className="text-xs text-[#555] font-sans">
          No credit card required. Cancel anytime.
        </p>
      </div>

      {/* WhatsApp mockup */}
      <div className="max-w-2xl mx-auto px-8 pb-24">
        <div className="bg-[#111] border border-[#252525] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1e1e1e]">
            <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center">
              <span className="text-black text-xs font-bold">N</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Nivi</p>
              <p className="text-[10px] text-[#777] font-sans">9:00 AM</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[90%]">
              <p className="text-[13px] text-[#d0d0d0] leading-relaxed">
                Good morning! Your Tuesday post is ready.
              </p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[90%]">
              <p className="text-[13px] text-[#d0d0d0] leading-relaxed font-sans italic">
                &ldquo;I almost quit my startup 3 months in.
                <br />
                <br />
                Not because it was failing.
                <br />
                Because it was working — and I wasn&apos;t ready for that.
                <br />
                <br />
                Here&apos;s what nobody tells you about early traction...&rdquo;
              </p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[90%]">
              <p className="text-[13px] text-[#999] font-sans">
                Reply: POST | SCHEDULE 3PM | EDIT: shorter | SKIP
              </p>
            </div>

            {/* User reply */}
            <div className="flex justify-end">
              <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-4 py-2.5">
                <p className="text-[13px] text-white font-medium">POST</p>
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl rounded-tl-sm p-4 max-w-[90%]">
              <p className="text-[13px] text-[#d0d0d0] leading-relaxed">
                Live on LinkedIn! I&apos;ll update you when it gains traction.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="border-t border-[#1e1e1e]">
        <div className="max-w-4xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#777] uppercase tracking-[0.2em] text-center mb-16">
            The daily loop
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {[
              {
                time: '7:00 AM',
                title: 'Nivi writes your post',
                desc: 'Using your voice profile, knowledge base, and what&apos;s performing best.',
                icon: '01',
              },
              {
                time: '9:00 AM',
                title: 'Draft lands in WhatsApp',
                desc: 'A polished post arrives in your morning brief. Review it with your coffee.',
                icon: '02',
              },
              {
                time: '9:05 AM',
                title: 'One word to publish',
                desc: 'Reply POST. Or EDIT, SCHEDULE, or SKIP. The entire workflow is one message.',
                icon: '03',
              },
              {
                time: '10:00 AM',
                title: 'Engagement autopilot',
                desc: '5 high-value comment opportunities with pre-drafted replies. Reply C1 C3 to post.',
                icon: '04',
              },
            ].map((step) => (
              <div key={step.icon} className="flex items-start gap-5">
                <span className="font-sans text-[28px] font-light text-[#333] leading-none shrink-0">
                  {step.icon}
                </span>
                <div>
                  <p className="font-sans text-[10px] text-[#22c55e] mb-1.5">
                    {step.time}
                  </p>
                  <h3 className="text-[16px] font-medium text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[14px] text-[#888] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features strip */}
      <div className="border-t border-[#1e1e1e]">
        <div className="max-w-4xl mx-auto px-8 py-24">
          <p className="font-sans text-xs text-[#777] uppercase tracking-[0.2em] text-center mb-16">
            Built different
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Your voice, not AI voice',
                desc: 'Nivi studies your writing samples, interview answers, and past posts. Every post sounds like you wrote it.',
              },
              {
                title: 'WhatsApp-first',
                desc: 'No dashboard required. Approve, edit, and schedule posts from the app you already check 50 times a day.',
              },
              {
                title: 'Learns over time',
                desc: 'Long-term memory. Nivi remembers your preferences, what performs best, and what to avoid.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-[#111] border border-[#252525] rounded-xl p-6"
              >
                <h3 className="text-[15px] font-medium text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-[13px] text-[#888] leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-[#1e1e1e]">
        <div className="max-w-3xl mx-auto px-8 py-24 text-center">
          <h2 className="font-sans text-[40px] font-bold mb-4">
            Stop overthinking LinkedIn.
          </h2>
          <p className="text-[#888] text-lg mb-10">
            Start posting consistently in your own voice. Set up takes 10 minutes.
          </p>
          <Link
            href="/sign-up"
            className="inline-block bg-white text-black text-sm px-10 py-4 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]"
          >
            Get started free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#1e1e1e]">
        <div className="max-w-5xl mx-auto px-8 py-8 flex items-center justify-between">
          <span className="font-sans text-lg font-bold text-[#555]">Nivi</span>
          <p className="text-xs text-[#555] font-sans">
            &copy; 2026 Nivi. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
