'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

export function LinkedInImportDialog({ open, onOpenChange, onApply }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)

  useEffect(() => {
    if (!open) return
    setSuggestion(null)
    setLoading(true)
    fetch('/api/dashboard/identity/import-linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.suggestion) {
          setSuggestion(data.suggestion)
        } else {
          toast.error(data.error ?? 'LinkedIn fetch failed')
          onOpenChange(false)
        }
      })
      .catch(() => {
        toast.error('LinkedIn fetch failed')
        onOpenChange(false)
      })
      .finally(() => setLoading(false))
  }, [open, onOpenChange])

  function handleApply() {
    if (!suggestion) return
    onApply(suggestion)
    onOpenChange(false)
    toast.success('Identity populated from LinkedIn')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Auto-fetch from LinkedIn
          </DialogTitle>
          <DialogDescription>
            Review the extracted Identity below. Edit anything before applying.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span className="ml-2 text-[13px] text-muted-foreground">
              Reading your LinkedIn profile…
            </span>
          </div>
        )}

        {suggestion && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
                      <p className="text-[13px] font-semibold text-foreground">
                        {o.name}
                      </p>
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
              Apply to Identity
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
