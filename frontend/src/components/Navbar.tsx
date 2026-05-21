import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import DarkModeToggle from './DarkModeToggle';
import MagneticButton from './MagneticButton';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Blog', href: '#blog' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Only show on landing page
  const isLanding = location.pathname === '/';

  useState(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
  });

  if (!isLanding) return null;

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-[100] h-14 flex items-center"
        style={{
          background: `hsl(var(--bg-primary) / ${scrolled ? 0.97 : 0.9})`,
          borderBottom: `1px solid ${scrolled ? 'hsl(var(--border))' : 'transparent'}`,
          transition: 'background 200ms ease, border-color 200ms ease',
        }}
      >
        <div className="w-full max-w-[1280px] mx-auto flex items-center justify-between" style={{ padding: '0 clamp(16px, 4vw, 80px)' }}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative w-7 h-7 rounded-md border flex items-center justify-center overflow-hidden"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
              <div className="absolute inset-0 transition-all duration-[250ms] origin-bottom group-hover:[clip-path:inset(0%_0_0_0)]"
                style={{ background: 'hsl(var(--accent))', clipPath: 'inset(100% 0 0 0)' }} />
              <span className="relative z-10 font-mono text-[10px] font-bold transition-colors duration-[250ms] group-hover:text-white"
                style={{ color: 'hsl(var(--ink))' }}>DV</span>
            </div>
            <span className="font-display text-base tracking-tight" style={{ fontWeight: 700, color: 'hsl(var(--ink))' }}>DeliverVault</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="relative font-body text-sm font-medium py-1 group/link"
                style={{ color: 'hsl(var(--ink-secondary))' }}
              >
                {link.label}
                <span className="absolute bottom-0 left-0 right-0 h-[1px] scale-x-0 group-hover/link:scale-x-100 transition-transform duration-200 origin-center"
                  style={{ background: 'hsl(var(--ink-secondary))' }} />
              </a>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-3">
            <DarkModeToggle />
            <Link to="/dashboard" className="hidden md:inline-block font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))' }}>Log in</Link>
            <div className="hidden md:block">
              <MagneticButton onClick={() => window.location.href = '/dashboard'}>Start free →</MagneticButton>
            </div>
            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <motion.span
                className="block w-5 h-[1.5px] rounded-full"
                style={{ background: 'hsl(var(--ink))' }}
                animate={mobileOpen ? { rotate: 45, y: 6.5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block w-5 h-[1.5px] rounded-full"
                style={{ background: 'hsl(var(--ink))' }}
                animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block w-5 h-[1.5px] rounded-full"
                style={{ background: 'hsl(var(--ink))' }}
                animate={mobileOpen ? { rotate: -45, y: -6.5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 md:hidden"
            style={{ background: 'hsl(var(--bg-primary))' }}
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="font-display text-3xl"
                style={{ color: 'hsl(var(--ink))' }}
              >
                {link.label}
              </motion.a>
            ))}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <MagneticButton onClick={() => { setMobileOpen(false); window.location.href = '/dashboard'; }}>
                Start free →
              </MagneticButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
