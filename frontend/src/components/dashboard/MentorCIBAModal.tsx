import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MagneticButton from '@/components/MagneticButton';
import { requestCIBAApproval, inviteMentor, isDemoMode } from '@/services/api';
import { toast } from 'sonner';

type Tab = 'push' | 'email';

export default function MentorCIBAModal({ open, onClose, onApproved, proposalId, stepId }: {
  open: boolean;
  onClose: () => void;
  onApproved: () => void;
  proposalId?: string | null;
  stepId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>('push');
  const [mentorId, setMentorId] = useState('');
  const [mentorEmail, setMentorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [pushStatus, setPushStatus] = useState<'idle' | 'waiting' | 'approved' | 'denied' | 'expired'>('idle');
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [reviewUrl, setReviewUrl] = useState('');

  useEffect(() => {
    if (!open) {
      setPushStatus('idle');
      setEmailSent(false);
      setReviewUrl('');
      setCountdown(300);
    }
  }, [open]);

  useEffect(() => {
    if (pushStatus !== 'waiting') return;
    const timer = setInterval(() => setCountdown(c => {
      if (c <= 1) {
        setPushStatus('expired');
        return 0;
      }
      return c - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [pushStatus]);

  const handlePush = useCallback(async () => {
    if (!mentorId.trim()) {
      toast.error('Enter the mentor\'s Auth0 user ID');
      return;
    }
    setPushing(true);

    if (isDemoMode() || !proposalId || !stepId) {
      await new Promise(r => setTimeout(r, 1500));
      setPushing(false);
      setPushStatus('waiting');
      const approveTimer = setTimeout(() => {
        setPushStatus('approved');
        setTimeout(() => { onApproved(); onClose(); }, 1500);
      }, 8000 + Math.random() * 7000);
      return () => clearTimeout(approveTimer);
    }

    try {
      const result = await requestCIBAApproval(proposalId, stepId, mentorId, message || undefined);
      setPushing(false);
      if (result?.authReqId) {
        setPushStatus('waiting');
        pollCIBA(result.authReqId);
      } else {
        toast.error('Failed to send push request');
      }
    } catch (err: unknown) {
      setPushing(false);
      toast.error('Failed to send CIBA request');
    }
  }, [mentorId, message, proposalId, stepId, onApproved, onClose]);

  const pollCIBA = useCallback(async (authReqId: string) => {
    const { pollCIBAStatus } = await import('@/services/api');
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const result = await pollCIBAStatus(authReqId);
        if (result?.status === 'approved') {
          clearInterval(interval);
          setPushStatus('approved');
          setTimeout(() => { onApproved(); onClose(); }, 1500);
        } else if (result?.status === 'denied') {
          clearInterval(interval);
          setPushStatus('denied');
          toast.error('Mentor denied the request');
        } else if (result?.status === 'expired' || attempts >= maxAttempts) {
          clearInterval(interval);
          setPushStatus('expired');
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPushStatus('expired');
        }
      }
    }, 5000);
  }, [onApproved, onClose]);

  const handleEmailSend = useCallback(async () => {
    if (!mentorEmail.trim()) {
      toast.error('Enter the mentor\'s email address');
      return;
    }
    setEmailSending(true);

    if (isDemoMode() || !proposalId || !stepId) {
      await new Promise(r => setTimeout(r, 1500));
      setEmailSending(false);
      setEmailSent(true);
      setReviewUrl(`${window.location.origin}/mentor/demo_${Date.now()}`);
      return;
    }

    try {
      const result = await inviteMentor(proposalId, stepId, mentorEmail);
      setEmailSending(false);
      
      if (result?.reviewUrl) {
        setReviewUrl(result.reviewUrl);
      }

      if (result?.emailError) {
        toast.warning('Email delivery failed: ' + result.emailError);
        // Still mark as sent so they can see the manual link
        setEmailSent(true);
      } else {
        setEmailSent(true);
        toast.success('Mentor invitation sent');
      }
    } catch (err: any) {
      setEmailSending(false);
      toast.error(err.response?.data?.error || 'Failed to send invitation');
    }
  }, [mentorEmail, proposalId, stepId]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative z-10 w-full max-w-[520px] rounded-2xl border"
        style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))' }}>
          <div>
            <h3 className="font-display text-lg" style={{ color: 'hsl(var(--ink))' }}>👤 Mentor Sign-off</h3>
            <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Request approval via CIBA push or email link</p>
          </div>
          <motion.button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: 'hsl(var(--ink-tertiary))' }}
            whileHover={{ background: 'hsl(var(--bg-surface))' }}>×</motion.button>
        </div>

        <div className="flex border-b" style={{ borderColor: 'hsl(var(--border))' }}>
          {([['push', '📱 Push Notification'], ['email', '📧 Email Link']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 py-3 font-body text-sm text-center relative transition-colors"
              style={{ color: tab === key ? 'hsl(var(--accent))' : 'hsl(var(--ink-tertiary))' }}>
              {label}
              {tab === key && (
                <motion.div layoutId="mentorTab" className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: 'hsl(var(--accent))' }} />
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {tab === 'push' && (
              <motion.div key="push" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                {pushStatus === 'idle' && (
                  <>
                    <div>
                      <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Mentor's Auth0 User ID</label>
                      <input value={mentorId} onChange={e => setMentorId(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
                        placeholder="auth0|62abc..." />
                      <p className="font-body text-[11px] mt-1.5" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                        Mentor will get a push on their Guardian app
                      </p>
                    </div>
                    {message !== undefined && (
                      <div>
                        <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Binding message (optional)</label>
                        <input value={message} onChange={e => setMessage(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
                          placeholder="Approve step 3 of Brand Refresh" />
                      </div>
                    )}
                    <MagneticButton loading={pushing} onClick={handlePush}>Send Push Request</MagneticButton>
                  </>
                )}
                {pushStatus === 'waiting' && (
                  <div className="text-center py-4">
                    <motion.div className="w-16 h-16 mx-auto mb-4 rounded-full border-[3px] flex items-center justify-center"
                      style={{ borderColor: 'hsl(var(--accent))', borderTopColor: 'transparent' }}
                      animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                      <span className="text-lg">📱</span>
                    </motion.div>
                    <p className="font-body text-sm font-semibold mb-1" style={{ color: 'hsl(var(--ink))' }}>Waiting for mentor...</p>
                    <p className="font-mono text-lg mb-2" style={{ color: 'hsl(var(--accent))' }}>{mins}:{secs.toString().padStart(2, '0')}</p>
                    <div className="w-full h-1 rounded-full overflow-hidden max-w-[200px] mx-auto" style={{ background: 'hsl(var(--border))' }}>
                      <motion.div className="h-full rounded-full" style={{ background: 'hsl(var(--accent))' }}
                        animate={{ width: ['0%', '100%'] }} transition={{ duration: 3, repeat: Infinity }} />
                    </div>
                    <p className="font-body text-xs mt-3" style={{ color: 'hsl(var(--ink-tertiary))' }}>Polling every 5 seconds...</p>
                  </div>
                )}
                {pushStatus === 'approved' && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                    <motion.div className="text-5xl mb-3" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>✅</motion.div>
                    <p className="font-body text-lg" style={{ color: 'hsl(var(--dv-success))' }}>Mentor approved!</p>
                    <p className="font-body text-xs mt-1" style={{ color: 'hsl(var(--ink-tertiary))' }}>Updating workflow...</p>
                  </motion.div>
                )}
                {pushStatus === 'denied' && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                    <div className="text-5xl mb-3">❌</div>
                    <p className="font-body text-lg" style={{ color: 'hsl(var(--dv-danger))' }}>Request denied</p>
                    <motion.button onClick={() => setPushStatus('idle')} className="mt-4 font-body text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }} whileHover={{ background: 'hsl(var(--bg-surface))' }}>Try again</motion.button>
                  </motion.div>
                )}
                {pushStatus === 'expired' && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                    <div className="text-5xl mb-3">⏰</div>
                    <p className="font-body text-lg" style={{ color: 'hsl(var(--dv-warning))' }}>Request expired</p>
                    <motion.button onClick={() => { setPushStatus('idle'); setCountdown(300); }} className="mt-4 font-body text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }} whileHover={{ background: 'hsl(var(--bg-surface))' }}>Try again</motion.button>
                  </motion.div>
                )}
              </motion.div>
            )}
            {tab === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                {!emailSent ? (
                  <>
                    <div>
                      <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Mentor's email</label>
                      <input value={mentorEmail} onChange={e => setMentorEmail(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
                        placeholder="mentor@example.com" />
                    </div>
                    <div>
                      <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Message (optional)</label>
                      <textarea value={message} onChange={e => setMessage(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 font-body text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2"
                        style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
                        placeholder="Please review step 3 of this proposal..." />
                    </div>
                    <MagneticButton loading={emailSending} onClick={handleEmailSend}>Send Review Link</MagneticButton>
                  </>
                ) : (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
                    <div className="text-3xl mb-3">✉️</div>
                    <p className="font-body text-sm" style={{ color: 'hsl(var(--dv-success))' }}>Review link sent to {mentorEmail} ✅</p>
                    {reviewUrl && (
                      <motion.button onClick={() => {
                        navigator.clipboard?.writeText(reviewUrl);
                        toast.success('Link copied!');
                      }}
                        className="mt-3 font-body text-xs px-3 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                        whileHover={{ borderColor: 'hsl(var(--accent))' }}
                      >
                        📋 Copy review link
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
