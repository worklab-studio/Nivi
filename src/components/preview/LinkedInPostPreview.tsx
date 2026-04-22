'use client'

import { useRef, useCallback, useEffect } from 'react'
import { Globe, MoreHorizontal } from 'lucide-react'
import { LinkedInEngagementBar } from './LinkedInEngagementBar'
import { markdownToLinkedInText, truncateToHook } from '@/components/compose/utils'

export interface LinkedInAuthor {
  name: string
  headline: string
  avatarUrl: string
}

export interface TextSelection {
  text: string
  start: number
  end: number
  rect: { top: number; left: number }
}

export interface LinkedInPostPreviewProps {
  author: LinkedInAuthor
  content: string
  postedAt?: string
  viewport?: 'mobile' | 'tablet' | 'desktop'
  hookOnly?: boolean
  editable?: boolean
  onChange?: (content: string) => void
  onSelectionChange?: (selection: TextSelection | null) => void
  /** Character range being edited by AI (shows skeleton) */
  editingRange?: { start: number; end: number } | null
  /** Expose textarea ref to parent for formatting operations */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  className?: string
}

const VIEWPORT_WIDTH: Record<
  NonNullable<LinkedInPostPreviewProps['viewport']>,
  number
> = {
  mobile: 375,
  tablet: 680,
  desktop: 544,
}

// LinkedIn post body font style — shared between textarea and split view
const BODY_STYLE: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.43,
  color: 'inherit',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  margin: 0,
}

function SkeletonLines() {
  return (
    <div className="py-1 space-y-2">
      <div className="skeleton-line h-[14px] w-full" />
      <div className="skeleton-line h-[14px] w-[85%]" />
      <div className="skeleton-line h-[14px] w-[60%]" />
    </div>
  )
}

