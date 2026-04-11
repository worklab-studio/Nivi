'use client'

import { QuestionFlow, type Question } from '../QuestionFlow'

const QUESTIONS: Question[] = [
  {
    id: 'topics',
    label: 'Name 3–5 topics you could write about forever.',
    type: 'tags',
  },
  {
    id: 'personal_stories',
    label: 'What personal stories or experiences do you have that nobody else does?',
    type: 'textarea',
    rows: 4,
    placeholder: 'Specific moments, failures, wins, turning points',
  },
  {
    id: 'industry_patterns',
    label: 'What patterns have you noticed in your industry that most people miss?',
    type: 'textarea',
    rows: 4,
  },
  {
    id: 'contrarian_positions',
    label: 'What contrarian positions do you hold that most people in your space disagree with?',
    type: 'textarea',
    rows: 4,
    placeholder: 'The things you believe that would surprise people',
  },
  {
    id: 'frameworks',
    label: 'What frameworks, systems, or mental models have you developed from your own experience?',
    type: 'textarea',
    rows: 4,
  },
]

interface Step6Props {
  onNext: () => void
  onBack: () => void
}

export function Step6Pillars({ onNext, onBack }: Step6Props) {
  const handleComplete = async (answers: Record<string, string | string[]>) => {
    try {
      await fetch('/api/onboarding/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'content_pillars', answers }),
      })
    } catch {
      // continue anyway
    }
    onNext()
  }

  return (
    <QuestionFlow
      title="Content Pillars"
      subtitle="What you will talk about."
      questions={QUESTIONS}
      onComplete={handleComplete}
      onBack={onBack}
    />
  )
}
