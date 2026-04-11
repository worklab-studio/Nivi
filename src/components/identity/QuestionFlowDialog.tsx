'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Question } from '@/components/onboarding/QuestionFlow'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  questions: Question[]
  onComplete: (answers: Record<string, string>) => void
}

export function QuestionFlowDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  questions,
  onComplete,
}: Props) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const q = questions[idx]
  const isLast = idx === questions.length - 1
  const value = answers[q?.id] ?? ''
  const canProceed = q?.optional ? true : value.trim().length > 0

  function reset() {
    setIdx(0)
    setAnswers({})
  }

  function handleNext() {
    if (isLast) {
      onComplete(answers)
      reset()
      onOpenChange(false)
    } else {
      setIdx((i) => i + 1)
    }
  }

  function handleBack() {
    if (idx > 0) setIdx((i) => i - 1)
  }

  if (!q) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= idx ? 'bg-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        <div className="space-y-3 pt-1">
          <label className="block text-[14px] font-medium text-foreground">
            {q.label}
            {q.optional && (
              <span className="text-[11px] text-muted-foreground ml-2 font-normal">
                Optional
              </span>
            )}
          </label>

          {q.type === 'text' && (
            <Input
              autoFocus
              value={value}
              placeholder={q.placeholder}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && canProceed && handleNext()}
            />
          )}

          {q.type === 'textarea' && (
            <Textarea
              autoFocus
              rows={q.rows ?? 4}
              value={value}
              placeholder={q.placeholder}
              className="resize-none"
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            />
          )}

          {q.type === 'radio' && q.options && (
            <div className="space-y-1.5">
              {q.options.map((o) => (
                <button
                  key={o}
                  onClick={() => setAnswers({ ...answers, [q.id]: o })}
                  className={`w-full text-left px-3 py-2 rounded-md border text-[13px] transition-colors ${
                    value === o
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3">
          <Button variant="ghost" size="sm" onClick={handleBack} disabled={idx === 0}>
            Back
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {idx + 1} of {questions.length}
          </span>
          <Button size="sm" onClick={handleNext} disabled={!canProceed}>
            {isLast ? 'Save' : 'Next'}
            {!isLast && <ChevronRight size={14} />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
