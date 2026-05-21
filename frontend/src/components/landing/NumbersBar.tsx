import { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';

const stats = [
  { value: 99.9, suffix: '%', label: 'Uptime SLA', description: 'With auto-reconnect and health checks' },
  { value: 200, suffix: 'ms', label: 'Token revocation', description: 'Average across all providers' },
  { value: 0, suffix: '', label: 'Credentials stored', description: 'Reference IDs only — never passwords', isSpecial: true, specialValue: 'ZERO' },
  { value: 5, suffix: '', label: 'AI providers', description: 'Free tier waterfall with fallback' },
];

export default function NumbersBar() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const inView = useInView(sectionRef, { once: true, margin: '-40px' });
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (prefersReduced || !sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="py-12 md:py-16 relative overflow-hidden px-4 md:px-8"
    >
      {/* Animated background gradient that follows mouse */}
      {!prefersReduced && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(600px circle at var(--mx, 50%) hsl(var(--accent) / 0.03), transparent 70%)',
          }}
          animate={{ '--mx': `${mousePos.x}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      <div className="max-w-[1280px] mx-auto">
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="border rounded-xl p-5 md:p-6 text-center relative overflow-hidden group cursor-default"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={inView || prefersReduced ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{
                delay: 0.1 + i * 0.08,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
              }}
              whileHover={{
                borderColor: 'hsl(var(--accent))',
                y: -4,
                boxShadow: '0 8px 24px hsl(var(--accent) / 0.06)',
                transition: { duration: 0.2 },
              }}
            >
              {/* Hover glow effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
                style={{
                  background: 'radial-gradient(circle at center, hsl(var(--accent) / 0.06), transparent 70%)',
                }}
              />

              <div className="relative z-10">
                {/* Number */}
                <div className="font-display text-3xl md:text-4xl font-bold mb-1" style={{ color: 'hsl(--ink)' }}>
                  {stat.isSpecial ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={inView ? { opacity: 1 } : {}}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                    >
                      {stat.specialValue}
                    </motion.span>
                  ) : (
                    <CountUpNumber value={stat.value} delay={0.2 + i * 0.1} />
                  )}
                  <span className="text-lg md:text-xl font-body font-medium" style={{ color: 'hsl(--accent)' }}>
                    {stat.suffix}
                  </span>
                </div>

                {/* Label */}
                <div className="font-body text-sm font-medium mb-1" style={{ color: 'hsl(--ink)' }}>
                  {stat.label}
                </div>

                {/* Description */}
                <p className="font-body text-[11px] md:text-xs" style={{ color: 'hsl(--ink-tertiary)' }}>
                  {stat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CountUpNumber({ value, delay }: { value: number; delay: number }) {
  const { ref, value: counted } = useCountUp(value, delay * 1000);

  return (
    <span ref={ref} className="tabular-nums">
      {counted}
    </span>
  );
}
