'use client'

import { useState, useEffect } from 'react'
import { NiviMessage } from '@/components/nivi/NiviMessage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface ContextFiles {
  writing_style: string
  hook_mechanics: string
  sentence_styling: string
  post_system: string
  version: number
  updated_at: string
}

const TAB_KEYS = ['writing_style', 'hook_mechanics', 'sentence_styling', 'post_system'] as const
const TAB_LABELS: Record<string, string> = {
  writing_style: 'Writing Style',
  hook_mechanics: 'Hook Mechanics',
  sentence_styling: 'Sentence Style',
  post_system: 'Post System',
}

export default function ProfilePage() {
  const [files, setFiles] = useState<ContextFiles | null>(null)
  const [editingTab, setEditingTab] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/profile')
      .then((r) => r.json())
      .then((d) => setFiles(d.files))
      .catch(() => {})
  }, [])

  const handleSave = async (key: string) => {
    await fetch('/api/dashboard/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: key, value: editContent }),
    })
    setFiles((prev) => (prev ? { ...prev, [key]: editContent } : prev))
    setEditingTab(null)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setConfirmText('')
    const res = await fetch('/api/onboarding/generate-context', { method: 'POST' })
    const data = await res.json()
    if (data.writing_style) {
      setFiles({
        writing_style: data.writing_style,
        hook_mechanics: data.hook_mechanics,
        sentence_styling: data.sentence_styling,
        post_system: data.post_system,
        version: (files?.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
    }
    setRegenerating(false)
  }

  const daysAgo = files?.updated_at
    ? Math.floor((Date.now() - new Date(files.updated_at).getTime()) / 86400000)
    : null

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-medium text-foreground">AI Profile</h1>
        <p className="font-sans text-xs text-muted-foreground mt-1 tracking-wider uppercase">Your brand voice context files</p>
      </div>

      <NiviMessage
        message={
          daysAgo !== null
            ? `Your AI profile was last updated ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago. Review and edit anytime to keep your voice sharp.`
            : 'Loading your profile...'
        }
        timestamp="profile"
        animate={false}
      />

      <Tabs defaultValue="writing_style">
        <TabsList className="bg-card border border-border">
          {TAB_KEYS.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="font-sans text-[11px] data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              {TAB_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_KEYS.map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-sans text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground">
                v{files?.version ?? 1}
              </span>
              {files?.updated_at && (
                <span className="font-sans text-[10px] text-muted-foreground">
                  Updated {new Date(files.updated_at).toLocaleDateString()}
                </span>
              )}
              <button
                onClick={() => {
                  if (editingTab === key) {
                    setEditingTab(null)
                  } else {
                    setEditingTab(key)
                    setEditContent(files?.[key] ?? '')
                  }
                }}
                className="font-sans text-[10px] px-2 py-1 border border-border text-muted-foreground hover:text-foreground rounded-sm transition-colors ml-auto"
              >
                {editingTab === key ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editingTab === key ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="w-full bg-card border border-border rounded p-6 text-muted-foreground text-[13px] font-sans leading-[1.9] focus:outline-none focus:border-border resize-none min-h-[400px]"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleSave(key)}
                    className="font-sans text-[11px] px-4 py-1.5 bg-white text-black rounded-md hover:bg-white/90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTab(null)}
                    className="font-sans text-[11px] px-4 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded p-6 min-h-[400px] overflow-y-auto max-h-[600px]">
                <pre className="font-sans text-[13px] text-muted-foreground leading-[1.9] whitespace-pre-wrap">
                  {files?.[key] || 'No content yet. Complete onboarding to generate.'}
                </pre>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Danger zone */}
      <div className="border border-destructive/30 rounded-lg p-5 mt-8">
        <h3 className="font-sans text-[13px] text-destructive mb-2">Regenerate AI Profile</h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          This deletes your current profile and rebuilds from scratch. Takes 30\u201360 seconds.
        </p>
        <Dialog>
          <DialogTrigger className="font-sans text-[11px] px-4 py-1.5 border border-destructive/30 text-destructive rounded-md hover:bg-destructive/10 transition-colors">
            Regenerate
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground font-sans">Confirm Regeneration</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-[13px] mb-4">
              Type &ldquo;regenerate&rdquo; to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="regenerate"
              className="w-full bg-secondary border border-border rounded-md px-4 py-2 text-foreground text-[14px] focus:outline-none focus:border-border"
            />
            <button
              onClick={handleRegenerate}
              disabled={confirmText !== 'regenerate' || regenerating}
              className="mt-3 font-sans text-[11px] px-4 py-1.5 bg-destructive text-white rounded-md disabled:opacity-30 hover:bg-destructive/80 transition-colors"
            >
              {regenerating ? 'Regenerating...' : 'Confirm Regenerate'}
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
