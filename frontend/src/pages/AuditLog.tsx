import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import MagneticButton from '@/components/MagneticButton';
import { DashboardLayout } from './Dashboard';
import { getAuditLog, getSocket, type AuditEntry } from '@/services/api';
import { isDemoMode } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Mock fallback data ─── */
interface AuditRow {
  time: string;
  action: string;
  token: string;
  scopes: string;
  status: string;
  duration: string;
  _id?: string;
}

const MOCK_AUDIT_ROWS: AuditRow[] = [
  { time: '10:42:31', action: 'Token Issued', token: 'tok_gmail_r4f8', scopes: 'gmail.readonly', status: 'success', duration: '24h' },
  { time: '10:42:45', action: 'Brief Parsed', token: 'tok_groq_k2m1', scopes: 'groq.inference', status: 'success', duration: '2.1s' },
  { time: '10:43:02', action: 'Delegation Sent', token: 'tok_ciba_p9q3', scopes: 'ciba.delegate', status: 'pending', duration: '—' },
  { time: '10:43:18', action: 'Step-up Auth', token: 'tok_step_v7w2', scopes: 'gmail.send', status: 'pending', duration: '—' },
  { time: '10:43:24', action: 'Send Approved', token: 'tok_gmail_s5t9', scopes: 'gmail.send', status: 'success', duration: '0.3s' },
  { time: '10:43:25', action: 'Repo Created', token: 'tok_gh_x1y6', scopes: 'repo.create', status: 'success', duration: '1.8s' },
  { time: '10:44:01', action: 'Token Expired', token: 'tok_gmail_r4f8', scopes: 'gmail.readonly', status: 'revoked', duration: '24h' },
  { time: '10:44:15', action: 'Token Issued', token: 'tok_gmail_r9k2', scopes: 'gmail.readonly', status: 'success', duration: '24h' },
  { time: '10:45:02', action: 'Delegation Approved', token: 'tok_ciba_p9q3', scopes: 'ciba.delegate', status: 'success', duration: '14m' },
  { time: '10:45:18', action: 'Step-up Confirmed', token: 'tok_step_v7w2', scopes: 'gmail.send', status: 'success', duration: '12s' },
  { time: '10:46:01', action: 'Token Revoked', token: 'tok_gh_x1y6', scopes: 'repo.create', status: 'revoked', duration: '2m' },
  { time: '10:46:30', action: 'Session End', token: '—', scopes: '—', status: 'info', duration: '4m 02s' },
  { time: '10:47:11', action: 'AI Waterfall', token: 'tok_groq_k2m1', scopes: 'groq.inference', status: 'success', duration: '1.2s' },
  { time: '10:48:05', action: 'Anomaly Scan', token: '—', scopes: '—', status: 'success', duration: '0.1s' },
  { time: '10:49:20', action: 'Token Issued', token: 'tok_notion_p7k3', scopes: 'pages.write', status: 'success', duration: '24h' },
  { time: '10:50:01', action: 'Step-up Auth', token: 'tok_step_m1n5', scopes: 'gmail.send', status: 'success', duration: '8s' },
  { time: '10:51:44', action: 'Delegation Sent', token: 'tok_ciba_r8s2', scopes: 'ciba.delegate', status: 'pending', duration: '—' },
  { time: '10:52:09', action: 'Token Revoked', token: 'tok_notion_p7k3', scopes: 'pages.write', status: 'revoked', duration: '3m' },
];

function mapAuditEntry(entry: AuditEntry): AuditRow {
  const d = new Date(entry.createdAt);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  return {
    _id: entry._id,
    time,
    action: entry.action,
    token: entry.meta?.token as string || entry.stepId || '—',
    scopes: entry.meta?.scopes as string || '—',
    status: entry.status,
    duration: entry.meta?.duration as string || '—',
  };
}

const STATUS_FILTERS = ['All', 'Token Issued', 'Delegation', 'Step-up Auth', 'Revoked', 'Anomaly'];
type SortCol = 'time' | 'action' | 'status' | 'duration';
type SortDir = 'asc' | 'desc';

