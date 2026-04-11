'use client'

import { useState } from 'react'
import { Copy, Loader2, Check } from 'lucide-react'
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

const PROMPTS = {
  chatgpt: `Print everything you remember about me from our previous conversations. Include facts about my work, projects, preferences, routines, location, family, skills, beliefs, and anything else relevant to my personal brand. Format as a plain bulleted list. Be exhaustive.`,
  claude: `List every fact you remember about me from our prior chats — work, projects, preferences, routines, location, family, skills, beliefs, anything that defines me. Plain bulleted list. Be exhaustive.`,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function MemoryImportDialog({ open, onOpenChange, onImported }: Props) {
  const [provider, setProvider] = useState<'chatgpt' | 'claude'>('chatgpt')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyPrompt() {
    navigator.clipboard.writeText(PROMPTS[provider])
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleImport() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/identity/import-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.ok) {
        const c = data.counts ?? {}
        const parts: string[] = []
        if (c.facts) parts.push(`${c.facts} facts`)
        if (c.offers) parts.push(`${c.offers} offers`)
        if (c.audiences) parts.push(`${c.audiences} audiences`)
        if (c.about_filled) parts.push('About')
        if (c.story_filled) parts.push('Story')
        toast.success(
          parts.length ? `Imported ${parts.join(', ')}` : 'Imported memories'
        )
        setText('')
        onImported()
        onOpenChange(false)
      } else {
        toast.error(data.error ?? 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import memories</DialogTitle>
          <DialogDescription>
            Run this prompt in ChatGPT or Claude, then paste the result here. Nivi extracts the facts and adds them to your Personal information.
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="grid grid-cols-2 gap-1 bg-secondary rounded-md p-0.5 mb-3">
            {(['chatgpt', 'claude'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`text-[12px] py-1.5 rounded transition-colors ${
                  provider === p
                    ? 'bg-card text-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'chatgpt' ? 'ChatGPT' : 'Claude'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="bg-secondary/50 border border-border rounded-md p-3 relative">
              <p className="text-[12px] text-muted-foreground leading-relaxed pr-8">
                {PROMPTS[provider]}
              </p>
              <button
                onClick={copyPrompt}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
                title="Copy prompt"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            <Textarea
              placeholder="Paste the response from ChatGPT/Claude here…"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="resize-none"
            />

            <div className="flex justify-end">
              <Button size="sm" onClick={handleImport} disabled={loading || !text.trim()}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                Import facts
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
