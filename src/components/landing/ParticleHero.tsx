'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import * as THREE from 'three'

export function ParticleHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [, setMounted] = useState(false)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const textOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const textY = useTransform(scrollYProgress, [0, 0.3], [0, -80])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // ── Setup ──
    const w = container.clientWidth
    const h = container.clientHeight
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0' })

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
    camera.position.z = 5

    let points: THREE.Points | null = null
    let mat: THREE.ShaderMaterial | null = null
    const startTime = performance.now()
    let animId = 0

    // ── Mouse ──
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    const onMouseLeave = () => { mouseRef.current.x = 0; mouseRef.current.y = 0 }
    const onTouchMove = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect()
      const t = e.touches[0]
      mouseRef.current.x = ((t.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((t.clientY - rect.top) / rect.height) * 2 + 1
    }
    window.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    // ── Load image → create particles ──
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/face-particles.jpg'
    img.onload = () => {
      const c = document.createElement('canvas')
      const sampleSize = 500
      const aspect = img.height / img.width
      c.width = sampleSize
      c.height = sampleSize * aspect
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const data = ctx.getImageData(0, 0, c.width, c.height)

      const isMobile = window.innerWidth < 768
      const step = isMobile ? 4 : 2

      const positions: number[] = []
      const randomStarts: number[] = []
      const alphas: number[] = []
      const sizes: number[] = []

      const imgW = c.width
      const imgH = c.height
      const spread = 4.5
      const spreadY = spread * aspect

      // Compute simple edge/gradient for depth
      const getLum = (x: number, y: number) => {
        if (x < 0 || x >= imgW || y < 0 || y >= imgH) return 0
        const i = (y * imgW + x) * 4
        return (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3
      }

      for (let y = 0; y < imgH; y += step) {
        for (let x = 0; x < imgW; x += step) {
          const lum = getLum(x, y)
          if (lum < 10) continue

          const brightness = lum / 255

          // 3D position
          const px = (x / imgW - 0.5) * spread
          const py = -(y / imgH - 0.5) * spreadY

          // Pseudo-3D depth:
          // - brightness = closer (nose, forehead bright = forward)
          // - edge gradient = contour depth
          // - center bias = nose is closest
          const gx = getLum(x + step, y) - getLum(x - step, y)
          const gy = getLum(x, y + step) - getLum(x, y - step)
          const gradient = Math.sqrt(gx * gx + gy * gy) / 255

          const centerDist = Math.sqrt(
            Math.pow((x / imgW - 0.5) * 2, 2) +
            Math.pow((y / imgH - 0.45) * 2, 2) // slightly above center for nose
          )
          const centerBias = Math.max(0, 1 - centerDist) * 0.3

          const pz = brightness * 0.6 - gradient * 0.3 + centerBias + (Math.random() - 0.5) * 0.12

          positions.push(px, py, pz)
          alphas.push(brightness)
          sizes.push(1.0 + brightness * 2.0)

          // Random start: spiral sphere
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          const r = 6 + Math.random() * 6
          randomStarts.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
          )
        }
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('aRandomStart', new THREE.Float32BufferAttribute(randomStarts, 3))
      geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1))
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))

      mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFormProgress: { value: 0 },
          uScroll: { value: 0 },
          uMouse: { value: new THREE.Vector3(0, 0, 0) },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          attribute float aSize;
          attribute vec3 aRandomStart;

          uniform float uTime;
          uniform float uFormProgress;
          uniform float uScroll;
          uniform vec3 uMouse;
          uniform float uPixelRatio;

          varying float vAlpha;
          varying float vGlow;
          varying float vDepth;

          void main() {
            // Entrance animation: cubic ease-out
            float t = 1.0 - pow(1.0 - clamp(uFormProgress, 0.0, 1.0), 3.0);
            vec3 pos = mix(aRandomStart, position, t);

            // Subtle breathing only
            pos.x += sin(uTime * 0.4 + position.y * 2.0) * 0.006;
            pos.y += cos(uTime * 0.3 + position.x * 2.0) * 0.006;

            // Scroll zoom
            float zoom = 1.0 + uScroll * 3.0;
            pos *= zoom;

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPos;

            // Mouse glow
            float mouseDist = distance(pos.xy, uMouse.xy);
            vGlow = smoothstep(1.8, 0.0, mouseDist);

            // Point size: solid base, slightly bigger on glow
            float sz = aSize * (1.0 + vGlow * 1.5) * uPixelRatio;
            gl_PointSize = sz * (1.0 / -mvPos.z);

            // Alpha: ALWAYS VISIBLE (0.7 base) + extra glow
            vAlpha = (aAlpha * 0.7 + vGlow * 0.3) * t;
            vAlpha *= 1.0 - smoothstep(0.55, 1.0, uScroll);

            vDepth = position.z;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          varying float vGlow;
          varying float vDepth;

          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;

            float strength = 1.0 - smoothstep(0.0, 0.5, d);
            strength = pow(strength, 1.5);

            // Color: cool lavender base → bright white on glow
            vec3 base = vec3(0.52, 0.47, 0.7);
            vec3 bright = vec3(1.0, 0.97, 1.0);
            vec3 color = mix(base, bright, vGlow);

            // Depth tint: forward particles slightly brighter
            color += vDepth * vec3(0.12, 0.1, 0.18);

            gl_FragColor = vec4(color, vAlpha * strength);
          }
        `,
      })

      points = new THREE.Points(geo, mat)
      scene.add(points)
      setMounted(true)
    }

    // ── Render loop ──
    function animate() {
      const elapsed = (performance.now() - startTime) / 1000

      if (mat) {
        mat.uniforms.uTime.value = elapsed
        mat.uniforms.uFormProgress.value = Math.min(1, elapsed / 2.5)
        mat.uniforms.uScroll.value = scrollYProgress.get()

        // Mouse → world space
        const mouse3D = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5)
        mouse3D.unproject(camera)
        const dir = mouse3D.sub(camera.position).normalize()
        const dist = -camera.position.z / dir.z
        const worldMouse = camera.position.clone().add(dir.multiplyScalar(dist))
        mat.uniforms.uMouse.value.set(worldMouse.x, worldMouse.y, 0)
      }

      // Head rotation following cursor (smooth lerp)
      if (points) {
        const targetRotY = mouseRef.current.x * 0.2
        const targetRotX = -mouseRef.current.y * 0.12
        points.rotation.y += (targetRotY - points.rotation.y) * 0.04
        points.rotation.x += (targetRotX - points.rotation.x) * 0.04
      }

      renderer.render(scene, camera)
      animId = requestAnimationFrame(animate)
    }
    animate()

    // ── Resize ──
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.remove()
    }
  }, [scrollYProgress])

  return (
    <motion.section
      ref={sectionRef}
      className="relative bg-[#0a0a0a]"
      style={{ height: '180vh' }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Three.js canvas */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Ambient radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '50%',
              height: '60%',
              background: 'radial-gradient(ellipse, rgba(100,80,160,0.06) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Text — bottom left */}
        <motion.div
          className="absolute z-10 bottom-0 left-0 p-8 sm:p-12 lg:p-16 max-w-2xl"
          style={{ opacity: textOpacity, y: textY }}
        >
          <p className="text-[10px] sm:text-[11px] text-[#777] uppercase tracking-[0.25em] font-medium mb-4">
            Your LinkedIn personal branding strategist
          </p>
          <h1 className="font-sans text-[44px] sm:text-[60px] lg:text-[76px] font-bold leading-[0.95] tracking-tight mb-6">
            Say hello
            <br />
            <span className="italic font-light bg-gradient-to-r from-white via-[#c4b5fd] to-[#a78bfa] bg-clip-text text-transparent">
              Nivi.
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-up"
              className="bg-white text-black text-[13px] px-6 py-2.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.1)] flex items-center gap-1.5"
            >
              Request Access <span className="text-[10px]">↗</span>
            </Link>
          </div>
        </motion.div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #0a0a0a, transparent)' }}
        />
      </div>
    </motion.section>
  )
}
