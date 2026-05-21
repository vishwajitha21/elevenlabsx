import { useRef, useEffect, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

function useInView(ref: React.RefObject<HTMLElement>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

export default function BentoGrid() {
  const prefersReduced = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null!);
  const inView = useInView(sectionRef);

  const cardMotion = (i: number) => prefersReduced ? {} : {
    initial: { y: 60, opacity: 0, scale: 0.96 },
    animate: inView ? { y: 0, opacity: 1, scale: 1 } : {},
    transition: { delay: 0.15 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  const headingText = "Built to protect every send.";

  const charVariants = {
    hidden: { y: '100%', opacity: 0, rotate: 5 },
    visible: (i: number) => ({
      y: '0%',
      opacity: 1,
      rotate: 0,
      transition: { delay: i * 0.025, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }),
  };

  return (
    <section ref={sectionRef} className="py-12 md:py-16 lg:py-24 px-4 md:px-8">
      <div className="max-w-[1280px] mx-auto">
        <div className="overflow-hidden mb-8 md:mb-16 text-center">
          <h2 className="text-section font-display" style={{ color: 'hsl(var(--ink))' }}>
            {headingText.split('').map((char, i) => (
              <motion.span
                key={i}
                className="inline-block"
                variants={charVariants}
                initial="hidden"
                animate={inView || prefersReduced ? 'visible' : 'hidden'}
                custom={i}
                style={{ display: 'inline-block' }}
              >
                {char === ' ' ? '\u00A0' : char}
              </motion.span>
            ))}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Row 1 */}
          <motion.div {...cardMotion(0)} className="md:col-span-1 lg:col-span-2">
            <TiltCard><CardA /></TiltCard>
          </motion.div>
          <motion.div {...cardMotion(1)} className="md:col-span-1 lg:col-span-3">
            <TiltCard><CardB /></TiltCard>
          </motion.div>
          {/* Row 2 */}
          <motion.div {...cardMotion(2)} className="lg:col-span-2">
            <TiltCard><CardC /></TiltCard>
          </motion.div>
          <motion.div {...cardMotion(3)} className="lg:col-span-2">
            <TiltCard><CardD /></TiltCard>
          </motion.div>
          <motion.div {...cardMotion(4)} className="lg:col-span-1">
            <TiltCard><CardE /></TiltCard>
          </motion.div>
          {/* Row 3 */}
          <motion.div {...cardMotion(5)} className="md:col-span-2 lg:col-span-5">
            <TiltCard><CardF /></TiltCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── Enhanced 3D Tilt Card Wrapper ─── */
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 });

  /* Glow position follows mouse */
  const glowX = useSpring(useTransform(mouseX, [-0.5, 0.5], [0, 100]), { stiffness: 150, damping: 25 });
  const glowY = useSpring(useTransform(mouseY, [-0.5, 0.5], [0, 100]), { stiffness: 150, damping: 25 });
  const glowXPercent = useTransform(glowX, (v) => `${v}%`);
  const glowYPercent = useTransform(glowY, (v) => `${v}%`);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };
  const handleMouseEnter = () => setIsHovered(true);

  if (prefersReduced) {
    return (
      <div
        ref={ref}
        className="border rounded-xl p-6 md:p-8 h-full transition-colors duration-200 cursor-default"
        style={{ background: 'hsl(var(--bg-surface))', borderColor: 'hsl(var(--border))' }}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        rotateX,
        rotateY,
        perspective: 800,
        background: 'hsl(var(--bg-surface))',
        borderColor: isHovered ? 'hsl(var(--accent))' : 'hsl(var(--border))',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      } as any} // eslint-disable-line @typescript-eslint/no-explicit-any
      animate={{
        boxShadow: isHovered
          ? '0 0 0 1px hsl(var(--accent)), 0 8px 32px hsl(var(--accent) / 0.08), 0 2px 8px hsl(var(--accent) / 0.04)'
          : '0 0 0 1px hsl(var(--border)), 0 1px 2px rgba(0,0,0,0.04)',
      }}
      transition={{ boxShadow: { duration: 0.3 } }}
      whileHover={{ scale: 1.01 }}
      className="border rounded-xl p-6 md:p-8 h-full transition-colors duration-200 cursor-default relative overflow-hidden"
      data-cursor="card"
    >
      {/* Mouse-follow glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0"
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: 'radial-gradient(300px circle at var(--glow-x) var(--glow-y), hsl(var(--accent) / 0.06), transparent 60%)',
        }}
      />
      {/* Floating glow edge */}
      <motion.div
        className="absolute pointer-events-none w-32 h-32 rounded-full blur-[60px] opacity-0"
        animate={{ opacity: isHovered ? 0.15 : 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'hsl(var(--accent))',
          left: glowXPercent,
          top: glowYPercent,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </motion.div>
  );
}

function CardA() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p + 1) % 8), 600);
    return () => clearInterval(interval);
  }, []);
  const timerValue = phase > 4 ? `00:00:0${8 - phase}` : '23:59:58';

  return (
    <div>
      <motion.span
        className="font-mono text-xs inline-flex items-center gap-1.5"
        style={{ color: 'hsl(var(--accent))' }}
        initial={{ opacity: 0, x: -8 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <motion.span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: 'hsl(var(--accent))' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        Token Vault
      </motion.span>
      <h4 className="font-body text-base md:text-lg font-semibold mt-2 mb-2" style={{ color: 'hsl(var(--ink))' }}>No stored passwords. Ever.</h4>
      <p className="font-body text-xs md:text-sm mb-4 md:mb-6" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>Our Token Vault holds every OAuth token in an encrypted store. We see a reference ID. Not your credentials.</p>
      <div className="h-[80px] md:h-[100px] relative overflow-hidden flex items-center gap-4">
        {/* Token */}
        <motion.div className="rounded-md px-3 py-1.5 font-mono text-[10px] text-primary-foreground flex-shrink-0"
          style={{ background: 'hsl(var(--accent))' }}
          animate={{ x: phase < 3 ? phase * 30 : 90, opacity: phase >= 3 && phase < 6 ? 0 : phase >= 6 ? 1 : 1, scale: phase >= 6 ? 0.9 : 1 }}
          transition={{ duration: 0.3 }}
        >tok_a3f8...</motion.div>
        {/* Vault */}
        <div className="absolute right-4 flex flex-col items-center gap-1">
          <motion.div className="w-14 h-10 rounded-lg border-2 flex items-center justify-center"
            style={{ borderColor: phase >= 3 ? 'hsl(var(--accent))' : 'hsl(var(--border))' }}
            animate={{ scale: phase >= 3 && phase < 6 ? [1, 1.05, 1] : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={phase >= 3 ? 'hsl(var(--accent))' : 'hsl(var(--ink-tertiary))'} strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </motion.div>
          <span className="font-mono text-[9px]"
            style={{ color: phase > 5 ? 'hsl(var(--dv-danger))' : 'hsl(var(--ink-tertiary))' }}>{timerValue}</span>
          <AnimatePresence>
            {phase >= 7 && (
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="font-mono text-[9px]" style={{ color: 'hsl(var(--dv-danger))' }}>Expired</motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CardB() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStage(s => (s + 1) % 4), 1200);
    return () => clearInterval(interval);
  }, []);
  return (
    <div>
      <h4 className="font-body text-base md:text-lg font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Your mentor approves first.</h4>
      <p className="font-body text-xs md:text-sm mb-4 md:mb-6" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>One click sends a delegation email. Your mentor reviews and approves — no account required.</p>
      <div className="flex items-center gap-4 md:gap-8 justify-center py-4 relative">
        <motion.div className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono text-xs"
          style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
          animate={{ scale: stage === 0 ? [1, 1.1, 1] : 1 }}>You</motion.div>
        <div className="relative w-16 md:w-20 h-[2px]">
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <line x1="0" y1="1" x2="100%" y2="1" stroke="hsl(var(--border))" strokeDasharray="4 4" />
          </svg>
          <motion.div className="absolute top-1/2 -translate-y-1/2 w-5 h-4 rounded-sm"
            style={{ background: 'hsl(var(--accent))' }}
            animate={{ x: stage >= 1 ? [0, 56] : 0, opacity: stage >= 1 ? 1 : 0 }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <div className="relative">
          <motion.div className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono text-xs"
            animate={{ borderColor: stage >= 2 ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}
            style={{ color: stage >= 2 ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}>M</motion.div>
          <AnimatePresence>
            {stage >= 3 && (
              <motion.span initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap"
                style={{ color: 'hsl(var(--dv-success))' }}>Approved ✓</motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CardC() {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <h4 className="font-body text-base md:text-lg font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Step-up auth before every send.</h4>
      <p className="font-body text-xs md:text-sm mb-4" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>Agent frozen at send. Step-up CIBA fires a push notification to your device.</p>
      <div className="flex justify-center relative h-24">
        <motion.svg width="48" height="72" viewBox="0 0 48 72" fill="none"
          animate={hovered ? { rotate: [-3, 3, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}>
          <rect x="4" y="2" width="40" height="68" rx="8" stroke="hsl(var(--ink-secondary))" strokeWidth="1.5" fill="hsl(var(--bg-surface))" />
          <rect x="8" y="10" width="32" height="48" rx="2" fill="hsl(var(--bg-primary))" />
          <line x1="18" y1="64" x2="30" y2="64" stroke="hsl(var(--ink-secondary))" strokeWidth="1.5" strokeLinecap="round" />
        </motion.svg>
        <motion.div className="absolute -top-1 right-[38%] w-2.5 h-2.5 rounded-full"
          style={{ background: 'hsl(var(--dv-danger))' }}
          animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.6, repeat: Infinity }} />
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ y: -20, opacity: 0, scale: 0.9 }} animate={{ y: -55, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute top-0 left-1/2 -translate-x-1/2 border rounded-xl p-3 text-[10px] font-body w-[180px] z-10"
              style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              <div className="font-semibold text-[11px] mb-1" style={{ color: 'hsl(var(--ink))' }}>Push notification</div>
              DeliverVault wants to send to client@email.com
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 rounded-md text-[9px] font-medium" style={{ background: 'hsl(var(--dv-success))', color: 'white' }}>Approve</span>
                <span className="px-2 py-1 rounded-md text-[9px] font-medium" style={{ background: 'hsl(var(--dv-danger))', color: 'white' }}>Deny</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CardD() {
  const lines = [
    { text: '[10:42:31] gmail_read · issued · 24h', color: 'hsl(var(--dv-success))' },
    { text: '[10:42:45] brief_parsed · 847 tokens', color: 'hsl(var(--ink-secondary))' },
    { text: '[10:43:02] delegation_sent · mentor', color: 'hsl(var(--dv-warning))' },
    { text: '[10:43:18] step_up_auth · requested', color: 'hsl(var(--dv-warning))' },
    { text: '[10:43:24] gmail_send · approved', color: 'hsl(var(--dv-success))' },
    { text: '[10:43:25] github_repo · created', color: 'hsl(var(--dv-success))' },
  ];
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    if (visibleCount < lines.length) {
      const t = setTimeout(() => setVisibleCount(c => c + 1), 350);
      return () => clearTimeout(t);
    }
    const reset = setTimeout(() => setVisibleCount(0), 2000);
    return () => clearTimeout(reset);
  }, [visibleCount]);
  return (
    <div>
      <h4 className="font-body text-base md:text-lg font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Full audit log. Always.</h4>
      <p className="font-body text-xs md:text-sm mb-4" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>Every token, every action, every revocation. Timestamped. Exportable.</p>
      <div className="space-y-1.5 font-mono text-[10px] md:text-[11px] min-h-[120px]">
        <AnimatePresence>
          {lines.slice(0, visibleCount).map((line, i) => (
            <motion.div key={`${i}-${visibleCount > lines.length ? 'r' : 'a'}`}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: line.color }} />
              <span style={{ color: line.color }}>{line.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CardE() {
  const [revoked, setRevoked] = useState(false);
  useEffect(() => { if (revoked) { const t = setTimeout(() => setRevoked(false), 3000); return () => clearTimeout(t); } }, [revoked]);
  return (
    <div>
      <h4 className="font-body text-base md:text-lg font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Revoke instantly.</h4>
      <p className="font-body text-xs md:text-sm mb-4" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>Token gone in &lt;200ms.</p>
      <div className="border rounded-lg p-3" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
        <div className="font-body text-xs mb-2" style={{ color: 'hsl(var(--ink))', textDecoration: revoked ? 'line-through' : 'none', transition: 'text-decoration 300ms' }}>
          Step 4 · Gmail send
        </div>
        <AnimatePresence mode="wait">
          {revoked ? (
            <motion.span key="revoked" initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -10, opacity: 0 }}
              className="text-[10px] font-body px-2 py-0.5 rounded-full inline-block"
              style={{ background: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))' }}>Revoked</motion.span>
          ) : (
            <motion.span key="active" initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 10, opacity: 0 }}
              className="text-[10px] font-body px-2 py-0.5 rounded-full inline-block"
              style={{ background: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' }}>Active</motion.span>
          )}
        </AnimatePresence>
        <motion.button onClick={() => setRevoked(true)}
          className="block mt-3 font-body text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'hsl(var(--dv-danger))', color: 'hsl(var(--dv-danger))' }}
          whileHover={{ scale: 1.03, boxShadow: '0 0 0 3px hsl(var(--dv-danger) / 0.15)' }}
          whileTap={{ scale: 0.97 }}
        >Revoke</motion.button>
      </div>
    </div>
  );
}

function CardF() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
      <div>
        <h4 className="font-body text-base md:text-lg font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Works everywhere. Install it.</h4>
        <p className="font-body text-xs md:text-sm mb-4" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>DeliverVault is a PWA. Browser or homescreen — same experience.</p>
        <motion.button className="font-body text-sm border rounded-lg px-4 py-2"
          style={{ borderColor: 'hsl(var(--ink))', color: 'hsl(var(--ink))' }}
          whileHover={{ scale: 1.02, boxShadow: '0 4px 16px hsl(var(--ink) / 0.08)' }}
          whileTap={{ scale: 0.98 }}>Install as app →</motion.button>
      </div>
      <div className="flex items-end justify-center gap-3 md:gap-4">
        {[{ w: 100, h: 68 }, { w: 68, h: 52 }, { w: 40, h: 60 }].map((d, i) => (
          <motion.div key={i}
            initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="border rounded-lg overflow-hidden cursor-pointer"
            style={{ width: d.w, height: d.h, borderColor: 'hsl(var(--border))' }}>
            <div className="w-full h-2.5 border-b flex items-center px-1 gap-0.5" style={{ borderColor: 'hsl(var(--border))' }}>
              {[0,1,2].map(j => <div key={j} className="w-1 h-1 rounded-full" style={{ background: 'hsl(var(--border))' }} />)}
            </div>
            <div className="p-1.5 space-y-1">
              <div className="h-1 rounded-full w-2/3" style={{ background: 'hsl(var(--border))' }} />
              <div className="h-1 rounded-full w-1/2" style={{ background: 'hsl(var(--border))' }} />
              <div className="h-1 rounded-full w-1/3" style={{ background: 'hsl(var(--accent) / 0.3)' }} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
