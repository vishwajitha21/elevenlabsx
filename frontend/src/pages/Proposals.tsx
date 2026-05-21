import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from './Dashboard';
import MagneticButton from '@/components/MagneticButton';
import { getProposals, createProposal, deleteProposal, shareProposal, getSocket, type Proposal } from '@/services/api';
import { useAuth, isDemoMode } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Local Proposal shape (used for display + sorting) ─── */
interface LocalProposal {
  id: string;
  client: string;
  subject: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'active' | 'archived';
  date: string;
  amount: string;
  amountRaw: number;
  brief: string;
  dateRaw: number;
  rawText?: string;
  shareUrl?: string;
  currency: string;
}

/* ─── Mock fallback data ─── */
const MOCK_PROPOSALS: LocalProposal[] = [
  { id: 'mock-1', client: 'Sarah Kim', subject: 'Brand Refresh Project', status: 'sent', date: 'Mar 21, 2026', amount: '$4,200', amountRaw: 4200, brief: 'Complete brand identity overhaul including logo, color palette, typography, and brand guidelines document.', dateRaw: 20260321, currency: 'USD' },
  { id: 'mock-2', client: 'James Chen', subject: 'E-commerce Platform', status: 'draft', date: 'Mar 20, 2026', amount: '$8,500', amountRaw: 8500, brief: 'Full-stack e-commerce platform with inventory management, payment processing, and admin dashboard.', dateRaw: 20260320, currency: 'USD' },
  { id: 'mock-3', client: 'Maria Lopez', subject: 'Marketing Campaign', status: 'approved', date: 'Mar 18, 2026', amount: '$2,800', amountRaw: 2800, brief: 'Q2 digital marketing campaign across social media, email, and paid advertising channels.', dateRaw: 20260318, currency: 'USD' },
  { id: 'mock-4', client: 'David Park', subject: 'Mobile App Design', status: 'rejected', date: 'Mar 15, 2026', amount: '$6,000', amountRaw: 6000, brief: 'iOS and Android app design with user research, wireframes, and high-fidelity prototypes.', dateRaw: 20260315, currency: 'USD' },
  { id: 'mock-5', client: 'Emma Wilson', subject: 'Website Redesign', status: 'sent', date: 'Mar 12, 2026', amount: '$3,400', amountRaw: 3400, brief: 'Responsive website redesign with modern UI patterns and improved conversion flow.', dateRaw: 20260312, currency: 'USD' },
  { id: 'mock-6', client: 'Oliver Brown', subject: 'Dashboard Analytics', status: 'draft', date: 'Mar 8, 2026', amount: '$5,800', amountRaw: 5800, brief: 'Real-time analytics dashboard with customizable widgets and data export capabilities.', dateRaw: 20260308, currency: 'USD' },
];

function mapApiProposal(p: Proposal): LocalProposal {
  const d = new Date(p.createdAt);
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRaw = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const amountRaw = p.value || 0;
  const amount = p.currency === 'USD' ? `$${amountRaw.toLocaleString()}` : `${amountRaw.toLocaleString()} ${p.currency || 'USD'}`;
  return {
    id: p._id,
    client: p.client || 'Unknown',
    subject: p.title || 'Untitled',
    status: (p.status === 'active' ? 'sent' : p.status) as LocalProposal['status'],
    date: dateStr,
    amount,
    amountRaw,
    brief: p.rawText || p.steps?.map(s => s.description || s.label).join('. ') || 'No details available.',
    dateRaw,
    rawText: p.rawText,
    shareUrl: p.shareUrl,
    currency: p.currency || 'USD',
  };
}

const statusStyles: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))' },
  sent: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' },
  active: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' },
  approved: { bg: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' },
  rejected: { bg: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))' },
  archived: { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))' },
};

type SortField = 'date' | 'amount' | 'status' | 'client';
type SortDir = 'asc' | 'desc';

