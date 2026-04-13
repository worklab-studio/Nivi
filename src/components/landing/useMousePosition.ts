'use client'

import { useEffect, useRef } from 'react'

/**
 * Tracks mouse/touch position relative to a canvas element.
 * Returns a mutable ref (no React re-renders) for use in RAF loops.
 */
export function useMousePosition(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const pos = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      pos.current.x = e.clientX - rect.left
      pos.current.y = e.clientY - rect.top
    }

    const onMouseLeave = () => {
      pos.current.x = -1000
      pos.current.y = -1000
    }

    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches[0]
      pos.current.x = touch.clientX - rect.left
      pos.current.y = touch.clientY - rect.top
    }

    const onTouchEnd = () => {
      pos.current.x = -1000
      pos.current.y = -1000
    }

    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [canvasRef])

  return pos
}
