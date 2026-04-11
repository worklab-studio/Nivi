'use client'

import { useState, useCallback } from 'react'
import { X, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface Offer {
  name: string
  description: string
  url?: string
}

interface Props {
  offer: Offer
  onChange: (next: Offer) => void
  onRemove: () => void
  onCommit: () => void // persists the parent offers list
  onExtracted: (extracted: Offer) => void // single-shot persist after AI extraction
}

function isValidUrl(s: string) {
  if (!s) return false
  try {
    const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`)
    return !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}

export function OfferRow({ offer, onChange, onRemove, onCommit, onExtracted }: Props) {
  const [extracting, setExtracting] = useState(false)

  const runExtract = useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim()
      if (!url || !isValidUrl(url)) return

      setExtracting(true)
      try {
        const res = await fetch('/api/dashboard/identity/extract-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (data.ok && data.offer) {
          const merged: Offer = {
            name: data.offer.name || offer.name,
            description: data.offer.description || offer.description,
            url: data.offer.url || url,
          }
          onExtracted(merged)
          toast.success('Offer extracted from page')
        } else {
          toast.error(data.error ?? 'Could not extract — please fill manually')
        }
      } catch (e) {
        toast.error(`Extraction failed: ${(e as Error).message}`)
      } finally {
        setExtracting(false)
      }
    },
    [offer.name, offer.description, onChange, onCommit]
  )

  function handleUrlBlur(e: React.FocusEvent<HTMLInputElement>) {
    const url = e.currentTarget.value.trim()
    onCommit()
    // Skip if already filled in detail
    if (offer.name && offer.description.length > 60) return
    runExtract(url)
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted || !isValidUrl(pasted)) return
    // Let the input update first, then extract
    setTimeout(() => {
      onChange({ ...offer, url: pasted })
      runExtract(pasted)
    }, 0)
  }

  return (
    <div className="bg-secondary/50 border border-border rounded-lg overflow-hidden">
      {/* Header row with X aligned */}
      <div className="flex items-start gap-2 p-4 pb-2">
        <Input
          placeholder="Offer name"
          value={offer.name}
          onChange={(e) => onChange({ ...offer, name: e.target.value })}
          onBlur={onCommit}
          className="flex-1"
        />
        <button
          onClick={onRemove}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Remove offer"
        >
          <X size={14} />
        </button>
      </div>

      {/* URL */}
      <div className="px-4 space-y-1">
        <div className="relative">
          <Input
            placeholder="Optional URL — paste to auto-extract details"
            value={offer.url ?? ''}
            onChange={(e) => onChange({ ...offer, url: e.target.value })}
            onBlur={handleUrlBlur}
            onPaste={handleUrlPaste}
            className="pr-8"
          />
          {extracting && (
            <Loader2
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-primary"
            />
          )}
          {!extracting &&
            offer.url &&
            isValidUrl(offer.url) &&
            offer.description.length > 60 && (
              <Sparkles
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary"
              />
            )}
        </div>
        {offer.url && isValidUrl(offer.url) && !extracting && (
          <button
            onClick={() => runExtract(offer.url ?? '')}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw size={10} />
            Re-extract from URL
          </button>
        )}
      </div>

      {/* Description */}
      <div className="p-4 pt-2">
        <Textarea
          placeholder="What it does, who it's for, what outcome it delivers"
          rows={4}
          value={offer.description}
          className="resize-none"
          onChange={(e) => onChange({ ...offer, description: e.target.value })}
          onBlur={onCommit}
        />
      </div>
    </div>
  )
}
