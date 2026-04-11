'use client'

import { QuestionFlow, type Question } from '../QuestionFlow'

const QUESTIONS: Question[] = [
  {
    id: 'tone',
    label: 'How would you describe your natural communication tone?',
    type: 'multi-select',
    options: [
      'Dry / analytical',
      'Warm / encouraging',
      'Direct / blunt',
      'Humorous / witty',
      'Formal / precise',
      'Conversational',
    ],
  },
  {
    id: 'cringe_content',
    label: 'What kind of LinkedIn content makes you cringe?',
    type: 'textarea',
    rows: 3,
    placeholder: 'Be honest — what do you scroll past immediately?',
  },
  {
    id: 'admired_content',
    label: 'What type of posts do you most respect or admire?',
    type: 'textarea',
    rows: 3,
  },
  {
    id: 'sentence_style',
    label: 'Do you prefer short punchy sentences or longer analytical ones?',
    type: 'radio',
    options: ['Short & punchy', 'A natural mix', 'Long & analytical'],
  },
  {
    id: 'humor',
    label: 'Do you use humor in your writing?',
    type: 'radio',
    options: [
      'No humor — I am precise',
      'Dry, subtle humor',
      'Occasional warmth and wit',
    ],
  },
  {
    id: 'off_limits',
    label: 'What topics are completely off-limits for you?',
    type: 'textarea',
    rows: 2,
    placeholder: 'Politics, religion, competitors...',
  },
  {
    id: 'signature_phrase',
    label: 'Do you have a signature phrase or way of ending posts?',
    type: 'textarea',
    rows: 2,
    optional: true,
  },
  {
    id: 'never_sound_like',
    label: 'What do you NEVER want to sound like?',
    type: 'multi-select',
    options: [
      'Motivational speaker',
      'Corporate robot',
      'Hype merchant',
      'Humble-bragger',
      'Generic AI',
      'Clickbait creator',
    ],
  },
]

interface Step5Props {
  onNext: () => void
  onBack: () => void
}

export function Step5Style({ onNext, onBack }: Step5Props) {
  const handleComplete = async (answers: Record<string, string | string[]>) => {
    try {
      await fetch('/api/onboarding/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'writing_style', answers }),
      })
    } catch {
      // continue anyway
    }
    onNext()
  }

  return (
    <QuestionFlow
      title="Your Style"
      subtitle="How you write and what you stand for."
      questions={QUESTIONS}
      onComplete={handleComplete}
      onBack={onBack}
    />
  )
}
