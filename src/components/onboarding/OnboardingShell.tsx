'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Step0Welcome } from './steps/Step0Welcome'
import { Step2LinkedIn } from './steps/Step2LinkedIn'
import { Step3WhatsApp } from './steps/Step3WhatsApp'
import { Step4AboutYou } from './steps/Step4AboutYou'
import { Step5Style } from './steps/Step5Style'
import { Step6Pillars } from './steps/Step6Pillars'
import { Step7SamplePosts } from './steps/Step7SamplePosts'
import { Step8Review } from './steps/Step8Review'

const STEP_META = [
  { label: 'Welcome', desc: "Let's get you set up." },
  { label: 'LinkedIn', desc: 'Connect your LinkedIn account.' },
  { label: 'WhatsApp', desc: 'Connect your WhatsApp.' },
  { label: 'About You', desc: 'Tell Nivi who you are.' },
  { label: 'Your Style', desc: 'How you write and what you stand for.' },
  { label: 'Content Pillars', desc: 'What you will talk about.' },
  { label: 'Your Writing', desc: 'Show Nivi how you sound.' },
  { label: 'Review', desc: 'Nivi is building your profile.' },
]

const NIVI_QUOTES = [
  '"The more you tell me, the more I sound like you."',
  '"Every detail you share becomes part of your voice."',
  '"This is where good ghostwriting starts — with honesty."',
  '"Your audience wants the real you, not a polished version."',
  '"Specificity is credibility. Be specific."',
]

export function OnboardingShell({ initialStep = 0 }: { initialStep?: number }) {
  const [step, setStep] = useState(initialStep)
  const [direction, setDirection] = useState(1)
  const router = useRouter()

  const goNext = useCallback(() => {
    setDirection(1)
    setStep((s) => Math.min(s + 1, 7))
  }, [])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const handleComplete = useCallback(() => {
    router.push('/')
  }, [router])

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return <Step0Welcome onNext={goNext} />
      case 1:
        return <Step2LinkedIn onNext={goNext} onBack={goBack} />
      case 2:
        return <Step3WhatsApp onNext={goNext} onBack={goBack} />
      case 3:
        return <Step4AboutYou onNext={goNext} onBack={goBack} />
      case 4:
        return <Step5Style onNext={goNext} onBack={goBack} />
      case 5:
        return <Step6Pillars onNext={goNext} onBack={goBack} />
      case 6:
        return <Step7SamplePosts onNext={goNext} onBack={goBack} />
      case 7:
        return <Step8Review onComplete={handleComplete} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex bg-black">
      {/* Progress bar — absolute top */}
      <motion.div
        className="absolute top-0 left-0 h-[1px] bg-white z-50"
        animate={{ width: `${((step + 1) / STEP_META.length) * 100}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />

      {/* Left panel */}
      <div className="w-[40%] flex flex-col justify-between p-12 bg-black">
        <div>
          <h1 className="font-sans text-[72px] font-bold text-white leading-none mb-8">
            Nivi
          </h1>
          <div className="font-sans text-[11px] tracking-[0.2em] text-white/40 uppercase mb-3">
            {STEP_META[step]?.label}
          </div>
          <p className="text-white/60 text-[15px] leading-relaxed font-sans">
            {NIVI_QUOTES[step % NIVI_QUOTES.length]}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2">
          {STEP_META.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                i < step
                  ? 'w-8 bg-white'
                  : i === step
                    ? 'w-8 bg-white/60'
                    : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-[60%] bg-card flex flex-col overflow-hidden relative">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-1 flex flex-col"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
