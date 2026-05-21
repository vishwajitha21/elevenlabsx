import { useRef, useState, useCallback, useMemo } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { useScrambleText } from '@/hooks/useScrambleText';
import MagneticButton from '@/components/MagneticButton';

/* ─── Floating Particles ─── */
function FloatingParticles() {
  const prefersReduced = useReducedMotion();
  const particles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      drift: (Math.random() - 0.5) * 30,
    })), []);

  if (prefersReduced) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: 'hsl(var(--accent))',
            opacity: 0.15,
          }}
          animate={{
            y: [0, -40 - p.drift, 0, 30 + p.drift, 0],
            x: [0, 15, -10, 20, 0],
            opacity: [0.08, 0.2, 0.1, 0.25, 0.08],
            scale: [1, 1.3, 0.8, 1.2, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Typing Cursor ─── */
function TypingCursor({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.span
      className="inline-block ml-0.5"
      style={{ color: 'hsl(var(--accent))' }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'steps(2)' }}
    >
      |
    </motion.span>
  );
}

export default function HeroSection() {
  const prefersReduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  const { display: scrambledText, scramble } = useScrambleText("Everything gated. Nothing hidden. You're in control.", 600);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const charVariants = {
    hidden: { y: '120%', opacity: 0, rotate: 8 },
    visible: (i: number) => ({
      y: '0%',
      opacity: 1,
      rotate: 0,
      transition: {
        delay: i * 0.025,
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    }),
  };

  const line1 = "Consent-chained";
  const line2 = "agent workflows.";

  const splitText = (text: string, baseDelay: number, charStyle?: React.CSSProperties) =>
    text.split('').map((char, i) => (
      <motion.span
        key={i}
        className="hero-char inline-block"
        variants={charVariants}
        custom={baseDelay + i}
        onAnimationComplete={char === '.' && text === line2 ? () => { setRevealed(true); scramble(); } : undefined}
        style={{ display: 'inline-block', ...charStyle }}
      >
        {char === ' ' ? '\u00A0' : char}
      </motion.span>
    ));

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0 },
    },
  };

  /* ─── Mouse-follow gradient glow ─── */
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const gradientX = useSpring(useTransform(mouseX, [0, 1], [20, 80]), { stiffness: 50, damping: 20 });
  const gradientY = useSpring(useTransform(mouseY, [0, 1], [20, 80]), { stiffness: 50, damping: 20 });
  const gradientLeft = useTransform(gradientX, (v) => `${v}%`);
  const gradientTop = useTransform(gradientY, (v) => `${v}%`);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (prefersReduced || !sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }, [prefersReduced, mouseX, mouseY]);

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="min-h-svh flex flex-col justify-center relative overflow-hidden"
      style={{ padding: '80px clamp(16px, 4vw, 80px) 48px' }}
    >
      {/* Floating particles */}
      <FloatingParticles />

      {/* Parallax dot grid */}
      <motion.div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          y: bgY,
          backgroundImage: `radial-gradient(circle, hsl(var(--ink)) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Mouse-follow gradient orb */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06] blur-[150px] pointer-events-none"
        style={{
          background: 'hsl(var(--accent))',
          left: gradientLeft,
          top: gradientTop,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[120px]"
        style={{ background: 'hsl(var(--accent))', top: '5%', right: '-10%', y: bgY }}
        animate={!prefersReduced ? { scale: [1, 1.2, 1], rotate: [0, 90, 0] } : {}}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[100px]"
        style={{ background: 'hsl(var(--accent))', bottom: '20%', left: '-5%', y: bgY }}
        animate={!prefersReduced ? { scale: [1.2, 1, 1.2] } : {}}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear', delay: 3 }}
      />

      <motion.div className="relative z-10 max-w-[1280px]" style={{ opacity }}>
        {/* Overline badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-8"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
        >
          <motion.div
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: 'hsl(var(--dv-success))' }}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>
            Token Vault · CIBA · Step-up Auth
          </span>
        </motion.div>

        {/* Hero headline with gradient */}
        <h1
          className="font-display leading-[1.05] mb-6 overflow-hidden"
          style={{ fontSize: 'clamp(2.4rem, 7vw, 6rem)' }}
        >
          <motion.div
            className="overflow-hidden block"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {splitText(line1, 0, {
              background: 'linear-gradient(135deg, hsl(var(--ink)) 0%, hsl(var(--ink-secondary)) 50%, hsl(var(--ink)) 100%)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            })}
          </motion.div>
          <motion.div
            className="overflow-hidden block"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {splitText(line2, line1.length + 5, {
              background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--accent-light)) 40%, hsl(var(--accent)) 100%)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradient-shift 6s ease-in-out infinite',
            })}
          </motion.div>
        </h1>

        {/* Sub-headline scramble with typing cursor */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-sm md:text-base mb-10 max-w-[520px]"
          style={{ color: 'hsl(var(--ink-tertiary))', lineHeight: 1.7 }}
        >
          {scrambledText}
          <TypingCursor active={revealed} />
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={revealed ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex flex-wrap gap-4 items-center"
        >
          <MagneticButton onClick={() => window.location.href = '/dashboard?tour=true'}>Start free →</MagneticButton>
          <motion.button
            onClick={() => window.location.href = '/dashboard?tour=true'}
            className="font-body text-sm flex items-center gap-2 border px-4 py-2.5 rounded-xl transition-all"
            style={{ 
              borderColor: 'hsl(var(--border))', 
              background: 'hsl(var(--bg-surface))',
              color: 'hsl(var(--ink-secondary))' 
            }}
            whileHover={{ 
              borderColor: 'hsl(var(--accent))', 
              color: 'hsl(var(--accent))',
              boxShadow: '0 4px 12px hsl(var(--accent) / 0.1)'
            }}
          >
            Take the Tour
            <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>🎯</motion.span>
          </motion.button>
          <motion.a
            href="#features"
            className="font-body text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            whileHover={{ color: 'hsl(var(--ink))', x: 2 }}
          >
            See how it works
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </motion.a>
        </motion.div>

        {/* Trust indicators with stagger-in */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={revealed ? { opacity: 1 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-wrap gap-6 mt-12"
        >
          {[
            { icon: '🔒', text: 'No credentials stored' },
            { icon: '⏱', text: '24h auto-expiry' },
            { icon: '✓', text: 'Revoke in < 200ms' },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{
                borderColor: 'hsl(var(--border))',
                background: 'hsl(var(--bg-surface))',
              }}
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={revealed ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{
                delay: 0.35 + i * 0.1,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
              }}
              whileHover={{
                borderColor: 'hsl(var(--accent))',
                y: -2,
                boxShadow: '0 4px 12px hsl(var(--accent) / 0.08)',
              }}
            >
              <motion.span
                className="text-sm"
                animate={revealed ? { scale: [1, 1.2, 1] } : {}}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
              >
                {item.icon}
              </motion.span>
              <span className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>{item.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={revealed ? { opacity: 1 } : {}}
        transition={{ delay: 0.8 }}
      >
        <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>scroll</span>
        <motion.div
          className="w-[1px] h-8"
          style={{ background: 'hsl(var(--border))' }}
          animate={{ scaleY: [0, 1, 0], originY: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Gradient animation keyframes */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
}
