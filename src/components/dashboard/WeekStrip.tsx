'use client'

import Link from 'next/link'
import { format, startOfWeek, addDays } from 'date-fns'

interface DayData {
  date: Date
  status: 'published' | 'scheduled' | 'draft' | null
}

interface WeekStripProps {
  days: DayData[]
}

export function WeekStrip({ days }: WeekStripProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = days.length > 0 ? days : Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i),
    status: null as 'published' | 'scheduled' | 'draft' | null,
  }))

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <Link href="/calendar" className="block">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dateStr = format(day.date, 'yyyy-MM-dd')
          const isToday = dateStr === today
          return (
            <div
              key={dateStr}
              className={`bg-card border rounded-lg p-3 text-center transition-colors hover:border-border ${
                isToday ? 'border-white' : 'border-border'
              }`}
            >
              <p className="font-sans text-[10px] text-muted-foreground uppercase">
                {format(day.date, 'EEE')}
              </p>
              <p className="font-sans text-[16px] text-foreground mt-0.5">
                {format(day.date, 'd')}
              </p>
              <div className="mt-1.5 flex justify-center">
                <div
                  className={`w-[6px] h-[6px] rounded-full ${
                    day.status === 'published'
                      ? 'bg-emerald-500'
                      : day.status === 'scheduled'
                        ? 'bg-amber-500'
                        : day.status === 'draft'
                          ? 'bg-white/30'
                          : 'bg-border'
                  }`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Link>
  )
}
