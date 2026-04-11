'use client'

import { useEffect, useRef, useState } from 'react'

interface MetricCardProps {
  label: string
  value: number
  delta?: { value: number; positive: boolean }
  prefix?: string
  suffix?: string
}

export function MetricCard({
  label,
  value,
  delta,
  prefix = '',
  suffix = '',
}: MetricCardProps) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const duration = 600
    const steps = 30
    const increment = value / steps
    let current = 0
    const timer = setInterval(() => {
      current = Math.min(current + increment, value)
      setDisplayed(Math.round(current))
      if (current >= value) clearInterval(timer)
    }, duration / steps)
    return () => clearInterval(timer)
  }, [value])

  return (
    <div
      ref={ref}
      className="bg-card border border-border rounded-lg p-4"
    >
      <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="font-sans text-[28px] font-medium text-foreground leading-none">
        {prefix}
        {displayed.toLocaleString()}
        {suffix}
      </p>
      {delta && (
        <p
          className={`font-sans text-[11px] mt-1 ${
            delta.positive ? 'text-emerald-600' : 'text-destructive'
          }`}
        >
          {delta.positive ? '+' : ''}
          {delta.value}% vs last week
        </p>
      )}
    </div>
  )
}
