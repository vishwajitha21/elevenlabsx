import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const tourSteps = [
  {
    target: 'proposal-input',
    title: 'Create Proposals',
    description: 'Paste a client brief and let AI parse it into actionable workflow steps. Each step represents a real action that requires your explicit consent.',
    icon: '✉',
    detail: 'Supports drag-and-drop, paste, or type. The 5-provider AI waterfall (Groq → Cerebras → SambaNova → Gemini → OpenRouter) ensures parsing always succeeds.',
    path: '/dashboard',
  },
  {
    target: 'canvas-area',
    title: 'Workflow Canvas',
    description: 'Interactive React Flow canvas — drag nodes, zoom, and manage every step. Approve or revoke tokens with a click. This IS the consent chain.',
    icon: '🔲',
    detail: 'Undo/redo with Ctrl+Z. Each node shows token status, scope, and service integration. Hover for detailed explanations.',
    path: '/dashboard',
  },
  {
    target: 'live-events',
    title: 'Live Event Feed',
    description: 'Real-time events from your Token Vault. Every token issuance, revocation, and service action is logged here for full transparency.',
    icon: '📡',
    detail: 'Immutable audit trail — every consent action is permanently recorded. Export as CSV for compliance.',
    path: '/dashboard',
  },
  {
    target: 'nav-connections',
    title: 'Token Vault Connections',
    description: 'Connect Gmail, GitHub, Slack, and Notion via Auth0 OAuth. All tokens auto-expire in 24h. Revoke any token instantly.',
    icon: '🔗',
    detail: 'Zero credentials stored — only encrypted reference IDs. Each connection shows live countdown and granted scopes.',
    path: '/dashboard/connections',
  },
  {
    target: 'nav-audit',
    title: 'Audit Log & Compliance',
    description: 'Complete audit trail of every token issued, revoked, and action taken. Filter, search, and export for compliance reporting.',
    icon: '📋',
    detail: 'Color-coded status indicators, duration tracking, and real-time Socket.io updates.',
    path: '/dashboard/audit',
  },
  {
    target: 'canvas-area',
    title: 'How Consent Works',
    description: 'DeliverVault implements a consent chain: each workflow step requires explicit approval before the agent can proceed. This is agent authorization — the agent CANNOT act without your permission.',
    icon: '🔐',
    detail: 'Inspired by Auth0 Token Vault and CIBA (Client-Initiated Backchannel Authentication). Step-up auth is used for high-stakes actions like sending emails. Your credentials are NEVER stored.',
    path: '/dashboard',
  },
];

interface OnboardingTourProps {
  forcedOpen?: boolean;
  onForceClose?: () => void;
}

