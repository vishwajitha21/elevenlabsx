import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import DarkModeToggle from '@/components/DarkModeToggle';
import { isDemoMode } from '@/contexts/AuthContext';

/* ─── Types ─── */
interface AdminUser {
  _id?: string;
  userId: string;
  streak: number;
  totalProposals: number;
  totalApprovals: number;
  lastActivity?: string;
}

interface AdminProposal {
  _id: string;
  userId?: string;
  title: string;
  client: string;
  value: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface AuditRow {
  _id: string;
  createdAt: string;
  action: string;
  status: string;
  userId?: string;
  proposalId?: string;
  stepId?: string;
  meta?: Record<string, unknown>;
}

type Tab = 'overview' | 'users' | 'proposals' | 'logs';

const statColors = [
  'hsl(var(--accent))',
  'hsl(var(--dv-success))',
  'hsl(var(--dv-warning))',
  'hsl(var(--dv-danger))',
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [overview, setOverview] = useState<{ totalUsers: number; totalProposals: number; totalApprovals: number } | null>(null);
  const [apiUsers, setApiUsers] = useState<AdminUser[]>([]);
  const [apiProposals, setApiProposals] = useState<AdminProposal[]>([]);
  const [apiAuditRows, setApiAuditRows] = useState<AuditRow[]>([]);
  const [proposalsPage, setProposalsPage] = useState(1);
  const [proposalsTotal, setProposalsTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(1);
  const [revokedTokens, setRevokedTokens] = useState<string[]>([]);
  const [suspendedUsers, setSuspendedUsers] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSuspendUser = (userId: string, name: string) => {
    setSuspendedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
    showToast(suspendedUsers.includes(userId) ? `${name} reinstated` : `${name} suspended`);
  };

  const handleRevokeToken = (tokenId: string) => {
    setRevokedTokens(prev => [...prev, tokenId]);
    showToast(`Token ${tokenId} revoked`);
  };

  // ─── Mock Data ───────────────────────────────────────────────
  const mockUsers = [
    { id: 'usr_a3f8', name: 'Alex Chen', email: 'alex@delivervault.dev', plan: 'Pro', proposals: 6, tokens: 3, status: 'active', joined: 'Mar 1, 2026' },
    { id: 'usr_b7g2', name: 'Sarah Kim', email: 'sarah@brandco.io', plan: 'Free', proposals: 2, tokens: 1, status: 'active', joined: 'Mar 8, 2026' },
    { id: 'usr_c1k9', name: 'James Chen', email: 'james@devstudio.co', plan: 'Pro', proposals: 4, tokens: 2, status: 'active', joined: 'Mar 12, 2026' },
    { id: 'usr_d4m3', name: 'Maria Lopez', email: 'maria@mktgpro.com', plan: 'Free', proposals: 1, tokens: 0, status: 'active', joined: 'Mar 15, 2026' },
    { id: 'usr_e8n5', name: 'David Park', email: 'david@startup.io', plan: 'Free', proposals: 0, tokens: 0, status: 'suspended', joined: 'Mar 18, 2026' },
  ];

  const mockAllProposals = [
    { id: 'p1', user: 'Alex Chen', client: 'Sarah Kim', subject: 'Brand Refresh', status: 'approved', amount: '$4,200', date: 'Mar 21' },
    { id: 'p2', user: 'Alex Chen', client: 'TechCorp', subject: 'E-commerce Platform', status: 'sent', amount: '$8,500', date: 'Mar 20' },
    { id: 'p3', user: 'James Chen', client: 'StartupXYZ', subject: 'Mobile App Design', status: 'draft', amount: '$6,000', date: 'Mar 19' },
    { id: 'p4', user: 'Sarah Kim', client: 'AgencyCo', subject: 'Marketing Campaign', status: 'approved', amount: '$2,800', date: 'Mar 18' },
    { id: 'p5', user: 'Alex Chen', client: 'Emma Wilson', subject: 'Website Redesign', status: 'sent', amount: '$3,400', date: 'Mar 12' },
    { id: 'p6', user: 'James Chen', client: 'Oliver Brown', subject: 'Dashboard Analytics', status: 'draft', amount: '$5,800', date: 'Mar 8' },
  ];

  const mockActiveTokens = [
    { id: 'tok_gmail_r4f8', user: 'Alex Chen', service: 'Gmail', scope: 'gmail.readonly', status: 'active', expires: '23h 14m' },
    { id: 'tok_gh_x1y6', user: 'James Chen', service: 'GitHub', scope: 'repo.create', status: 'active', expires: '22h 08m' },
    { id: 'tok_slack_m2n9', service: 'Slack', user: 'Alex Chen', scope: 'chat:write', status: 'active', expires: '19h 42m' },
    { id: 'tok_gmail_s5t9', service: 'Gmail', user: 'Sarah Kim', scope: 'gmail.send', status: 'active', expires: '1h 03m' },
  { id: 'tok_notion_p7k3', service: 'Notion', user: 'Maria Lopez', scope: 'pages:write', status: 'active', expires: '16h 30m' },
  ];

  // Fetch overview data
  useEffect(() => {
    if (!isDemoMode()) {
      fetch('/api/admin/overview')
        .then(r => r.json())
        .then(data => setOverview(data))
        .catch(() => {});
    } else {
      setOverview({ totalUsers: 5, totalProposals: 6, totalApprovals: 3 });
    }
  }, []);

  // Fetch users
  useEffect(() => {
    if (!isDemoMode()) {
      fetch('/api/admin/users')
        .then(r => r.json())
        .then(data => setApiUsers(data.users || []))
        .catch(() => {});
    }
  }, []);

  // Fetch proposals
  useEffect(() => {
    if (!isDemoMode()) {
      fetch(`/api/admin/proposals?page=${proposalsPage}&limit=20`)
        .then(r => r.json())
        .then(data => {
          setApiProposals(data.proposals || []);
          setProposalsTotal(data.total || 0);
        })
        .catch(() => {});
    }
  }, [proposalsPage]);

  // Fetch audit logs
  useEffect(() => {
    if (!isDemoMode()) {
      fetch(`/api/admin/audit?page=${auditPage}&limit=50`)
        .then(r => r.json())
        .then(data => {
          setApiAuditRows(data.entries || []);
          setAuditTotal(data.total || 0);
          setAuditPages(data.pages || 1);
        })
        .catch(() => {});
    }
  }, [auditPage]);

  // Merge data sources — show mock users in demo mode
  const displayUsers = apiUsers.length > 0
    ? apiUsers.map(u => ({
        ...u,
        id: u._id || u.userId || '',
        name: (u as Record<string, unknown>).name as string || u.userId || 'Unknown',
        email: (u as Record<string, unknown>).email as string || '',
        plan: (u as Record<string, unknown>).plan as string || 'Free',
        proposals: u.totalProposals || 0,
        tokens: 0,
        status: 'active' as string,
        joined: u.lastActivity ? new Date(u.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      }))
    : mockUsers.map(u => ({
        ...u,
        userId: u.id,
      }));
  const displayProposals = apiProposals.length > 0 ? apiProposals.map(p => ({
    id: p._id,
    user: p.userId || 'Unknown',
    client: p.client,
    subject: p.title,
    status: p.status,
    amount: p.value ? `$${p.value.toLocaleString()}` : '$0',
    date: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
  })) : [];
  const displayAudit = apiAuditRows.length > 0 ? apiAuditRows : [];

  const displayAuditRows = displayAudit.length > 0 ? displayAudit.map(e => ({
    _id: e._id,
    time: new Date(e.createdAt).toISOString().slice(11, 19),
    action: e.action,
    status: e.status,
    token: e.stepId || e.proposalId || '—',
    scopes: '—',
    duration: '—',
  })) : [];

  const filteredUsers = displayUsers.filter(u =>
    ((u.userId || '') + (u.name || '') + (u.email || '')).toLowerCase().includes(userSearch.toLowerCase())
  );

  const statusStyles: Record<string, { bg: string; color: string }> = {
    sent: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' },
    approved: { bg: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' },
    draft: { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))' },
    rejected: { bg: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))' },
    active: { bg: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' },
    warning: { bg: 'hsl(var(--dv-warning) / 0.15)', color: 'hsl(var(--dv-warning))' },
    pending: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' },
    suspended: { bg: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))' },
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '⌂' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'proposals', label: 'Proposals', icon: '✉' },
    { id: 'tokens', label: 'Active Tokens', icon: '🔑' },
    { id: 'logs', label: 'System Logs', icon: '📋' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--bg-primary))' }}>
      {/* Header */}
      <div className="border-b h-14 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20"
        style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-mono text-[10px] font-bold"
            style={{ background: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))' }}>ADM</div>
          <span className="font-display text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>Admin Panel</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border"
            style={{ borderColor: 'hsl(var(--dv-danger) / 0.3)', color: 'hsl(var(--dv-danger))' }}>No auth required</span>
        </div>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <Link to="/dashboard" className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto p-4 md:p-6">
        {/* Tab nav */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 font-body text-sm relative transition-colors"
              style={{ color: tab === t.id ? 'hsl(var(--accent))' : 'hsl(var(--ink-secondary))' }}>
              <span className="text-sm">{t.icon}</span>
              {t.label}
              {tab === t.id && (
                <motion.div layoutId="adminTab"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: 'hsl(var(--accent))' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Users', value: mockUsers.length, icon: '👥', color: statColors[0] },
                  { label: 'Total Proposals', value: mockAllProposals.length, icon: '✉', color: statColors[1] },
                  { label: 'Active Tokens', value: mockActiveTokens.filter(t => !revokedTokens.includes(t.id)).length, icon: '🔑', color: statColors[2] },
                  { label: 'Suspended', value: suspendedUsers.length, icon: '⚠', color: statColors[3] },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="border rounded-xl p-5" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                    <div className="text-2xl mb-1">{stat.icon}</div>
                    <div className="font-display text-3xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent activity */}
                <div className="border rounded-xl p-5" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                  <h3 className="font-body text-sm font-semibold mb-4" style={{ color: 'hsl(var(--ink))' }}>Recent Activity</h3>
                  <div className="space-y-3">
                    {[
                      { icon: '✉', text: 'Alex Chen sent a proposal to Sarah Kim', time: '2m ago', color: 'hsl(var(--accent))' },
                      { icon: '🔑', text: 'New Gmail token issued for James Chen', time: '8m ago', color: 'hsl(var(--dv-success))' },
                      { icon: '👤', text: 'Maria Lopez mentor delegation pending', time: '15m ago', color: 'hsl(var(--dv-warning))' },
                      { icon: '🔒', text: 'Token tok_gh_x1y6 expired for David Park', time: '1h ago', color: 'hsl(var(--dv-danger))' },
                      { icon: '✓', text: 'James Chen proposal approved by FinanceApp', time: '2h ago', color: 'hsl(var(--dv-success))' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-sm mt-0.5">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{item.text}</p>
                        </div>
                        <span className="font-mono text-[10px] flex-shrink-0" style={{ color: 'hsl(var(--ink-tertiary))' }}>{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan breakdown */}
                <div className="border rounded-xl p-5" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                  <h3 className="font-body text-sm font-semibold mb-4" style={{ color: 'hsl(var(--ink))' }}>Plan Distribution</h3>
                  <div className="space-y-4">
                    {[
                      { plan: 'Free', count: mockUsers.filter(u => u.plan === 'Free').length, total: mockUsers.length, color: 'hsl(var(--ink-tertiary))' },
                      { plan: 'Pro', count: mockUsers.filter(u => u.plan === 'Pro').length, total: mockUsers.length, color: 'hsl(var(--accent))' },
                    ].map(item => (
                      <div key={item.plan}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-body text-sm" style={{ color: 'hsl(var(--ink))' }}>{item.plan}</span>
                          <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{item.count}/{item.total}</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ background: 'hsl(var(--border))' }}>
                          <motion.div className="h-full rounded-full"
                            style={{ background: item.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / item.total) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                    <h4 className="font-body text-xs font-medium mb-3" style={{ color: 'hsl(var(--ink))' }}>Quick Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Revoke all tokens', color: 'hsl(var(--dv-danger))', border: 'hsl(var(--dv-danger) / 0.3)' },
                        { label: 'Export user list', color: 'hsl(var(--ink-secondary))', border: 'hsl(var(--border))' },
                        { label: 'Send announcement', color: 'hsl(var(--accent))', border: 'hsl(var(--accent) / 0.3)' },
                      ].map(action => (
                        <button key={action.label} onClick={() => showToast(`${action.label} — coming soon`)}
                          className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors"
                          style={{ borderColor: action.border, color: action.color }}>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* USERS TAB */}
          {tab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4 gap-4">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="border rounded-lg px-3 py-2 font-body text-sm focus:outline-none w-64"
                  style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))' }}
                />
                <span className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>{filteredUsers.length} users</span>
              </div>
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'hsl(var(--border))' }}>
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                      {['Name', 'Plan', 'Proposals', 'Tokens', 'Status', 'Joined', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-body font-medium text-xs" style={{ color: 'hsl(var(--ink))' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, i) => {
                      const isSuspended = suspendedUsers.includes(user.id) || user.status === 'suspended';
                      return (
                        <motion.tr key={user.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                          className="border-b transition-colors"
                          style={{ borderColor: 'hsl(var(--border))' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs flex-shrink-0"
                                style={{ background: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' }}>
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="font-body text-sm font-medium" style={{ color: 'hsl(var(--ink))' }}>{user.name}</div>
                                <div className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-body text-xs px-2 py-0.5 rounded-full"
                              style={{ background: user.plan === 'Pro' ? 'hsl(var(--accent-light))' : 'hsl(var(--bg-surface-hover))', color: user.plan === 'Pro' ? 'hsl(var(--accent))' : 'hsl(var(--ink-tertiary))' }}>
                              {user.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{user.proposals}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{user.tokens}</td>
                          <td className="px-4 py-3">
                            <span className="font-body text-[10px] px-2 py-0.5 rounded-full capitalize"
                              style={isSuspended ? statusStyles.suspended : statusStyles.active}>
                              {isSuspended ? 'suspended' : 'active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>{user.joined}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSuspendUser(user.id, user.name)}
                                className="font-body text-xs px-2 py-1 rounded border transition-colors"
                                style={isSuspended
                                  ? { borderColor: 'hsl(var(--dv-success) / 0.4)', color: 'hsl(var(--dv-success))' }
                                  : { borderColor: 'hsl(var(--dv-warning) / 0.4)', color: 'hsl(var(--dv-warning))' }}>
                                {isSuspended ? 'Reinstate' : 'Suspend'}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* PROPOSALS TAB */}
          {tab === 'proposals' && (
            <motion.div key="proposals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'hsl(var(--border))' }}>
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                      {['User', 'Client', 'Subject', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-body font-medium text-xs" style={{ color: 'hsl(var(--ink))' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayProposals.map((p, i) => (
                      <motion.tr key={p.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                        className="border-b transition-colors"
                        style={{ borderColor: 'hsl(var(--border))' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-4 py-3 font-body text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{p.user}</td>
                        <td className="px-4 py-3 font-body text-xs font-medium" style={{ color: 'hsl(var(--ink))' }}>{p.client}</td>
                        <td className="px-4 py-3 font-body text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{p.subject}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'hsl(var(--ink))' }}>{p.amount}</td>
                        <td className="px-4 py-3">
                          <span className="font-body text-[10px] px-2 py-0.5 rounded-full capitalize" style={statusStyles[p.status] || statusStyles.draft}>{p.status}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{p.date}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => showToast(`Viewing proposal #${p.id}`)}
                            className="font-body text-xs px-2 py-1 rounded border"
                            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}>
                            View
                          </button>
                        </td>
                      </motion.tr>
                    )}
                  </tbody>
                </table>
              </div>
              {displayProposals.length === 0 && (
                <div className="text-center py-8">
                  <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>No proposals yet</p>
                </div>
              )}
            </motion.div>
          )}

          {/* TOKENS TAB */}
          {tab === 'tokens' && (
            <motion.div key="tokens" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))' }}>
                  {mockActiveTokens.filter(t => !revokedTokens.includes(t.id)).length} active tokens across all users
                </p>
                <button onClick={() => { setRevokedTokens(mockActiveTokens.map(t => t.id)); showToast('⚠ All tokens revoked'); }}
                  className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: 'hsl(var(--dv-danger) / 0.4)', color: 'hsl(var(--dv-danger))' }}>
                  Revoke all
                </button>
              </div>
              <div className="space-y-3">
                {mockActiveTokens.map((token, i) => {
                  const isRevoked = revokedTokens.includes(token.id);
                  return (
                    <motion.div key={token.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="border rounded-xl p-4 flex items-center justify-between gap-4"
                      style={{ borderColor: isRevoked ? 'hsl(var(--border))' : 'hsl(var(--border))', background: isRevoked ? 'transparent' : 'hsl(var(--bg-surface))', opacity: isRevoked ? 0.5 : 1 }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: isRevoked ? 'hsl(var(--bg-surface-hover))' : 'hsl(var(--accent-light))' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isRevoked ? 'hsl(var(--ink-tertiary))' : 'hsl(var(--accent))'} strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-medium" style={{ color: 'hsl(var(--ink))' }}>{token.id}</span>
                            <span className="font-body text-[10px] px-1.5 py-0.5 rounded-full" style={isRevoked ? statusStyles.rejected : statusStyles[token.status] || statusStyles.active}>
                              {isRevoked ? 'revoked' : token.status}
                            </span>
                          </div>
                          <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                            {token.user} · {token.service} · <span className="font-mono">{token.scope}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {!isRevoked && token.expires !== '—' && (
                          <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>{token.expires}</span>
                        )}
                        {!isRevoked && (
                          <button onClick={() => handleRevokeToken(token.id)}
                            className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors"
                            style={{ borderColor: 'hsl(var(--dv-danger) / 0.4)', color: 'hsl(var(--dv-danger))' }}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* LOGS TAB */}
          {tab === 'logs' && (
            <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                  <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                    System audit log{displayAuditRows.length > 0 ? ` (${displayAuditRows.length} entries)` : ''}
                  </span>
                  <button onClick={async () => {
                    try {
                      const res = await fetch('/api/admin/audit/export?limit=5000');
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `delivervault-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast('Audit log exported');
                      } else {
                        showToast('Export failed — try again');
                      }
                    } catch { showToast('Export failed'); }
                  }}
                    className="font-body text-xs px-3 py-1 rounded-lg border"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}>
                    Export CSV
                  </button>
                </div>
                <div className="p-4 font-mono text-xs space-y-1.5 max-h-[480px] overflow-y-auto"
                  style={{ background: 'hsl(var(--bg-primary))' }}>
                  {displayAuditRows.length > 0 ? displayAuditRows.map((log, i) => (
                    <motion.div key={log._id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="flex gap-3 py-0.5">
                      <span style={{ color: 'hsl(var(--ink-tertiary))' }}>[{log.time}]</span>
                      <span style={{ color: log.status === 'failure' ? 'hsl(var(--dv-danger))' : log.status === 'success' ? 'hsl(var(--dv-success))' : 'hsl(var(--accent))' }}>{log.status}</span>
                      <span style={{ color: 'hsl(var(--ink-secondary))' }}>{log.action}{log.token !== '—' ? ` · ${log.token}` : ''}</span>
                    </motion.div>
                  )) : [
                    { t: '10:42:31', level: 'INFO', msg: 'user alex@delivervault.dev authenticated via Auth0' },
                    { t: '10:42:45', level: 'INFO', msg: 'token tok_gmail_r4f8 issued · scope: gmail.readonly · ttl: 24h' },
                    { t: '10:43:02', level: 'INFO', msg: 'CIBA delegation sent to mentor@example.com' },
                    { t: '10:43:18', level: 'WARN', msg: 'step-up auth required for gmail.send · push notification sent' },
                    { t: '10:43:24', level: 'INFO', msg: 'step-up approved · proposal sent to sarah@brandco.io' },
                    { t: '10:43:25', level: 'INFO', msg: 'token tok_gh_x1y6 issued · scope: repo.create · ttl: 24h' },
                    { t: '10:44:01', level: 'INFO', msg: 'token tok_gmail_r4f8 expired · auto-revoked' },
                    { t: '10:44:15', level: 'INFO', msg: 'user sarah@brandco.io accessed mentor approval link' },
                    { t: '10:45:02', level: 'INFO', msg: 'CIBA delegation approved by mentor@example.com · latency: 14m02s' },
                    { t: '10:45:18', level: 'INFO', msg: 'anomaly scan: no flags · proposal_amount=$4200 within normal range' },
                    { t: '10:46:01', level: 'WARN', msg: 'token tok_slack_m2n9 approaching expiry · 1h remaining' },
                    { t: '10:46:30', level: 'INFO', msg: 'session ended · total_tokens_issued: 4 · total_revoked: 2' },
                    { t: '10:47:11', level: 'ERROR', msg: 'AI waterfall: openai failed (ratelimit) → fallback to groq' },
                    { t: '10:47:14', level: 'INFO', msg: 'AI waterfall: groq responded · tokens_used: 847 · latency: 1.2s' },
                    { t: '10:48:05', level: 'INFO', msg: 'user james@devstudio.co authenticated via Auth0' },
                  ].map((log, i) => (
                    <motion.div key={`mock-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="flex gap-3 py-0.5">
                      <span style={{ color: 'hsl(var(--ink-tertiary))' }}>[{log.t}]</span>
                      <span style={{ color: log.level === 'ERROR' ? 'hsl(var(--dv-danger))' : log.level === 'WARN' ? 'hsl(var(--dv-warning))' : 'hsl(var(--dv-success))' }}>{log.level}</span>
                      <span style={{ color: 'hsl(var(--ink-secondary))' }}>{log.msg}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-6 right-6 rounded-lg px-4 py-3 font-body text-sm z-[400] shadow-lg border"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink))' }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
