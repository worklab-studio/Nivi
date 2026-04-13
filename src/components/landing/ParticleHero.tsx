'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import * as THREE from 'three'

export function ParticleHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const textOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])
  const bgColor = useTransform(
    scrollYProgress,
    [0, 0.5, 0.8, 1],
    ['rgba(10,10,10,1)', 'rgba(10,10,10,1)', 'rgba(200,200,220,0.8)', 'rgba(255,255,255,1)']
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0' })

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
    camera.position.z = 4.5
    const initialCamZ = 4.5

    let points: THREE.Points | null = null
    let mat: THREE.ShaderMaterial | null = null
    const startTime = performance.now()
    let animId = 0

    // Mouse
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

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/face-photo.png'
    img.onload = () => {
      const c = document.createElement('canvas')
      const isMobile = window.innerWidth < 768
      const sampleSize = isMobile ? 350 : 600
      const aspect = img.height / img.width
      c.width = sampleSize
      c.height = Math.floor(sampleSize * aspect)
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const data = ctx.getImageData(0, 0, c.width, c.height)

      const step = isMobile ? 2 : 1
      const imgW = c.width
      const imgH = c.height
      const spread = 3.8
      const spreadY = spread * aspect

      const positions: number[] = []
      const randomStarts: number[] = []
      const colors: number[] = []  // store actual pixel color
      const sizes: number[] = []

      for (let y = 0; y < imgH; y += step) {
        for (let x = 0; x < imgW; x += step) {
          const i = (y * imgW + x) * 4
          const r = data.data[i]
          const g = data.data[i + 1]
          const b = data.data[i + 2]
          const lum = (r + g + b) / 3

          if (lum < 10) continue

          const brightness = Math.pow(lum / 255, 0.6) // gamma boost darks

          const px = (x / imgW - 0.5) * spread
          const py = -(y / imgH - 0.5) * spreadY

          // Strong 3D depth
          const centerDist = Math.sqrt(Math.pow((x / imgW - 0.5) * 2, 2) + Math.pow((y / imgH - 0.4) * 2, 2))
          const centerBias = Math.max(0, 1 - centerDist) * 0.5
          const pz = brightness * 1.2 + centerBias + (Math.random() - 0.5) * 0.2

          positions.push(px, py, pz)
          colors.push(r / 255, g / 255, b / 255)
          sizes.push(2.0 + brightness * 3.0) // bigger particles

          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          const rad = 5 + Math.random() * 4
          randomStarts.push(
            rad * Math.sin(phi) * Math.cos(theta),
            rad * Math.sin(phi) * Math.sin(theta),
            rad * Math.cos(phi)
          )
        }
      }

      console.log(`[ParticleHero] ${positions.length / 3} particles`)

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('aRandomStart', new THREE.Float32BufferAttribute(randomStarts, 3))
      geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3))
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
          attribute vec3 aColor;
          attribute float aSize;
          attribute vec3 aRandomStart;
          uniform float uTime;
          uniform float uFormProgress;
          uniform float uScroll;
          uniform vec3 uMouse;
          uniform float uPixelRatio;
          varying vec3 vColor;
          varying float vGlow;
          varying float vAlpha;

          void main() {
            float t = 1.0 - pow(1.0 - clamp(uFormProgress, 0.0, 1.0), 3.0);
            vec3 pos = mix(aRandomStart, position, t);

            // Subtle floating
            pos.x += sin(uTime * 0.2 + position.y * 4.0) * 0.004;
            pos.y += cos(uTime * 0.15 + position.x * 4.0) * 0.004;
            pos.z += sin(uTime * 0.1 + position.x * position.y * 3.0) * 0.003;

            // Cursor distance
            float mouseDist = distance(position.xy, uMouse.xy);
            vGlow = smoothstep(2.0, 0.0, mouseDist);

            // Cursor repulsion — particles react to cursor
            vec2 repDir = position.xy - uMouse.xy;
            float repLen = length(repDir);
            if (repLen > 0.01 && repLen < 1.2) {
              pos.xy += normalize(repDir) * smoothstep(1.2, 0.0, repLen) * 0.08;
              pos.z += smoothstep(1.2, 0.0, repLen) * 0.15;
            }

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPos;

            // Scroll glow
            float scrollGlow = smoothstep(0.2, 0.6, uScroll) * 0.5;

            // Size: bigger on glow
            float sz = aSize * (1.0 + vGlow * 2.5) * uPixelRatio;
            gl_PointSize = sz * (1.0 / -mvPos.z);

            vColor = aColor;

            // Alpha: BRIGHT base + cursor boost
            float lum = dot(aColor, vec3(0.299, 0.587, 0.114));
            vAlpha = (lum * 2.0 + vGlow * 0.8 + scrollGlow) * t;
            vAlpha *= 1.0 - smoothstep(0.75, 1.0, uScroll);
            vAlpha = clamp(vAlpha, 0.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uScroll;
          varying vec3 vColor;
          varying float vGlow;
          varying float vAlpha;

          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float strength = 1.0 - smoothstep(0.0, 0.5, d);
            strength = pow(strength, 1.3);

            // Image color boosted significantly
            vec3 color = vColor * 2.0;

            // Cursor makes particles glow bright white
            color = mix(color, vec3(1.0, 0.95, 1.0), vGlow * 0.6);

            // Scroll white
            float scrollWhite = smoothstep(0.4, 0.7, uScroll);
            color = mix(color, vec3(1.0), scrollWhite);

            gl_FragColor = vec4(color, vAlpha * strength);
          }
        `,
      })

      points = new THREE.Points(geo, mat)
      scene.add(points)
    }

    function animate() {
      const elapsed = (performance.now() - startTime) / 1000
      const scroll = scrollYProgress.get()

      if (mat) {
        mat.uniforms.uTime.value = elapsed
        mat.uniforms.uFormProgress.value = Math.min(1, elapsed / 2.5)
        mat.uniforms.uScroll.value = scroll
        camera.position.z = Math.max(-0.5, initialCamZ - scroll * 5.5)

        const mouse3D = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5)
        mouse3D.unproject(camera)
        const dir = mouse3D.sub(camera.position).normalize()
        const dist = -camera.position.z / dir.z
        const worldMouse = camera.position.clone().add(dir.multiplyScalar(dist))
        mat.uniforms.uMouse.value.set(worldMouse.x, worldMouse.y, 0)
      }

      if (points) {
        points.rotation.y += (mouseRef.current.x * 0.25 - points.rotation.y) * 0.05
        points.rotation.x += (-mouseRef.current.y * 0.15 - points.rotation.x) * 0.05
      }

      renderer.render(scene, camera)
      animId = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      const nw = container.clientWidth
      const nh = container.clientHeight
      renderer.setSize(nw, nh)
      camera.aspect = nw / nh
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
      style={{ height: '220vh', backgroundColor: bgColor }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ width: '55%', height: '65%', background: 'radial-gradient(ellipse, rgba(100,60,220,0.12) 0%, transparent 70%)' }} />
        </div>

        <motion.div
          className="absolute z-10 left-0 right-0 px-6 sm:px-10 lg:px-16"
          style={{ bottom: 48, opacity: textOpacity }}
        >
          <p className="text-[10px] sm:text-[11px] text-[#666] uppercase tracking-[0.3em] font-medium mb-3">
            Your LinkedIn personal branding strategist
          </p>
          <h1 className="font-sans text-[40px] sm:text-[56px] lg:text-[64px] font-bold tracking-tight text-white leading-[1.05] mb-3">
            Introducing Nivi.
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[#777] mb-6 max-w-md leading-relaxed">
            She learns your voice, writes daily posts, and delivers them to your WhatsApp.
          </p>
          <Link href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-black text-[13px] px-6 py-2.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.1)]">
            Say Hello Nivi <span className="text-[11px]">↗</span>
          </Link>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.8), transparent)' }} />
      </div>
    </motion.section>
  )
}
