'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  IndentIncrease,
  Eraser,
  Smile,
  Smartphone,
  Tablet,
  Monitor,
} from 'lucide-react'

export type Viewport = 'mobile' | 'tablet' | 'desktop'

interface ComposeToolbarProps {
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  hookOnly: boolean
  onHookOnlyToggle: () => void
  onFormat?: (action: 'bold' | 'italic' | 'strike' | 'bullet' | 'numbered' | 'indent' | 'clear') => void
  onInsert?: (char: string) => void
  className?: string
}

const SYMBOL_SECTIONS = [
  {
    label: 'Popular',
    items: ['🔥', '💡', '🚀', '✅', '❌', '⭐', '💪', '🎯', '📌', '🏆', '💰', '📈', '🤝', '⚡', '❤️', '👇', '👆', '👉', '👈', '🙌', '💬', '📢', '🧠', '🎉'],
  },
  {
    label: 'Arrows & Pointers',
    items: ['→', '←', '↑', '↓', '↗', '↘', '⟶', '⟵', '▶', '◀', '▲', '▼', '➡️', '⬅️', '⬆️', '⬇️', '↩', '↪'],
  },
  {
    label: 'Bullets & Marks',
    items: ['•', '◦', '▪', '▫', '■', '□', '●', '○', '◆', '◇', '★', '☆', '✓', '✗', '✔', '✘', '‣', '⁃'],
  },
  {
    label: 'Separators & Lines',
    items: ['—', '–', '―', '│', '┃', '║', '·', '∙', '⋅', '…', '⟡', '◈', '⬥', '⬦', '∎', '▬'],
  },
  {
    label: 'Numbers & Letters',
    items: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', 'Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', '⓵', '⓶', '⓷', '⓸', '⓹'],
  },
  {
    label: 'Business',
    items: ['📊', '📋', '📝', '💼', '🏢', '📱', '💻', '🔑', '🔒', '📧', '🗓️', '⏰', '🎓', '📚', '🛠️', '⚙️', '🔍', '📣'],
  },
]

export function ComposeToolbar({
  viewport,
  onViewportChange,
  hookOnly,
  onHookOnlyToggle,
  onFormat,
  onInsert,
  className,
}: ComposeToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  const formatBtns = [
    { id: 'bold' as const, icon: Bold, label: 'Bold' },
    { id: 'italic' as const, icon: Italic, label: 'Italic' },
    { id: 'strike' as const, icon: Strikethrough, label: 'Strike' },
    { id: 'bullet' as const, icon: List, label: 'Bullets' },
    { id: 'numbered' as const, icon: ListOrdered, label: 'Numbered' },
    { id: 'indent' as const, icon: IndentIncrease, label: 'Indent' },
    { id: 'clear' as const, icon: Eraser, label: 'Clear' },
  ]

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-card ${className ?? ''}`}
    >
      {/* Format buttons */}
      <div className="flex items-center gap-0.5">
        {formatBtns.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat?.(id)}
            className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Icon size={15} />
          </button>
        ))}

        {/* Emoji & Symbols picker */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            title="Emoji & Symbols"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPickerOpen((v) => !v)}
            className={`size-8 inline-flex items-center justify-center rounded-md transition-colors ml-1 ${
              pickerOpen
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Smile size={15} />
          </button>

          {pickerOpen && (
            <div
              className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl w-[320px] max-h-[360px] overflow-y-auto"
              onMouseDown={(e) => e.preventDefault()}
            >
              {SYMBOL_SECTIONS.map((section) => (
                <div key={section.label} className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    {section.label}
                  </p>
                  <div className="flex flex-wrap gap-0.5">
                    {section.items.map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => {
                          onInsert?.(char)
                        }}
                        className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-[16px]"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Viewport tabs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-secondary rounded-md p-0.5">
          {(
            [
              { id: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
              { id: 'tablet' as const, icon: Tablet, label: 'Tablet' },
              { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => onViewportChange(id)}
              className={`size-7 inline-flex items-center justify-center rounded transition-colors ${
                viewport === id
                  ? 'bg-card text-foreground'
                  : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onHookOnlyToggle}
          className={`text-[12px] font-sans px-2.5 py-1 rounded-md transition-colors ${
            hookOnly
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Hook Only
        </button>
      </div>
    </div>
  )
}
