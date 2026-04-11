'use client'

import { useState } from 'react'
import { Loader2, Sparkles, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Suggestion {
  about_you: string
  your_story: string
  target_audience_suggestions: { label: string; description?: string }[]
  offer_suggestions: { name: string; description: string; url?: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (suggestion: Suggestion) => void
}

export function LinkedInUrlImportDialog({ open, onOpenChange, onApply }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)

  function reset() {
    setUrl('')
    setSuggestion(null)
    setLoading(false)
  }

  async function handleFetch() {
    if (!url.trim()) return
    setLoading(true)
    setSuggestion(null)
    try {
      const res = await fetch('/api/dashboard/identity/import-linkedin-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.ok && data.suggestion) {
        setSuggestion(data.suggestion)
      } else {
        toast.error(data.error ?? 'Could not fetch profile')
      }
    } catch (e) {
      toast.error(`Fetch failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!suggestion) return
    onApply(suggestion)
    toast.success('Identity populated from LinkedIn URL')
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            Paste LinkedIn URL
          </DialogTitle>
          <DialogDescription>
            For public profiles. We&apos;ll fetch the page and extract your Identity. If LinkedIn shows a sign-in wall, use Auto-fetch from LinkedIn (Unipile) instead.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="https://linkedin.com/in/your-handle"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleFetch()}
          />
          <Button onClick={handleFetch} disabled={loading || !url.trim()} size="sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Fetch'}
          </Button>
        </div>

        {suggestion && (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 pt-2 border-t border-border">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                About you
              </p>
              <Textarea
                value={suggestion.about_you}
                rows={4}
                className="resize-none"
                onChange={(e) =>
                  setSuggestion({ ...suggestion, about_you: e.target.value })
                }
              />
            </div>

            {suggestion.your_story && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Your story
                </p>
                <Textarea
                  value={suggestion.your_story}
                  rows={4}
                  className="resize-none"
                  onChange={(e) =>
                    setSuggestion({ ...suggestion, your_story: e.target.value })
                  }
                />
              </div>
            )}

            {suggestion.target_audience_suggestions?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Suggested audiences
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.target_audience_suggestions.map((a, i) => (
                    <span
                      key={i}
                      className="inline-block bg-accent text-accent-foreground rounded-full px-3 py-1 text-[12px]"
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {suggestion.offer_suggestions?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Suggested offers
                </p>
                <div className="space-y-1.5">
                  {suggestion.offer_suggestions.map((o, i) => (
                    <div
                      key={i}
                      className="bg-secondary/50 border border-border rounded-md p-2"
                    >
                      <p className="text-[13px] font-semibold text-foreground">{o.name}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {o.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {suggestion && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              <Sparkles size={14} />
              Apply to Identity
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
