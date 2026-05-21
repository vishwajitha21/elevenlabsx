import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { getSharedProposal, isDemoMode } from '@/services/api';

interface SharedStep {
  id: string;
  label: string;
  description?: string;
  status: string;
  service?: string;
  estimatedDays?: number;
  requiresApproval?: boolean;
}

interface SharedProposalData {
  proposal: {
    _id: string;
    title: string;
    client: string;
    value: number;
    currency: string;
    status: string;
    steps: SharedStep[];
    createdAt: string;
  };
}

export default function SharedProposal() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [data, setData] = useState<SharedProposalData | null>(null);

  useEffect(() => {
    async function fetchProposal() {
      try {
        const result = await getSharedProposal(token!);
        if (result?.proposal) {
          setData(result as SharedProposalData);
          setStatus('loaded');
        } else {
          setStatus('error');
        }
      } catch {
        if (isDemoMode()) {
          // Demo fallback
          setData({
            proposal: {
              _id: 'demo-1',
              title: 'Brand Refresh Project',
              client: 'Sarah Kim',
              value: 4200,
              currency: 'USD',
              status: 'active',
              steps: [
                { id: 'step-1', label: 'Discovery & Research', description: 'Brand audit, competitor analysis, mood boarding', status: 'done', service: null, estimatedDays: 3, requiresApproval: false },
                { id: 'step-2', label: 'Design Exploration', description: 'Logo concepts, color palette, typography selection', status: 'active', service: null, estimatedDays: 5, requiresApproval: true },
                { id: 'step-3', label: 'Client Review', description: 'Present design concepts for approval and feedback', status: 'pending', service: 'gmail', estimatedDays: 2, requiresApproval: true },
                { id: 'step-4', label: 'Final Delivery', description: 'Brand guidelines document, asset handoff, source files', status: 'pending', service: 'notion', estimatedDays: 3, requiresApproval: false },
              ],
              createdAt: new Date().toISOString(),
            },
          });
          setStatus('loaded');
        } else {
          setStatus('error');
        }
      }
    }
    fetchProposal();
  }, [token]);

  const proposal = data?.proposal;
  const steps = proposal?.steps || [];
  const doneCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    done: { bg: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))', label: 'Completed' },
    active: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))', label: 'In Progress' },
    pending: { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))', label: 'Pending' },
    waiting: { bg: 'hsl(var(--dv-warning) / 0.15)', color: 'hsl(var(--dv-warning))', label: 'Waiting' },
    revoked: { bg: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))', label: 'Revoked' },
  };

  const serviceIcon = (svc?: string) => {
    if (!svc) return '⚡';
    const s = svc.toLowerCase();
    if (s.includes('gmail')) return '📧';
    if (s.includes('github')) return '🐙';
    if (s.includes('slack')) return '💬';
    if (s.includes('notion')) return '📝';
    return '⚡';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen"
      style={{ background: 'hsl(var(--bg-primary))' }}
    >
      {/* Header */}
      <div className="border-b sticky top-0 z-10" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
        <div className="max-w-[860px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
              <span className="font-mono text-[10px] font-bold" style={{ color: 'hsl(var(--accent))' }}>DV</span>
            </div>
            <span className="font-display text-sm" style={{ color: 'hsl(--ink)' }}>DeliverVault</span>
          </div>
          <Link to="/" className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}>
            ← Home
          </Link>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>
            Loading shared proposal...
          </motion.div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center px-6">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="font-display text-2xl mb-2" style={{ color: 'hsl(var(--ink))' }}>Link Not Found</h2>
            <p className="font-body text-sm mb-6" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              This share link is invalid, expired, or has been revoked.
            </p>
            <Link to="/" className="font-body text-sm px-5 py-2.5 rounded-lg border transition-colors" style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>
              Go to DeliverVault
            </Link>
          </div>
        </div>
      )}

      {status === 'loaded' && proposal && (
        <div className="max-w-[860px] mx-auto px-4 md:px-8 py-10">
          {/* Proposal header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: statusStyles[proposal.status]?.bg || 'hsl(var(--bg-surface))', color: statusStyles[proposal.status]?.color || 'hsl(var(--ink-tertiary))' }}>
                {statusStyles[proposal.status]?.label || proposal.status}
              </span>
              <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                Shared via DeliverVault
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl mb-2" style={{ color: 'hsl(var(--ink))' }}>{proposal.title}</h1>
            <div className="flex items-center gap-4 font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))' }}>
              <span>Client: <strong style={{ color: 'hsl(var(--ink))' }}>{proposal.client}</strong></span>
              <span>Value: <strong className="font-mono" style={{ color: 'hsl(var(--ink))' }}>${proposal.value.toLocaleString()} {proposal.currency}</strong></span>
            </div>
          </motion.div>

          {/* Progress bar */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Workflow Progress</span>
              <span className="font-mono text-xs" style={{ color: 'hsl(var(--accent))' }}>{doneCount}/{totalCount} steps completed</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
                initial={{ width: 0 }} animate={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }} transition={{ duration: 1, delay: 0.3 }} />
            </div>
          </motion.div>

          {/* Consent chain info */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="border rounded-xl p-5 mb-8"
            style={{ borderColor: 'hsl(var(--accent) / 0.2)', background: 'hsl(var(--accent-light))' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--accent) / 0.15)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--accent))' }}>Consent-Chained Workflow</span>
                <p className="font-body text-xs mt-1" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>
                  This proposal is built on DeliverVault's consent chain. Each step requires explicit approval
                  before proceeding. Tokens are issued via Auth0 Token Vault with minimal scopes and auto-expire after 24 hours.
                  Every action is logged in an immutable audit trail.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Steps timeline */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="font-body text-lg font-semibold mb-4" style={{ color: 'hsl(var(--ink))' }}>Workflow Steps</h3>
            <div className="space-y-3">
              {steps.map((step, i) => {
                const style = statusStyles[step.status] || statusStyles.pending;
                return (
                  <motion.div key={step.id}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                    className="border rounded-xl p-4 md:p-5"
                    style={{ borderColor: step.status === 'active' ? 'hsl(var(--accent))' : step.status === 'done' ? 'hsl(var(--dv-success) / 0.3)' : 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-mono text-sm font-bold"
                          style={{
                            background: step.status === 'done' ? 'hsl(var(--dv-success))' : step.status === 'active' ? 'hsl(var(--accent))' : 'hsl(var(--bg-primary))',
                            color: step.status === 'done' || step.status === 'active' ? '#fff' : 'hsl(var(--ink-tertiary))',
                          }}>
                          {step.status === 'done' ? '✓' : i + 1}
                        </div>
                        {step.status === 'active' && (
                          <div className="w-[2px] h-4 rounded-full mx-auto mt-1" style={{ background: 'hsl(var(--accent))' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{serviceIcon(step.service)}</span>
                          <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{step.label}</span>
                          <span className="font-body text-[10px] rounded-full px-2 py-0.5" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                        </div>
                        {step.description && (
                          <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.6 }}>{step.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                          {step.estimatedDays && <span>⏱ {step.estimatedDays} days</span>}
                          {step.service && <span>🔗 {step.service}</span>}
                          {step.requiresApproval && <span style={{ color: 'hsl(var(--dv-warning))' }}>🔒 Requires approval</span>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="mt-12 pt-6 border-t text-center" style={{ borderColor: 'hsl(var(--border))' }}>
            <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              Shared securely via DeliverVault · Consent-chained proposal workflow platform
            </p>
            <Link to="/" className="font-body text-xs mt-2 inline-block" style={{ color: 'hsl(var(--accent))' }}>
              Try DeliverVault free →
            </Link>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
