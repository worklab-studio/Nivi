'use client'

export function NiviAvatar({ size = 24 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-white flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span className="font-sans text-background font-bold" style={{ fontSize: size * 0.5 }}>
        N
      </span>
    </div>
  )
}
