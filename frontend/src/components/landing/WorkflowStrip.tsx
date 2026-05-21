import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const steps = [
  { num: '01', name: 'Read brief', service: 'Gmail read', token: 'Token Vault' },
  { num: '02', name: 'AI drafts', service: 'Groq Llama', token: 'No token' },
  { num: '03', name: 'Delegate', service: 'Mentor', token: 'CIBA async' },
  { num: '04', name: 'Approve & send', service: 'Gmail send', token: 'Step-up' },
  { num: '05', name: 'Kickoff', service: 'GitHub repo', token: 'Token Vault' },
];

export default function WorkflowStrip() {
  const [activeStep, setActiveStep] = useState(-1);
  const [stepStates, setStepStates] = useState<string[]>(Array(5).fill('idle'));
  const [isPaused, setIsPaused] = useState(false);
  const prefersReduced = useReducedMotion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getStatusText = (idx: number) => {
    const state = stepStates[idx];
    if (state === 'idle') return 'Pending';
    if (state === 'active') return 'Active';
    if (state === 'waiting') return 'Waiting for mentor...';
    if (state === 'step-up') return 'Step-up auth required';
    if (state === 'done') return 'Done ✓';
    return 'Pending';
  };

  const getStatusColor = (idx: number) => {
    const state = stepStates[idx];
    if (state === 'done') return 'hsl(var(--dv-success))';
    if (state === 'active') return 'hsl(var(--accent))';
    if (state === 'waiting' || state === 'step-up') return 'hsl(var(--dv-warning))';
    return 'hsl(var(--ink-tertiary))';
  };

  /* Particle trail data between steps */
  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      offset: Math.random() * 0.6 + 0.2,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 0.4,
    })), []);

  /* Animation loop */
  useEffect(() => {
    if (prefersReduced || isPaused) return;
    let i = 0;
    const tick = () => {
      if (i > 5) {
        i = 0;
        setActiveStep(-1);
        setStepStates(Array(5).fill('idle'));
        return;
      }
      setActiveStep(i);
      setStepStates(prev => {
        const next = [...prev];
        if (i > 0) next[i - 1] = 'done';
        if (i < 5) {
          if (i === 2) next[i] = 'waiting';
          else if (i === 3) next[i] = 'step-up';
          else next[i] = 'active';
        }
        return next;
      });
      if (i === 2) setTimeout(() => setStepStates(prev => { const n = [...prev]; n[2] = 'done'; return n; }), 800);
      if (i === 3) setTimeout(() => setStepStates(prev => { const n = [...prev]; n[3] = 'done'; return n; }), 800);
      i++;
    };
    intervalRef.current = setInterval(tick, 1200);
    tick();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [prefersReduced, isPaused]);

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  return (
    <section
      className="py-8 md:py-12 overflow-hidden px-4 md:px-8"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Paused indicator */}
      <motion.div
        className="flex justify-center mb-4"
        animate={{ opacity: isPaused ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}>
          ⏸ Paused — hover to resume
        </span>
      </motion.div>

      {/* Mobile: horizontal scroll */}
      <div
        className="flex gap-3 md:gap-4 items-center overflow-x-auto pb-4 md:pb-0 md:overflow-visible md:justify-center snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-3 snap-start flex-shrink-0">
            <motion.div
              className="w-[160px] md:w-[200px] h-[120px] md:h-[140px] rounded-[10px] border p-3 md:p-4 flex flex-col justify-between relative overflow-hidden"
              style={{
                background: 'hsl(var(--bg-surface))',
                borderTopColor: stepStates[idx] === 'active' ? 'hsl(var(--accent))' : stepStates[idx] === 'done' ? 'hsl(var(--dv-success) / 0.3)' : 'hsl(var(--border))',
                borderRightColor: stepStates[idx] === 'active' ? 'hsl(var(--accent))' : stepStates[idx] === 'done' ? 'hsl(var(--dv-success) / 0.3)' : 'hsl(var(--border))',
                borderBottomColor: stepStates[idx] === 'active' ? 'hsl(var(--accent))' : stepStates[idx] === 'done' ? 'hsl(var(--dv-success) / 0.3)' : 'hsl(var(--border))',
                borderLeftWidth: activeStep === idx ? 3 : 1,
                borderLeftColor: activeStep === idx ? 'hsl(var(--accent))' : stepStates[idx] === 'done' ? 'hsl(var(--dv-success) / 0.3)' : 'hsl(var(--border))',
                transition: 'border 200ms ease',
                willChange: 'transform, box-shadow',
              }}
              whileHover={{ scale: 1.03, y: -4 }}
              animate={{
                boxShadow: activeStep === idx
                  ? '0 0 20px hsl(var(--accent) / 0.12), 0 4px 16px hsl(var(--accent) / 0.06)'
                  : stepStates[idx] === 'done'
                    ? '0 0 12px hsl(var(--dv-success) / 0.06)'
                    : '0 1px 2px rgba(0,0,0,0.02)',
              }}
              transition={{ boxShadow: { duration: 0.3 } }}
            >
              {/* Pulsing glow effect for active step */}
              {activeStep === idx && (
                <motion.div
                  className="absolute top-0 left-0 w-full h-full rounded-[10px] pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at 0% 50%, hsl(var(--accent) / 0.08), transparent 70%)',
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Active indicator dot */}
              <motion.div
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{
                  background: stepStates[idx] === 'active'
                    ? 'hsl(var(--accent))'
                    : stepStates[idx] === 'done'
                      ? 'hsl(var(--dv-success))'
                      : stepStates[idx] === 'waiting' || stepStates[idx] === 'step-up'
                        ? 'hsl(var(--dv-warning))'
                        : 'transparent',
                }}
                animate={{
                  scale: stepStates[idx] === 'active' ? [1, 1.3, 1] : 1,
                  opacity: stepStates[idx] !== 'idle' ? [0.7, 1, 0.7] : 0,
                }}
                transition={{ duration: 1, repeat: Infinity }}
              />

              <div className="flex justify-between items-start relative z-10">
                <span className="font-mono text-[10px] md:text-[11px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.num}</span>
              </div>
              <span className="font-body text-xs md:text-sm font-semibold relative z-10" style={{ color: 'hsl(var(--ink))' }}>{step.name}</span>
              <span className="text-[10px] md:text-xs font-body relative z-10" style={{ color: getStatusColor(idx), transition: 'color 200ms ease' }}>
                {getStatusText(idx)}
              </span>
              <span
                className="font-mono text-[9px] md:text-[10px] border rounded-full px-2 py-0.5 inline-block w-fit relative z-10"
                style={{
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--ink-tertiary))',
                  boxShadow: activeStep === idx ? '0 0 0 3px hsl(var(--accent) / 0.2)' : 'none',
                  transition: 'box-shadow 200ms ease',
                }}
              >
                {step.token}
              </span>
            </motion.div>

            {/* Connector with particle trail */}
            {idx < steps.length - 1 && (
              <div className="hidden md:flex flex-col items-center gap-0 flex-shrink-0 w-12">
                <svg width="48" height="20" className="overflow-visible">
                  <motion.path
                    d="M0 10 C8 0, 40 20, 48 10"
                    fill="none"
                    stroke={activeStep > idx ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                    strokeWidth="1"
                    style={{ transition: 'stroke 400ms ease' }}
                  />
                  {/* Particle trail animation */}
                  {activeStep > idx && !isPaused && particles.slice(0, 4).map((p) => (
                    <motion.circle
                      key={p.id}
                      r={p.size * 0.5}
                      fill="hsl(var(--accent))"
                      initial={{ opacity: 0 }}
                      animate={{
                        cx: [0, 48],
                        cy: [10, 10],
                        opacity: [0, 0.6, 0],
                      }}
                      transition={{
                        duration: 1.2,
                        delay: p.delay,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                  ))}
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </section>
  );
}
