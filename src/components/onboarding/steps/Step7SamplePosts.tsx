'use client'

import { useState } from 'react'

interface Step7Props {
  onNext: () => void
  onBack: () => void
}

export function Step7SamplePosts({ onNext, onBack }: Step7Props) {
  const [samples, setSamples] = useState('')
  const [showWhy, setShowWhy] = useState(false)

  const charCount = samples.length
  const canProceed = charCount >= 500

  const handleContinue = async () => {
    try {
      await fetch('/api/onboarding/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'sample_posts', answers: { samples } }),
      })
    } catch {
      // continue anyway
    }
    onNext()
  }

  return (
    <div className="flex-1 flex flex-col p-12">
      <h2 className="text-[28px] font-medium text-foreground mb-2">
        Your Writing
      </h2>
      <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">
        Paste 3–5 of your best LinkedIn posts, emails, articles, or any writing
        that sounds most like you.
      </p>
      <p className="text-muted-foreground text-[13px] mb-6 leading-relaxed">
        No LinkedIn posts yet? Paste 3 emails or messages you have written.
        Nivi analyses your rhythm, not your content.
      </p>

      <textarea
        value={samples}
        onChange={(e) => setSamples(e.target.value)}
        placeholder="Paste your writing samples here. Separate each sample with a blank line..."
        rows={14}
        className="w-full flex-1 bg-secondary border border-border rounded-md px-4 py-3 text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors resize-none font-sans leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3 mb-4">
        <p
          className={`font-sans text-[11px] ${
            canProceed ? 'text-emerald-600' : 'text-muted-foreground'
          }`}
        >
          {charCount.toLocaleString()} characters
          {!canProceed && ` — need ${(500 - charCount).toLocaleString()} more`}
        </p>
        <p className="font-sans text-[11px] text-muted-foreground">
          Minimum: 3 samples
        </p>
      </div>

      <button
        onClick={() => setShowWhy(!showWhy)}
        className="text-left font-sans text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors mb-6"
      >
        {showWhy ? '▾' : '▸'} Why we need this
      </button>
      {showWhy && (
        <p className="text-muted-foreground text-[12px] leading-relaxed mb-6 pl-3 border-l border-border">
          Nivi studies how you form sentences, what words you reach for, how you
          open and close. This is how your posts will sound like you and not like
          everyone else.
        </p>
      )}

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onBack}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canProceed}
          className="bg-white text-black px-6 py-2.5 rounded-md font-medium text-[14px] disabled:opacity-30 hover:bg-white/90 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
