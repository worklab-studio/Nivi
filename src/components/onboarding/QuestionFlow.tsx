'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type QuestionType = 'text' | 'textarea' | 'radio' | 'multi-select' | 'tags'

export interface Question {
  id: string
  label: string
  type: QuestionType
  placeholder?: string
  optional?: boolean
  rows?: number
  options?: string[]
}

interface QuestionFlowProps {
  title: string
  subtitle: string
  questions: Question[]
  onComplete: (answers: Record<string, string | string[]>) => void
  onBack: () => void
}

export function QuestionFlow({
  title,
  subtitle,
  questions,
  onComplete,
  onBack,
}: QuestionFlowProps) {
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [direction, setDirection] = useState(1)
  const [tagInput, setTagInput] = useState('')

  const q = questions[qIndex]
  const currentValue = answers[q.id] ?? (q.type === 'multi-select' || q.type === 'tags' ? [] : '')
  const isLast = qIndex === questions.length - 1

  const canProceed = q.optional
    ? true
    : q.type === 'tags'
      ? (currentValue as string[]).length >= 3
      : q.type === 'multi-select'
        ? (currentValue as string[]).length > 0
        : (currentValue as string).trim().length > 0

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete(answers)
    } else {
      setDirection(1)
      setQIndex((i) => i + 1)
    }
  }, [isLast, answers, onComplete])

  const handleBack = useCallback(() => {
    if (qIndex === 0) {
      onBack()
    } else {
      setDirection(-1)
      setQIndex((i) => i - 1)
    }
  }, [qIndex, onBack])

  const setValue = (val: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [q.id]: val }))
  }

  const toggleMultiSelect = (option: string) => {
    const current = (currentValue as string[]) || []
    if (current.includes(option)) {
      setValue(current.filter((o) => o !== option))
    } else {
      setValue([...current, option])
    }
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !(currentValue as string[]).includes(tag)) {
      setValue([...(currentValue as string[]), tag])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setValue((currentValue as string[]).filter((t) => t !== tag))
  }

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 30 : -30, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -30 : 30, opacity: 0 }),
  }

  return (
    <div className="flex-1 flex flex-col p-12">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-[28px] font-medium text-foreground">{title}</h2>
        <p className="text-muted-foreground text-[15px] mb-1">{subtitle}</p>
        <p className="font-sans text-[10px] text-muted-foreground">
          {qIndex + 1} of {questions.length}
        </p>
      </div>

      {/* Question progress */}
      <div className="flex gap-1 mb-8">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-[2px] flex-1 rounded-full transition-all duration-300 ${
              i < qIndex
                ? 'bg-white'
                : i === qIndex
                  ? 'bg-white/60'
                  : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <div className="flex-1">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={q.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <label className="block text-foreground text-[16px] font-medium mb-4 leading-relaxed">
              {q.label}
              {q.optional && (
                <span className="text-muted-foreground text-[12px] ml-2 font-normal">
                  Optional
                </span>
              )}
            </label>

            {q.type === 'text' && (
              <input
                type="text"
                value={currentValue as string}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canProceed && handleNext()}
                placeholder={q.placeholder}
                autoFocus
                className="w-full bg-secondary border border-border rounded-md px-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors"
              />
            )}

            {q.type === 'textarea' && (
              <textarea
                value={currentValue as string}
                onChange={(e) => setValue(e.target.value)}
                placeholder={q.placeholder}
                rows={q.rows || 4}
                autoFocus
                className="w-full bg-secondary border border-border rounded-md px-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors resize-none"
              />
            )}

            {q.type === 'radio' && q.options && (
              <div className="space-y-2">
                {q.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => setValue(option)}
                    className={`w-full text-left px-4 py-3 rounded-md border transition-colors text-[14px] ${
                      currentValue === option
                        ? 'border-white bg-white/10 text-white'
                        : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multi-select' && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((option) => {
                  const selected = (currentValue as string[]).includes(option)
                  return (
                    <button
                      key={option}
                      onClick={() => toggleMultiSelect(option)}
                      className={`px-4 py-2 rounded-md border text-[13px] transition-colors ${
                        selected
                          ? 'border-white bg-white/10 text-white'
                          : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'tags' && (
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(currentValue as string[]).map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 text-white text-[13px] border border-white/20"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-white/40 hover:text-white text-[11px]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Type a topic and press Enter"
                  autoFocus
                  className="w-full bg-secondary border border-border rounded-md px-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors"
                />
                <p className="font-sans text-[10px] text-muted-foreground mt-2">
                  {(currentValue as string[]).length} / 3 minimum
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6">
        <button
          onClick={handleBack}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="bg-white text-black px-6 py-2.5 rounded-md font-medium text-[14px] disabled:opacity-30 hover:bg-white/90 transition-colors"
        >
          {isLast ? 'Continue →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
