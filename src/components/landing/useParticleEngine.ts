'use client'

import { useEffect, useRef } from 'react'
import type { MotionValue } from 'framer-motion'

interface Particle {
  originX: number // normalized 0-1
  originY: number // normalized 0-1
  brightness: number // 0-1 from source image
  size: number
}

/**
 * Canvas particle engine:
 * - Samples a grayscale image to create particle positions
 * - Renders particles with cursor-proximity glow
 * - Applies scroll-based zoom
 */
export function useParticleEngine(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mouseRef: React.RefObject<{ x: number; y: number }>,
  scrollProgress: MotionValue<number>
) {
  const particles = useRef<Particle[]>([])
  const animId = useRef(0)
  const loaded = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Resize canvas for retina
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Load and sample the face image
    const img = new Image()
    img.src = '/face-particles.jpg'
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width = img.width
      offscreen.height = img.height
      const octx = offscreen.getContext('2d')!
      octx.drawImage(img, 0, 0)
      const imageData = octx.getImageData(0, 0, img.width, img.height)

      const isMobile = window.innerWidth < 768
      const step = isMobile ? 5 : 3
      const sampled: Particle[] = []

      for (let y = 0; y < img.height; y += step) {
        for (let x = 0; x < img.width; x += step) {
          const i = (y * img.width + x) * 4
          const r = imageData.data[i]
          const g = imageData.data[i + 1]
          const b = imageData.data[i + 2]
          const lum = (r + g + b) / 3

          if (lum > 25) {
            const brightness = lum / 255
            sampled.push({
              originX: x / img.width,
              originY: y / img.height,
              brightness,
              size: 0.8 + brightness * 1.2,
            })
          }
        }
      }

      particles.current = sampled
      loaded.current = true
      render()
    }

    function render() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      ctx.clearRect(0, 0, w, h)

      if (!loaded.current || particles.current.length === 0) {
        animId.current = requestAnimationFrame(render)
        return
      }

      const mouse = mouseRef.current ?? { x: -1000, y: -1000 }
      const scroll = scrollProgress.get()

      // Face dimensions — centered, taking ~45% width and ~75% height
      const faceW = w * 0.45
      const faceH = h * 0.75
      const offsetX = (w - faceW) / 2
      const offsetY = (h - faceH) * 0.35 // slightly above center

      // Scroll zoom
      const scale = 1 + scroll * 2.5
      const cx = w / 2
      const cy = h / 2

      // Scroll-based overall opacity
      const globalAlpha = scroll < 0.7 ? 1 : 1 - (scroll - 0.7) / 0.3

      const glowRadius = 160
      const pts = particles.current

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]

        // Base position
        const bx = offsetX + p.originX * faceW
        const by = offsetY + p.originY * faceH

        // Apply zoom from center
        const px = cx + (bx - cx) * scale
        const py = cy + (by - cy) * scale

        // Skip if offscreen
        if (px < -10 || px > w + 10 || py < -10 || py > h + 10) continue

        // Mouse distance
        const dx = px - mouse.x
        const dy = py - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const glow = Math.max(0, 1 - dist / glowRadius)

        // Alpha: base dimness + cursor glow boost
        const alpha = Math.min(1, p.brightness * 0.25 + glow * 0.85) * globalAlpha
        if (alpha < 0.02) continue

        // Color: cool white with purple tint, brightens near cursor
        const r = 180 + glow * 75
        const g = 175 + glow * 75
        const b = 200 + glow * 55

        // Size increases near cursor
        const sz = p.size * (1 + glow * 0.6)

        ctx.beginPath()
        ctx.arc(px, py, sz, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`
        ctx.fill()
      }

      animId.current = requestAnimationFrame(render)
    }

    return () => {
      cancelAnimationFrame(animId.current)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef, mouseRef, scrollProgress])
}
