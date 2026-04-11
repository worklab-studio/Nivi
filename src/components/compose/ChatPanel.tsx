'use client'

import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import {
  Send,
  Sparkles,
  Plus,
  SlidersHorizontal,
  Users,
  BookOpen,
  Globe,
  Paperclip,
  Brain,
  Layers,
  UserCircle,
  LayoutTemplate,
  X,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  why?: string | null
}

export interface ComposeContext {
  audience?: string
  template?: string
  templateName?: string
  webSearch?: boolean
  knowledgeSnippet?: string
  inspirationPost?: string
  identityContext?: boolean
}

interface ChatPanelProps {
  messages: ChatMessage[]
  thinking: boolean
  onSend: (text: string, context?: ComposeContext) => void
  className?: string
}

export function ChatPanel({
  messages,
  thinking,
  onSend,
  className,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Context state
  const [context, setContext] = useState<ComposeContext>({ webSearch: false, identityContext: true })
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)

  // Data for submenus
  const [audiences, setAudiences] = useState<{ label: string }[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [inspirations, setInspirations] = useState<{ id: string; content: string; author_name: string }[]>([])
  const [knowledgeSources, setKnowledgeSources] = useState<{ id: string; title: string }[]>([])

  const contextMenuRef = useRef<HTMLDivElement>(null)
  const settingsMenuRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false)
        setActiveSubmenu(null)
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false)
        setActiveSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch data when menus open
  useEffect(() => {
    if (showSettingsMenu && audiences.length === 0) {
      fetch('/api/dashboard/identity')
        .then((r) => r.json())
        .then((d) => {
          const auds = d.identity?.target_audiences ?? []
          setAudiences(auds.map((a: { label: string } | string) => ({ label: typeof a === 'string' ? a : a.label })))
        })
        .catch(() => {})
    }
    if (showSettingsMenu && templates.length === 0) {
      fetch('/api/dashboard/writing-style/templates')
        .then((r) => r.json())
        .then((d) => setTemplates((d.templates ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))))
        .catch(() => {})
    }
  }, [showSettingsMenu, audiences.length, templates.length])

  useEffect(() => {
    if (showContextMenu && inspirations.length === 0) {
      fetch('/api/dashboard/inspiration?limit=20')
        .then((r) => r.json())
        .then((d) => setInspirations((d.posts ?? []).slice(0, 15).map((p: { id: string; content: string; author_name: string }) => ({ id: p.id, content: p.content, author_name: p.author_name }))))
        .catch(() => {})
    }
    if (showContextMenu && knowledgeSources.length === 0) {
      fetch('/api/dashboard/knowledge')
        .then((r) => r.json())
        .then((d) => setKnowledgeSources((d.sources ?? []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }))))
        .catch(() => {})
    }
  }, [showContextMenu, inspirations.length, knowledgeSources.length])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  function submit() {
    const text = input.trim()
    if (!text || thinking) return
    onSend(text, context)
    setInput('')
    inputRef.current?.focus()
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // Active context pills
  const activePills: { label: string; key: string }[] = []
  if (context.audience) activePills.push({ label: `🎯 ${context.audience}`, key: 'audience' })
  if (context.templateName) activePills.push({ label: `✍️ ${context.templateName}`, key: 'template' })
  if (context.webSearch) activePills.push({ label: '🌐 Web search', key: 'webSearch' })
  if (context.identityContext) activePills.push({ label: '🧠 Identity', key: 'identity' })
  if (context.inspirationPost) activePills.push({ label: '💡 Inspiration', key: 'inspiration' })
  if (context.knowledgeSnippet) activePills.push({ label: '📚 Knowledge', key: 'knowledge' })

  function removePill(key: string) {
    setContext((prev) => {
      const next = { ...prev }
      if (key === 'audience') { next.audience = undefined }
      if (key === 'template') { next.template = undefined; next.templateName = undefined }
      if (key === 'webSearch') { next.webSearch = false }
      if (key === 'identity') { next.identityContext = false }
      if (key === 'inspiration') { next.inspirationPost = undefined }
      if (key === 'knowledge') { next.knowledgeSnippet = undefined }
      return next
    })
  }

  return (
    <div
      className={`flex flex-col h-full bg-card border border-border rounded-xl ${className ?? ''}`}
    >
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4"
      >
        {messages.length === 0 && !thinking && (
          <div className="text-center mt-8">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-accent mb-3">
              <Sparkles className="size-5 text-foreground" />
            </div>
            <p className="font-sans text-lg text-foreground">
              What should we write today?
            </p>
            <p className="font-sans text-xs text-muted-foreground mt-1">
              Drop an idea, a story, or just a topic — Nivi takes it from there.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={
                m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              }
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-accent text-foreground rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.why && (
                  <p className="mt-1.5 pt-1.5 border-t border-border text-[11px] text-muted-foreground italic">
                    why: {m.why}
                  </p>
                )}
              </div>
            </motion.div>
          ))}

          {thinking && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-accent rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Active context pills */}
        {activePills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activePills.map((pill) => (
              <span
                key={pill.key}
                className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-accent text-foreground border border-border"
              >
                {pill.label}
                <button
                  type="button"
                  onClick={() => removePill(pill.key)}
                  className="hover:text-destructive transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Textarea + send */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tell Nivi what you want to post about..."
            rows={1}
            className="flex-1 resize-none bg-secondary border border-border rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border max-h-32"
            style={{ minHeight: 38 }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || thinking}
            className="size-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Bottom toolbar: context + settings buttons */}
        <div className="flex items-center gap-1">
          {/* Context menu (+ button): Upload, Knowledge, Inspiration, Identity, Templates */}
          <div className="relative" ref={contextMenuRef}>
            <button
              type="button"
              onClick={() => { setShowContextMenu((v) => !v); setShowSettingsMenu(false); setActiveSubmenu(null) }}
              className={`size-7 flex items-center justify-center rounded-md transition-colors ${
                showContextMenu ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="Add context"
            >
              <Plus size={15} />
            </button>

            {showContextMenu && (
              <div className="absolute bottom-full left-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-xl w-[220px] overflow-hidden">
                {/* Knowledge base */}
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(activeSubmenu === 'knowledge' ? null : 'knowledge')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Brain size={15} className="text-muted-foreground" />
                    Knowledge base
                  </span>
                  <span className="text-muted-foreground text-[10px]">›</span>
                </button>

                {activeSubmenu === 'knowledge' && (
                  <div className="border-t border-border max-h-[200px] overflow-y-auto">
                    {knowledgeSources.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-muted-foreground">No sources yet</p>
                    ) : knowledgeSources.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setContext((p) => ({ ...p, knowledgeSnippet: s.id }))
                          setShowContextMenu(false)
                          setActiveSubmenu(null)
                        }}
                        className="w-full text-left px-4 py-2 text-[12px] text-foreground hover:bg-accent transition-colors truncate"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}

                {/* Inspiration */}
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(activeSubmenu === 'inspiration' ? null : 'inspiration')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Layers size={15} className="text-muted-foreground" />
                    Inspiration
                  </span>
                  <span className="text-muted-foreground text-[10px]">›</span>
                </button>

                {activeSubmenu === 'inspiration' && (
                  <div className="border-t border-border max-h-[200px] overflow-y-auto">
                    {inspirations.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-muted-foreground">No posts saved</p>
                    ) : inspirations.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setContext((prev) => ({ ...prev, inspirationPost: p.id }))
                          setShowContextMenu(false)
                          setActiveSubmenu(null)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-accent transition-colors"
                      >
                        <p className="text-[11px] text-foreground line-clamp-2">{p.content.slice(0, 80)}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{p.author_name}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Identity */}
                <button
                  type="button"
                  onClick={() => {
                    setContext((p) => ({ ...p, identityContext: !p.identityContext }))
                    setShowContextMenu(false)
                    setActiveSubmenu(null)
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <UserCircle size={15} className="text-muted-foreground" />
                    Identity
                  </span>
                  {context.identityContext && <Check size={14} className="text-primary" />}
                </button>

                {/* Templates */}
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(activeSubmenu === 'templates' ? null : 'templates')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <LayoutTemplate size={15} className="text-muted-foreground" />
                    My templates
                  </span>
                  <span className="text-muted-foreground text-[10px]">›</span>
                </button>

                {activeSubmenu === 'templates' && (
                  <div className="border-t border-border max-h-[200px] overflow-y-auto">
                    {templates.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-muted-foreground">No templates yet</p>
                    ) : templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setContext((p) => ({ ...p, template: t.id, templateName: t.name }))
                          setShowContextMenu(false)
                          setActiveSubmenu(null)
                        }}
                        className={`w-full text-left px-4 py-2 text-[12px] hover:bg-accent transition-colors ${
                          context.template === t.id ? 'text-primary font-medium' : 'text-foreground'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings menu (sliders button): Target audience, Writing style, Web search */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => { setShowSettingsMenu((v) => !v); setShowContextMenu(false); setActiveSubmenu(null) }}
              className={`size-7 flex items-center justify-center rounded-md transition-colors ${
                showSettingsMenu ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="Generation settings"
            >
              <SlidersHorizontal size={15} />
            </button>

            {showSettingsMenu && (
              <div className="absolute bottom-full left-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-xl w-[220px] overflow-hidden">
                {/* Target audience */}
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(activeSubmenu === 'audience' ? null : 'audience')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Users size={15} className="text-muted-foreground" />
                    Target audience
                  </span>
                  <span className="text-muted-foreground text-[10px]">›</span>
                </button>

                {activeSubmenu === 'audience' && (
                  <div className="border-t border-border max-h-[200px] overflow-y-auto">
                    {audiences.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-muted-foreground">No audiences set — add them in Identity</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setContext((p) => ({ ...p, audience: undefined }))
                            setActiveSubmenu(null)
                          }}
                          className={`w-full text-left px-4 py-2 text-[12px] hover:bg-accent transition-colors ${
                            !context.audience ? 'text-primary font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          All audiences
                        </button>
                        {audiences.map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            onClick={() => {
                              setContext((p) => ({ ...p, audience: a.label }))
                              setShowSettingsMenu(false)
                              setActiveSubmenu(null)
                            }}
                            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-accent transition-colors ${
                              context.audience === a.label ? 'text-primary font-medium' : 'text-foreground'
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Writing style */}
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(activeSubmenu === 'style' ? null : 'style')}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <BookOpen size={15} className="text-muted-foreground" />
                    Writing style
                  </span>
                  <span className="text-muted-foreground text-[10px]">›</span>
                </button>

                {activeSubmenu === 'style' && (
                  <div className="border-t border-border max-h-[200px] overflow-y-auto">
                    {templates.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-muted-foreground">No templates yet</p>
                    ) : templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setContext((p) => ({ ...p, template: t.id, templateName: t.name }))
                          setShowSettingsMenu(false)
                          setActiveSubmenu(null)
                        }}
                        className={`w-full text-left px-4 py-2 text-[12px] hover:bg-accent transition-colors ${
                          context.template === t.id ? 'text-primary font-medium' : 'text-foreground'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Web search toggle */}
                <button
                  type="button"
                  onClick={() => setContext((p) => ({ ...p, webSearch: !p.webSearch }))}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] text-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Globe size={15} className="text-muted-foreground" />
                    Web search
                  </span>
                  <div
                    className={`w-8 h-[18px] rounded-full flex items-center transition-colors ${
                      context.webSearch ? 'bg-primary justify-end' : 'bg-secondary border border-border justify-start'
                    }`}
                  >
                    <div className={`size-3.5 rounded-full mx-0.5 transition-colors ${
                      context.webSearch ? 'bg-primary-foreground' : 'bg-muted-foreground'
                    }`} />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
