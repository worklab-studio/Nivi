'use client'

interface StreakRowProps {
  streakCount: number
  days: { date: string; status: 'published' | 'scheduled' | 'empty' }[]
}

export function StreakRow({ streakCount, days }: StreakRowProps) {
  return (
    <div>
      <p className="font-sans text-xs text-muted-foreground mb-2">
        Day {streakCount} streak
      </p>
      <div className="flex gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            title={day.date}
            className={`w-[10px] h-[10px] rounded-[2px] ${
              day.status === 'published'
                ? 'bg-emerald-500'
                : day.status === 'scheduled'
                  ? 'bg-amber-500'
                  : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
