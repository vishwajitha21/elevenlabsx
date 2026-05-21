import { useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import MagneticButton from '@/components/MagneticButton';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function FooterCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const prefersReduced = useReducedMotion();

  useGSAP(() => {
    if (!textRef.current || prefersReduced) return;
    
    // Advanced 3D SplitText animation without external split text plugins (using manual spans)
    const words = textRef.current.querySelectorAll('.word');
    
    // Floating entrance effect for words
    gsap.fromTo(words, 
      { 
        y: 100, 
        opacity: 0, 
        rotateX: -90, 
        z: -200 
      },
      {
        y: 0, 
        opacity: 1, 
        rotateX: 0, 
        z: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: 'back.out(1.4)',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      }
    );

    // Continuous slow breathing on the main container
    gsap.to(textRef.current, {
      y: -10,
      rotateX: 2,
      rotateY: -2,
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }, { scope: ref });

  /* Floating dots for visual depth */
  const dots = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
    })), []);

  return (
    <section ref={ref} className="py-24 md:py-32 relative overflow-hidden px-4 md:px-8 border-t" style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))' }}>
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(circle at center, hsl(var(--accent) / 0.15), transparent 70%)',
        }} />

      {/* Subtle floating particles */}
      {!prefersReduced && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ perspective: '800px' }}>
          {dots.map((d) => (
            <motion.div
              key={d.id}
              className="absolute rounded-full"
              style={{
                width: d.size,
                height: d.size,
                left: `${d.x}%`,
                top: `${d.y}%`,
                background: 'hsl(var(--accent))',
                opacity: 0,
                boxShadow: '0 0 10px hsl(var(--accent))'
              }}
              animate={{
                y: [0, -100],
                opacity: [0, 0.4, 0],
                rotateZ: [0, 180]
              }}
              transition={{
                duration: d.duration,
                delay: d.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-[1280px] mx-auto text-center relative z-10" style={{ perspective: '1200px' }}>
        <h2 
          ref={textRef}
          className="font-display text-5xl md:text-7xl lg:text-[100px] leading-[1.1] tracking-tight mb-8 font-bold flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-4xl mx-auto"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {['Ship', 'with', 'Absolute', 'Confidence.'].map((word, i) => (
            <span key={i} className="word inline-block origin-bottom" style={{ color: word === 'Absolute' ? 'hsl(var(--accent))' : 'hsl(var(--ink))' }}>
              {word}
            </span>
          ))}
        </h2>

        <motion.p
          className="font-body text-sm md:text-base mb-10 max-w-lg mx-auto"
          style={{ color: 'hsl(var(--ink-secondary))' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          Stop sharing credentials. Start using tokens. The free tier will forever be free for solo freelancers.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.7, type: 'spring' }}
        >
          <MagneticButton onClick={() => window.location.href = '/dashboard'}>
            Deploy your agent →
          </MagneticButton>
          <MagneticButton variant="outlined" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span style={{ color: 'hsl(var(--ink))' }}>Back to top</span>
          </MagneticButton>
        </motion.div>
      </div>
    </section>
  );
}
