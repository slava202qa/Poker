import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  life: number
}

const COLORS = ['#d4a843', '#f0d078', '#FFD700', '#FFA500', '#FF6347', '#00CED1', '#7B68EE', '#ffffff']

interface Props {
  active: boolean
  duration?: number
}

export function Confetti({ active, duration = 3000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    // Spawn particles
    const particles: Particle[] = []
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 100,
        y: h / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 15 - 5,
        size: Math.random() * 8 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        life: 1,
      })
    }
    particlesRef.current = particles

    const startTime = Date.now()

    function animate() {
      if (!ctx || !canvas) return
      const elapsed = Date.now() - startTime
      if (elapsed > duration + 1000) {
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
        return
      }

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      for (const p of particlesRef.current) {
        p.x += p.vx
        p.vy += 0.3 // gravity
        p.y += p.vy
        p.vx *= 0.99
        p.rotation += p.rotationSpeed
        p.life = Math.max(0, 1 - elapsed / duration)

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [active, duration])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
