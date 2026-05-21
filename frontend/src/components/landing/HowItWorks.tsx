import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const panels = [
  {
    num: '01',
    title: 'Read brief',
    desc: 'Your agent reads the client brief from Gmail using a scoped Token Vault credential. Read-only. Time-limited. Revocable.',
    badges: ['gmail.readonly', 'Token Vault'],
  },
  {
    num: '02',
    title: 'AI drafts',
    desc: "Groq's Llama-3.1 drafts a proposal based on the parsed brief. No external token needed — inference stays local.",
    badges: ['groq.inference'],
  },
  {
    num: '03',
    title: 'Delegate',
    desc: 'The agent sends a review link to your mentor via CIBA. Agent freezes until mentor responds. No account needed.',
    badges: ['ciba.delegate', 'CIBA async'],
  },
  {
    num: '04',
    title: 'Approve & send',
    desc: 'A push notification is sent to your device for step-up verification. No confirmation = no send. The agent stays frozen.',
    badges: ['gmail.send', 'Step-up auth'],
  },
  {
    num: '05',
    title: 'Project kickoff',
    desc: 'A GitHub repo is created with issues, milestones, and timelines. All via Token Vault OAuth scopes.',
    badges: ['repo.create', 'Token Vault'],
  },
];

export default function HowItWorks() {
  const prefersReduced = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.05 });
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={sectionRef}>
      <div className="py-16 md:py-8 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <motion.span
            className="font-mono text-xs block mb-4"
            style={{ color: 'hsl(var(--ink-tertiary))' }}
            initial={{ opacity: 0, y: 12 }}
            animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            Process
          </motion.span>
          <motion.h2
            className="text-section font-display mb-8 lg:mb-0"
            style={{ color: 'hsl(var(--ink))' }}
            initial={{ opacity: 0, y: 20 }}
            animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          >
            5 steps. You control every one.
          </motion.h2>
        </div>
      </div>

      {isDesktop && !prefersReduced ? <HorizontalScroll /> : <VerticalAccordion prefersReduced={prefersReduced} />}
    </section>
  );
}

