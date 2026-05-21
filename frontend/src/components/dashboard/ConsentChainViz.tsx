import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ProposalStep } from '@/services/mock';

interface ConsentNode {
  stepId: number;
  name: string;
  tokenActive: boolean;
  approvedBy: string;
  scope: string;
  timestamp: string;
  service: string;
}

function buildChain(steps: ProposalStep[]): ConsentNode[] {
  return steps.map((s, i) => ({
    stepId: s.id,
    name: s.name,
    tokenActive: s.status === 'done' || s.status === 'active',
    approvedBy: s.status === 'done' ? 'alex@delivervault.dev' : s.status === 'waiting' ? 'mentor@email.com (pending)' : '—',
    scope: s.scope || '',
    timestamp: s.status === 'done' ? `${10 + i}:4${i}:${(i * 12 + 31) % 60}` : '—',
    service: s.service,
  }));
}

const serviceIcons: Record<string, string> = {
  'Gmail read': '📧', 'Gmail send': '📧', 'Groq Llama': '🤖',
  Mentor: '👤', 'GitHub repo': '🐙', Slack: '💬', Notion: '📝',
};

export default function ConsentChainViz({ steps, open, onClose }: {
  steps: ProposalStep[];
  open: boolean;
  onClose: () => void;
}) {
  const chain = buildChain(steps);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (open) {
      setAnimPhase(0);
      const t1 = setTimeout(() => setAnimPhase(1), 200);
      const t2 = setTimeout(() => setAnimPhase(2), 600);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [open]);

  const activeCount = chain.filter(c => c.tokenActive).length;
  const pendingCount = chain.filter(c => !c.tokenActive).length;
  const scopeCount = chain.filter(c => c.tokenActive && c.scope).length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="relative z-10 w-full max-w-[860px] max-h-[90vh] overflow-hidden rounded-2xl border flex flex-col"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}
          >
            {/* Header */}
            <div className="p-5 md:p-6 border-b flex-shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'hsl(var(--accent-light))' }}
                    animate={!prefersReduced ? { rotate: [0, 5, -5, 0] } : {}}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </motion.div>
                  <div>
                    <h3 className="font-display text-lg md:text-xl" style={{ color: 'hsl(var(--ink))' }}>Consent Chain Visualization</h3>
                    <p className="font-body text-xs mt-0.5" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                      Every token, scope, and approval — fully transparent
                    </p>
                  </div>
                </div>
                <motion.button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ color: 'hsl(var(--ink-tertiary))' }}
                  whileHover={{ background: 'hsl(var(--bg-surface))', scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}>×</motion.button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Active Tokens', value: activeCount, total: chain.length, color: 'hsl(var(--dv-success))' },
                  { label: 'Pending Consent', value: pendingCount, total: chain.length, color: 'hsl(var(--dv-warning))' },
                  { label: 'Scopes Granted', value: scopeCount, total: chain.length, color: 'hsl(var(--accent))' },
                ].map((stat, i) => (
                  <motion.div key={stat.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={animPhase >= 1 ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 200 }}
                    className="border rounded-xl p-3 text-center"
                    style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <motion.div className="w-8 h-8 rounded-full border-[3px] flex items-center justify-center"
                        style={{ borderColor: stat.color }}
                        initial={{ pathLength: 0 }}
                        animate={{ rotate: animPhase >= 1 ? 360 : 0 }}
                        transition={{ duration: 1, delay: 0.2 + i * 0.15 }}>
                        <span className="font-display text-sm" style={{ color: stat.color }}>{stat.value}</span>
                      </motion.div>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{stat.label}</span>
                    {/* Mini progress */}
                    <div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: stat.color }}
                        initial={{ width: 0 }}
                        animate={animPhase >= 1 ? { width: `${chain.length > 0 ? (stat.value / chain.length) * 100 : 0}%` } : {}}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Chain */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-[2px]" style={{ background: 'hsl(var(--border))' }}>
                  <motion.div className="absolute top-0 left-0 w-full rounded-full"
                    style={{ background: 'hsl(var(--accent))' }}
                    initial={{ height: 0 }}
                    animate={animPhase >= 2 ? { height: `${chain.length > 0 ? (activeCount / chain.length) * 100 : 0}%` } : {}}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
                </div>

                {chain.map((node, i) => (
                  <motion.div key={node.stepId}
                    initial={{ opacity: 0, x: -30 }}
                    animate={animPhase >= 2 ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: i * 0.12, type: 'spring', stiffness: 180, damping: 18 }}
                    className="relative pl-14 pb-5 last:pb-0"
                    onMouseEnter={() => setHoveredId(node.stepId)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(selectedId === node.stepId ? null : node.stepId)}
                  >
                    {/* Node dot */}
                    <div className="absolute left-[10px] top-4 z-10">
                      <motion.div className="w-[20px] h-[20px] rounded-full border-[3px] flex items-center justify-center cursor-pointer"
                        style={{
                          borderColor: node.tokenActive ? 'hsl(var(--dv-success))' : 'hsl(var(--border))',
                          background: node.tokenActive ? 'hsl(var(--dv-success))' : 'hsl(var(--bg-primary))',
                        }}
                        whileHover={{ scale: 1.3 }}
                        animate={node.tokenActive && !prefersReduced ? { boxShadow: ['0 0 0 0px hsl(var(--dv-success) / 0.4)', '0 0 0 8px hsl(var(--dv-success) / 0)', '0 0 0 0px hsl(var(--dv-success) / 0)'] } : {}}
                        transition={node.tokenActive ? { duration: 2, repeat: Infinity, delay: i * 0.4 } : {}}>
                        {node.tokenActive && (
                          <motion.svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"
                            initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.5 + i * 0.12, type: 'spring' }}>
                            <polyline points="20 6 9 17 4 12" />
                          </motion.svg>
                        )}
                      </motion.div>
                    </div>

                    {/* Card */}
                    <motion.div
                      className="border rounded-xl overflow-hidden cursor-pointer"
                      style={{
                        borderColor: hoveredId === node.stepId || selectedId === node.stepId ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                        background: hoveredId === node.stepId ? 'hsl(var(--bg-surface))' : 'hsl(var(--bg-primary))',
                        borderLeftWidth: 3,
                        borderLeftColor: node.tokenActive ? 'hsl(var(--dv-success))' : 'hsl(var(--dv-warning))',
                      }}
                      whileHover={!prefersReduced ? { y: -2, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' } : {}}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{serviceIcons[node.service] || '⚡'}</span>
                            <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{node.name}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink-tertiary))' }}>Step {node.stepId}</span>
                          </div>
                          <motion.span className="font-body text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5"
                            style={{
                              background: node.tokenActive ? 'hsl(var(--dv-success) / 0.12)' : 'hsl(var(--dv-warning) / 0.12)',
                              color: node.tokenActive ? 'hsl(var(--dv-success))' : 'hsl(var(--dv-warning))',
                            }}
                            animate={node.tokenActive && !prefersReduced ? {} : {}}>
                            {node.tokenActive ? (
                              <><motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }}
                                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} /> Token Active</>
                            ) : '🔒 Awaiting Consent'}
                          </motion.span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { label: 'Service', value: node.service },
                            { label: 'Scope', value: node.scope || '—' },
                            { label: 'Approved by', value: node.approvedBy },
                            { label: 'Timestamp', value: node.timestamp },
                          ].map(item => (
                            <div key={item.label} className="rounded-lg p-2" style={{ background: 'hsl(var(--bg-surface))' }}>
                              <span className="font-mono text-[8px] block mb-0.5 uppercase tracking-wider" style={{ color: 'hsl(var(--ink-tertiary))' }}>{item.label}</span>
                              <span className="font-body text-[11px] font-medium" style={{ color: 'hsl(var(--ink-secondary))' }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {selectedId === node.stepId && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                            <div className="p-4 space-y-2" style={{ background: 'hsl(var(--bg-surface))' }}>
                              <div className="flex items-center gap-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--accent))' }}>Token Vault encrypted · Reference ID only</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--dv-success))" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-secondary))' }}>Auto-expires in 24 hours from issuance</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--ink-tertiary))" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-secondary))' }}>Logged in immutable audit trail</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* Trust footer */}
              <motion.div className="mt-6 p-4 rounded-xl border"
                initial={{ opacity: 0, y: 20 }}
                animate={animPhase >= 2 ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.8, type: 'spring' }}
                style={{ borderColor: 'hsl(var(--accent) / 0.2)', background: 'hsl(var(--accent-light))' }}>
                <div className="flex items-start gap-3">
                  <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2" className="flex-shrink-0 mt-0.5"
                    animate={!prefersReduced ? { rotate: [0, 10, 0] } : {}} transition={{ duration: 4, repeat: Infinity }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </motion.svg>
                  <div>
                    <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--accent))' }}>Zero-trust verified</span>
                    <p className="font-body text-xs mt-1" style={{ color: 'hsl(var(--ink-secondary))' }}>
                      Every action required explicit user consent via Auth0 Token Vault. 
                      No credentials stored — only reference IDs. All tokens auto-expire within 24 hours.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
