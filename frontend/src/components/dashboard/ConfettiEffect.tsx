import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
}

export default function ConfettiEffect({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const colors = [
      'hsl(var(--accent))',
      'hsl(var(--dv-success))',
      'hsl(var(--dv-warning))',
      'hsl(234 89% 74%)',
      'hsl(160 90% 40%)',
    ];
    const newParticles = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 40,
      y: 40 + (Math.random() - 0.5) * 20,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.8,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 1500);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[600]">
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 8 * p.scale,
              height: 8 * p.scale,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              background: p.color,
            }}
            initial={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
            animate={{
              opacity: 0,
              y: 200 + Math.random() * 300,
              x: (Math.random() - 0.5) * 300,
              rotate: p.rotation + 720,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
