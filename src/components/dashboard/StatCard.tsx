'use client'

import { Card } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  label: string
  value: string | number
  delta?: number // percentage, +/-
  spark?: { value: number }[]
  hint?: string
}

export function StatCard({ label, value, delta, spark, hint }: Props) {
  const positive = (delta ?? 0) >= 0
  return (
    <Card className="bg-card border border-border rounded-xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col gap-3">
      <p className="text-[12px] font-medium text-muted-foreground tracking-wide">
        {label}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[28px] font-semibold text-foreground tracking-tight tabular-nums leading-none">
          {value}
        </p>
        {spark && spark.length > 1 && (
          <div className="w-[88px] h-[36px] -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  fill={`url(#spark-${label})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12px]">
        {typeof delta === 'number' && (
          <span
            className={`inline-flex items-center gap-0.5 font-medium ${
              positive ? 'text-emerald-600' : 'text-destructive'
            }`}
          >
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  )
}
