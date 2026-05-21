import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: string;
  action: () => void;
  category: string;
}

export default function CommandPalette({ onNewProposal, onExpandCanvas, onRevokeAll, onExportPdf }: {
  onNewProposal?: () => void;
  onExpandCanvas?: () => void;
  onRevokeAll?: () => void;
  onExportPdf?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    { id: 'new-proposal', label: 'New Proposal', shortcut: 'N', icon: '✉', action: () => { onNewProposal?.(); navigate('/dashboard'); }, category: 'Actions' },
    { id: 'expand-canvas', label: 'Expand Canvas', shortcut: 'E', icon: '⤢', action: () => onExpandCanvas?.(), category: 'Actions' },
    { id: 'export-pdf', label: 'Export as PDF', shortcut: 'P', icon: '📄', action: () => onExportPdf?.(), category: 'Actions' },
    { id: 'revoke-all', label: 'Revoke All Tokens', icon: '⚠', action: () => onRevokeAll?.(), category: 'Actions' },
    { id: 'go-dashboard', label: 'Go to Dashboard', icon: '⌂', action: () => navigate('/dashboard'), category: 'Navigate' },
    { id: 'go-proposals', label: 'Go to Proposals', icon: '✉', action: () => navigate('/dashboard/proposals'), category: 'Navigate' },
    { id: 'go-audit', label: 'Go to Audit Log', icon: '📋', action: () => navigate('/dashboard/audit'), category: 'Navigate' },
    { id: 'go-connections', label: 'Go to Connections', icon: '🔗', action: () => navigate('/dashboard/connections'), category: 'Navigate' },
    { id: 'go-settings', label: 'Go to Settings', icon: '⚙', action: () => navigate('/dashboard/settings'), category: 'Navigate' },
    { id: 'go-home', label: 'Go to Landing Page', icon: '🏠', action: () => navigate('/'), category: 'Navigate' },
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(o => !o);
      setQuery('');
      setSelectedIndex(0);
    }
    if (!open) return;
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      setOpen(false);
    }
  }, [open, filtered, selectedIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const categories = [...new Set(filtered.map(c => c.category))];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh] p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="relative z-10 w-full max-w-[520px] rounded-2xl overflow-hidden"
            style={{ background: 'hsl(var(--bg-primary))', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', border: '1px solid hsl(var(--border))' }}>
            
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--ink-tertiary))" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-transparent border-none outline-none font-body text-sm"
                style={{ color: 'hsl(var(--ink))' }}
              />
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}>ESC</span>
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="py-8 text-center font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>No results found</div>
              )}
              {categories.map(cat => (
                <div key={cat}>
                  <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--ink-tertiary))' }}>{cat}</div>
                  {filtered.filter(c => c.category === cat).map((cmd) => {
                    const globalIdx = filtered.indexOf(cmd);
                    return (
                      <motion.div
                        key={cmd.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                        style={{
                          background: selectedIndex === globalIdx ? 'hsl(var(--accent-light))' : 'transparent',
                          color: selectedIndex === globalIdx ? 'hsl(var(--accent))' : 'hsl(var(--ink))',
                        }}
                        onClick={() => { cmd.action(); setOpen(false); }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <span className="text-sm w-5 text-center">{cmd.icon}</span>
                        <span className="font-body text-sm flex-1">{cmd.label}</span>
                        {cmd.shortcut && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border"
                            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-tertiary))' }}>{cmd.shortcut}</span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
              <span className="font-mono text-[10px] flex items-center gap-1" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                <span className="px-1 py-0.5 rounded border" style={{ borderColor: 'hsl(var(--border))' }}>↑↓</span> navigate
              </span>
              <span className="font-mono text-[10px] flex items-center gap-1" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                <span className="px-1 py-0.5 rounded border" style={{ borderColor: 'hsl(var(--border))' }}>↵</span> select
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
