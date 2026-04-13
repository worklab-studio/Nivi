'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useMousePosition } from './useMousePosition'
import { useParticleEngine } from './useParticleEngine'

export function ParticleHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Track scroll progress of this section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  // Mouse tracking
  const mouseRef = useMousePosition(canvasRef)

  // Particle render loop
  useParticleEngine(canvasRef, mouseRef, scrollYProgress)

  // Scroll-driven animations
  const textOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const textY = useTransform(scrollYProgress, [0, 0.3], [0, -60])
  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.6, 0.85, 1],
    ['#0a0a0a', '#0a0a0a', '#0a0a0a', '#0a0a0a']
  )

  return (
    <motion.section
      ref={sectionRef}
      className="relative"
      style={{ height: '180vh', backgroundColor: bgColor }}
    >
      {/* Sticky viewport container */}
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Particle canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: 'crosshair' }}
        />

        {/* Subtle radial glow behind face */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '40%',
              height: '60%',
              background: 'radial-gradient(ellipse, rgba(120,100,180,0.08) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Text overlay */}
        <motion.div
          className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8"
          style={{ opacity: textOpacity, y: textY }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-[#333] rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm bg-black/20">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-xs text-[#a0a0a0] font-sans">
              Your AI LinkedIn brand strategist
            </span>
          </div>

          {/* Heading */}
          <h1 className="font-sans text-[48px] sm:text-[64px] lg:text-[80px] font-bold leading-[1.05] tracking-tight mb-6">
            Your LinkedIn.
            <br />
            <span className="bg-gradient-to-r from-white via-white to-[#888] bg-clip-text text-transparent">
              On autopilot.
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-[#999] text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Nivi learns your voice, writes daily posts, drafts strategic comments,
            and delivers everything to your WhatsApp.{' '}
            <span className="text-white font-medium">
              Reply &quot;ok&quot; to publish.
            </span>
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link
              href="/sign-up"
              className="bg-white text-black text-sm px-8 py-3.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]"
            >
              Start 7-day free trial
            </Link>
            <Link
              href="#how"
              className="border border-[#333] text-sm px-8 py-3.5 rounded-lg text-[#aaa] hover:text-white hover:border-[#555] transition-colors"
            >
              See how it works
            </Link>
          </div>
          <p className="text-xs text-[#555] font-sans">
            No credit card required. Cancel anytime.
          </p>
        </motion.div>

        {/* Bottom gradient fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, #0a0a0a, transparent)',
          }}
        />
      </div>
    </motion.section>
  )
}
