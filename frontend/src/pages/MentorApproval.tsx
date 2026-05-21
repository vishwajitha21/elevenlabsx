import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { getMentorRequest, submitMentorDecision, isDemoMode } from '@/services/api';
import { mockProposalText } from '@/services/mock';
import { toast } from 'sonner';

interface MentorProposal {
  proposal: {
    title: string;
    client: string;
    steps: Array<{ id: string; label: string; description?: string; status: string }>;
    value?: number;
    currency?: string;
  };
  step: { id: string; label: string; description?: string; status: string };
  mentorEmail: string;
}

export default function MentorApproval() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'review' | 'approved' | 'changes' | 'rejected' | 'error'>('loading');
  const [feedback, setFeedback] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [countdown, setCountdown] = useState(3599);
  const [submitting, setSubmitting] = useState(false);
  const [proposalData, setProposalData] = useState<MentorProposal | null>(null);

  // Fetch mentor request data
  useEffect(() => {
    async function fetchRequest() {
      try {
        const data = await getMentorRequest(token!);
        if (data?.proposal) {
          setProposalData(data as MentorProposal);
          setStatus('review');
        } else {
          setStatus('error');
        }
      } catch {
        // In demo mode or on error, use mock data
        if (isDemoMode()) {
          setProposalData({
            proposal: {
              title: 'Brand Refresh Project',
              client: 'Sarah Kim',
              steps: [
                { id: 'step-1', label: 'Discovery & Research', description: 'Brand audit, competitor analysis, mood boarding', status: 'done' },
                { id: 'step-2', label: 'Design Exploration', description: 'Logo concepts, color palette, typography', status: 'pending' },
                { id: 'step-3', label: 'Final Delivery', description: 'Brand guidelines document, asset handoff', status: 'pending' },
              ],
              value: 4200,
              currency: 'USD',
            },
            step: { id: 'step-2', label: 'Design Exploration', description: 'Logo concepts, color palette, typography', status: 'pending' },
            mentorEmail: 'mentor@example.com',
          });
          setStatus('review');
        } else {
          setStatus('error');
        }
      }
    }
    fetchRequest();
  }, [token]);

  // Countdown timer
  useEffect(() => {
    const i = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, []);

  const hrs = Math.floor(countdown / 3600);
  const mins = Math.floor((countdown % 3600) / 60);
  const secs = countdown % 60;

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      if (!isDemoMode()) {
        await submitMentorDecision(token!, 'approve', 'Approved via mentor review');
      }
      setStatus('approved');
    } catch {
      // Still show success in demo/local mode
      if (isDemoMode()) {
        setStatus('approved');
      } else {
        setStatus('error');
      }
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      if (!isDemoMode()) {
        await submitMentorDecision(token!, 'reject', 'Rejected by mentor');
      }
      setStatus('rejected');
    } catch {
      if (isDemoMode()) {
        setStatus('rejected');
      } else {
        setStatus('error');
      }
    }
    setSubmitting(false);
  };

  const handleRequestChanges = async () => {
    setSubmitting(true);
    try {
      if (!isDemoMode()) {
        await (await import('@/services/api')).submitMentorDecision(token!, 'reject', feedback || 'Changes requested by mentor');
      }
      setStatus('rejected');
    } catch (err: any) {
      console.error('[DEBUG] Mentor feedback failed:', err);
      if (isDemoMode()) {
        setStatus('rejected');
      } else {
        toast.error(`Submission failed: ${err.message}`);
      }
    }
    setSubmitting(false);
  };

  const title = proposalData?.proposal?.title || 'Proposal from Alex Chen';
  const client = proposalData?.proposal?.client || 'Sarah Kim';
  const steps = proposalData?.proposal?.steps || [];
  const stepLabel = proposalData?.step?.label || '';
  const mentorEmail = proposalData?.mentorEmail || '';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen"
      style={{ background: 'hsl(var(--bg-primary))' }}
    >
      {/* Expiry banner */}
      {status === 'review' && countdown < 3600 && (
        <div className="sticky top-0 z-10 py-2 px-4 text-center border-b font-body text-sm"
          style={{ background: 'hsl(var(--dv-warning) / 0.1)', borderColor: 'hsl(var(--dv-warning))', color: 'hsl(var(--dv-warning))' }}>
          This review link expires in {hrs}h {mins}m {secs}s · After expiry this link cannot be used.
        </div>
      )}

      <div className="max-w-[680px] mx-auto my-12 border rounded-2xl p-10" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
        <div className="font-mono text-xs mb-3" style={{ color: 'hsl(var(--ink-tertiary))' }}>DeliverVault · Mentor Review</div>
        <h1 className="font-display text-3xl mb-3" style={{ color: 'hsl(var(--ink))' }}>{title}</h1>
        <div className="font-body text-xs mb-8" style={{ color: 'hsl(var(--ink-tertiary))' }}>
          Client: {client} · Expires in {hrs}h {mins}m · {mentorEmail || 'alex@delivervault.dev'}
        </div>

        {status === 'loading' && (
          <div className="text-center py-16">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="font-body text-sm"
              style={{ color: 'hsl(var(--ink-tertiary))' }}>
              Loading proposal...
            </motion.div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="font-display text-xl mb-2" style={{ color: 'hsl(var(--ink))' }}>Link Expired or Invalid</h2>
            <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              This review link has expired, been used, or is invalid. Please request a new link from the proposal owner.
            </p>
          </div>
        )}

        {(status === 'review' || status === 'changes') && proposalData && (
          <>
            {/* Step under review */}
            <div className="mb-6 border rounded-xl p-4" style={{ borderColor: 'hsl(var(--accent))', background: 'hsl(var(--accent-light))' }}>
              <div className="font-mono text-[10px] mb-1" style={{ color: 'hsl(var(--accent))' }}>STEP UNDER REVIEW</div>
              <div className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{stepLabel}</div>
              {proposalData.step.description && (
                <p className="font-body text-xs mt-1" style={{ color: 'hsl(var(--ink-secondary))' }}>{proposalData.step.description}</p>
              )}
            </div>

            {/* Proposal steps timeline */}
            {steps.length > 0 && (
              <div className="mb-8">
                <span className="font-mono text-xs block mb-3" style={{ color: 'hsl(var(--ink-tertiary))' }}>Workflow Steps</span>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3 py-2 px-3 border rounded-lg"
                      style={{
                        borderColor: step.id === proposalData.step.id ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                        background: step.id === proposalData.step.id ? 'hsl(var(--accent-light))' : 'transparent',
                      }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] flex-shrink-0"
                        style={{
                          background: step.status === 'done' ? 'hsl(var(--dv-success))' : step.id === proposalData.step.id ? 'hsl(var(--accent))' : 'hsl(var(--bg-surface))',
                          color: step.status === 'done' ? '#fff' : step.id === proposalData.step.id ? '#fff' : 'hsl(var(--ink-tertiary))',
                        }}>
                        {step.status === 'done' ? '✓' : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-body text-xs font-medium block truncate" style={{ color: 'hsl(var(--ink))' }}>{step.label}</span>
                        {step.description && (
                          <span className="font-body text-[10px] block truncate" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.description}</span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: step.status === 'done' ? 'hsl(var(--dv-success) / 0.12)' : 'hsl(var(--bg-surface-hover))',
                          color: step.status === 'done' ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))',
                        }}>
                        {step.status === 'done' ? 'done' : 'pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposal draft text */}
            <div className="mb-8">
              <span className="font-mono text-xs block mb-2" style={{ color: 'hsl(var(--ink-tertiary))' }}>Proposal draft</span>
              <div className="border rounded-lg p-4 max-h-[320px] overflow-y-auto font-body text-[15px]"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {mockProposalText}
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-6 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
              {status === 'review' && (
                <>
                  <motion.button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="w-full h-11 rounded-lg font-body text-sm text-white transition-opacity disabled:opacity-60"
                    style={{ background: 'hsl(var(--dv-success))' }}
                    whileHover={{ scale: submitting ? 1 : 1.01 }}
                    whileTap={{ scale: submitting ? 1 : 0.99 }}>
                    {submitting ? 'Submitting...' : '✓ Approve and send this proposal'}
                  </motion.button>

                  <button
                    onClick={() => setStatus('changes')}
                    className="w-full h-11 rounded-lg font-body text-sm border transition-colors"
                    style={{ borderColor: 'hsl(var(--ink))', color: 'hsl(var(--ink))' }}>
                    ✏ Request changes
                  </button>

                  {!confirmReject && (
                    <button
                      onClick={() => setConfirmReject(true)}
                      className="w-full font-body text-sm py-2 transition-colors"
                      style={{ color: 'hsl(var(--dv-danger))' }}>
                      Reject proposal
                    </button>
                  )}

                  {confirmReject && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="font-body text-xs p-4 rounded-lg border"
                      style={{ borderColor: 'hsl(var(--dv-danger) / 0.3)', background: 'hsl(var(--dv-danger) / 0.04)', color: 'hsl(var(--ink-secondary))' }}>
                      <p className="mb-3">Are you sure? This will notify the freelancer and the proposal step will be revoked.</p>
                      <div className="flex gap-3">
                        <motion.button
                          onClick={handleReject}
                          disabled={submitting}
                          className="font-body text-xs px-4 py-2 rounded-lg text-white disabled:opacity-60"
                          style={{ background: 'hsl(var(--dv-danger))' }}
                          whileHover={{ scale: submitting ? 1 : 1.02 }}
                          whileTap={{ scale: submitting ? 1 : 0.98 }}>
                          {submitting ? 'Rejecting...' : 'Yes, reject'}
                        </motion.button>
                        <button
                          onClick={() => setConfirmReject(false)}
                          className="font-body text-xs px-4 py-2 rounded-lg border transition-colors"
                          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}>
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {status === 'changes' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Describe your requested changes..."
                    className="w-full border rounded-lg p-3 font-body text-sm min-h-[120px] resize-y focus:outline-none focus:ring-1"
                    style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))' }}
                  />
                  <div className="flex gap-2">
                    <motion.button
                      onClick={handleRequestChanges}
                      disabled={submitting || !feedback.trim()}
                      className="font-body text-sm border rounded-lg px-4 py-2 disabled:opacity-50"
                      style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
                      whileHover={{ scale: submitting ? 1 : 1.02 }}>
                      {submitting ? 'Sending...' : 'Send feedback →'}
                    </motion.button>
                    <button
                      onClick={() => setStatus('review')}
                      className="font-body text-sm px-4 py-2 rounded-lg transition-colors"
                      style={{ color: 'hsl(var(--ink-tertiary))' }}>
                      Back
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </>
        )}

        {status === 'approved' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="text-5xl mb-4">✅</motion.div>
            <span className="font-body text-lg font-semibold" style={{ color: 'hsl(var(--dv-success))' }}>Approved — agent notified</span>
            <p className="font-body text-xs mt-4" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              The proposal step has been approved and the workflow will continue. You can close this tab.
            </p>
          </motion.div>
        )}

        {status === 'rejected' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="text-5xl mb-4">🚫</motion.div>
            <span className="font-body text-lg font-semibold" style={{ color: 'hsl(var(--dv-danger))' }}>Proposal rejected</span>
            <p className="font-body text-xs mt-4" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              The freelancer has been notified. The proposal step has been revoked.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
