'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Link2 } from 'lucide-react'
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
import type { Opportunity } from './OpportunityCard'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (opp: Opportunity) => void
}

const PROGRESS_STEPS = [
  'Fetching post…',
  "Reading the author's voice…",
  'Drafting your comment…',
  'Almost done…',
]

export function AddOpportunityDialog({ open, onOpenChange, onCreated }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!loading) {
      setStepIndex(0)
      return
    }
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % PROGRESS_STEPS.length)
    }, 1200)
    return () => clearInterval(id)
  }, [loading])

  function reset() {
    setUrl('')
    setLoading(false)
    setStepIndex(0)
  }

  async function handleSubmit() {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/engagement/add-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (data.ok && data.opportunity) {
        const opp = data.opportunity as Opportunity
        toast.success(
          `Drafted a comment for ${opp.author_name ?? 'the post'}`
        )
        onCreated(opp)
        reset()
        onOpenChange(false)
      } else {
        toast.error(data.error ?? 'Could not draft from URL')
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            Add from LinkedIn URL
          </DialogTitle>
          <DialogDescription>
            Paste any LinkedIn post URL. Nivi fetches the post, reads the
            author&apos;s voice, and drafts a comment in your voice matched to
            your content pillars.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <Input
            placeholder="https://linkedin.com/posts/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
            autoFocus
            disabled={loading}
          />
          {!loading && (
            <p className="text-[11px] text-muted-foreground">
              Works for public LinkedIn posts. Login-walled posts will fail.
            </p>
          )}

          {loading && (
            <div className="bg-secondary/60 border border-border rounded-md px-3 py-3 flex items-center gap-2.5">
              <Loader2
                size={14}
                className="animate-spin text-primary shrink-0"
              />
              <span
                key={stepIndex}
                className="text-[12px] text-foreground animate-in fade-in slide-in-from-left-1 duration-300"
              >
                {PROGRESS_STEPS[stepIndex]}
              </span>
            </div>
          )}
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
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!url.trim() || loading}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Fetch &amp; draft
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
