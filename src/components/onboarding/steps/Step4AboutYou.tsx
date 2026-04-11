'use client'

import { QuestionFlow, type Question } from '../QuestionFlow'

const QUESTIONS: Question[] = [
  {
    id: 'profession',
    label: 'What is your profession or job title?',
    type: 'text',
    placeholder: 'e.g. Founder, Product Designer, Coach',
  },
  {
    id: 'industry',
    label: 'What industry are you in?',
    type: 'text',
    placeholder: 'e.g. SaaS, Fintech, Health & Wellness',
  },
  {
    id: 'experience',
    label: 'How many years of experience do you have?',
    type: 'radio',
    options: ['1–3 years', '3–7 years', '7–12 years', '12–20 years', '20+ years'],
  },
  {
    id: 'origin_story',
    label: 'Tell us your origin story — how did you get to where you are today?',
    type: 'textarea',
    rows: 4,
    placeholder: 'Be specific — the more real, the better',
  },
  {
    id: 'achievements',
    label: 'What have you built, founded, or led that you are proud of?',
    type: 'textarea',
    rows: 4,
  },
  {
    id: 'target_audience',
    label: 'Who is your target audience on LinkedIn?',
    type: 'textarea',
    rows: 3,
    placeholder: 'Who specifically? What do they do? What do they struggle with?',
  },
  {
    id: 'known_for',
    label: 'What do you want to be known for on LinkedIn in 12 months?',
    type: 'textarea',
    rows: 3,
  },
  {
    id: 'product_service',
    label: 'What is your current primary product, service, or business?',
    type: 'textarea',
    rows: 3,
    placeholder: 'Name, what it does, price if relevant',
  },
  {
    id: 'unique_background',
    label: 'What makes your background genuinely unique — that nobody else has?',
    type: 'textarea',
    rows: 4,
  },
  {
    id: 'industry_wrong',
    label: 'What do most people in your industry get completely wrong?',
    type: 'textarea',
    rows: 4,
  },
]

interface Step4Props {
  onNext: () => void
  onBack: () => void
}

export function Step4AboutYou({ onNext, onBack }: Step4Props) {
  const handleComplete = async (answers: Record<string, string | string[]>) => {
    try {
      await fetch('/api/onboarding/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'about_you', answers }),
      })
    } catch {
      // save failed, continue anyway — retry later
    }
    onNext()
  }

  return (
    <QuestionFlow
      title="About You"
      subtitle="Tell Nivi who you are."
      questions={QUESTIONS}
      onComplete={handleComplete}
      onBack={onBack}
    />
  )
}
