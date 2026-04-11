'use client'

import { User, BookOpen, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { QuestionSetKey } from '@/lib/identity/questionSets'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (key: QuestionSetKey) => void
}

const OPTIONS: { key: QuestionSetKey; icon: typeof User; title: string; desc: string }[] = [
  {
    key: 'about_you',
    icon: User,
    title: 'About you',
    desc: 'Refine your professional background and what makes you unique.',
  },
  {
    key: 'your_story',
    icon: BookOpen,
    title: 'Your story',
    desc: 'Capture your journey, turning points, and motivation.',
  },
  {
    key: 'personal_info',
    icon: Sparkles,
    title: 'Personal information',
    desc: 'Quick personal details that make posts feel like you.',
  },
]

export function QuestionsPickerDialog({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update via questions</DialogTitle>
          <DialogDescription>
            Pick a section. We&apos;ll walk you through a few quick questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                onPick(o.key)
                onOpenChange(false)
              }}
              className="w-full text-left bg-secondary/50 hover:bg-secondary border border-border rounded-lg p-3 transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                <o.icon size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{o.title}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
