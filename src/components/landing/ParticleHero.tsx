'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

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

    // Load GLB model
    const loader = new GLTFLoader()
    loader.load(
      '/nivi-model.bin',
      (gltf) => {
        console.log('[ParticleHero] Model loaded')

        // Find mesh
        let meshGeo: THREE.BufferGeometry | null = null
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry && !meshGeo) {
            meshGeo = child.geometry
          }
        })
        if (!meshGeo) return

        const posAttr = (meshGeo as THREE.BufferGeometry).attributes.position
        if (!posAttr) return

        ;(meshGeo as THREE.BufferGeometry).computeBoundingBox()
        const box = (meshGeo as THREE.BufferGeometry).boundingBox!
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 3.8 / maxDim

        const isMobile = window.innerWidth < 768
        const totalVerts = posAttr.count
        const maxP = isMobile ? 40000 : 200000
        const skip = Math.max(1, Math.floor(totalVerts / maxP))

        console.log(`[ParticleHero] ${totalVerts} verts, using ${Math.floor(totalVerts / skip)} particles`)

        const positions: number[] = []
        const randomStarts: number[] = []
        const alphas: number[] = []
        const sizes: number[] = []

        for (let i = 0; i < totalVerts; i += skip) {
          const x = (posAttr.getX(i) - center.x) * scale
          const y = (posAttr.getY(i) - center.y) * scale
          const z = (posAttr.getZ(i) - center.z) * scale

          const ny = (posAttr.getY(i) - box.min.y) / size.y
          const nz = (posAttr.getZ(i) - box.min.z) / size.z
          const brightness = 0.6 + ny * 0.25 + nz * 0.15

          positions.push(x, y, z)
          alphas.push(brightness)
          sizes.push(1.5 + brightness * 2.0)

          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          const r = 6 + Math.random() * 5
          randomStarts.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
          )
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
              float t = 1.0 - pow(1.0 - clamp(uFormProgress, 0.0, 1.0), 3.0);
              vec3 pos = mix(aRandomStart, position, t);

              pos.x += sin(uTime * 0.15 + position.y * 3.0) * 0.005;
              pos.y += cos(uTime * 0.12 + position.x * 3.0) * 0.005;

              vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
              gl_Position = projectionMatrix * mvPos;

              float mouseDist = distance(pos.xy, uMouse.xy);
              vGlow = smoothstep(2.0, 0.0, mouseDist);

              float centerDist = length(position.xy);
              float innerGlow = smoothstep(2.0, 0.0, centerDist) * 0.25;
              float scrollGlow = smoothstep(0.2, 0.6, uScroll) * 0.8;

              float sz = aSize * (1.0 + vGlow * 2.0 + innerGlow) * uPixelRatio;
              gl_PointSize = sz * (1.0 / -mvPos.z);

              vAlpha = (aAlpha * 1.4 + innerGlow * 0.5 + vGlow * 0.5 + scrollGlow) * t;
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

              vec3 shadow = vec3(0.35, 0.2, 0.6);
              vec3 mid = vec3(0.55, 0.4, 0.85);
              vec3 highlight = vec3(0.75, 0.65, 1.0);

              vec3 color = mix(shadow, mid, smoothstep(0.2, 0.5, vAlpha));
              color = mix(color, highlight, smoothstep(0.5, 0.9, vAlpha));
              color = mix(color, vec3(0.85, 0.78, 1.0), vGlow * 0.6);

              float scrollWhite = smoothstep(0.3, 0.65, uScroll);
              color = mix(color, vec3(1.0), scrollWhite);
              color += vDepth * vec3(0.05, 0.03, 0.1);

              gl_FragColor = vec4(color, vAlpha * strength);
            }
          `,
        })

        points = new THREE.Points(geo, mat)
        scene.add(points)
      },
      (p) => console.log(`[ParticleHero] Loading: ${Math.round((p.loaded / (p.total || 1)) * 100)}%`),
      (err) => console.error('[ParticleHero] Error:', err)
    )

    function animate() {
      const elapsed = (performance.now() - startTime) / 1000
      const scroll = scrollYProgress.get()

      if (mat) {
        mat.uniforms.uTime.value = elapsed
        mat.uniforms.uFormProgress.value = Math.min(1, elapsed / 2.5)
        mat.uniforms.uScroll.value = scroll
        camera.position.z = Math.max(-0.5, initialCamZ - scroll * 6.0)

        const mouse3D = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5)
        mouse3D.unproject(camera)
        const dir = mouse3D.sub(camera.position).normalize()
        const dist = -camera.position.z / dir.z
        const worldMouse = camera.position.clone().add(dir.multiplyScalar(dist))
        mat.uniforms.uMouse.value.set(worldMouse.x, worldMouse.y, 0)
      }

      if (points) {
        points.rotation.y += (mouseRef.current.x * 0.2 - points.rotation.y) * 0.04
        points.rotation.x += (-mouseRef.current.y * 0.12 - points.rotation.x) * 0.04
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
      style={{ height: '250vh', backgroundColor: bgColor }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ width: '70%', height: '80%', background: 'radial-gradient(ellipse, rgba(120,80,220,0.15) 0%, rgba(80,40,180,0.05) 40%, transparent 70%)' }} />
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ width: '40%', height: '50%', background: 'radial-gradient(ellipse, rgba(140,100,255,0.2) 0%, rgba(100,60,200,0.08) 50%, transparent 75%)' }} />
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