export default function OnboardingTour({ forcedOpen, onForceClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const prefersReduced = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  const openTour = useCallback(() => {
    setStep(0);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (forcedOpen) openTour();
  }, [forcedOpen, openTour]);

  useEffect(() => {
    const seen = localStorage.getItem('dv-tour-seen');
    if (!seen) {
      const timer = setTimeout(() => openTour(), 1500);
      return () => clearTimeout(timer);
    }
  }, [openTour]);

  // Highlight the target element
  useEffect(() => {
    if (!visible) { setHighlightRect(null); return; }
    const current = tourSteps[step];
    // Try direct ID first, then data attribute, then nav link
    let el = document.getElementById(current.target);
    if (!el) el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el && current.target.startsWith('nav-')) {
      const label = current.target.replace('nav-', '');
      const links = document.querySelectorAll('nav a');
      links.forEach(link => {
        if (link.textContent?.toLowerCase().includes(label)) el = link as HTMLElement;
      });
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlightRect(rect);
    } else {
      setHighlightRect(null);
    }
  }, [visible, step]);

  const handleNext = () => {
    if (step >= tourSteps.length - 1) {
      closeTour();
      return;
    }

    const nextStep = tourSteps[step + 1];
    if (nextStep.path && location.pathname !== nextStep.path) {
      navigate(nextStep.path);
      // Let the effect handle the increment after navigation
      setTimeout(() => setStep(s => s + 1), 300);
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (step <= 0) return;

    const prevStep = tourSteps[step - 1];
    if (prevStep.path && location.pathname !== prevStep.path) {
      navigate(prevStep.path);
      setTimeout(() => setStep(s => s - 1), 300);
    } else {
      setStep(s => s - 1);
    }
  };

  const closeTour = () => {
    setVisible(false);
    localStorage.setItem('dv-tour-seen', 'true');
    onForceClose?.();
  };

  if (!visible) return null;

  const current = tourSteps[step];
  const hasHighlight = highlightRect !== null;

  // Position tooltip near highlighted element or center
  const tooltipStyle: React.CSSProperties = hasHighlight ? {
    position: 'fixed',
    left: Math.min(Math.max(highlightRect!.left, 16), window.innerWidth - 380),
    top: highlightRect!.bottom + 16,
    // If tooltip would go off bottom, show above
    ...(highlightRect!.bottom + 320 > window.innerHeight ? {
      top: 'auto',
      bottom: window.innerHeight - highlightRect!.top + 16,
    } : {}),
  } : {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] pointer-events-auto">
        {/* Overlay with cutout */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.55)' }} onClick={closeTour} />

        {/* Highlight ring */}
        {hasHighlight && (
          <motion.div
            className="absolute rounded-xl pointer-events-none z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              left: highlightRect!.left - 6,
              top: highlightRect!.top - 6,
              width: highlightRect!.width + 12,
              height: highlightRect!.height + 12,
              border: '2px solid hsl(var(--accent))',
              boxShadow: '0 0 0 4000px rgba(0,0,0,0.45), 0 0 20px hsl(var(--accent) / 0.3)',
              background: 'transparent',
            }}
          >
            {!prefersReduced && (
              <motion.div className="absolute inset-0 rounded-xl"
                style={{ border: '2px solid hsl(var(--accent))' }}
                animate={{ scale: [1, 1.06, 1], opacity: [0.8, 0, 0] }}
                transition={{ duration: 2, repeat: Infinity }} />
            )}
          </motion.div>
        )}

        {/* Tooltip */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="z-20 w-[360px] rounded-2xl p-5 pointer-events-auto"
          style={{
            ...tooltipStyle,
            background: 'hsl(var(--bg-primary))',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            border: '1px solid hsl(var(--border))',
          }}
        >
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-4">
            {tourSteps.map((_, i) => (
              <motion.div key={i}
                className="h-1 rounded-full flex-1 cursor-pointer"
                style={{ background: i <= step ? 'hsl(var(--accent))' : 'hsl(var(--border))' }}
                onClick={() => setStep(i)}
                whileHover={{ scaleY: 2 }}
                animate={i === step && !prefersReduced ? { scaleX: [1, 1.05, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }} />
            ))}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <motion.span className="text-2xl"
              animate={!prefersReduced ? { rotate: [0, -10, 10, 0] } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}>{current.icon}</motion.span>
            <div>
              <h4 className="font-body text-base font-semibold" style={{ color: 'hsl(var(--ink))' }}>{current.title}</h4>
              <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step + 1} of {tourSteps.length}</span>
            </div>
          </div>

          <p className="font-body text-sm mb-2" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>{current.description}</p>
          <p className="font-mono text-[10px] mb-5 px-2 py-1.5 rounded-lg" style={{ color: 'hsl(var(--ink-tertiary))', background: 'hsl(var(--bg-surface))' }}>{current.detail}</p>

          <div className="flex items-center justify-between">
            <button onClick={closeTour} className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Skip tour</button>
            <div className="flex gap-2">
              {step > 0 && (
                <motion.button onClick={handlePrev}
                  className="font-body text-sm px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                  whileHover={{ borderColor: 'hsl(var(--accent))' }} whileTap={{ scale: 0.97 }}>← Back</motion.button>
              )}
              <motion.button onClick={handleNext}
                className="font-body text-sm px-4 py-2 rounded-lg"
                style={{ background: 'hsl(var(--accent))', color: 'white' }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {step >= tourSteps.length - 1 ? 'Get started ✓' : 'Next →'}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/** Floating button to replay the tour */
export function TourReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-20 md:bottom-6 left-4 md:left-auto md:right-20 z-40 flex items-center gap-2 px-3 py-2 rounded-full border font-body text-xs"
      style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      whileHover={{ scale: 1.05, borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2 }}
    >
      <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>🎯</motion.span>
      Tour
    </motion.button>
  );
}