export function LinkedInPostPreview({
  author,
  content,
  postedAt = 'Just now',
  viewport = 'desktop',
  hookOnly = false,
  editable = false,
  onChange,
  onSelectionChange,
  editingRange,
  textareaRef: externalTextareaRef,
  className,
}: LinkedInPostPreviewProps) {
  const widthPx = VIEWPORT_WIDTH[viewport]
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = externalTextareaRef ?? internalRef
  const containerRef = useRef<HTMLDivElement>(null)
  const rendered = markdownToLinkedInText(content || '')
  const { visible, truncated } = hookOnly
    ? truncateToHook(rendered, viewport)
    : { visible: rendered, truncated: false }

  const initials =
    author.name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  // Auto-resize textarea (also re-run when hookOnly toggles off)
  useEffect(() => {
    if (!textareaRef.current) return
    const el = textareaRef.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content, hookOnly])

  // (highlight fading removed — using justEdited flash instead)

  const handleSelect = useCallback(() => {
    if (!onSelectionChange || !textareaRef.current || !containerRef.current)
      return
    const el = textareaRef.current
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) {
      onSelectionChange(null)
      return
    }
    const text = el.value.slice(start, end)
    if (!text.trim()) {
      onSelectionChange(null)
      return
    }
    const textBefore = el.value.slice(0, start)
    const lines = textBefore.split('\n').length
    const containerRect = containerRef.current.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const lineHeight = 20
    const topOffset = elRect.top - containerRect.top + (lines - 1) * lineHeight

    onSelectionChange({
      text,
      start,
      end,
      rect: {
        top: topOffset,
        left: elRect.left - containerRect.left + elRect.width / 2,
      },
    })
  }, [onSelectionChange])

  // Split view ONLY during skeleton loading
  const showSkeleton = !!editingRange
  const beforeText = editingRange ? content.slice(0, editingRange.start) : ''
  const afterText = editingRange ? content.slice(editingRange.end) : ''

  return (
    <div
      ref={containerRef}
      className={`mx-auto relative ${className ?? ''}`}
      style={{ maxWidth: widthPx, width: '100%' }}
    >
      {/* Inline styles for animations */}
      <style>{`
        .nivi-compose-textarea::selection {
          background: rgba(44, 88, 182, 0.18);
          color: inherit;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-line {
          border-radius: 4px;
          background: linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--accent)) 37%, hsl(var(--muted)) 63%);
          background-size: 200% 100%;
          animation: shimmer 1.8s ease-in-out infinite;
        }
      `}</style>

      <article
        className="rounded-lg overflow-hidden font-sans bg-card text-foreground border border-border"
      >
        {/* Header */}
        <header
          className="flex items-start gap-2"
          style={{ padding: '12px 16px 0 16px' }}
        >
          <div className="shrink-0">
            {author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.avatarUrl}
                alt={author.name}
                width={48}
                height={48}
                className="rounded-full object-cover border border-border"
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-white font-semibold text-sm bg-primary border border-border"
                style={{ width: 48, height: 48 }}
              >
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight text-[14px] text-foreground">
              {author.name || 'Your Name'}
            </div>
            {author.headline && (
              <div className="truncate leading-tight mt-0.5 text-[12px] text-muted-foreground">
                {author.headline}
              </div>
            )}
            <div className="flex items-center gap-1 leading-tight mt-0.5 text-[12px] text-muted-foreground">
              <span>{postedAt}</span>
              <span aria-hidden>•</span>
              <Globe size={12} strokeWidth={2} aria-label="Public" />
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="rounded-full p-1 hover:bg-accent transition-colors"
            aria-label="More"
          >
            <MoreHorizontal
              size={20}
              className="text-muted-foreground"
            />
          </button>
        </header>

        {/* Post body */}
        <div style={{ padding: '8px 16px 12px 16px' }}>
          {hookOnly ? (
            /* Hook-only: read-only truncated preview */
            <p
              className="whitespace-pre-wrap break-words"
              style={BODY_STYLE}
            >
              {visible}
              {truncated && (
                <>
                  {'… '}
                  <span className="cursor-pointer font-semibold text-muted-foreground">
                    see more
                  </span>
                </>
              )}
            </p>
          ) : editable && showSkeleton ? (
            /* Split view: before + skeleton + after (ONLY during loading) */
            <div
              className="whitespace-pre-wrap break-words"
              style={BODY_STYLE}
            >
              <span>{beforeText}</span>
              <SkeletonLines />
              <span>{afterText}</span>
            </div>
          ) : editable ? (
            /* Normal editable textarea */
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onChange?.(e.target.value)}
              onSelect={handleSelect}
              onBlur={() => setTimeout(() => onSelectionChange?.(null), 200)}
              className="nivi-compose-textarea w-full resize-none border-none outline-none bg-transparent"
              style={{
                ...BODY_STYLE,
                padding: 0,
                minHeight: 120,
                caretColor: 'hsl(var(--primary))',
                overflow: 'hidden',
              }}
              placeholder="Start writing your post…"
            />
          ) : (
            /* Read-only view */
            <p
              className="whitespace-pre-wrap break-words"
              style={BODY_STYLE}
            >
              {visible}
              {truncated && (
                <>
                  {'… '}
                  <span className="cursor-pointer font-semibold text-muted-foreground">
                    see more
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Engagement counts — LinkedIn style with proper reaction icons */}
        <div
          className="flex items-center justify-between text-[12px] text-muted-foreground border-b border-border"
          style={{ padding: '8px 16px' }}
        >
          <div className="flex items-center gap-1.5">
            <div className="flex items-center -space-x-1">
              <ReactionIcon type="like" />
              <ReactionIcon type="celebrate" />
              <ReactionIcon type="love" />
            </div>
            <span className="ml-1">Be the first to react</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>0 comments</span>
            <span aria-hidden className="text-border">•</span>
            <span>0 reposts</span>
          </div>
        </div>

        <div style={{ padding: '4px 8px 8px 8px' }}>
          <LinkedInEngagementBar />
        </div>
      </article>
    </div>
  )
}

/**
 * Mini reaction icons matching LinkedIn's actual style.
 * SVG circles with the icon inside — no emojis.
 */
function ReactionIcon({ type }: { type: 'like' | 'celebrate' | 'love' }) {
  const config = {
    like: { bg: '#0A66C2', label: 'Like' },
    celebrate: { bg: '#6DAE4F', label: 'Celebrate' },
    love: { bg: '#DF704D', label: 'Love' },
  }[type]

  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: 16,
        height: 16,
        background: config.bg,
        border: '1.5px solid hsl(var(--card))',
      }}
      aria-label={config.label}
    >
      {type === 'like' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
          <path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 7.59 6.59C7.22 6.95 7 7.45 7 8v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z" />
        </svg>
      )}
      {type === 'celebrate' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.44-11.56l-1.06 2.31L12 12l2.39 1.06 1.06 2.31 1.05-2.31L19 12l-2.5-1.25-1.06-2.31zM7 12l1.5-3.25L12 7.5 8.5 6 7 2.75 5.5 6 2 7.5l3.5 1.25z" />
        </svg>
      )}
      {type === 'love' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      )}
    </div>
  )
}
