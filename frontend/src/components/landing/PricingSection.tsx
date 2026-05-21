import { useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import MagneticButton from '@/components/MagneticButton';

export default function PricingSection() {
  return (
    <section id="pricing" className="py-12 md:py-16 lg:py-24 px-4 md:px-8">
      <div className="max-w-[1280px] mx-auto">
        <h2 className="text-section font-display text-center mb-8 md:mb-16" style={{ color: 'hsl(var(--ink))' }}>Simple. Honest. Free.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-[800px] mx-auto">
          <FreeCard />
          <ProCard />
        </div>
      </div>
    </section>
  );
}

function FreeCard() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="border rounded-xl p-6 md:p-8 relative"
      style={{
        borderColor: 'hsl(var(--border))',
        background: 'hsl(var(--bg-surface))',
        borderTopWidth: hovered ? 6 : 3,
        borderTopColor: 'hsl(var(--accent))',
        transition: 'border-top-width 200ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="font-display text-4xl md:text-5xl mb-4" style={{ color: 'hsl(var(--ink))' }}>$0<span className="text-base md:text-lg font-body font-normal" style={{ color: 'hsl(var(--ink-secondary))' }}> / mo</span></div>
      <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
        {['3 Token Vault connections', 'Unlimited proposals', '24h token auto-expiry', 'Mentor delegation', 'Full audit log', 'PWA installable'].map(f => (
          <li key={f} className="font-body text-xs md:text-sm flex items-center gap-2" style={{ color: 'hsl(var(--ink-secondary))' }}>
            <span style={{ color: 'hsl(var(--dv-success))' }}>✓</span> {f}
          </li>
        ))}
      </ul>
      <MagneticButton>Start free →</MagneticButton>
    </div>
  );
}

function ProCard() {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
    rotateY.set(x * 8);
    rotateX.set(-y * 8);
  };

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        className="border rounded-xl p-6 md:p-8 relative opacity-80"
        style={{
          borderColor: 'hsl(var(--border))',
          background: 'hsl(var(--bg-surface))',
          rotateX,
          rotateY,
        }}
        onMouseMove={handleMouse}
        onMouseLeave={() => { rotateX.set(0); rotateY.set(0); }}
      >
        <span className="absolute top-4 right-4 font-mono text-[10px] border rounded-full px-2 py-0.5" style={{ borderColor: 'hsl(var(--dv-warning))', color: 'hsl(var(--dv-warning))' }}>Coming soon</span>
        <div className="font-display text-4xl md:text-5xl mb-4" style={{ color: 'hsl(var(--ink))' }}>$9<span className="text-base md:text-lg font-body font-normal" style={{ color: 'hsl(var(--ink-secondary))' }}> / mo</span></div>
        <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8 pointer-events-none">
          {['Everything in Free', '10 Token Vault connections', 'Custom token expiry', 'Team workspaces', 'Priority support', 'API access'].map(f => (
            <li key={f} className="font-body text-xs md:text-sm flex items-center gap-2" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              <span>✓</span> {f}
            </li>
          ))}
        </ul>
        <button disabled className="font-body text-sm border rounded-lg px-4 py-2 opacity-50 cursor-not-allowed" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}>Coming soon</button>
      </motion.div>
    </div>
  );
}