export default function Proposals() {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localProposals, setLocalProposals] = useState<LocalProposal[]>(MOCK_PROPOSALS);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDemo } = useAuth();

  // ─── Fetch proposals from API ───
  const { data: apiData, isLoading, isError } = useQuery({
    queryKey: ['proposals', filter === 'all' ? undefined : filter],
    queryFn: () => getProposals(filter !== 'all' ? { status: filter } : undefined),
    enabled: !isDemoMode(),
    retry: 1,
    staleTime: 30_000,
  });

  // Merge API data with local state
  const proposals = isLoading || isError || !apiData?.proposals?.length
    ? localProposals
    : apiData.proposals.map(mapApiProposal);

  // ─── Socket listener for real-time updates ───
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) return;

    const handlers: Array<[string, (...args: unknown[]) => void]> = [
      ['proposal:created', () => queryClient.invalidateQueries({ queryKey: ['proposals'] })],
      ['proposal:updated', () => queryClient.invalidateQueries({ queryKey: ['proposals'] })],
      ['proposal:deleted', () => queryClient.invalidateQueries({ queryKey: ['proposals'] })],
      ['step:approved', () => queryClient.invalidateQueries({ queryKey: ['proposals'] })],
      ['step:revoked', () => queryClient.invalidateQueries({ queryKey: ['proposals'] })],
    ];

    handlers.forEach(([event, handler]) => socket.on(event, handler));
    return () => { handlers.forEach(([event, handler]) => socket.off(event, handler)); };
  }, [queryClient]);

  // ─── Mutations ───
  const deleteMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal revoked');
    },
    onError: () => {
      toast.error('Failed to revoke proposal');
    },
  });

  const shareMutation = useMutation({
    mutationFn: shareProposal,
    onSuccess: (data) => {
      toast.success('Share link generated!');
      if (data?.shareUrl) {
        navigator.clipboard?.writeText(data.shareUrl).catch(() => {});
      }
    },
    onError: () => {
      toast.error('Failed to generate share link');
    },
  });

  const createMutation = useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('New proposal created');
    },
    onError: () => {
      toast.error('Failed to create proposal');
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <span style={{ color: 'hsl(var(--ink-tertiary))' }}>↕</span>;
    return <span style={{ color: 'hsl(var(--accent))' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const sorted = [...proposals]
    .filter(p => filter === 'all' || p.status === filter)
    .sort((a, b) => {
      let diff = 0;
      if (sortField === 'date') diff = a.dateRaw - b.dateRaw;
      else if (sortField === 'amount') diff = a.amountRaw - b.amountRaw;
      else if (sortField === 'status') diff = a.status.localeCompare(b.status);
      else if (sortField === 'client') diff = a.client.localeCompare(b.client);
      return sortDir === 'asc' ? diff : -diff;
    });

  const handleRevoke = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDemoMode()) {
      setLocalProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' as const } : p));
      toast.success('🔒 Proposal revoked (demo)');
    } else {
      deleteMutation.mutate(id);
    }
    setSelectedId(null);
  }, [deleteMutation]);

  const handleDuplicate = useCallback((proposal: LocalProposal, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRaw = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const newProposal: LocalProposal = {
      ...proposal,
      id: `local-${Date.now()}`,
      subject: `${proposal.subject} (copy)`,
      status: 'draft',
      date: dateStr,
      dateRaw,
    };
    setLocalProposals(prev => [newProposal, ...prev]);
    if (proposal.rawText && !isDemoMode()) {
      createMutation.mutate(proposal.rawText);
    }
    toast.success('📋 Proposal duplicated as draft');
  }, [createMutation]);

  const handleShareLink = useCallback((proposal: LocalProposal, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDemoMode()) {
      const link = `https://delivervault.dev/share/proposal-${proposal.id}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      setCopiedId(proposal.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('🔗 Share link copied (demo)!');
    } else {
      setCopiedId(proposal.id);
      shareMutation.mutate(proposal.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [shareMutation]);

  const handleNewProposal = () => {
    navigate('/dashboard');
  };

  const filters = ['all', 'draft', 'sent', 'approved', 'rejected'];
  const sortColumns: { field: SortField; label: string }[] = [
    { field: 'client', label: 'Client' },
    { field: 'date', label: 'Date' },
    { field: 'amount', label: 'Amount' },
    { field: 'status', label: 'Status' },
  ];

  const totalValue = sorted.reduce((sum, p) => sum + p.amountRaw, 0);

  return (
    <DashboardLayout title="Proposals">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-body text-lg font-semibold" style={{ color: 'hsl(var(--ink))' }}>Your Proposals</h3>
            <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))' }}>
              {sorted.length} proposals · <span className="font-mono">${totalValue.toLocaleString()}</span> total value
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MagneticButton onClick={handleNewProposal}>New proposal +</MagneticButton>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="font-body text-xs px-3 py-1.5 rounded-full capitalize transition-all duration-[120ms]"
                style={{
                  background: filter === f ? 'hsl(var(--accent-light))' : 'transparent',
                  color: filter === f ? 'hsl(var(--accent))' : 'hsl(var(--ink-secondary))',
                  border: `1px solid ${filter === f ? 'hsl(var(--accent))' : 'hsl(var(--border))'}`,
                }}>
                {f}
              </button>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Sort:</span>
            {sortColumns.map(col => (
              <button key={col.field} onClick={() => handleSort(col.field)}
                className="flex items-center gap-1 font-body text-xs px-2.5 py-1 rounded-lg border transition-all"
                style={{
                  borderColor: sortField === col.field ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                  color: sortField === col.field ? 'hsl(var(--accent))' : 'hsl(var(--ink-secondary))',
                  background: sortField === col.field ? 'hsl(var(--accent-light))' : 'transparent',
                }}>
                {col.label} {sortIcon(col.field)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="font-body text-sm"
              style={{ color: 'hsl(var(--ink-tertiary))' }}>
              Loading proposals…
            </motion.div>
          </div>
        )}

        {/* Proposals list */}
        <div className="space-y-3">
          {!isLoading && (
            <AnimatePresence mode="popLayout">
              {sorted.map((proposal, i) => (
                <motion.div key={proposal.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="border rounded-xl p-4 md:p-5 cursor-pointer transition-all duration-[120ms]"
                  style={{
                    borderColor: selectedId === proposal.id ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                    background: 'hsl(var(--bg-surface))',
                    borderLeftWidth: proposal.status === 'approved' ? 3 : proposal.status === 'rejected' ? 3 : 1,
                    borderLeftColor: proposal.status === 'approved' ? 'hsl(var(--dv-success))' : proposal.status === 'rejected' ? 'hsl(var(--dv-danger))' : 'hsl(var(--border))',
                  }}
                  onClick={() => setSelectedId(selectedId === proposal.id ? null : proposal.id)}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{proposal.subject}</span>
                        <span className="font-body text-[10px] rounded-full px-2 py-0.5 capitalize"
                          style={{ background: (statusStyles[proposal.status] || statusStyles.draft).bg, color: (statusStyles[proposal.status] || statusStyles.draft).color }}>
                          {proposal.status}
                        </span>
                      </div>
                      <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                        {proposal.client} · {proposal.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{proposal.amount}</span>
                      <motion.button
                        onClick={e => handleShareLink(proposal, e)}
                        className="font-mono text-[10px] px-2 py-1 rounded-lg border transition-colors"
                        style={{
                          borderColor: copiedId === proposal.id ? 'hsl(var(--dv-success))' : 'hsl(var(--border))',
                          color: copiedId === proposal.id ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))',
                        }}
                        whileHover={{ scale: 1.03 }}
                        title="Copy share link">
                        {copiedId === proposal.id ? '✓' : '🔗'}
                      </motion.button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard?id=${proposal.id}`); }}
                        className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors duration-[120ms] border-[hsl(var(--accent))] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent-light))]"
                      >
                        Open
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedId(selectedId === proposal.id ? null : proposal.id); }}
                        className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors duration-[120ms]"
                        style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(var(--accent))'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border))'}>
                        {selectedId === proposal.id ? 'Close' : 'Details'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  <AnimatePresence>
                    {selectedId === proposal.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: 'hsl(var(--border))' }}>
                          <div>
                            <span className="font-mono text-[10px] block mb-2" style={{ color: 'hsl(var(--ink-tertiary))' }}>Brief</span>
                            <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))', lineHeight: 1.7 }}>{proposal.brief}</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: 'Client', value: proposal.client },
                              { label: 'Amount', value: proposal.amount },
                              { label: 'Date', value: proposal.date },
                              { label: 'Status', value: proposal.status },
                            ].map(item => (
                              <div key={item.label} className="border rounded-lg p-3" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
                                <span className="font-mono text-[10px] block mb-1" style={{ color: 'hsl(var(--ink-tertiary))' }}>{item.label}</span>
                                <span className="font-body text-sm font-medium capitalize" style={{ color: 'hsl(var(--ink))' }}>{item.value}</span>
                              </div>
                            ))}
                          </div>

                          {/* Share link input */}
                          <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
                            <span className="font-mono text-[11px] flex-1 truncate" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                              {proposal.shareUrl || `https://delivervault.dev/share/proposal-${proposal.id}`}
                            </span>
                            <motion.button
                              onClick={e => handleShareLink(proposal, e)}
                              className="font-body text-xs px-3 py-1 rounded-lg flex-shrink-0"
                              style={{ background: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' }}
                              whileHover={{ scale: 1.02 }}>
                              {copiedId === proposal.id ? 'Copied! ✓' : 'Copy link'}
                            </motion.button>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <MagneticButton onClick={() => navigate(`/dashboard?id=${proposal.id}`)}>Open in Dashboard →</MagneticButton>
                            {proposal.status === 'draft' && (
                              <motion.button onClick={() => navigate('/dashboard')} className="font-body text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }} whileHover={{ borderColor: 'hsl(var(--accent))' }}>Edit & Parse</motion.button>
                            )}
                            {(proposal.status === 'sent' || proposal.status === 'active') && (
                              <motion.button
                                onClick={e => handleRevoke(proposal.id, e)}
                                disabled={deleteMutation.isPending}
                                className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                                style={{ borderColor: 'hsl(var(--dv-danger))', color: 'hsl(var(--dv-danger))' }}
                                whileHover={{ background: 'hsl(var(--dv-danger) / 0.08)' }}>
                                {deleteMutation.isPending ? 'Revoking…' : '🔒 Revoke proposal'}
                              </motion.button>
                            )}
                            <motion.button
                              onClick={e => handleDuplicate(proposal, e)}
                              disabled={createMutation.isPending}
                              className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                              whileHover={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>
                              📋 Duplicate
                            </motion.button>
                            <motion.button
                              onClick={e => handleShareLink(proposal, e)}
                              disabled={shareMutation.isPending}
                              className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                              whileHover={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>
                              {shareMutation.isPending ? 'Sharing…' : '🔗 Share link'}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!isLoading && sorted.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-16 border rounded-xl" style={{ borderColor: 'hsl(var(--border))' }}>
              <div className="text-3xl mb-3">✉</div>
              <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>No proposals in this category</p>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
