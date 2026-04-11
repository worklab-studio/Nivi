'use client'

import { motion } from 'framer-motion'

export function Step0Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex-1 flex flex-col justify-center p-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="text-[32px] font-medium text-foreground mb-4 leading-tight">
          Let&rsquo;s build your
          <br />
          personal brand engine.
        </h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed mb-8 max-w-md">
          In the next few minutes, Nivi will learn who you are, how you write,
          and what you want to be known for. Then every morning, you&rsquo;ll
          get a post draft on WhatsApp that sounds exactly like you.
        </p>

        <div className="space-y-4 mb-12">
          {[
            { step: '01', label: 'Connect LinkedIn & WhatsApp', time: '2 min' },
            { step: '02', label: 'Answer questions about you', time: '5 min' },
            { step: '03', label: 'Paste a few writing samples', time: '2 min' },
            { step: '04', label: 'Review your AI profile', time: '1 min' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-4">
              <span className="font-sans text-[11px] text-muted-foreground w-6">
                {item.step}
              </span>
              <span className="text-foreground text-[14px] flex-1">
                {item.label}
              </span>
              <span className="font-sans text-[11px] text-muted-foreground">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="mt-auto flex justify-end">
        <button
          onClick={onNext}
          className="bg-white text-black px-6 py-2.5 rounded-md font-medium text-[14px] hover:bg-white/90 transition-colors"
        >
          Let&rsquo;s go →
        </button>
      </div>
    </div>
  )
}
