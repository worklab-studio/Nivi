'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Calendar, Send, Save, Loader2, Undo2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { ChatPanel, type ChatMessage, type ComposeContext } from '@/components/compose/ChatPanel'
import {
  ComposeToolbar,
  type Viewport,
} from '@/components/compose/ComposeToolbar'
import {
  LinkedInPostPreview,
  type LinkedInAuthor,
  type TextSelection,
} from '@/components/preview/LinkedInPostPreview'
import {
  SelectionToolbar,
  type EditAction,
} from '@/components/compose/SelectionToolbar'
import {
  countChars,
  toLinkedInBold,
  toLinkedInItalic,
} from '@/components/compose/utils'

export default function ComposePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-muted-foreground">Loading…</div>
      }
    >
      <ComposeInner />
    </Suspense>
  )
}

function ComposeInner() {
  const params = useSearchParams()
  const router = useRouter()
  const initialDraftId = params.get('draft')
  const remixId = params.get('remix')

  const [postId, setPostId] = useState<string | null>(initialDraftId)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [author, setAuthor] = useState<LinkedInAuthor>({
    name: 'You',
    headline: '',
    avatarUrl: '',
  })
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [hookOnly, setHookOnly] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [editingRange, setEditingRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const [draftHistory, setDraftHistory] = useState<string[]>([])

  /** Push current draft onto the undo stack (max 20). Call BEFORE setDraft. */
  function pushHistory(current: string) {
    if (!current) return
    setDraftHistory((prev) => [...prev.slice(-19), current])
  }

  function handleUndo() {
    setDraftHistory((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = next.pop()!
      setDraft(last)
      return next
    })
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleFormat(
    action: 'bold' | 'italic' | 'strike' | 'bullet' | 'numbered' | 'indent' | 'clear'
  ) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) return // No selection — do nothing
    const before = draft.slice(0, start)
    const selected = draft.slice(start, end)
    const after = draft.slice(end)

    let newText = ''
    let cursorOffset = 0

    switch (action) {
      case 'bold':
        newText = before + toLinkedInBold(selected) + after
        cursorOffset = start + toLinkedInBold(selected).length
        break
      case 'italic':
        newText = before + toLinkedInItalic(selected) + after
        cursorOffset = start + toLinkedInItalic(selected).length
        break
      case 'strike': {
        const struck = [...selected]
          .map((c) => `${c}\u0336`)
          .join('')
        newText = before + struck + after
        cursorOffset = start + struck.length
        break
      }
      case 'bullet': {
        const lines = selected.split('\n')
        const bulleted = lines.map((l) => `• ${l.replace(/^[•\-]\s*/, '')}`).join('\n')
        newText = before + bulleted + after
        cursorOffset = start + bulleted.length
        break
      }
      case 'numbered': {
        const lines = selected.split('\n')
        const numbered = lines.map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '')}`).join('\n')
        newText = before + numbered + after
        cursorOffset = start + numbered.length
        break
      }
      case 'indent': {
        const lines = selected.split('\n')
        const indented = lines.map((l) => `  ${l}`).join('\n')
        newText = before + indented + after
        cursorOffset = start + indented.length
        break
      }
      case 'clear': {
        const cleaned = stripUnicodeFormatting(selected)
        newText = before + cleaned + after
        cursorOffset = start + cleaned.length
        break
      }
      default:
        return
    }

    setDraft(newText)
    // Keep the formatted text selected after React re-render
    const newSelStart = start
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newSelStart, cursorOffset)
    })
  }

  function handleInsert(char: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = draft.slice(0, start)
    const after = draft.slice(end)
    const newText = before + char + after
    const cursorPos = start + char.length
    setDraft(newText)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursorPos, cursorPos)
    })
  }

  // Fetch the LinkedIn author profile once on mount
  useEffect(() => {
    fetch('/api/dashboard/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setAuthor(d.profile)
      })
      .catch(() => {})
  }, [])

  // If `?draft=<id>` was passed, load the existing post content (any status)
  useEffect(() => {
    if (!initialDraftId) return
    fetch(`/api/dashboard/posts/${initialDraftId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.post) {
          setDraft(d.post.content ?? '')
          setPostId(d.post.id)
        }
      })
      .catch(() => {
        // Fallback: try legacy drafts endpoint
        fetch('/api/dashboard/drafts')
          .then((r) => r.json())
          .then((dd) => {
            const found = (dd.drafts ?? []).find(
              (x: { id: string }) => x.id === initialDraftId
            )
            if (found) {
              setDraft(found.content ?? '')
              setPostId(found.id)
            }
          })
          .catch(() => {})
      })
  }, [initialDraftId])

  // If `?remix=<id>` was passed, load the inspiration post and auto-send
  // a remix request to Nivi so she generates a voice-matched version.
  useEffect(() => {
    if (!remixId) return
    fetch(`/api/dashboard/inspiration`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.posts ?? []).find(
          (p: { id: string }) => p.id === remixId
        )
        if (found && found.content) {
          // Auto-send the remix prompt as the first message
          const remixPrompt = `I found this post I like. Rewrite it in my voice — keep the structure and hook pattern but use my own examples, stories, and perspective:\n\n"${found.content}"`
          // Use a timeout so the component is fully mounted before sending
          setTimeout(() => sendChat(remixPrompt), 500)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remixId])

  async function sendChat(text: string, ctx?: ComposeContext) {
    setThinking(true)
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    try {
      const res = await fetch('/api/dashboard/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          messages: messages, // history before this turn
          currentDraft: draft,
          userMessage: text,
          // Context from the chat panel menus
          ...(ctx?.audience && { targetAudience: ctx.audience }),
          ...(ctx?.template && { templateId: ctx.template }),
          ...(ctx?.webSearch && { webSearch: true }),
          ...(ctx?.identityContext && { useIdentity: true }),
          ...(ctx?.inspirationPost && { inspirationId: ctx.inspirationPost }),
          ...(ctx?.knowledgeSnippet && { knowledgeSourceId: ctx.knowledgeSnippet }),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'hmm something glitched on my side. try saying that again?',
          },
        ])
        return
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply ?? '',
        why: data.why ?? null,
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (data.draftChanged && typeof data.updatedDraft === 'string') {
        pushHistory(draft)
        setDraft(data.updatedDraft)
      }
      if (data.postId) {
        setPostId(data.postId)
      }
      if (data.saved) {
        setSavedAt(new Date())
      }
    } catch (err) {
      console.error('[compose] error:', err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'connection hiccup, one sec — try again',
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  async function handleSectionEdit(
    action: EditAction,
    customPrompt?: string
  ) {
    if (!selection || !draft) return

    // Save the selection range before clearing
    const selStart = selection.start
    const selEnd = selection.end
    const selText = selection.text

    setSectionLoading(true)
    setSelection(null)
    // Show skeleton on the selected range
    setEditingRange({ start: selStart, end: selEnd })

    const userMessage =
      action === 'custom' && customPrompt
        ? `Edit this section: "${selText}"\n\nInstruction: ${customPrompt}`
        : `${action} this section: "${selText}"`

    try {
      const res = await fetch('/api/dashboard/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          messages,
          currentDraft: draft,
          userMessage,
          editMode: 'section',
          selectedText: selText,
          editAction: action,
        }),
      })
      const data = await res.json()

      // Clear skeleton
      setEditingRange(null)

      if (data.draftChanged && typeof data.updatedDraft === 'string') {
        pushHistory(draft)
        setDraft(data.updatedDraft)
      }

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'user',
            content:
              action === 'custom' && customPrompt
                ? `✏️ ${customPrompt}`
                : `✨ ${action}: "${selText.slice(0, 40)}${selText.length > 40 ? '…' : ''}"`,
          },
          { role: 'assistant', content: data.reply, why: data.why },
        ])
      }
      if (data.postId) setPostId(data.postId)
      if (data.saved) setSavedAt(new Date())
    } catch {
      setEditingRange(null)
    } finally {
      setSectionLoading(false)
    }
  }

  const [saving, setSaving] = useState(false)

  async function manualSave() {
    if (!draft.trim()) return
    setSaving(true)
    try {
      if (postId) {
        await fetch('/api/posts/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, content: draft }),
        })
      } else {
        // Create a new draft post
        const res = await fetch('/api/dashboard/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: null,
            messages: [],
            currentDraft: '',
            userMessage: `Save this draft exactly as-is: "${draft}"`,
          }),
        })
        const data = await res.json()
        if (data.postId) setPostId(data.postId)
      }
      setSavedAt(new Date())
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const [scheduling, setScheduling] = useState(false)

  async function schedule() {
    if (!postId) return
    setScheduling(true)
    try {
      // Save latest content first
      await fetch('/api/posts/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, content: draft }),
      })
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          scheduledAt: tomorrow.toISOString(),
        }),
      })
      toast.success('Scheduled for tomorrow at 9:00 AM')
      router.push('/calendar')
    } catch {
      toast.error('Failed to schedule')
    } finally {
      setScheduling(false)
    }
  }

  async function publishNow() {
    if (!postId) return
    setPublishing(true)
    try {
      // Save latest content first
      await fetch('/api/posts/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, content: draft }),
      })
      await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      toast.success('Published to LinkedIn!')
      router.push('/posts')
    } catch (err) {
      console.error('[compose] publish failed', err)
      toast.error('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  const charCount = useMemo(() => countChars(draft), [draft])
  const status: 'Draft' | 'Empty' = draft.trim() ? 'Draft' : 'Empty'
  const savedLabel = savedAt
    ? `Saved ${formatRelative(savedAt)}`
    : 'Unsaved'

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background text-foreground">
      {/* Top header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h1 className="font-sans text-[18px] text-foreground leading-none">
            Compose
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1 font-sans">
            {status} · {savedLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={manualSave}
            disabled={!draft.trim() || saving}
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={draftHistory.length === 0}
            title="Undo last AI edit"
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            <Undo2 size={13} />
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              if (!draft.trim()) return
              navigator.clipboard.writeText(draft)
              toast.success('Copied to clipboard')
            }}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            <Copy size={13} />
            Copy
          </button>
          <button
            type="button"
            onClick={schedule}
            disabled={!postId || scheduling}
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            {scheduling ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
            Schedule
          </button>
          <button
            type="button"
            onClick={publishNow}
            disabled={!postId || publishing}
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {publishing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            Publish
          </button>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] overflow-hidden">
        {/* LEFT: chat */}
        <div className="border-r border-border p-4 overflow-hidden">
          <ChatPanel
            messages={messages}
            thinking={thinking}
            onSend={sendChat}
            className="h-full"
          />
        </div>

        {/* RIGHT: toolbar + preview */}
        <div className="flex flex-col overflow-hidden">
          <ComposeToolbar
            viewport={viewport}
            onViewportChange={setViewport}
            hookOnly={hookOnly}
            onHookOnlyToggle={() => setHookOnly((v) => !v)}
            onFormat={handleFormat}
            onInsert={handleInsert}
          />

          <div className="flex-1 overflow-y-auto p-6 bg-background relative">
            <LinkedInPostPreview
              author={author}
              content={draft}
              viewport={viewport}
              hookOnly={hookOnly}
              editable
              onChange={(text) => setDraft(text)}
              onSelectionChange={setSelection}
              editingRange={editingRange}
              textareaRef={textareaRef}
            />
            {/* Floating AI toolbar on text selection */}
            <SelectionToolbar
              visible={!!selection && !sectionLoading}
              loading={sectionLoading}
              top={selection?.rect.top ?? 0}
              left={selection?.rect.left ?? 0}
              onAction={handleSectionEdit}
            />

            {draft && (
              <p className="text-center font-sans text-[10px] text-muted-foreground mt-4">
                {charCount} characters
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Strip LinkedIn unicode bold/italic/strikethrough back to plain ASCII */
function stripUnicodeFormatting(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    // Mathematical Bold A-Z (U+1D400–1D419)
    if (cp >= 0x1d400 && cp <= 0x1d419) {
      out += String.fromCharCode(0x41 + (cp - 0x1d400))
    // Mathematical Bold a-z (U+1D41A–1D433)
    } else if (cp >= 0x1d41a && cp <= 0x1d433) {
      out += String.fromCharCode(0x61 + (cp - 0x1d41a))
    // Mathematical Bold digits 0-9 (U+1D7CE–1D7D7)
    } else if (cp >= 0x1d7ce && cp <= 0x1d7d7) {
      out += String.fromCharCode(0x30 + (cp - 0x1d7ce))
    // Mathematical Italic A-Z (U+1D434–1D44D)
    } else if (cp >= 0x1d434 && cp <= 0x1d44d) {
      out += String.fromCharCode(0x41 + (cp - 0x1d434))
    // Mathematical Italic a-z (U+1D44E–1D467), skip h (U+210E)
    } else if (cp >= 0x1d44e && cp <= 0x1d467) {
      out += String.fromCharCode(0x61 + (cp - 0x1d44e))
    // Planck constant (italic h)
    } else if (cp === 0x210e) {
      out += 'h'
    // Mathematical Bold Italic A-Z (U+1D468–1D481)
    } else if (cp >= 0x1d468 && cp <= 0x1d481) {
      out += String.fromCharCode(0x41 + (cp - 0x1d468))
    // Mathematical Bold Italic a-z (U+1D482–1D49B)
    } else if (cp >= 0x1d482 && cp <= 0x1d49b) {
      out += String.fromCharCode(0x61 + (cp - 0x1d482))
    // Combining long stroke overlay (strikethrough)
    } else if (cp === 0x0336) {
      // skip it
    } else {
      out += ch
    }
  }
  return out
}

function formatRelative(date: Date): string {
  const sec = Math.round((Date.now() - date.getTime()) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  return `${h}h ago`
}
