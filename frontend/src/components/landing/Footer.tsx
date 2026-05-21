import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

export default function Footer() {
  const prefersReduced = useReducedMotion();
  const footerRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!footerRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.05 });
    obs.observe(footerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <footer ref={footerRef} className="border-t relative z-10" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="max-w-[1280px] mx-auto py-12 md:py-16 px-4 md:px-8 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <Link to="/" className="flex items-center gap-2 mb-4 group">
            <motion.div
              className="w-8 h-8 rounded-md border flex items-center justify-center transition-colors"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
              whileHover={{ borderColor: 'hsl(var(--accent))', scale: 1.05 }}
            >
              <span className="font-mono text-[11px] font-bold" style={{ color: 'hsl(var(--ink))' }}>DV</span>
            </motion.div>
            <span className="font-display text-lg tracking-tight font-bold" style={{ color: 'hsl(var(--ink))' }}>DeliverVault</span>
          </Link>
          <p className="font-body text-sm max-w-sm mb-6" style={{ color: 'hsl(var(--ink-secondary))' }}>
            Agent power. Human control. Every action consent-chained and audited.
          </p>
        </motion.div>
      </div>
      
      <div className="border-t" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="max-w-[1280px] mx-auto py-4 md:py-6 px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="font-mono text-[10px] md:text-[11px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>© 2026 DeliverVault</span>
          <span className="font-mono text-[10px] md:text-[11px] text-center" style={{ color: 'hsl(var(--ink-tertiary))' }}>
            Zero-trust. Consent-chained. Always audited.
          </span>
        </div>
      </div>
    </footer>
  );
}
