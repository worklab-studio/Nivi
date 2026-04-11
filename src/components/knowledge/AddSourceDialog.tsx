'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  FileText,
  MessageSquare,
  StickyNote,
  Video,
  Loader2,
  Sparkles,
  Upload,
  X,
  Link2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import type { KnowledgeChunk } from './SourceCard'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (chunk: KnowledgeChunk) => void
}

interface SourceOption {
  value: string
  label: string
  Icon: LucideIcon
  iconClass: string
  bgClass: string
}

const SOURCE_OPTIONS: SourceOption[] = [
  { value: 'transcript', label: 'Transcript', Icon: Mic, iconClass: 'text-violet-600', bgClass: 'bg-violet-500/10' },
  { value: 'article', label: 'Article', Icon: FileText, iconClass: 'text-blue-600', bgClass: 'bg-blue-500/10' },
  { value: 'post', label: 'Post', Icon: MessageSquare, iconClass: 'text-emerald-600', bgClass: 'bg-emerald-500/10' },
  { value: 'note', label: 'Note', Icon: StickyNote, iconClass: 'text-amber-600', bgClass: 'bg-amber-500/10' },
  { value: 'video', label: 'Video', Icon: Video, iconClass: 'text-pink-600', bgClass: 'bg-pink-500/10' },
]

const ACCEPTED_EXTENSIONS =
  '.txt,.md,.vtt,.srt,.pdf,.docx,.mp3,.m4a,.wav,.mp4,.mov,.webm,.ogg,.flac'

const PROGRESS_STEPS = [
  'Saving source…',
  'Reading your content…',
  'Extracting insights…',
  'Embedding for semantic search…',
  'Almost done…',
]

const EXTRACT_STEPS = [
  'Parsing file…',
  'Reading content…',
  'Transcribing if audio/video…',
  'Cleaning up…',
]

function detectSourceTypeFromFile(filename: string, mime: string): string {
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac)$/i.test(filename))
    return 'transcript'
  if (mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(filename))
    return 'video'
  if (mime === 'application/pdf' || /\.pdf$/i.test(filename)) return 'article'
  if (/\.docx$/i.test(filename)) return 'article'
  if (/\.(vtt|srt)$/i.test(filename)) return 'transcript'
  return 'note'
}

