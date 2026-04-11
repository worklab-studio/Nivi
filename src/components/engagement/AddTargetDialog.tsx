'use client'

import { useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export interface Target {
  id: string
  linkedin_url: string
  author_handle: string | null
  author_name: string | null
  author_headline: string | null
  avatar_url: string | null
  mode: 'whitelist' | 'blacklist'
  note: string | null
  created_at: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (target: Target) => void
}

export function AddTargetDialog({ open, onOpenChange, onCreated }: Props) {
  const [url, setUrl] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [mode, setMode] = useState<'whitelist' | 'blacklist'>('whitelist')
  const [loading, setLoading] = useState(false)

  function reset() {
    setUrl('')
    setAuthorName('')
    setMode('whitelist')
    setLoading(false)
  }

  async function handleSubmit() {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/engagement/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: url.trim(),
          author_name: authorName.trim() || undefined,
          mode,
        }),
      })
      const data = await res.json()
      if (data.ok && data.target) {
        toast.success(`Added ${data.target.author_name ?? data.target.author_handle}`)
        onCreated(data.target)
        reset()
        onOpenChange(false)
      } else {
        toast.error(data.error ?? 'Could not add target')
      }
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={16} className="text-primary" />
            Add an engagement target
          </DialogTitle>
          <DialogDescription>
            Whitelist authors you want to build relationships with, or blacklist ones you want to avoid. Whitelisted authors get a relevance boost so their posts surface higher in your Queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              LinkedIn URL
            </p>
            <Input
              placeholder="https://linkedin.com/in/handle"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Display name (optional)
            </p>
            <Input
              placeholder="e.g. Justin Welsh"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['whitelist', 'blacklist'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={loading}
                  className={`text-[12px] py-2 rounded-md border transition-colors capitalize ${
                    mode === m
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!url.trim() || loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Add target
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
