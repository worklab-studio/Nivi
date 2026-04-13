'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import * as THREE from 'three'

export function ParticleHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const pointsRef = useRef<THREE.Points | null>(null)
  const mouseRef = useRef(new THREE.Vector2(-10, -10))
  const animRef = useRef(0)
  const [ready, setReady] = useState(false)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  const textOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const textY = useTransform(scrollYProgress, [0, 0.3], [0, -80])

  // Mouse tracking
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    const onMouseLeave = () => {
      mouseRef.current.set(-10, -10)
    }
    const onTouchMove = (e: TouchEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const t = e.touches[0]
      mouseRef.current.x = ((t.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((t.clientY - rect.top) / rect.height) * 2 + 1
    }
    const onTouchEnd = () => {
      mouseRef.current.set(-10, -10)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    containerRef.current?.addEventListener('mouseleave', onMouseLeave)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Three.js setup
  const initScene = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    rendererRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
    camera.position.z = 4
    cameraRef.current = camera

    // Load image and create particles
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/face-particles.jpg'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 400
      const aspect = img.height / img.width
      canvas.width = size
      canvas.height = size * aspect
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const isMobile = window.innerWidth < 768
      const step = isMobile ? 4 : 2
      const positions: number[] = []
      const alphas: number[] = []
      const sizes: number[] = []

      const imgW = canvas.width
      const imgH = canvas.height
      const scaleX = 5.0 // larger spread — fill viewport
      const scaleY = scaleX * aspect

      for (let y = 0; y < imgH; y += step) {
        for (let x = 0; x < imgW; x += step) {
          const i = (y * imgW + x) * 4
          const r = imageData.data[i]
          const g = imageData.data[i + 1]
          const b = imageData.data[i + 2]
          const lum = (r + g + b) / 3

          if (lum > 20) {
            const brightness = lum / 255
            // Map to 3D coords centered at origin
            const px = (x / imgW - 0.5) * scaleX
            const py = -(y / imgH - 0.5) * scaleY
            // Add subtle Z depth based on brightness (brighter = closer)
            const pz = (brightness - 0.5) * 0.4 + (Math.random() - 0.5) * 0.1

            positions.push(px, py, pz)
            alphas.push(brightness)
            sizes.push(1.5 + brightness * 2.5)
          }
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1))
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))

      // Custom shader material
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMouse: { value: new THREE.Vector3(-10, -10, 0) },
          uGlowRadius: { value: 1.2 },
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: `
          attribute float aAlpha;
          attribute float aSize;
          uniform vec3 uMouse;
          uniform float uGlowRadius;
          uniform float uTime;
          uniform float uScroll;
          uniform float uPixelRatio;
          varying float vAlpha;
          varying float vGlow;

          void main() {
            vec3 pos = position;

            // Subtle floating animation
            pos.x += sin(uTime * 0.3 + position.y * 2.0) * 0.01;
            pos.y += cos(uTime * 0.2 + position.x * 2.0) * 0.01;

            // Scroll zoom
            float zoom = 1.0 + uScroll * 3.0;
            pos *= zoom;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            // Mouse distance in world space
            float dist = distance(pos.xy, uMouse.xy);
            vGlow = smoothstep(uGlowRadius, 0.0, dist);

            // Size: base + glow boost
            float finalSize = aSize * (1.0 + vGlow * 2.0) * uPixelRatio;
            gl_PointSize = finalSize * (1.0 / -mvPosition.z);

            // Alpha: dim base + bright glow
            vAlpha = aAlpha * 0.15 + vGlow * 0.9;
            vAlpha *= 1.0 - smoothstep(0.6, 1.0, uScroll); // fade on scroll
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          varying float vGlow;

          void main() {
            // Circular particle shape
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;

            // Soft edge
            float strength = 1.0 - smoothstep(0.0, 0.5, d);
            strength = pow(strength, 1.5);

            // Color: cool lavender base, warm white on glow
            vec3 baseColor = vec3(0.65, 0.6, 0.78);
            vec3 glowColor = vec3(0.95, 0.92, 1.0);
            vec3 color = mix(baseColor, glowColor, vGlow);

            gl_FragColor = vec4(color, vAlpha * strength);
          }
        `,
      })

      const points = new THREE.Points(geometry, material)
      scene.add(points)
      pointsRef.current = points

      setReady(true)
      animate()
    }

    function animate() {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return

      const material = pointsRef.current?.material as THREE.ShaderMaterial | undefined
      if (material) {
        material.uniforms.uTime.value = performance.now() * 0.001

        // Convert screen mouse to world space
        const mouse3D = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5)
        mouse3D.unproject(cameraRef.current!)
        const dir = mouse3D.sub(cameraRef.current!.position).normalize()
        const distance = -cameraRef.current!.position.z / dir.z
        const worldMouse = cameraRef.current!.position.clone().add(dir.multiplyScalar(distance))
        material.uniforms.uMouse.value.set(worldMouse.x, worldMouse.y, 0)

        // Scroll progress
        material.uniforms.uScroll.value = scrollYProgress.get()
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current!)
      animRef.current = requestAnimationFrame(animate)
    }

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [scrollYProgress])

  useEffect(() => {
    const cleanup = initScene()
    return () => cleanup?.()
  }, [initScene])

  return (
    <motion.section
      ref={sectionRef}
      className="relative bg-[#0a0a0a]"
      style={{ height: '180vh' }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Three.js container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ cursor: 'none' }}
        />

        {/* Cursor glow overlay (CSS, follows mouse for extra glow) */}
        <div className="absolute inset-0 pointer-events-none" id="cursor-glow" />

        {/* Text overlay — bottom left */}
        <motion.div
          className="absolute z-10 bottom-0 left-0 p-8 sm:p-12 lg:p-16 max-w-2xl"
          style={{ opacity: textOpacity, y: textY }}
        >
          <p className="text-[11px] sm:text-xs text-[#888] uppercase tracking-[0.2em] font-medium mb-4">
            Your LinkedIn personal branding strategist
          </p>

          <h1 className="font-sans text-[48px] sm:text-[64px] lg:text-[80px] font-bold leading-[0.95] tracking-tight mb-6">
            Say hello
            <br />
            <span className="italic font-light bg-gradient-to-r from-white via-[#c4b5fd] to-[#888] bg-clip-text text-transparent">
              Nivi.
            </span>
          </h1>

          <div className="flex items-center gap-4">
            <Link
              href="/sign-up"
              className="bg-white text-black text-sm px-7 py-3 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]"
            >
              Request Access
            </Link>
            <Link
              href="#how"
              className="border border-[#333] text-sm px-7 py-3 rounded-lg text-[#aaa] hover:text-white hover:border-[#555] transition-colors"
            >
              Learn more
            </Link>
          </div>
        </motion.div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #0a0a0a, transparent)' }}
        />
      </div>
    </motion.section>
  )
}
