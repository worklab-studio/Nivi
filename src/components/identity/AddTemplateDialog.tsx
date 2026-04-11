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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const PROGRESS_STEPS = [
  'Fetching the post…',
  'Reading the author’s rhythm…',
  'Finding the hook formula…',
  'Mapping the logic flow…',
  'Extracting rhetorical devices…',
  'Isolating vocabulary signature…',
  'Decoding the closing pattern…',
  'Assembling voice DNA…',
  'Almost there…',
]

export function AddTemplateDialog({ open, onOpenChange, onCreated }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Rotate the loading message every 1.2s while loading
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
    setStepIndex(0)
    try {
      const res = await fetch('/api/dashboard/writing-style/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Saved as "${data.template?.name ?? 'New template'}"`)
        reset()
        onCreated()
        onOpenChange(false)
      } else {
        toast.error(data.error ?? 'Could not extract post')
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
            Add a writing style
          </DialogTitle>
          <DialogDescription>
            Paste a link to any LinkedIn post. Nivi fetches the post, extracts the author&apos;s voice DNA — hook formula, logic flow, rhetorical devices, vocabulary signature — and saves it as a template you can activate.
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
              Works best with public posts. Login-walled posts will fail to extract.
            </p>
          )}

          {/* Animated progress panel */}
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

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !url.trim()}>
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {loading ? 'Extracting…' : 'Extract style'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
