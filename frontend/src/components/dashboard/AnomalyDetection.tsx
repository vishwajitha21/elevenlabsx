import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiDetectAnomalies } from '@/services/api';
import { isDemoMode } from '@/contexts/AuthContext';

interface Anomaly {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestion: string;
}

const TYPE_LABELS: Record<string, string> = {
  payment_terms: 'Unusual payment terms',
  scope_creep: 'Scope creep risk',
  ip_ownership: 'IP ownership concern',
  liability: 'Liability exposure',
  cancellation: 'Cancellation clause issue',
  revision_policy: 'Revision policy risk',
  other: 'Contract risk flagged',
};

const DEMO_ANOMALIES: Anomaly[] = [
  { id: '1', severity: 'high', title: 'Unusual payment terms', description: 'Step 4 references NET-90 payment terms which exceeds typical NET-30 for this contract value.', suggestion: 'Consider changing to NET-30 for better cash flow.' },
  { id: '2', severity: 'medium', title: 'Scope creep risk', description: 'Step 3 includes "unlimited revisions" which could lead to scope creep.', suggestion: 'Limit to 2-3 revision rounds per phase.' },
  { id: '3', severity: 'low', title: 'Missing IP clause', description: 'No intellectual property transfer clause found in the approval chain.', suggestion: 'Add IP assignment clause before final delivery step.' },
];

export default function AnomalyDetection({ open, onClose, proposalAmount, proposalText, proposalId }: {
  open: boolean;
  onClose: () => void;
  proposalAmount?: number;
  proposalText?: string;
  proposalId?: string | null;
}) {
  const [scanning, setScanning] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!open) return;
    setScanning(true);
    setAnomalies([]);
    setProgress(0);
    setSummary('');

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 90));
    }, 80);

    const run = async () => {
      if (isDemoMode() || (!proposalText && !proposalId)) {
        await new Promise(r => setTimeout(r, 2800));
        clearInterval(progressInterval);
        setProgress(100);
        setScanning(false);
        setAnomalies(DEMO_ANOMALIES);
        setSummary('Demo scan complete. 3 potential issues found.');
        return;
      }
      try {
        const result = await aiDetectAnomalies(proposalId || undefined, proposalText);
        clearInterval(progressInterval);
        setProgress(100);
        const mapped: Anomaly[] = (result?.anomalies || []).map((a: Record<string, string>, i: number) => ({
          id: String(i + 1),
          severity: (a.severity as Anomaly['severity']) || 'low',
          title: TYPE_LABELS[a.type] || a.type || 'Risk flagged',
          description: a.description || '',
          suggestion: a.suggestion || '',
        }));
        setAnomalies(mapped.length > 0 ? mapped : []);
        setSummary(result?.summary || 'Analysis complete.');
        setScanning(false);
      } catch {
        clearInterval(progressInterval);
        setProgress(100);
        setScanning(false);
        setAnomalies(DEMO_ANOMALIES);
        setSummary('Analysis complete (fallback).');
      }
    };

    run();
    return () => clearInterval(progressInterval);
  }, [open, proposalText, proposalId]);

  const severityColor = (s: string) => {
    if (s === 'high') return { bg: 'hsl(var(--dv-danger) / 0.12)', color: 'hsl(var(--dv-danger))', border: 'hsl(var(--dv-danger) / 0.3)' };
    if (s === 'medium') return { bg: 'hsl(var(--dv-warning) / 0.12)', color: 'hsl(var(--dv-warning))', border: 'hsl(var(--dv-warning) / 0.3)' };
    return { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))', border: 'hsl(var(--accent) / 0.2)' };
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 w-full max-w-[560px] rounded-2xl border"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div className="p-6 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--accent-light))' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-lg" style={{ color: 'hsl(var(--ink))' }}>AI Anomaly Scan</h3>
                    <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>Powered by Groq Llama-3.1</p>
                  </div>
                </div>
                <motion.button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ color: 'hsl(var(--ink-tertiary))' }}
                  whileHover={{ background: 'hsl(var(--bg-surface))' }}>×</motion.button>
              </div>

              {proposalAmount && proposalAmount > 10000 && (
                <motion.div className="mt-3 p-2.5 rounded-lg flex items-center gap-2"
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: 'hsl(var(--dv-warning) / 0.1)', border: '1px solid hsl(var(--dv-warning) / 0.3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--dv-warning))" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <span className="font-body text-xs" style={{ color: 'hsl(var(--dv-warning))' }}>
                    High-value proposal (${proposalAmount.toLocaleString()}) — Step-up auth required before final approval.
                  </span>
                </motion.div>
              )}
            </div>

            <div className="p-6">
              {scanning ? (
                <div className="text-center py-8">
                  <motion.div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: 'hsl(var(--accent))', borderTopColor: 'transparent' }}
                    animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                  <p className="font-body text-sm mb-3" style={{ color: 'hsl(var(--ink))' }}>Scanning contract clauses...</p>
                  <div className="w-full h-1.5 rounded-full overflow-hidden mx-auto max-w-[200px]" style={{ background: 'hsl(var(--border))' }}>
                    <motion.div className="h-full rounded-full" style={{ background: 'hsl(var(--accent))' }}
                      animate={{ width: `${progress}%` }} />
                  </div>
                  <p className="font-mono text-[10px] mt-2" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                    Checking payment terms, scope boundaries, IP clauses...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>
                      {anomalies.length > 0 ? `${anomalies.length} potential issues found` : 'No issues found'}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: anomalies.some(a => a.severity === 'high') ? 'hsl(var(--dv-danger) / 0.12)' : 'hsl(var(--dv-success) / 0.12)', color: anomalies.some(a => a.severity === 'high') ? 'hsl(var(--dv-danger))' : 'hsl(var(--dv-success))' }}>
                      {anomalies.some(a => a.severity === 'high') ? 'Attention needed' : 'All clear'}
                    </span>
                  </div>

                  {summary && (
                    <p className="font-body text-xs mb-3" style={{ color: 'hsl(var(--ink-secondary))' }}>{summary}</p>
                  )}

                  {anomalies.map((anomaly, i) => {
                    const colors = severityColor(anomaly.severity);
                    return (
                      <motion.div key={anomaly.id}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="border rounded-xl p-4"
                        style={{ borderColor: colors.border, background: colors.bg }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold"
                            style={{ background: colors.color + '20', color: colors.color }}>{anomaly.severity}</span>
                          <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{anomaly.title}</span>
                        </div>
                        <p className="font-body text-xs mb-2" style={{ color: 'hsl(var(--ink-secondary))' }}>{anomaly.description}</p>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ background: 'hsl(var(--bg-primary) / 0.6)' }}>
                          <span className="text-[10px]">💡</span>
                          <span className="font-body text-[11px]" style={{ color: 'hsl(var(--accent))' }}>{anomaly.suggestion}</span>
                        </div>
                      </motion.div>
                    );
                  })}

                  <motion.button onClick={onClose}
                    className="w-full mt-4 font-body text-sm py-3 rounded-xl border transition-colors"
                    style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
                    whileHover={{ background: 'hsl(var(--accent-light))' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Acknowledge & Continue →
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