/* ─── Desktop: GSAP Horizontal Pin Scroll ─── */
function HorizontalScroll() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const prefersReduced = useReducedMotion();

  useGSAP(() => {
    if (prefersReduced) return;

    const sections = gsap.utils.toArray('.panel-card');
    const totalWidth = (sections.length - 1) * 100;

    gsap.to(sections, {
      xPercent: -totalWidth,
      ease: 'none',
      scrollTrigger: {
        trigger: triggerRef.current,
        pin: true,
        scrub: 1.2,
        snap: 1 / (sections.length - 1),
        start: 'top top',
        end: () => `+=${triggerRef.current?.offsetWidth || 3000}`,
        onUpdate: (self) => {
          const idx = Math.round(self.progress * (sections.length - 1));
          setActiveIdx(idx);
        },
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, { scope: triggerRef, dependencies: [prefersReduced] });

  const scrollTo = (idx: number) => {
    const st = ScrollTrigger.getById('how-it-works-st') || ScrollTrigger.getAll().find(t => t.trigger === triggerRef.current);
    if (!st) return;
    const progress = idx / (panels.length - 1);
    const scrollPos = st.start + (st.end - st.start) * progress;
    window.scrollTo({ top: scrollPos, behavior: 'smooth' });
  };

  return (
    <div ref={triggerRef} className="relative w-full overflow-hidden" style={{ background: 'hsl(var(--bg-primary))' }}>
      <div className="relative min-h-screen flex items-center">
        {/* Scroll progress bar */}
        <ScrollProgressBar activeIdx={activeIdx} />

        {/* Floating background num */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={activeIdx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="font-display text-[40vw] leading-none"
              style={{ color: 'hsl(var(--ink))' }}
            >
              {panels[activeIdx].num}
            </motion.span>
          </AnimatePresence>
        </div>

        <div ref={trackRef} className="flex flex-nowrap w-full h-full items-center">
          {panels.map((panel, idx) => (
            <div
              key={idx}
              className="panel-card flex-shrink-0 w-screen h-full flex items-center justify-center px-12 md:px-20"
            >
              <div className="grid grid-cols-2 gap-16 max-w-[1280px] w-full items-center">
                {/* Left content */}
                <div className="relative">
                  <div className="relative z-10">
                    <motion.span
                      className="font-mono text-xs block mb-3"
                      style={{ color: 'hsl(var(--accent))' }}
                      animate={activeIdx === idx ? { opacity: 1, y: 0 } : { opacity: 0.4, y: 5 }}
                      transition={{ duration: 0.4 }}
                    >
                      Step {panel.num}
                    </motion.span>
                    <motion.h3
                      className="font-display text-5xl mb-4"
                      style={{ color: 'hsl(var(--ink))' }}
                      animate={activeIdx === idx ? { opacity: 1, x: 0 } : { opacity: 0.5, x: -10 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                      {panel.title}
                    </motion.h3>
                    <motion.p
                      className="font-body text-base mb-6 max-w-[400px]"
                      style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}
                      animate={activeIdx === idx ? { opacity: 1 } : { opacity: 0.3 }}
                      transition={{ duration: 0.5 }}
                    >
                      {panel.desc}
                    </motion.p>
                    <div className="flex flex-wrap gap-2">
                      {panel.badges.map(b => (
                        <motion.span
                          key={b}
                          className="font-mono text-[10px] border rounded-full px-3 py-1"
                          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}
                          animate={activeIdx === idx ? { opacity: 1, scale: 1 } : { opacity: 0.4, scale: 0.95 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          {b}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right illustration */}
                <div className="flex items-center justify-center">
                  <StepIllustration step={idx} active={activeIdx === idx} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Magnetic progress dots */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-4 z-30">
          {panels.map((_, idx) => (
            <MagneticDot
              key={idx}
              idx={idx}
              active={idx === activeIdx}
              passed={idx < activeIdx}
              onClick={() => scrollTo(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Scroll Progress Bar ─── */
function ScrollProgressBar({ activeIdx }: { activeIdx: number }) {
  const progress = ((activeIdx + 1) / panels.length) * 100;

  return (
    <div className="absolute top-0 left-0 right-0 h-[2px] z-20" style={{ background: 'hsl(var(--border))' }}>
      <motion.div
        className="h-full"
        style={{ background: 'hsl(var(--accent))' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      />
    </div>
  );
}

/* ─── Magnetic Navigation Dot ─── */
function MagneticDot({ idx, active, passed, onClick }: { idx: number; active: boolean; passed: boolean; onClick: () => void }) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 400, damping: 25 });
  const springY = useSpring(y, { stiffness: 400, damping: 25 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (prefersReduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    x.set(dx * 0.3);
    y.set(dy * 0.3);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      className="rounded-full cursor-pointer relative overflow-hidden"
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        width: active ? 32 : 10,
        height: active ? 10 : 10,
        background: active
          ? 'hsl(var(--accent))'
          : passed
            ? 'hsl(var(--accent) / 0.4)'
            : 'hsl(var(--border))',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
    >
      {/* Pulsing glow on active */}
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'hsl(var(--accent))' }}
          animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}

/* ─── Mobile/Tablet: Vertical Accordion ─── */
function VerticalAccordion({ prefersReduced }: { prefersReduced: boolean | null }) {
  const [openPanel, setOpenPanel] = useState<number | null>(0);

  return (
    <div className="pb-16 md:pb-24 px-4 md:px-8">
      <div className="max-w-[1280px] mx-auto space-y-0">
        {panels.map((panel, idx) => {
          const isOpen = openPanel === idx;
          return (
            <motion.div
              key={idx}
              className="border-b"
              style={{ borderColor: 'hsl(var(--border))' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.5 }}
            >
              <button
                onClick={() => setOpenPanel(isOpen ? null : idx)}
                className="w-full flex items-center justify-between py-5 md:py-6 text-left group"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <motion.span
                    className="font-mono text-xs md:text-sm"
                    style={{ color: isOpen ? 'hsl(var(--accent))' : 'hsl(var(--ink-tertiary))' }}
                    animate={{ scale: isOpen ? 1.1 : 1 }}
                  >
                    {panel.num}
                  </motion.span>
                  <span className="font-body text-base md:text-lg font-semibold" style={{ color: 'hsl(var(--ink))' }}>{panel.title}</span>
                </div>
                <motion.svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <path d="M4 6L8 10L12 6" stroke="hsl(var(--ink-tertiary))" strokeWidth="1.5" strokeLinecap="round" />
                </motion.svg>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                    style={{ willChange: 'height, opacity' }}
                  >
                    <div className="pb-6 md:pb-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      <div>
                        <p className="font-body text-sm mb-4" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>{panel.desc}</p>
                        <div className="flex flex-wrap gap-2">
                          {panel.badges.map(b => (
                            <span key={b} className="font-mono text-[10px] border rounded-full px-2 py-0.5" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                      <StepIllustration step={idx} active={true} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step Illustrations ─── */
function StepIllustration({ step, active }: { step: number; active: boolean }) {
  if (step === 0) return <EnvelopeIllustration active={active} />;
  if (step === 1) return <TypewriterIllustration active={active} />;
  if (step === 2) return <HandoffIllustration active={active} />;
  if (step === 3) return <PhoneIllustration active={active} />;
  return <RepoIllustration active={active} />;
}

function EnvelopeIllustration({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <motion.svg width="120" height="90" viewBox="0 0 120 90" fill="none" animate={active ? { scale: 1 } : { scale: 0.9 }}>
        <motion.rect x="6" y="18" width="108" height="66" rx="6"
          stroke="hsl(var(--ink-secondary))" strokeWidth="1.5"
          fill="hsl(var(--bg-surface))" />
        <motion.path
          d="M6 18L60 54L114 18"
          stroke="hsl(var(--accent))"
          strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          animate={active ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        <motion.rect x="30" y="40" width="60" height="4" rx="2" fill="hsl(var(--border))"
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.6 }}
        />
        <motion.rect x="30" y="50" width="40" height="4" rx="2" fill="hsl(var(--border))"
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.8 }}
        />
      </motion.svg>
      <motion.span className="font-mono text-[10px] px-2 py-1 border rounded-full"
        style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ delay: 1 }}
      >
        Token Vault · gmail.readonly
      </motion.span>
    </div>
  );
}

function TypewriterIllustration({ active }: { active: boolean }) {
  const text = "Dear Client,\nThank you for...";
  const [chars, setChars] = useState(0);

  useEffect(() => {
    if (!active) { setChars(0); return; }
    const interval = setInterval(() => {
      setChars(c => {
        if (c >= text.length) { clearInterval(interval); return c; }
        return c + 1;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="p-4 md:p-8">
      <div className="border rounded-xl p-4 md:p-5 font-mono text-xs md:text-sm"
        style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))', background: 'hsl(var(--bg-surface))', minHeight: 100, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
        {text.slice(0, chars)}
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
          style={{ color: 'hsl(var(--accent))' }}>|</motion.span>
      </div>
    </div>
  );
}

function HandoffIllustration({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div className="flex items-center gap-4 md:gap-8">
        <motion.div
          className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center font-mono text-xs"
          style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
          animate={active ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >You</motion.div>

        <div className="relative w-16 md:w-24 h-[2px]">
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <line x1="0" y1="1" x2="100%" y2="1" stroke="hsl(var(--border))" strokeDasharray="4 4" />
          </svg>
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-3 rounded-sm"
            style={{ background: 'hsl(var(--accent))' }}
            animate={active ? { x: [0, 48, 48], opacity: [0, 1, 1] } : { x: 0, opacity: 0 }}
            transition={{ duration: 1.5, repeat: active ? Infinity : 0, repeatDelay: 1 }}
          />
        </div>

        <div className="relative">
          <motion.div
            className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center font-mono text-xs"
            style={{ color: 'hsl(var(--dv-success))' }}
            animate={active ? { borderColor: ['hsl(var(--ink-tertiary))', 'hsl(var(--dv-success))'] } : {}}
            transition={{ delay: 1.5 }}
          >M</motion.div>
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={active ? { y: 0, opacity: 1 } : { y: 8, opacity: 0 }}
            transition={{ delay: 2 }}
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap"
            style={{ color: 'hsl(var(--dv-success))' }}
          >Approved ✓</motion.div>
        </div>
      </div>
      <motion.div
        className="font-mono text-[10px] mt-4 px-3 py-1 rounded-lg"
        style={{ background: 'hsl(var(--dv-success) / 0.1)', color: 'hsl(var(--dv-success))' }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 2.5 }}
      >
        Mentor approved · 14 minutes ago
      </motion.div>
    </div>
  );
}

function PhoneIllustration({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <motion.svg width="60" height="90" viewBox="0 0 60 90" fill="none"
        animate={active ? { rotate: [-4, 4, -4, 4, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5, delay: 0.5, repeat: active ? 2 : 0 }}
      >
        <rect x="6" y="3" width="48" height="84" rx="8" stroke="hsl(var(--ink-secondary))" strokeWidth="1.5" fill="hsl(var(--bg-surface))" />
        <rect x="12" y="14" width="36" height="54" rx="2" fill="hsl(var(--bg-primary))" />
        <line x1="22" y1="76" x2="38" y2="76" stroke="hsl(var(--ink-secondary))" strokeWidth="1.5" strokeLinecap="round" />
        <motion.rect x="14" y="20" width="32" height="14" rx="3"
          fill="hsl(var(--accent-light))"
          stroke="hsl(var(--accent))" strokeWidth="0.5"
          animate={active ? { opacity: [0, 1], y: [10, 0] } : { opacity: 0 }}
          transition={{ delay: 1.5, duration: 0.3 }}
        />
        <motion.text x="18" y="30" fontSize="5" fill="hsl(var(--accent))" fontFamily="JetBrains Mono"
          animate={active ? { opacity: [0, 1] } : { opacity: 0 }}
          transition={{ delay: 1.7 }}
        >Approve send?</motion.text>
      </motion.svg>
      <motion.span className="font-mono text-xs" style={{ color: 'hsl(var(--dv-success))' }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 2.5 }}
      >Sent ✓</motion.span>
    </div>
  );
}

function RepoIllustration({ active }: { active: boolean }) {
  const items = ['client-project-2026', 'Setup environment', 'Design review', 'Milestone 1', 'Due Apr 30 ↗'];
  return (
    <div className="p-4 md:p-8">
      <div className="border rounded-xl p-4 md:p-5 space-y-2" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
        {items.map((item, i) => (
          <motion.div
            key={item}
            initial={{ y: 8, opacity: 0 }}
            animate={active ? { y: 0, opacity: 1 } : { y: 8, opacity: 0 }}
            transition={{ delay: i * 0.2 }}
            className="font-mono text-xs"
            style={{ color: i === 0 ? 'hsl(var(--ink))' : i === items.length - 1 ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-secondary))' }}
          >
            {i > 0 && i < items.length - 1 ? (
              <span className="border rounded-full px-2 py-0.5 inline-block" style={{ borderColor: 'hsl(var(--border))' }}>{item}</span>
            ) : item}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
