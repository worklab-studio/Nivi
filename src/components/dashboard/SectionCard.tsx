import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface Props {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = '',
}: Props) {
  return (
    <Card
      className={`bg-card border border-border shadow-[0_1px_2px_rgba(16,24,40,0.04)] rounded-xl overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-border">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[14px] font-semibold text-foreground tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </Card>
  )
}
