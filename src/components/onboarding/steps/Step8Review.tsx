'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const LOADING_MESSAGES = [
  'Reading your writing samples...',
  'Mapping your voice patterns...',
  'Building your personal hook library...',
  'Defining your content pillars...',
  'Writing your sentence style guide...',
  'Finalising your post system...',
  'Almost ready...',
]

const TABS = [
  { key: 'writing_style', label: 'Writing Style' },
  { key: 'hook_mechanics', label: 'Hook Mechanics' },
  { key: 'sentence_styling', label: 'Sentence Style' },
  { key: 'post_system', label: 'Post System' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface ContextFiles {
  writing_style: string
  hook_mechanics: string
  sentence_styling: string
  post_system: string
}

export function Step8Review({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [files, setFiles] = useState<ContextFiles | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('writing_style')
  const [editedFiles, setEditedFiles] = useState<ContextFiles | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  // Cycle loading messages
  useEffect(() => {
    if (!loading) return
    intervalRef.current = setInterval(() => {
      setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length)
    }, 4000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loading])

  // Generate context files
  useEffect(() => {
    generateContextFiles()
  }, [])

  const generateContextFiles = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/generate-context', {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const generated: ContextFiles = {
        writing_style: data.writing_style || '',
        hook_mechanics: data.hook_mechanics || '',
        sentence_styling: data.sentence_styling || '',
        post_system: data.post_system || '',
      }
      setFiles(generated)
      setEditedFiles(generated)
    } catch {
      setError('Generation failed. Please try again.')
    }
    setLoading(false)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    await generateContextFiles()
    setRegenerating(false)
  }

  const handleApprove = async () => {
    try {
      await fetch('/api/onboarding/approve-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedFiles),
      })
    } catch {
      // continue anyway
    }
    onComplete()
  }

  const updateFile = (key: TabKey, value: string) => {
    setEditedFiles((prev) =>
      prev ? { ...prev, [key]: value } : prev
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black p-12">
        <h2 className="font-sans text-[48px] font-bold text-white mb-8">
          Nivi
        </h2>
        <motion.p
          key={loadingMsg}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="font-sans text-[13px] text-white/50 mb-12"
        >
          {LOADING_MESSAGES[loadingMsg]}
        </motion.p>
        <div className="w-48 h-[1px] bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white/40"
            animate={{ width: ['0%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    )
  }

  if (error && !files) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <p className="text-destructive font-sans text-[13px] mb-4">{error}</p>
        <button
          onClick={generateContextFiles}
          className="bg-white text-black px-6 py-2.5 rounded-md font-medium text-[14px] hover:bg-white/90 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-12">
      <h2 className="text-[28px] font-medium text-foreground mb-2">
        Your AI Profile
      </h2>
      <p className="text-muted-foreground text-[15px] mb-6">
        Nivi has built your brand voice. Review and edit anything before we
        start.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`font-sans text-[11px] px-4 py-2.5 transition-colors border-b-2 -mb-[1px] ${
              activeTab === key
                ? 'border-white text-white'
                : 'border-transparent text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <textarea
        value={editedFiles?.[activeTab] ?? ''}
        onChange={(e) => updateFile(activeTab, e.target.value)}
        rows={16}
        className="flex-1 w-full bg-secondary border border-border rounded-md px-4 py-3 text-foreground text-[13px] font-sans leading-relaxed focus:outline-none focus:border-border transition-colors resize-none"
      />

      {/* Actions */}
      <div className="flex justify-between items-center pt-6">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="font-sans text-[12px] text-muted-foreground border border-border px-4 py-2 rounded hover:border-border hover:text-muted-foreground transition-colors disabled:opacity-50"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
        <button
          onClick={handleApprove}
          className="bg-white text-black px-6 py-2.5 rounded-md font-medium text-[14px] hover:bg-white/90 transition-colors"
        >
          Looks good — let&rsquo;s start →
        </button>
      </div>
    </div>
  )
}
