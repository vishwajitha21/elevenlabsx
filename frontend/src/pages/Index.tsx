import { useRef, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import WorkflowStrip from '@/components/landing/WorkflowStrip';
import NumbersBar from '@/components/landing/NumbersBar';
import BentoGrid from '@/components/landing/BentoGrid';
import HowItWorks from '@/components/landing/HowItWorks';
import TechTicker from '@/components/landing/TechTicker';
import PricingSection from '@/components/landing/PricingSection';
import FAQSection from '@/components/landing/FAQSection';
import FooterCTA from '@/components/landing/FooterCTA';
import Footer from '@/components/landing/Footer';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ─── Animated horizontal divider with traveling light ─── */
function GlowDivider() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    const orb = ref.current.querySelector('.glow-orb');
    const line = ref.current.querySelector('.divider-line');
    if (!orb || !line) return;

    gsap.fromTo(line,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      }
    );

    gsap.fromTo(orb,
      { left: '-8%', opacity: 0 },
      {
        left: '108%',
        opacity: 1,
        duration: 2.5,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      }
    );
  }, { scope: ref });

  return (
    <div ref={ref} className="relative py-4 overflow-hidden" style={{ padding: '16px clamp(16px, 4vw, 80px)' }}>
      <div className="max-w-[1280px] mx-auto relative h-[1px]">
        <div className="divider-line absolute inset-0 origin-left"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border)), transparent)' }} />
        <div className="glow-orb absolute top-1/2 -translate-y-1/2 w-24 h-[3px] rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(var(--accent)), transparent)',
            boxShadow: '0 0 20px hsl(var(--accent) / 0.4), 0 0 60px hsl(var(--accent) / 0.15)',
            filter: 'blur(0.5px)',
          }} />
      </div>
    </div>
  );
}

/* ─── Framer Motion scroll-reveal section wrapper ─── */
function ScrollSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        delay,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Floating gradient mesh background ─── */
function GradientMesh() {
  const prefersReduced = useReducedMotion();

  const blobs = useMemo(() => [
    { x: '15%', y: '10%', size: 500, color: 'hsl(var(--accent))', opacity: 0.025 },
    { x: '75%', y: '50%', size: 400, color: 'hsl(var(--accent))', opacity: 0.02 },
    { x: '40%', y: '80%', size: 350, color: 'hsl(150 60% 50%)', opacity: 0.015 },
  ], []);

  if (prefersReduced) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y,
            background: b.color,
            opacity: b.opacity,
            filter: `blur(${100 + i * 15}px)`,
          }}
          animate={{
            x: [0, 60 * (i % 2 === 0 ? 1 : -1), -40, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 18 + i * 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Section label with animated line ─── */
function SectionLabel({ text }: { text: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 mb-2"
      style={{ padding: '16px clamp(16px, 4vw, 80px) 0' }}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-[1280px] mx-auto flex items-center gap-3 w-full">
        <motion.div
          className="h-[1px] w-8"
          style={{ background: 'hsl(var(--accent))' }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: 'hsl(var(--accent))' }}>
          {text}
        </span>
      </div>
    </motion.div>
  );
}

export default function Index() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GradientMesh />
      <Navbar />
      <main className="relative z-10">
        <HeroSection />

        <GlowDivider />

        <SectionLabel text="Workflow" />
        <ScrollSection>
          <WorkflowStrip />
        </ScrollSection>

        <GlowDivider />

        <SectionLabel text="By the numbers" />
        <NumbersBar />

        <GlowDivider />

        <SectionLabel text="Features" />
        <section id="features">
          <BentoGrid />
        </section>

        <GlowDivider />

        <HowItWorks />

        <GlowDivider />

        <SectionLabel text="Stack" />
        <ScrollSection>
          <TechTicker />
        </ScrollSection>

        <GlowDivider />

        <SectionLabel text="Plans" />
        <ScrollSection>
          <PricingSection />
        </ScrollSection>

        <GlowDivider />

        <SectionLabel text="FAQ" />
        <FAQSection />

        <GlowDivider />

        <FooterCTA />
        <Footer />
      </main>
    </motion.div>
  );
}
