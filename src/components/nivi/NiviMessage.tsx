'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface NiviMessageProps {
  message: string
  timestamp?: string
  actions?: { label: string; onClick: () => void }[]
  animate?: boolean
}

export function NiviMessage({
  message,
  timestamp,
  actions,
  animate = true,
}: NiviMessageProps) {
  const [displayed, setDisplayed] = useState(animate ? '' : message)

  useEffect(() => {
    if (!animate) return
    let i = 0
    const interval = setInterval(() => {
      setDisplayed(message.slice(0, i))
      i++
      if (i > message.length) clearInterval(interval)
    }, 18)
    return () => clearInterval(interval)
  }, [message, animate])

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="nivi-message"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-sans text-[10px] text-muted-foreground">nivi</span>
        <span className="text-muted-foreground">&mdash;</span>
        {timestamp && (
          <span className="font-sans text-[10px] text-muted-foreground">
            {timestamp}
          </span>
        )}
      </div>

      <p className="font-sans text-[13px] text-muted-foreground leading-[1.8]">
        {displayed}
        {animate && displayed.length < message.length && (
          <span className="inline-block w-[2px] h-[13px] bg-white/40 ml-[1px] animate-pulse" />
        )}
      </p>

      {actions && actions.length > 0 && (
        <div className="flex gap-2 mt-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="font-sans text-[10px] px-2 py-1 border border-border text-muted-foreground hover:text-foreground hover:border-border transition-colors rounded-sm"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