function downloadCSV(rows: AuditRow[]) {
  const header = ['Time', 'Action', 'Token', 'Scopes', 'Status', 'Duration'].join(',');
  const lines = rows.map(r =>
    [r.time, r.action, r.token, r.scopes, r.status, r.duration].map(v => `"${v}"`).join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `delivervault-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLog() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>(MOCK_AUDIT_ROWS);
  const [sortCol, setSortCol] = useState<SortCol>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [newRowFlash, setNewRowFlash] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 20;

  // ─── API Query ───
  const apiFilter = activeFilter === 'All' ? undefined
    : activeFilter === 'Revoked' ? { status: 'revoked' }
    : activeFilter === 'Anomaly' ? { action: 'anomaly' }
    : { action: activeFilter.toLowerCase().includes('token') ? 'token_issued' : activeFilter.toLowerCase().replace(/\s+/g, '_') };

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['auditLog', apiFilter, page],
    queryFn: () => getAuditLog({
      ...apiFilter,
      limit: PAGE_SIZE,
      page,
    }),
    enabled: !isDemoMode(),
    retry: 1,
    staleTime: 15_000,
  });

  // Merge API data — backend returns `entries` field
  useEffect(() => {
    if (isLoading || !apiData?.entries?.length) return;
    setRows(apiData.entries.map(mapAuditEntry));
    if (apiData.total !== undefined && apiData.pages !== undefined) {
      setTotalPages(apiData.pages);
    }
  }, [apiData, isLoading]);

  // ─── Socket listener ───
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected || !liveEnabled) return;

    const onNewEntry = (data: unknown) => {
      const entry = data as AuditEntry;
      if (entry) {
        const newRow = mapAuditEntry(entry);
        setRows(prev => [newRow, ...prev].slice(0, 50));
        setNewRowFlash(newRow.time);
        setTimeout(() => setNewRowFlash(null), 1200);
      }
    };

    socket.on('audit:entry', onNewEntry);
    return () => { socket.off('audit:entry', onNewEntry); };
  }, [liveEnabled]);

  // ─── Live simulation for demo mode ───
  const LIVE_EVENTS = [
    { action: 'Token Issued', token: 'tok_live', scopes: 'gmail.readonly', status: 'success', duration: '24h' },
    { action: 'Anomaly Scan', token: '—', scopes: '—', status: 'success', duration: '0.1s' },
    { action: 'Step-up Auth', token: 'tok_step_live', scopes: 'gmail.send', status: 'pending', duration: '—' },
    { action: 'Token Revoked', token: 'tok_live_exp', scopes: 'repo.create', status: 'revoked', duration: '12m' },
  ];

  useEffect(() => {
    if (!isDemoMode() || !liveEnabled) return;
    const interval = setInterval(() => {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const src = LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)];
      const newRow: AuditRow = { ...src, time, token: src.token === '—' ? '—' : `tok_${Math.random().toString(36).slice(2, 8)}` };
      setRows(prev => [newRow, ...prev].slice(0, 40));
      setNewRowFlash(newRow.time);
      setTimeout(() => setNewRowFlash(null), 1200);
    }, 8000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEnabled]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortIcon = (col: SortCol) => {
    if (sortCol !== col) return <span className="opacity-30 ml-0.5">↕</span>;
    return <span className="ml-0.5" style={{ color: 'hsl(var(--accent))' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const filteredRows = rows
    .filter(r => {
      if (activeFilter === 'All') return true;
      const f = activeFilter.toLowerCase();
      if (f === 'anomaly') return r.action.toLowerCase().includes('anomaly');
      if (f === 'revoked') return r.status === 'revoked';
      return r.action.toLowerCase().includes(f.split(' ')[0]);
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortCol === 'time') diff = a.time.localeCompare(b.time);
      else if (sortCol === 'action') diff = a.action.localeCompare(b.action);
      else if (sortCol === 'status') diff = a.status.localeCompare(b.status);
      else if (sortCol === 'duration') diff = a.duration.localeCompare(b.duration);
      return sortDir === 'asc' ? diff : -diff;
    });

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      if (!isDemoMode()) {
        try {
          const res = await fetch(`${window.location.origin}/api/audit/export?limit=1000`, {
            headers: { 'X-Demo-Mode': 'false' },
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `delivervault-audit-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Audit log exported as CSV');
            setExportDone(true);
          } else {
            downloadCSV(filteredRows);
            toast.success('Audit log exported as CSV');
            setExportDone(true);
          }
        } catch {
          downloadCSV(filteredRows);
          toast.success('Audit log exported as CSV');
          setExportDone(true);
        }
      } else {
        downloadCSV(filteredRows);
        toast.success('Audit log exported as CSV');
        setExportDone(true);
      }
      setTimeout(() => setExportDone(false), 2500);
    } catch {
      downloadCSV(filteredRows);
      toast.success('Audit log exported as CSV');
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    }
    setExporting(false);
  }, [filteredRows]);

  const handleFilterChange = (f: string) => {
    setActiveFilter(f);
    setPage(1);
  };

  const getRowBorder = (status: string) => {
    if (status === 'success') return 'hsl(var(--accent))';
    if (status === 'pending') return 'hsl(var(--dv-warning))';
    if (status === 'revoked') return 'hsl(var(--dv-danger))';
    return 'hsl(var(--ink-tertiary))';
  };

  const statusBadgeStyle = (status: string) => {
    if (status === 'success') return { bg: 'hsl(var(--dv-success) / 0.12)', color: 'hsl(var(--dv-success))' };
    if (status === 'pending') return { bg: 'hsl(var(--dv-warning) / 0.12)', color: 'hsl(var(--dv-warning))' };
    if (status === 'revoked') return { bg: 'hsl(var(--dv-danger) / 0.12)', color: 'hsl(var(--dv-danger))' };
    return { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))' };
  };

  const cols: { key: SortCol; label: string }[] = [
    { key: 'time', label: 'Time' },
    { key: 'action', label: 'Action' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <DashboardLayout title="Audit Log">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-body text-lg font-semibold" style={{ color: 'hsl(var(--ink))' }}>Audit Log</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))' }}>{filteredRows.length} entries</p>
              {!isDemoMode() && totalPages > 1 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink-tertiary))' }}>
                  Page {page} of {totalPages}
                </span>
              )}
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: liveEnabled ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}
                animate={liveEnabled ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 2, repeat: Infinity }} />
              <button onClick={() => setLiveEnabled(l => !l)}
                className="font-mono text-[10px]"
                style={{ color: liveEnabled ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}>
                {liveEnabled ? 'live' : 'paused'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MagneticButton loading={exporting} onClick={handleExport}>
              {exportDone ? 'Downloaded ✓' : 'Export CSV'}
            </MagneticButton>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => handleFilterChange(f)}
              className="font-body text-xs rounded-full px-3 py-1.5 transition-all duration-[120ms]"
              style={{
                background: activeFilter === f ? 'hsl(var(--accent-light))' : 'transparent',
                color: activeFilter === f ? 'hsl(var(--accent))' : 'hsl(var(--ink-secondary))',
                border: `1px solid ${activeFilter === f ? 'hsl(var(--accent))' : 'hsl(var(--border))'}`,
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              Loading audit log…
            </motion.div>
          </div>
        )}

        {/* Table */}
        {!isLoading && (
          <div className="border rounded-xl overflow-x-auto" style={{ borderColor: 'hsl(var(--border))' }}>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                  {['Time', 'Action', 'Token', 'Scopes', 'Status', 'Duration'].map((h) => {
                    const sortable = cols.find(c => c.label === h);
                    return (
                      <th key={h}
                        className={`text-left px-4 py-3 font-body font-medium text-xs sticky top-0 ${sortable ? 'cursor-pointer select-none' : ''}`}
                        style={{ color: 'hsl(var(--ink))', background: 'hsl(var(--bg-primary))' }}
                        onClick={sortable ? () => handleSort(sortable.key) : undefined}>
                        {h}{sortable && sortIcon(sortable.key)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filteredRows.map((row, i) => {
                    const isNew = newRowFlash === row.time && i === 0;
                    const badge = statusBadgeStyle(row.status);
                    return (
                      <motion.tr key={`${row.time}-${row.action}-${row._id || i}`}
                        initial={{ opacity: 0, backgroundColor: isNew ? 'hsl(var(--accent) / 0.08)' : 'transparent' }}
                        animate={{ opacity: 1, backgroundColor: 'transparent' }}
                        transition={{ delay: i < 5 ? i * 0.025 : 0, duration: 0.3 }}
                        className="border-b transition-colors duration-[120ms]"
                        style={{ borderColor: 'hsl(var(--border))', borderLeftWidth: 3, borderLeftColor: getRowBorder(row.status) }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-surface))')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{row.time}</td>
                        <td className="px-4 py-3 font-body text-xs font-medium" style={{ color: 'hsl(var(--ink))' }}>{row.action}</td>
                        <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'hsl(var(--ink-secondary))' }}>{row.token}</td>
                        <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{row.scopes}</td>
                        <td className="px-4 py-3">
                          <span className="font-body text-[10px] rounded-full px-2 py-0.5 capitalize"
                            style={{ background: badge.bg, color: badge.color }}>{row.status}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{row.duration}</td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}>
              ← Prev
            </button>
            <span className="font-mono text-xs px-3" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="font-body text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}>
              Next →
            </button>
          </div>
        )}

        {filteredRows.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>No entries match this filter</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
