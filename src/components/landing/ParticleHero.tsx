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
  const textOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])
  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.5, 0.8, 1],
    ['rgba(10,10,10,1)', 'rgba(10,10,10,1)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,1)']
  )

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
    camera.position.z = 5  // pull back so face is properly framed

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
    img.src = '/face-particles.png'
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
      const step = isMobile ? 3 : 2  // dense but performant

      const positions: number[] = []
      const randomStarts: number[] = []
      const alphas: number[] = []
      const sizes: number[] = []

      const imgW = c.width
      const imgH = c.height
      const spread = 3.0
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

          const pz = brightness * 1.0 - gradient * 0.5 + centerBias + (Math.random() - 0.5) * 0.25

          positions.push(px, py, pz)
          alphas.push(brightness)
          sizes.push(2.5 + brightness * 3.5)  // bigger particles, brighter = bigger

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

      // ── Floating logo particles ──
      const logos = [
        { text: 'in', x: -3.2, y: 0.8, scale: 0.8 },      // LinkedIn
        { text: 'AI', x: 3.0, y: -0.5, scale: 0.7 },       // AI
        { text: '◆', x: -2.8, y: -1.5, scale: 0.6 },       // Claude diamond
        { text: '✦', x: 2.5, y: 1.5, scale: 0.55 },        // ChatGPT star
        { text: '⚡', x: -1.8, y: 2.0, scale: 0.5 },       // AI spark
        { text: '◈', x: 3.3, y: -1.8, scale: 0.5 },        // Extra
      ]

      for (const logo of logos) {
        const lc = document.createElement('canvas')
        lc.width = 80
        lc.height = 80
        const lctx = lc.getContext('2d')!
        lctx.fillStyle = 'white'
        lctx.font = `bold ${Math.floor(50 * logo.scale)}px Arial`
        lctx.textAlign = 'center'
        lctx.textBaseline = 'middle'
        lctx.fillText(logo.text, 40, 40)

        const ld = lctx.getImageData(0, 0, 80, 80)
        const logoStep = 2
        for (let ly = 0; ly < 80; ly += logoStep) {
          for (let lx = 0; lx < 80; lx += logoStep) {
            const li = (ly * 80 + lx) * 4
            if (ld.data[li] > 80) {
              const b = ld.data[li] / 255
              const px = logo.x + (lx / 80 - 0.5) * logo.scale
              const py = logo.y + -(ly / 80 - 0.5) * logo.scale
              const pz = (Math.random() - 0.5) * 0.15

              positions.push(px, py, pz)
              alphas.push(b * 0.7)
              sizes.push(1.5 + b * 1.5)

              const theta = Math.random() * Math.PI * 2
              const phi = Math.acos(2 * Math.random() - 1)
              const r = 8 + Math.random() * 5
              randomStarts.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
              )
            }
          }
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

            // Subtle constant drift — particles float gently
            float drift = uTime * 0.15;
            pos.x += sin(drift + position.y * 4.0 + position.z * 2.0) * 0.008;
            pos.y += cos(drift * 0.8 + position.x * 3.0 + position.z) * 0.008;
            pos.z += sin(drift * 0.6 + position.x * position.y * 3.0) * 0.005;

            // Scroll zoom
            float zoom = 1.0 + uScroll * 3.0;
            pos *= zoom;

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPos;

            // Mouse glow
            float mouseDist = distance(pos.xy, uMouse.xy);
            vGlow = smoothstep(2.0, 0.0, mouseDist);

            // Internal glow: center of face glows from within
            float centerDist = length(position.xy);
            float innerGlow = smoothstep(2.5, 0.0, centerDist) * 0.3;

            // Point size
            float sz = aSize * (1.0 + vGlow * 1.8 + innerGlow * 0.5) * uPixelRatio;
            gl_PointSize = sz * (1.0 / -mvPos.z);

            // Alpha: bright base, glow hotter on scroll, then fade
            float scrollGlow = smoothstep(0.0, 0.5, uScroll) * 0.5; // brighter as you scroll
            vAlpha = (aAlpha * 1.2 + innerGlow * 0.6 + vGlow * 0.4 + scrollGlow) * t;
            vAlpha *= 1.0 - smoothstep(0.65, 1.0, uScroll); // fade out at end
            vAlpha = clamp(vAlpha, 0.0, 1.0);

            vDepth = position.z;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uScroll;
          varying float vAlpha;
          varying float vGlow;
          varying float vDepth;

          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;

            // Softer falloff for glow effect
            float strength = 1.0 - smoothstep(0.0, 0.5, d);
            strength = pow(strength, 1.2);

            // Color: bright particles — epiminds style
            vec3 shadow = vec3(0.4, 0.35, 0.65);      // darker areas: deep purple
            vec3 mid = vec3(0.7, 0.65, 0.95);          // mid tones: bright lavender
            vec3 highlight = vec3(0.95, 0.92, 1.0);    // highlights: near white

            // Brightness-based color (aAlpha carries original brightness)
            vec3 color = mix(shadow, mid, smoothstep(0.2, 0.5, vAlpha));
            color = mix(color, highlight, smoothstep(0.5, 0.9, vAlpha));

            // Cursor makes even brighter
            color = mix(color, vec3(1.0), vGlow * 0.5);

            // Scroll: particles turn white-hot before fading
            float scrollWhite = smoothstep(0.3, 0.7, uScroll);
            color = mix(color, vec3(1.0, 0.98, 1.0), scrollWhite);

            // Depth: forward = brighter
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
      className="relative"
      style={{ height: '200vh', backgroundColor: bgColor }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Three.js canvas */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Subtle backlight — soft blur, not solid */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              width: '50%',
              height: '60%',
              background: 'radial-gradient(ellipse, rgba(100,70,200,0.08) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Text — bottom left */}
        <motion.div
          className="absolute z-10 bottom-0 left-0 p-8 sm:p-12 lg:p-16 max-w-2xl"
          style={{ opacity: textOpacity }}
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

        {/* Bottom fade — adapts to scroll bg transition */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: useTransform(
              scrollYProgress,
              [0, 0.7, 1],
              [
                'linear-gradient(to top, rgba(10,10,10,1), transparent)',
                'linear-gradient(to top, rgba(10,10,10,0.5), transparent)',
                'linear-gradient(to top, rgba(255,255,255,1), transparent)',
              ]
            ),
          }}
        />
      </div>
    </motion.section>
  )
}
