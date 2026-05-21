import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'logo' | 'fill' | 'text' | 'particles' | 'reveal' | 'done';

export default function PageLoader() {
  const [phase, setPhase] = useState<Phase>('logo');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('fill'), 300),
      setTimeout(() => setPhase('text'), 700),
      setTimeout(() => setPhase('particles'), 1100),
      setTimeout(() => setPhase('reveal'), 1600),
      setTimeout(() => setPhase('done'), 2300),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === 'done') return null;

  const phaseIdx = ['logo', 'fill', 'text', 'particles', 'reveal'].indexOf(phase);

  return (
    <AnimatePresence>
      <motion.div key="loader" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{
          background: 'hsl(var(--bg-primary))',
          clipPath: phase === 'reveal' ? 'circle(150% at 50% 50%)' : 'circle(100% at 50% 50%)',
        }}>
        
        {/* Radial pulse rings */}
        {phaseIdx >= 3 && [0, 1, 2].map(i => (
          <motion.div key={i} className="absolute rounded-full border"
            style={{ borderColor: 'hsl(var(--accent) / 0.15)' }}
            initial={{ width: 80, height: 80, opacity: 0.6 }}
            animate={{ width: 300 + i * 100, height: 300 + i * 100, opacity: 0 }}
            transition={{ duration: 1.2, delay: i * 0.15, ease: 'easeOut' }}
          />
        ))}

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo box */}
          <motion.div className="relative"
            initial={{ scale: 0, rotate: -180 }}
            animate={
              phaseIdx < 4
                ? { scale: 1, rotate: 0 }
                : { scale: 2, opacity: 0 }
            }
            transition={
              phaseIdx < 1
                ? { duration: 0.4, type: 'spring', stiffness: 200, damping: 15 }
                : phaseIdx >= 4
                ? { duration: 0.5, ease: [0.76, 0, 0.24, 1] }
                : {}
            }
          >
            <div className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center overflow-hidden relative"
              style={{ borderColor: 'hsl(var(--accent))', background: 'hsl(var(--bg-surface))' }}>
              {/* Fill sweep */}
              <motion.div className="absolute inset-0" style={{ background: 'hsl(var(--accent))' }}
                initial={{ clipPath: 'inset(100% 0 0 0)' }}
                animate={phaseIdx >= 1 ? { clipPath: 'inset(0% 0 0 0)' } : {}}
                transition={{ duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
              />
              {/* DV text */}
              <motion.span className="relative z-10 font-display text-3xl tracking-tight select-none"
                style={{ color: 'hsl(var(--ink))' }}
                animate={phaseIdx >= 1 ? { color: '#ffffff' } : {}}
                transition={{ duration: 0.3, delay: 0.1 }}
              >DV</motion.span>
            </div>

            {/* Corner accent dots */}
            {phaseIdx >= 2 && [
              { x: -40, y: -40 }, { x: 40, y: -40 }, { x: -40, y: 40 }, { x: 40, y: 40 },
              { x: 0, y: -50 }, { x: 0, y: 50 }, { x: -50, y: 0 }, { x: 50, y: 0 },
            ].map((pos, i) => (
              <motion.div key={i} className="absolute w-1 h-1 rounded-full"
                style={{ background: 'hsl(var(--accent))', top: '50%', left: '50%' }}
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], x: pos.x, y: pos.y }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
              />
            ))}
          </motion.div>

          {/* Brand name with stagger */}
          <motion.div className="flex gap-[2px] mt-5 overflow-hidden">
            {'DeliverVault'.split('').map((char, i) => (
              <motion.span key={i} className="font-display text-sm tracking-wider select-none"
                style={{ color: 'hsl(var(--ink-tertiary))' }}
                initial={{ y: 20, opacity: 0 }}
                animate={phaseIdx >= 2 ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.03 * i, duration: 0.3 }}
              >{char}</motion.span>
            ))}
          </motion.div>

          {/* Progress bar */}
          <motion.div className="w-28 h-[2px] rounded-full mt-4 overflow-hidden"
            style={{ background: 'hsl(var(--border))' }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={phaseIdx >= 1 ? { opacity: 1, scaleX: 1 } : {}}
            transition={{ duration: 0.3 }}
          >
            <motion.div className="h-full rounded-full" style={{ background: 'hsl(var(--accent))' }}
              initial={{ width: '0%' }}
              animate={{ width: phaseIdx >= 3 ? '100%' : phaseIdx >= 2 ? '60%' : '20%' }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
