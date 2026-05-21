import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MagneticButton from '@/components/MagneticButton';

interface ServiceActionModalProps {
  open: boolean;
  onClose: () => void;
  service: string;
  stepName: string;
  onConfirm: (data: Record<string, string>) => void;
}

const serviceConfig: Record<string, { label: string; icon: string; fields: { key: string; label: string; placeholder: string; multiline?: boolean; defaultValue?: string }[] }> = {
  'Gmail read': { label: 'Gmail', icon: '📧', fields: [] },
  'Gmail send': {
    label: 'Gmail — Send Email',
    icon: '📧',
    fields: [
      { key: 'to', label: 'To email', placeholder: 'client@example.com' },
      { key: 'subject', label: 'Subject (optional)', placeholder: 'Re: Proposal — Brand Refresh Project' },
      { key: 'body', label: 'Message', placeholder: 'Dear Sarah, ...', multiline: true },
    ],
  },
  'GitHub repo': {
    label: 'GitHub — Create Issue',
    icon: '🐙',
    fields: [
      { key: 'owner_repo', label: 'Repository', placeholder: 'owner/repo', defaultValue: localStorage.getItem('dv_github_repo') || '' },
      { key: 'title', label: 'Issue title', placeholder: 'Project kickoff: Brand Refresh' },
      { key: 'body', label: 'Description', placeholder: 'Details about the project...', multiline: true },
    ],
  },
  Mentor: {
    label: 'Mentor Delegation',
    icon: '👤',
    fields: [
      { key: 'email', label: 'Mentor email', placeholder: 'mentor@example.com' },
      { key: 'message', label: 'Instructions', placeholder: 'Please review the design phase...', multiline: true },
    ],
  },
  'Groq Llama': { label: 'Groq AI', icon: '🤖', fields: [] },
  Slack: {
    label: 'Slack — Post Message',
    icon: '💬',
    fields: [
      { key: 'channel', label: 'Channel', placeholder: '#general', defaultValue: '#general' },
      { key: 'message', label: 'Message Text', placeholder: 'New proposal approved!', multiline: true },
    ],
  },
  Notion: {
    label: 'Notion — Create Page',
    icon: '📝',
    fields: [
      { key: 'databaseId', label: 'Database ID', placeholder: '12345678... (UUID)' },
      { key: 'title', label: 'Page Title', placeholder: 'DeliverVault Proposal...' },
      { key: 'body', label: 'Summary Content', placeholder: 'This document presents...', multiline: true },
    ],
  },
};

export default function ServiceActionModal({ open, onClose, service, stepName, onConfirm }: ServiceActionModalProps) {
  // Normalize service name for lookup
  const normalizedSvc = (service || '').toLowerCase();
  let lookupKey = service;
  
  if (normalizedSvc === 'gmail' || normalizedSvc === 'gmail send') lookupKey = 'Gmail send';
  else if (normalizedSvc.includes('github')) lookupKey = 'GitHub repo';
  else if (normalizedSvc.includes('slack')) lookupKey = 'Slack';
  else if (normalizedSvc.includes('notion')) lookupKey = 'Notion';
  else if (normalizedSvc.includes('mentor')) lookupKey = 'Mentor';
  else if (normalizedSvc.includes('groq') || normalizedSvc.includes('ai')) lookupKey = 'Groq Llama';

  const config = serviceConfig[lookupKey] || { label: service, icon: '⚡', fields: [] };
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize form whenever opening or service changes
  useEffect(() => {
    if (open) {
      setFormData(Object.fromEntries(config.fields.map(f => [f.key, f.defaultValue || ''])));
    }
  }, [open, service]);

  const handleSubmit = () => {
    setSubmitting(true);
    // Save GitHub repo for next time
    if (service === 'GitHub repo' && formData.owner_repo) {
      localStorage.setItem('dv_github_repo', formData.owner_repo);
    }
    setTimeout(() => {
      onConfirm(formData);
      setSubmitting(false);
      onClose();
    }, 1200);
  };

  // Auto-confirm if no fields needed
  if (config.fields.length === 0 && open) {
    setTimeout(() => { onConfirm({}); onClose(); }, 300);
    return null;
  }

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
            className="relative z-10 w-full max-w-[460px] rounded-2xl border"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{config.icon}</span>
                <div>
                  <h3 className="font-body text-base font-semibold" style={{ color: 'hsl(var(--ink))' }}>{config.label}</h3>
                  <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Approving: {stepName}</p>
                </div>
              </div>
              <motion.button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ color: 'hsl(var(--ink-tertiary))' }}
                whileHover={{ background: 'hsl(var(--bg-surface))' }}>×</motion.button>
            </div>

            <div className="p-5 space-y-4">
              {config.fields.map(field => (
                <div key={field.key}>
                  <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>{field.label}</label>
                  {field.multiline ? (
                    <textarea value={formData[field.key] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 min-h-[100px] resize-y"
                      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as any}
                      placeholder={field.placeholder} />
                  ) : (
                    <input value={formData[field.key] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as any}
                      placeholder={field.placeholder} />
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'hsl(var(--accent-light))' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <p className="font-body text-[11px]" style={{ color: 'hsl(var(--accent))' }}>
                  Token Vault will issue a scoped token for this action only.
                </p>
              </div>

              <MagneticButton loading={submitting} onClick={handleSubmit} className="w-full">
                Approve & Execute →
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
