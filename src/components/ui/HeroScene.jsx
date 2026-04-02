import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 600

function Particles({ mouse }) {
  const mesh = useRef()
  const light = useRef()

  const [positions, sizes, colors] = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3)
    const sz = new Float32Array(PARTICLE_COUNT)
    const col = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15
      sz[i] = Math.random() * 3 + 0.5
      // Mix of warm colors: white, orange-red, soft pink
      const r = Math.random()
      if (r < 0.5) {
        col[i * 3] = 1; col[i * 3 + 1] = 1; col[i * 3 + 2] = 1
      } else if (r < 0.8) {
        col[i * 3] = 1; col[i * 3 + 1] = 0.3; col[i * 3 + 2] = 0.1
      } else {
        col[i * 3] = 1; col[i * 3 + 1] = 0.5; col[i * 3 + 2] = 0.7
      }
    }
    return [pos, sz, col]
  }, [])

  const originalPositions = useMemo(() => new Float32Array(positions), [positions])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const posArray = mesh.current.geometry.attributes.position.array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      const ox = originalPositions[i3]
      const oy = originalPositions[i3 + 1]
      const oz = originalPositions[i3 + 2]

      // Organic floating motion
      posArray[i3] = ox + Math.sin(t * 0.3 + i * 0.1) * 0.4
      posArray[i3 + 1] = oy + Math.sin(t * 0.5 + i * 0.05) * 0.6 + Math.sin(t * 0.2) * 0.2
      posArray[i3 + 2] = oz + Math.cos(t * 0.4 + i * 0.08) * 0.3
    }
    mesh.current.geometry.attributes.position.needsUpdate = true

    // Rotate slowly
    mesh.current.rotation.y = t * 0.02
    mesh.current.rotation.x = Math.sin(t * 0.1) * 0.05

    // Light follows mouse
    if (light.current) {
      light.current.position.x = mouse.current[0] * 8
      light.current.position.y = mouse.current[1] * 5
    }
  })

  return (
    <>
      <pointLight ref={light} color="#ff4500" intensity={15} distance={12} />
      <pointLight position={[0, 0, 5]} color="#ffffff" intensity={3} distance={15} />
      <points ref={mesh}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={PARTICLE_COUNT}
            array={colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={PARTICLE_COUNT}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  )
}

function WaveRing({ radius, speed, color, opacity }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const posArray = ref.current.geometry.attributes.position.array
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      const wave = Math.sin(t * speed + i * 0.15) * 0.3 +
                   Math.sin(t * speed * 0.7 + i * 0.1) * 0.2
      const r = radius + wave
      posArray[i * 3] = Math.cos(a) * r
      posArray[i * 3 + 1] = Math.sin(a) * r
    }
    ref.current.geometry.attributes.position.needsUpdate = true
    ref.current.rotation.z = t * 0.05
  })

  return (
    <line ref={ref} geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} />
    </line>
  )
}

function AudioBars() {
  const ref = useRef()
  const barCount = 48
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2
      const freq = Math.sin(t * 2.5 + i * 0.4) * 0.5 + 0.5
      const freq2 = Math.sin(t * 1.8 + i * 0.6) * 0.3 + 0.3
      const height = (freq * freq2) * 2.5 + 0.1
      const dist = 3.5

      dummy.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 0)
      dummy.scale.set(0.06, height, 0.06)
      dummy.lookAt(0, 0, 0)
      dummy.rotateX(Math.PI / 2)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[null, null, barCount]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ff3d00" transparent opacity={0.25} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  )
}

function Scene({ mouse }) {
  return (
    <>
      <fog attach="fog" args={['#0d0d0d', 5, 20]} />
      <ambientLight intensity={0.15} />
      <Particles mouse={mouse} />
      <WaveRing radius={2.8} speed={2} color="#ffffff" opacity={0.12} />
      <WaveRing radius={3.5} speed={1.5} color="#ff3d00" opacity={0.06} />
      <WaveRing radius={4.2} speed={1} color="#ffffff" opacity={0.04} />
      <AudioBars />
    </>
  )
}

export default function HeroScene() {
  const mouse = useRef([0, 0])

  const handleMouseMove = (e) => {
    mouse.current = [
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    ]
  }

  return (
    <div className="hero-3d" onMouseMove={handleMouseMove}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene mouse={mouse} />
      </Canvas>
    </div>
  )
}
