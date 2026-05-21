import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const faqs = [
  { q: 'Do you ever store my Gmail password or credentials?', a: 'Never. Our Token Vault holds encrypted OAuth tokens on your behalf. DeliverVault only receives a reference ID — we never see, store, or transmit your credentials. This is the core principle of the Token Vault pattern: store reference IDs, never raw credentials.' },
  { q: "What happens if I don't approve the send?", a: 'The agent stays frozen indefinitely. Without your explicit step-up authentication approval, the proposal is never sent. This is by design — the agent has zero autonomous access to sending capabilities. You can cancel the workflow at any time and all tokens will be automatically revoked.' },
  { q: 'Can my mentor see my other emails or data?', a: 'No. The mentor receives a secure, time-limited link to review only the specific proposal step you delegated. They have zero access to your email, files, account, or any other proposals. This is scoped consent — the mentor only sees what you explicitly shared.' },
  { q: 'What happens when the token expires?', a: 'The agent loses access immediately. All Token Vault credentials auto-expire after 24 hours by default. You can also configure shorter expiry times (1h, 6h, 12h) in Settings. Manual revocation takes less than 200ms — just click Disconnect on any connection.' },
  { q: 'How does the AI waterfall work?', a: 'DeliverVault uses a 5-provider cascade: Groq (fastest, ~0.8s), Cerebras (~0.3s), SambaNova (~0.6s), Google Gemini (~1.2s), and OpenRouter (fallback, ~2s). All providers use free-tier API keys. If one provider hits a rate limit or fails, the next provider takes over automatically. This ensures your proposal parsing always succeeds.' },
  { q: 'What is CIBA and how is it used here?', a: 'CIBA (Client-Initiated Backchannel Authentication) allows an agent to request approval from a mentor via push notification. The mentor can approve or deny without logging into DeliverVault. This is the key pattern for delegated approval in agent authorization.' },
  { q: 'Is this production-ready for freelancers?', a: 'Yes. The free tier is free forever for solo freelancers. Token Vault manages all OAuth credentials securely. The immutable audit trail satisfies compliance requirements. Stripe integration handles payments. The entire system runs on Render free tier with automatic keep-alive.' },
  { q: 'What happens to my data if I delete my account?', a: 'All your proposals, connections, audit logs, and personal data are permanently deleted. Token Vault credentials are separately managed and can be revoked from your security dashboard. There is no recovery after deletion — this is intentional for privacy compliance.' },
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-12 md:py-16 lg:py-24 px-4 md:px-8"
    >
      <div className="max-w-3xl mx-auto">
        {/* Section heading */}
        <motion.h2
          className="text-section font-display mb-10 md:mb-14 text-center"
          style={{ color: 'hsl(var(--ink))' }}
          initial={{ opacity: 0, y: 24 }}
          animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          Questions.
        </motion.h2>

        {/* FAQ list */}
        <motion.div
          className="space-y-0"
          initial={{ opacity: 0, y: 16 }}
          animate={inView || prefersReduced ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              index={i}
              isOpen={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FAQItem({ faq, index, isOpen, onToggle }: {
  faq: { q: string; a: string };
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      className="border-b last:border-b-0"
      style={{ borderColor: 'hsl(var(--border))' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.05 * index,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 md:py-6 text-left group transition-colors duration-200 hover:bg-[hsl(var(--bg-surface))]/50 -mx-3 px-3 rounded-lg"
        aria-expanded={isOpen}
      >
        <span
          className="font-body text-sm md:text-[15px] font-medium pr-4 transition-colors duration-200"
          style={{ color: isOpen ? 'hsl(var(--ink))' : 'hsl(var(--ink))' }}
        >
          {faq.q}
        </span>
        <motion.div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: isOpen ? 'hsl(var(--accent) / 0.1)' : 'hsl(var(--bg-surface))' }}
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1V11M1 6H11"
              stroke={isOpen ? 'hsl(var(--accent))' : 'hsl(var(--ink-tertiary))'}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
              opacity: { duration: 0.25, delay: 0.05 },
            }}
            style={{ willChange: 'height, opacity' }}
            className="overflow-hidden"
          >
            <p
              className="pb-5 md:pb-6 font-body text-xs md:text-sm leading-relaxed"
              style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.75 }}
            >
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
