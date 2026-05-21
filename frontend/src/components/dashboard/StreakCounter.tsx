import { motion } from 'framer-motion';

export default function StreakCounter({ streak }: { streak: number }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.span className="text-lg"
        animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
        transition={{ duration: 0.5, delay: 0.5 }}>
        🔥
      </motion.span>
      <div>
        <motion.span
          key={streak}
          className="font-display text-lg block leading-none"
          style={{ color: 'hsl(var(--accent))' }}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          {streak}
        </motion.span>
        <span className="font-body text-[9px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>day streak</span>
      </div>
    </motion.div>
  );
}