export function AddSourceDialog({ open, onOpenChange, onCreated }: Props) {
  const [sourceType, setSourceType] = useState('note')
  const [sourceTitle, setSourceTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [extractStepIndex, setExtractStepIndex] = useState(0)
  const [attachedFile, setAttachedFile] = useState<{
    name: string
    size: number
    words: number
  } | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!extracting) {
      setExtractStepIndex(0)
      return
    }
    const id = setInterval(() => {
      setExtractStepIndex((i) => (i + 1) % EXTRACT_STEPS.length)
    }, 1500)
    return () => clearInterval(id)
  }, [extracting])

  function reset() {
    setSourceType('note')
    setSourceTitle('')
    setContent('')
    setLoading(false)
    setExtracting(false)
    setStepIndex(0)
    setExtractStepIndex(0)
    setAttachedFile(null)
    setYoutubeUrl('')
    setFetchingUrl(false)
  }

  async function handleFile(file: File) {
    if (!file) return
    setExtracting(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.ok) {
        setContent(data.text)
        if (!sourceTitle.trim()) setSourceTitle(data.suggestedTitle)
        setSourceType(detectSourceTypeFromFile(file.name, file.type))
        setAttachedFile({
          name: file.name,
          size: file.size,
          words: data.words,
        })
        toast.success(`Extracted ${data.words.toLocaleString()} words`)
      } else {
        toast.error(data.error ?? 'Could not read file')
      }
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`)
    } finally {
      setExtracting(false)
    }
  }

  async function handleYoutube() {
    if (!youtubeUrl.trim()) return
    setFetchingUrl(true)
    try {
      const res = await fetch('/api/knowledge/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setContent(data.text)
        if (!sourceTitle.trim()) setSourceTitle(data.suggestedTitle)
        setSourceType(data.sourceType ?? 'video')
        setAttachedFile({
          name: data.suggestedTitle,
          size: 0,
          words: data.words,
        })
        setYoutubeUrl('')
        toast.success(`Fetched transcript (${data.words.toLocaleString()} words)`)
      } else {
        toast.error(data.error ?? 'Could not fetch transcript')
      }
    } catch (e) {
      toast.error(`Fetch failed: ${(e as Error).message}`)
    } finally {
      setFetchingUrl(false)
    }
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length
  const charCount = content.length
  const canSubmit =
    !loading && !extracting && charCount >= 50 && sourceTitle.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          sourceType,
          sourceTitle: sourceTitle.trim(),
        }),
      })
      const data = await res.json()
      if (data.chunk) {
        const insightCount = data.insightCount ?? 0
        toast.success(
          `Added "${sourceTitle.trim()}" — ${insightCount} insight${insightCount === 1 ? '' : 's'} extracted`
        )
        onCreated(data.chunk)
        reset()
        onOpenChange(false)
      } else {
        toast.error(data.error ?? 'Could not add source')
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
      <DialogContent className="sm:max-w-xl max-h-[calc(100vh-80px)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Add a knowledge source
          </DialogTitle>
          <DialogDescription>
            Upload a file, paste a YouTube link, or paste text directly. Nivi will extract the key insights and remember them every time she writes for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-1 pr-1">
          {/* Dropzone */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Upload file
            </p>
            {attachedFile ? (
              <div className="bg-secondary/60 border border-border rounded-lg p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {attachedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {attachedFile.words.toLocaleString()} words extracted
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAttachedFile(null)
                    setContent('')
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleFile(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-5 flex flex-col items-center justify-center gap-1.5 transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 bg-secondary/30'
                } ${extracting ? 'pointer-events-none opacity-70' : ''}`}
              >
                {extracting ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-primary" />
                    <p
                      key={extractStepIndex}
                      className="text-[12px] text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300"
                    >
                      {EXTRACT_STEPS[extractStepIndex]}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload size={18} className="text-muted-foreground" />
                    <p className="text-[13px] text-foreground font-medium">
                      Drop a file or click to browse
                    </p>
                    <p className="text-[11px] text-muted-foreground text-center">
                      .pdf · .docx · .txt · .md · .vtt · .srt · .mp3 · .m4a · .wav · .mp4 · .mov · .webm
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = '' // reset so same file can be re-selected
                  }}
                />
              </div>
            )}
          </div>

          {/* YouTube URL */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Or paste a YouTube URL
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  placeholder="https://youtube.com/watch?v=…"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && !fetchingUrl && handleYoutube()
                  }
                  disabled={fetchingUrl || loading}
                  className="pl-8"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleYoutube}
                disabled={!youtubeUrl.trim() || fetchingUrl || loading}
              >
                {fetchingUrl ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  'Fetch'
                )}
              </Button>
            </div>
          </div>

          {/* Source type chips */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Source type
            </p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((opt) => {
                const active = sourceType === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSourceType(opt.value)}
                    disabled={loading}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-[12px] ${
                      active
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${opt.bgClass}`}
                    >
                      <opt.Icon size={11} className={opt.iconClass} />
                    </div>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Title
            </p>
            <Input
              placeholder="e.g. My interview with XYZ Podcast"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Content
              </p>
              <span
                className={`text-[11px] tabular-nums ${
                  charCount < 50
                    ? 'text-muted-foreground'
                    : 'text-foreground'
                }`}
              >
                {wordCount.toLocaleString()} words{' '}
                {charCount < 50 && charCount > 0 && (
                  <span className="text-muted-foreground">
                    (min {50 - charCount} chars)
                  </span>
                )}
              </span>
            </div>
            <Textarea
              placeholder="Paste content here, or upload a file / YouTube URL above…"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              className="resize-none"
            />
          </div>

          {/* Progress panel */}
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

        <div className="shrink-0 flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || extracting}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {loading ? 'Processing…' : 'Add to Knowledge Base'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
