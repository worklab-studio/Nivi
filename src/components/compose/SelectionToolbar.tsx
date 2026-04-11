'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  ArrowDownFromLine,
  ArrowUpFromLine,
  Zap,
  Pencil,
  Loader2,
  X,
} from 'lucide-react'

export type EditAction = 'rewrite' | 'shorter' | 'expand' | 'punchier' | 'custom'

interface Props {
  top: number
  left: number
  visible: boolean
  loading: boolean
  onAction: (action: EditAction, customPrompt?: string) => void
}

const ACTIONS: {
  action: EditAction
  Icon: typeof Sparkles
  label: string
  color: string
}[] = [
  { action: 'rewrite', Icon: Sparkles, label: 'Rewrite', color: 'text-primary' },
  { action: 'shorter', Icon: ArrowDownFromLine, label: 'Shorter', color: 'text-amber-600' },
  { action: 'expand', Icon: ArrowUpFromLine, label: 'Expand', color: 'text-emerald-600' },
  { action: 'punchier', Icon: Zap, label: 'Punchier', color: 'text-violet-600' },
]

export function SelectionToolbar({
  top,
  left,
  visible,
  loading,
  onAction,
}: Props) {
  const [showCustom, setShowCustom] = useState(false)
  const [customText, setCustomText] = useState('')
  const [show, setShow] = useState(false)

  // Smooth entrance — delay to prevent flicker during quick selections
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setShow(true), 80)
      return () => clearTimeout(t)
    }
    setShow(false)
    setShowCustom(false)
    setCustomText('')
  }, [visible])

  if (!show && !loading) return null

  function handleCustomSubmit() {
    if (!customText.trim()) return
    onAction('custom', customText.trim())
    setCustomText('')
    setShowCustom(false)
  }

  return (
    <div
      className="absolute z-50 transition-all duration-200 ease-out"
      // Prevent mousedown from blurring the textarea (which clears selection)
      onMouseDown={(e) => e.preventDefault()}
      style={{
        top: top - 52,
        left: Math.max(8, left - 140),
        opacity: show || loading ? 1 : 0,
        transform: show || loading ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      {loading ? (
        <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-2.5 flex items-center gap-2.5 backdrop-blur-sm">
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <Loader2 size={16} className="animate-spin text-primary relative" />
          </div>
          <span className="text-[12px] text-foreground font-medium">
            Editing section…
          </span>
        </div>
      ) : showCustom ? (
        <div className="bg-card border border-border rounded-xl shadow-xl p-2 flex items-center gap-1.5 min-w-[320px] backdrop-blur-sm">
          <Pencil size={13} className="text-muted-foreground shrink-0 ml-1" />
          <input
            autoFocus
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomSubmit()
              if (e.key === 'Escape') {
                setShowCustom(false)
                setCustomText('')
              }
            }}
            placeholder="e.g. add a number, make it a question…"
            className="text-[12px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground flex-1 py-1"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customText.trim()}
            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40 transition-opacity"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setShowCustom(false)
              setCustomText('')
            }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-xl flex items-center overflow-hidden backdrop-blur-sm">
          {ACTIONS.map(({ action, Icon, label, color }) => (
            <button
              key={action}
              onClick={() => onAction(action)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-150 border-r border-border last:border-r-0 group"
            >
              <Icon
                size={13}
                className={`transition-colors group-hover:${color}`}
              />
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] text-primary font-medium hover:bg-primary/5 transition-all duration-150"
          >
            <Pencil size={13} />
            Custom
          </button>
        </div>
      )}
    </div>
  )
}
