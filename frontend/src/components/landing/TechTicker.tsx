import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function TechTicker() {
  const allItems = useMemo(() => {
    const items = [
      'Token Vault Protocol', 'Groq Llama-3.1', 'Next.js 15', 'FastAPI Python',
      'LangGraph', 'MongoDB Atlas', 'Vercel', 'Railway', 'Resend',
      'React Flow', 'Socket.io', 'Lenis', 'Framer Motion', 'GSAP',
    ];
    return [...items, ...items, ...items];
  }, []);

  return (
    <section className="border-t border-b overflow-hidden py-6 relative" style={{ borderColor: 'hsl(var(--border))' }}>
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, hsl(var(--bg-primary)), transparent)' }} />
      <div className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, hsl(var(--bg-primary)), transparent)' }} />

      <div className="flex animate-marquee">
        {allItems.map((item, i) => (
          <motion.span
            key={i}
            className="font-mono text-xs border rounded-full px-3 py-1 mx-2 whitespace-nowrap flex-shrink-0"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}
            whileHover={{
              borderColor: 'hsl(var(--accent))',
              color: 'hsl(var(--accent))',
              scale: 1.05,
              boxShadow: '0 0 12px hsl(var(--accent) / 0.1)',
            }}
            transition={{ duration: 0.2 }}
          >
            {item}
          </motion.span>
        ))}
      </div>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
        .animate-marquee { animation: marquee 25s linear infinite; width: max-content; }
      `}</style>
    </section>
  );
}
