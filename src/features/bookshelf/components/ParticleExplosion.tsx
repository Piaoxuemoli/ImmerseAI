/**
 * ParticleExplosion 组件
 *
 * 书籍删除时的粒子爆炸动画
 */

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  angle: number
  distance: number
  size: number
  color: string
}

interface ParticleExplosionProps {
  x: number
  y: number
  onComplete: () => void
}

const PARTICLE_COUNT = 12
const COLORS = [
  'hsl(238, 84%, 67%)', // primary
  'hsl(142, 71%, 45%)', // success
  'hsl(220, 10%, 50%)', // muted
  'hsl(0, 72%, 51%)', // destructive
]

export function ParticleExplosion({ x, y, onComplete }: ParticleExplosionProps) {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x,
      y,
      angle: (360 / PARTICLE_COUNT) * i + Math.random() * 20 - 10,
      distance: 60 + Math.random() * 40,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
    }))
  )

  useEffect(() => {
    const timer = setTimeout(onComplete, 600)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <>
      {particles.map((particle) => {
        const rad = (particle.angle * Math.PI) / 180
        const tx = Math.cos(rad) * particle.distance
        const ty = Math.sin(rad) * particle.distance

        return (
          <motion.div
            key={particle.id}
            className="fixed rounded-full pointer-events-none"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
            }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: 0,
              scale: 0,
              x: tx,
              y: ty,
            }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
            }}
          />
        )
      })}
    </>
  )
}
