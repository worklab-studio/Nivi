'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'

/**
 * Hero with the particle-style portrait rendered as an image
 * with CSS-based glow effects and scroll animations.
 * The AI-generated image already has the particle aesthetic.
 */
export function ParticleHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  const textOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.8, 4])
  const imageOpacity = useTransform(scrollYProgress, [0, 0.5, 0.8, 1], [1, 1, 0.5, 0])
  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.5, 0.8, 1],
    ['rgba(10,10,10,1)', 'rgba(10,10,10,1)', 'rgba(200,200,220,0.8)', 'rgba(255,255,255,1)']
  )
  const imageFilter = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7],
    ['brightness(1)', 'brightness(1.3)', 'brightness(2.5)']
  )

  // Cursor glow effect
  useEffect(() => {
    const container = imageRef.current
    const glow = glowRef.current
    if (!container || !glow) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      glow.style.opacity = '1'
      glow.style.background = `radial-gradient(500px circle at ${x}px ${y}px, rgba(160,120,255,0.25), rgba(100,60,220,0.08) 50%, transparent 70%)`
    }

    const onMouseLeave = () => {
      glow.style.opacity = '0'
    }

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)

    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <motion.section
      ref={sectionRef}
      className="relative"
      style={{ height: '220vh', backgroundColor: bgColor }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Image container */}
        <motion.div
          ref={imageRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{ scale: imageScale, opacity: imageOpacity, filter: imageFilter }}
        >
          {/* The particle-style portrait */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/face-photo.png"
            alt=""
            className="h-[95vh] w-auto max-w-none object-contain select-none pointer-events-none"
            style={{ filter: 'brightness(1.4) contrast(1.2)' }}
            draggable={false}
          />

          {/* Cursor glow overlay */}
          <div
            ref={glowRef}
            className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
            style={{ opacity: 0 }}
          />
        </motion.div>

        {/* Purple ambient backlight */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              width: '60%',
              height: '70%',
              background: 'radial-gradient(ellipse, rgba(100,60,220,0.18) 0%, rgba(80,40,180,0.06) 40%, transparent 70%)',
            }}
          />
          <div
            className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{
              width: '30%',
              height: '40%',
              background: 'radial-gradient(ellipse, rgba(140,100,255,0.12) 0%, transparent 65%)',
            }}
          />
        </div>

        {/* Text — bottom left */}
        <motion.div
          className="absolute z-10 left-0 right-0 px-6 sm:px-10 lg:px-16"
          style={{ bottom: 48, opacity: textOpacity }}
        >
          <p className="text-[10px] sm:text-[11px] text-[#666] uppercase tracking-[0.3em] font-medium mb-3">
            Your LinkedIn personal branding strategist
          </p>
          <h1 className="font-sans text-[40px] sm:text-[56px] lg:text-[64px] font-bold tracking-tight text-white leading-[1.05] mb-3">
            Introducing Nivi.
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[#777] mb-6 max-w-md leading-relaxed">
            She learns your voice, writes daily posts, and delivers them to your WhatsApp.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-black text-[13px] px-6 py-2.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.1)]"
          >
            Say Hello Nivi <span className="text-[11px]">↗</span>
          </Link>
        </motion.div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.9), transparent)' }}
        />
      </div>
    </motion.section>
  )
}
