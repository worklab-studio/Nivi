'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

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
    [0, 0.4, 0.7, 0.85, 1],
    ['rgba(10,10,10,1)', 'rgba(10,10,10,1)', 'rgba(40,40,50,1)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,1)']
  )

  useEffect(() => {
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
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0' })

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
    camera.position.z = 5
    const initialCamZ = 5

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

    // Load 3D model (Draco compressed)
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)
    loader.load('/nivi-model.glb', (gltf) => {
      // Extract all vertices from the model
      const positions: number[] = []
      const randomStarts: number[] = []
      const alphas: number[] = []
      const sizes: number[] = []

      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const geo = child.geometry
          const posAttr = geo.attributes.position
          if (!posAttr) return

          const isMobile = window.innerWidth < 768
          // Sample vertices — skip some for performance
          const totalVerts = posAttr.count
          const maxParticles = isMobile ? 30000 : 80000
          const skip = Math.max(1, Math.floor(totalVerts / maxParticles))

          for (let i = 0; i < totalVerts; i += skip) {
            const x = posAttr.getX(i)
            const y = posAttr.getY(i)
            const z = posAttr.getZ(i)

            // Get color/brightness from vertex normals for shading
            let brightness = 0.7
            if (geo.attributes.normal) {
              const ny = geo.attributes.normal.getY(i)
              brightness = 0.4 + Math.max(0, ny) * 0.6 // front-facing = brighter
            }

            positions.push(x, y, z)
            alphas.push(brightness)
            sizes.push(1.0 + brightness * 1.8)

            // Random start position (sphere for entrance animation)
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            const r = 8 + Math.random() * 6
            randomStarts.push(
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.sin(phi) * Math.sin(theta),
              r * Math.cos(phi)
            )
          }
        }
      })

      if (positions.length === 0) {
        console.error('No vertices found in model')
        return
      }

      console.log(`[ParticleHero] Loaded ${positions.length / 3} particles from 3D model`)

      // Center and scale the model
      const tempGeo = new THREE.BufferGeometry()
      tempGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      tempGeo.computeBoundingBox()
      const box = tempGeo.boundingBox!
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 3.5 / maxDim // fit within ~3.5 units

      // Apply centering and scaling
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (positions[i] - center.x) * scale
        positions[i + 1] = (positions[i + 1] - center.y) * scale
        positions[i + 2] = (positions[i + 2] - center.z) * scale
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
            // Entrance: spiral in from random positions
            float t = 1.0 - pow(1.0 - clamp(uFormProgress, 0.0, 1.0), 3.0);
            vec3 pos = mix(aRandomStart, position, t);

            // Subtle drift
            float drift = uTime * 0.15;
            pos.x += sin(drift + position.y * 3.0 + position.z * 2.0) * 0.005;
            pos.y += cos(drift * 0.8 + position.x * 3.0 + position.z) * 0.005;
            pos.z += sin(drift * 0.6 + position.x * position.y * 2.0) * 0.003;

            vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPos;

            // Mouse glow
            float mouseDist = distance(pos.xy, uMouse.xy);
            vGlow = smoothstep(2.0, 0.0, mouseDist);

            // Inner glow from center
            float centerDist = length(position.xy);
            float innerGlow = smoothstep(2.0, 0.0, centerDist) * 0.25;

            // Scroll glow (brighter as camera zooms in)
            float scrollGlow = smoothstep(0.2, 0.6, uScroll) * 0.8;

            // Point size
            float sz = aSize * (1.0 + vGlow * 2.0 + innerGlow) * uPixelRatio;
            gl_PointSize = sz * (1.0 / -mvPos.z);

            // Alpha
            vAlpha = (aAlpha * 1.0 + innerGlow * 0.5 + vGlow * 0.5 + scrollGlow) * t;
            vAlpha *= 1.0 - smoothstep(0.75, 1.0, uScroll);
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

            float strength = 1.0 - smoothstep(0.0, 0.5, d);
            strength = pow(strength, 1.2);

            // Color: blue-purple base → white on glow
            vec3 shadow = vec3(0.35, 0.32, 0.6);
            vec3 mid = vec3(0.6, 0.55, 0.85);
            vec3 highlight = vec3(0.9, 0.88, 1.0);

            vec3 color = mix(shadow, mid, smoothstep(0.2, 0.6, vAlpha));
            color = mix(color, highlight, smoothstep(0.5, 0.9, vAlpha));
            color = mix(color, vec3(1.0), vGlow * 0.6);

            // Scroll: turn white
            float scrollWhite = smoothstep(0.3, 0.65, uScroll);
            color = mix(color, vec3(1.0, 0.98, 1.0), scrollWhite);

            // Depth tint
            color += vDepth * vec3(0.06, 0.04, 0.1);

            gl_FragColor = vec4(color, vAlpha * strength);
          }
        `,
      })

      points = new THREE.Points(geo, mat)
      scene.add(points)
    })

    // Render loop
    function animate() {
      const elapsed = (performance.now() - startTime) / 1000
      const scroll = scrollYProgress.get()

      if (mat) {
        mat.uniforms.uTime.value = elapsed
        mat.uniforms.uFormProgress.value = Math.min(1, elapsed / 2.5)
        mat.uniforms.uScroll.value = scroll

        // Camera zooms into face on scroll
        const targetZ = initialCamZ - scroll * 6.0
        camera.position.z = Math.max(-0.5, targetZ)

        // Mouse → world space
        const mouse3D = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5)
        mouse3D.unproject(camera)
        const dir = mouse3D.sub(camera.position).normalize()
        const dist = -camera.position.z / dir.z
        const worldMouse = camera.position.clone().add(dir.multiplyScalar(dist))
        mat.uniforms.uMouse.value.set(worldMouse.x, worldMouse.y, 0)
      }

      // Head rotation following cursor
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

    // Resize
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
      style={{ height: '250vh', backgroundColor: bgColor }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Three.js canvas */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* LinkedIn blue backlight */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              width: '55%',
              height: '65%',
              background: 'radial-gradient(ellipse, rgba(0,119,181,0.1) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{
              width: '30%',
              height: '40%',
              background: 'radial-gradient(ellipse, rgba(0,119,181,0.08) 0%, transparent 65%)',
            }}
          />
        </div>

        {/* Text — bottom left */}
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
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-black text-[13px] px-6 py-2.5 rounded-lg font-medium hover:bg-white/90 transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.1)]"
          >
            Say Hello Nivi <span className="text-[11px]">↗</span>
          </Link>
        </motion.div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.8), transparent)' }}
        />
      </div>
    </motion.section>
  )
}
