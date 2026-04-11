'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface Audience {
  label: string
  description?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (audience: Audience | Audience[]) => void
}

export function AddAudienceDialog({ open, onOpenChange, onAdd }: Props) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Audience[]>([])
  const [loading, setLoading] = useState(false)

  function reset() {
    setText('')
    setSuggestions([])
  }

  async function handleSuggest() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/identity/suggest-audiences', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok && data.suggestions) {
        setSuggestions(data.suggestions)
      } else {
        toast.error('No suggestions yet — fill About + Offers first')
      }
    } catch {
      toast.error('Suggestion failed')
    } finally {
      setLoading(false)
    }
  }

  function handleAddManual() {
    if (!text.trim()) return
    onAdd({ label: text.trim() })
    reset()
    onOpenChange(false)
  }

  function handleAddSuggestion(s: Audience) {
    onAdd(s)
    setSuggestions((prev) => prev.filter((p) => p.label !== s.label))
  }

  function handleAddAll() {
    if (suggestions.length === 0) return
    onAdd(suggestions)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add target audience</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="e.g. SaaS founders running 5–50 person teams who feel buried in tools"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="resize-none"
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSuggest}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Suggest from Identity
            </Button>
            <Button size="sm" onClick={handleAddManual} disabled={!text.trim()}>
              <Plus size={14} />
              Add
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Suggestions
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleAddSuggestion(s)}
                  className="w-full text-left bg-secondary/50 border border-border rounded-md p-3 hover:border-primary/40 transition-colors"
                >
                  <p className="text-[13px] font-semibold text-foreground">{s.label}</p>
                  {s.description && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {s.description}
                    </p>
                  )}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddAll}
                className="w-full"
              >
                Add all
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
