import { motion, AnimatePresence } from 'framer-motion';

const templates = [
  {
    id: 'brand',
    title: 'Brand Refresh',
    icon: '🎨',
    brief: `Dear [Client],\n\nThank you for reaching out about your brand refresh project. Based on our discussion, I propose a comprehensive 3-week engagement:\n\n• Week 1: Discovery & brand audit\n• Week 2: Visual identity exploration\n• Week 3: Final assets & brand guide\n\nInvestment: $4,200\n\nLooking forward to your feedback.\n\nBest,\nAlex`,
  },
  {
    id: 'web',
    title: 'Web Development',
    icon: '💻',
    brief: `Hi [Client],\n\nI'm excited about your website project. Here's my proposed approach:\n\n• Phase 1: UX research & wireframes (1 week)\n• Phase 2: Visual design & prototyping (2 weeks)\n• Phase 3: Development & testing (3 weeks)\n• Phase 4: Launch & handoff (1 week)\n\nTotal: $8,500 | Timeline: 7 weeks\n\nShall we schedule a kickoff call?\n\nBest,\nAlex`,
  },
  {
    id: 'marketing',
    title: 'Marketing Campaign',
    icon: '📢',
    brief: `Dear [Client],\n\nHere's my proposal for your Q2 marketing campaign:\n\n• Social media strategy & content calendar\n• Email automation sequence (8 emails)\n• Paid ad creative (3 platforms)\n• Monthly analytics reporting\n\nDuration: 3 months | Investment: $2,800/month\n\nLet me know if you'd like to discuss further.\n\nBest,\nAlex`,
  },
  {
    id: 'consulting',
    title: 'Strategy Consulting',
    icon: '📊',
    brief: `Hi [Client],\n\nThank you for considering me for your strategy engagement. My approach:\n\n1. Current state assessment (3 days)\n2. Stakeholder interviews (5 sessions)\n3. Strategic recommendations document\n4. Implementation roadmap\n\nEngagement fee: $6,000 | Duration: 2 weeks\n\nI'm confident we can unlock significant growth.\n\nBest,\nAlex`,
  },
];

export default function ProposalTemplates({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (brief: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="relative z-10 w-full max-w-[560px] rounded-2xl p-5 md:p-6"
            style={{ background: 'hsl(var(--bg-primary))', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid hsl(var(--border))' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="font-body text-base font-semibold" style={{ color: 'hsl(var(--ink))' }}>Quick Templates</h4>
                <p className="font-body text-xs mt-0.5" style={{ color: 'hsl(var(--ink-tertiary))' }}>One-click starter briefs</p>
              </div>
              <motion.button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ color: 'hsl(var(--ink-tertiary))' }}
                whileHover={{ background: 'hsl(var(--bg-surface))' }}>×</motion.button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {templates.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border rounded-xl p-4 cursor-pointer transition-all duration-[120ms]"
                  style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
                  onClick={() => { onSelect(t.brief); onClose(); }}
                  whileHover={{ borderColor: 'hsl(var(--accent))', y: -2 }}
                >
                  <span className="text-2xl mb-3 block">{t.icon}</span>
                  <span className="font-body text-sm font-semibold block mb-1" style={{ color: 'hsl(var(--ink))' }}>{t.title}</span>
                  <span className="font-body text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>Click to use</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
