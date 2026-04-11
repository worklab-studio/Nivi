import type { Question } from '@/components/onboarding/QuestionFlow'

export const ABOUT_YOU_QUESTIONS: Question[] = [
  {
    id: 'profession',
    label: 'What do you do, in one sentence?',
    type: 'text',
    placeholder: 'e.g. I help SaaS founders simplify their stack',
  },
  {
    id: 'years',
    label: 'How long have you been doing it?',
    type: 'radio',
    options: ['<1 year', '1–3 years', '3–7 years', '7–12 years', '12+ years'],
  },
  {
    id: 'unique',
    label: 'What makes your work different from others in your space?',
    type: 'textarea',
    rows: 4,
  },
  {
    id: 'proof',
    label: 'What concrete proof do you have? (numbers, named clients, outcomes)',
    type: 'textarea',
    rows: 3,
    optional: true,
  },
]

export const YOUR_STORY_QUESTIONS: Question[] = [
  {
    id: 'origin',
    label: 'How did you end up doing this work?',
    type: 'textarea',
    rows: 4,
  },
  {
    id: 'turning_point',
    label: 'What was the turning point or hardest moment?',
    type: 'textarea',
    rows: 3,
  },
  {
    id: 'why',
    label: 'Why does this matter to you personally?',
    type: 'textarea',
    rows: 3,
  },
]

export const PERSONAL_INFO_QUESTIONS: Question[] = [
  {
    id: 'location',
    label: 'Where are you based?',
    type: 'text',
    optional: true,
  },
  {
    id: 'routine',
    label: 'A daily habit or routine that shapes how you work?',
    type: 'textarea',
    rows: 2,
    optional: true,
  },
  {
    id: 'fun_fact',
    label: 'A non-work fact about you that surprises people?',
    type: 'textarea',
    rows: 2,
    optional: true,
  },
]

export type QuestionSetKey = 'about_you' | 'your_story' | 'personal_info'

export const QUESTION_SETS: Record<QuestionSetKey, { title: string; subtitle: string; questions: Question[] }> = {
  about_you: {
    title: 'About you',
    subtitle: 'A few quick questions to refine your professional background',
    questions: ABOUT_YOU_QUESTIONS,
  },
  your_story: {
    title: 'Your story',
    subtitle: 'Help Nivi understand your journey',
    questions: YOUR_STORY_QUESTIONS,
  },
  personal_info: {
    title: 'Personal information',
    subtitle: 'Optional details that make posts feel like you',
    questions: PERSONAL_INFO_QUESTIONS,
  },
}
