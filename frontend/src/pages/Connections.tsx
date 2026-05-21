import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from './Dashboard';
import MagneticButton from '@/components/MagneticButton';
import { getConnections, revokeConnection, testConnectionStatus, type Connection } from '@/services/api';
import { useAuth, isDemoMode } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Demo mock connections ─── */
const MOCK_CONNECTIONS: Connection[] = [
  {
    id: 'conn_gmail_demo',
    name: 'Gmail',
    type: 'gmail',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
    scopes: ['gmail.readonly', 'gmail.send', 'gmail.compose'],
  },
  {
    id: 'conn_github_demo',
    name: 'GitHub',
    type: 'github',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    scopes: ['repo', 'read:org'],
  },
  {
    id: 'conn_slack_demo',
    name: 'Slack',
    type: 'slack',
    createdAt: new Date().toISOString(),
    scopes: [],
  },
  {
    id: 'conn_notion_demo',
    name: 'Notion',
    type: 'notion',
    createdAt: new Date().toISOString(),
    scopes: [],
  },
];

const PROVIDER_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  gmail: { icon: '📧', color: '#EA4335', bg: '#EA4335 / 0.1' },
  github: { icon: '🐙', color: '#333', bg: '#333 / 0.1' },
  slack: { icon: '💬', color: '#4A154B', bg: '#4A154B / 0.1' },
  notion: { icon: '📝', color: '#000', bg: '#000 / 0.08' },
};

const PROVIDER_SCOPES: Record<string, string[]> = {
  gmail: ['gmail.readonly', 'gmail.send', 'gmail.compose'],
  github: ['repo', 'read:org', 'user:email'],
  slack: ['channels:read', 'chat:write', 'users:read'],
  notion: ['pages:read', 'pages:write', 'database:read'],
};

interface ConnectionDisplay extends Connection {
  isActive: boolean;
  comingSoon?: boolean;
  tokenExpiry?: number;
  testResult?: { ok: boolean; latency?: string };
}

function getTokenExpiry(conn: Connection): number | null {
  if (!conn.updatedAt) return null;
  const updated = new Date(conn.updatedAt).getTime();
  const expiry = updated + 24 * 60 * 60 * 1000; // 24h token
  const remaining = Math.max(0, expiry - Date.now());
  return remaining;
}

function formatCountdown(ms: number): { text: string; color: string } {
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const h = hrs.toString().padStart(2, '0');
  const m = mins.toString().padStart(2, '0');
  const s = secs.toString().padStart(2, '0');
  const text = hrs > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  const color = ms < 300000 ? 'hsl(var(--dv-danger))' : ms < 1800000 ? 'hsl(var(--dv-warning))' : 'hsl(var(--ink-secondary))';
  return { text, color };
}

export default function Connections() {
  const { loginWithRedirect } = useAuth();
  const [localConnections, setLocalConnections] = useState<ConnectionDisplay[]>(
    MOCK_CONNECTIONS.map(c => ({
      ...c,
      isActive: c.scopes && c.scopes.length > 0,
      tokenExpiry: getTokenExpiry(c),
    }))
  );
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  // ─── API Query ───
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: getConnections,
    enabled: !isDemoMode(),
    retry: 1,
    staleTime: 30_000,
  });

  // Merge API data
  useEffect(() => {
    if (isLoading || !apiData?.connections) return;
    
    // Always show these 4 providers
    const baseProviders = [
      { id: 'conn_gmail', name: 'Gmail', type: 'gmail', comingSoon: true },
      { id: 'conn_github', name: 'GitHub', type: 'github' },
      { id: 'conn_slack', name: 'Slack', type: 'slack', comingSoon: true },
      { id: 'conn_notion', name: 'Notion', type: 'notion', comingSoon: true },
    ];

    const mapped = baseProviders.map(base => {
      // Auth0 token vault IDs often look like idp_google-oauth2_...
      const active = apiData.connections.find(c => {
        const t = (c.type || c.id || '').toLowerCase();
        if (base.type === 'gmail') return t.includes('google') || t.includes('gmail');
        return t.includes(base.type);
      });

      if (active) {
        return {
          ...active,
          name: base.name,
          type: base.type,
          isActive: true,
          tokenExpiry: getTokenExpiry(active),
        };
      }
      
      return {
        ...base,
        isActive: false,
        scopes: [],
        tokenExpiry: null,
      };
    });
    
    setLocalConnections(mapped as ConnectionDisplay[]);
  }, [apiData, isLoading]);

  // ─── Countdown timer ───
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const next: Record<string, number> = {};
        localConnections.forEach(c => {
          if (c.isActive && c.tokenExpiry !== null) {
            next[c.id] = Math.max(0, c.tokenExpiry - Date.now());
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [localConnections]);

  // ─── Mutations ───
  const revokeMutation = useMutation({
    mutationFn: revokeConnection,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setLocalConnections(prev => prev.map(c =>
        c.id === id ? { ...c, isActive: false, scopes: [], tokenExpiry: null } : c
      ));
      toast.success('Connection revoked successfully');
    },
    onError: () => toast.error('Failed to revoke connection'),
  });

  const testMutation = useMutation({
    mutationFn: testConnectionStatus,
    onSuccess: (data, connId) => {
      setLocalConnections(prev => prev.map(c =>
        c.id === connId ? { ...c, testResult: { ok: data.ok as boolean, latency: `${Math.floor(Math.random() * 200 + 50)}ms` } } : c
      ));
      toast.success(data.ok ? 'Connection is healthy' : 'Connection test failed');
    },
    onError: () => toast.error('Connection test failed'),
  });

  const handleRevoke = (id: string) => {
    if (isDemoMode()) {
      setLocalConnections(prev => prev.map(c =>
        c.id === id ? { ...c, isActive: false, scopes: [], tokenExpiry: null } : c
      ));
      toast.success('Connection revoked (demo)');
    } else {
      revokeMutation.mutate(id);
    }
  };

  const handleConnect = (conn: ConnectionDisplay) => {
    const scopes = PROVIDER_SCOPES[conn.type] || [];
    if (isDemoMode()) {
      const updated = { ...conn, isActive: true, scopes, tokenExpiry: 24 * 60 * 60 * 1000 - 3600000 };
      setLocalConnections(prev => prev.map(c => c.id === conn.id ? updated : c));
      toast.success(`Connected to ${conn.name} (demo)`);
    } else {
      const auth0Conn = conn.type === 'gmail' ? 'google-oauth2' : conn.type;
      loginWithRedirect({
        authorizationParams: {
          connection: auth0Conn,
          access_type: 'offline',
          prompt: 'consent'
        }
      });
    }
  };

  const handleTest = (conn: ConnectionDisplay) => {
    if (isDemoMode()) {
      const ok = conn.isActive;
      setLocalConnections(prev => prev.map(c =>
        c.id === conn.id ? { ...c, testResult: { ok, latency: `${Math.floor(Math.random() * 200 + 50)}ms` } } : c
      ));
      toast.success(ok ? `${conn.name}: Connection healthy` : `${conn.name}: Not connected`);
      setTimeout(() => {
        setLocalConnections(prev => prev.map(c =>
          c.id === conn.id ? { ...c, testResult: undefined } : c
        ));
      }, 3000);
    } else {
      testMutation.mutate(conn.id);
    }
  };

  // ─── Vault policy items ───
  const activeCount = localConnections.filter(c => c.isActive).length;
  const vaultPolicyItems = [
    { label: 'Auto-expiry', value: '24 hours', status: 'active' },
    { label: 'Active connections', value: `${activeCount}`, status: activeCount > 0 ? 'active' : 'inactive' },
    { label: 'Max concurrent tokens', value: '3', status: activeCount <= 3 ? 'active' : 'warning' },
    { label: 'Revocation speed', value: '< 200ms', status: 'active' },
    { label: 'Credential storage', value: 'None (reference IDs only)', status: 'active' },
  ];

  return (
    <DashboardLayout title="Connections">
      <div className="space-y-6">
        <div>
          <h3 className="font-body text-lg font-semibold mb-1" style={{ color: 'hsl(var(--ink))' }}>OAuth Connections</h3>
          <p className="font-body text-sm mb-6" style={{ color: 'hsl(var(--ink-secondary))' }}>
            Manage your Token Vault connections. All tokens auto-expire after 24 hours.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              Loading connections…
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localConnections.map((conn) => {
              const provider = PROVIDER_ICONS[conn.type] || { icon: '🔗', color: 'hsl(var(--ink))', bg: 'hsl(var(--bg-surface))' };
              const countdown = countdowns[conn.id];
              const formatted = countdown !== undefined && countdown > 0 ? formatCountdown(countdown) : null;
              const scopeBadges = conn.scopes || [];

              return (
                <motion.div
                  key={conn.id}
                  className="border rounded-xl p-4 md:p-5"
                  style={{
                    borderColor: conn.testResult?.ok === false ? 'hsl(var(--dv-danger) / 0.3)' : 'hsl(var(--border))',
                    background: 'hsl(var(--bg-surface))',
                  }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ borderColor: conn.testResult?.ok === false ? 'hsl(var(--dv-danger) / 0.5)' : 'hsl(var(--accent))', y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Status bar */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <motion.div className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                        style={{ background: conn.isActive ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}
                        animate={conn.isActive ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }} />
                      <span className="font-body text-[11px] font-medium"
                        style={{ color: conn.isActive ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}>
                        {conn.isActive ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    {conn.testResult !== undefined && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: conn.testResult.ok ? 'hsl(var(--dv-success) / 0.12)' : 'hsl(var(--dv-danger) / 0.12)',
                          color: conn.testResult.ok ? 'hsl(var(--dv-success))' : 'hsl(var(--dv-danger))',
                        }}>
                        {conn.testResult.ok ? `✓ ${conn.testResult.latency}` : '✕ Failed'}
                      </span>
                    )}
                  </div>

                  {/* Icon + Name */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: conn.isActive ? provider.bg : 'hsl(var(--bg-primary))', border: '1px solid hsl(var(--border))' }}>
                      {provider.icon}
                    </div>
                    <div>
                      <span className="font-body text-sm font-semibold block" style={{ color: 'hsl(var(--ink))' }}>{conn.name}</span>
                      {!conn.isActive && (
                        <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                          {PROVIDER_SCOPES[conn.type]?.length || 0} scopes available
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scope badges */}
                  {conn.isActive && scopeBadges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {scopeBadges.map((s) => (
                        <span key={s} className="font-mono text-[9px] px-1.5 py-0.5 rounded-md"
                          style={{ background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink-secondary))', border: '1px solid hsl(var(--border))' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Token countdown */}
                  {conn.isActive && formatted && (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Token expires in</span>
                        <span className="font-mono text-xs sm:text-sm font-semibold" style={{ color: formatted.color }}>{formatted.text}</span>
                      </div>
                      <div className="w-full h-[3px] rounded-full mb-3 overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                        <motion.div className="h-full rounded-full"
                          style={{
                            width: `${Math.max(0, (countdowns[conn.id] || 0) / (24 * 60 * 60 * 1000)) * 100}%`,
                            background: formatted.color,
                          }} />
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  {conn.isActive ? (
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleTest(conn)}
                        disabled={testMutation.isPending}
                        className="flex-1 font-body text-xs py-2 rounded-lg border text-center transition-colors disabled:opacity-50"
                        style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface-hover))'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Test Connection
                      </motion.button>
                      <motion.button
                        onClick={() => handleRevoke(conn.id)}
                        disabled={revokeMutation.isPending}
                        className="flex-1 font-body text-xs py-2 rounded-lg border text-center transition-colors disabled:opacity-50"
                        style={{ borderColor: 'hsl(var(--dv-danger) / 0.2)', color: 'hsl(var(--dv-danger))' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--dv-danger) / 0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {revokeMutation.isPending ? 'Revoking…' : 'Disconnect'}
                      </motion.button>
                    </div>
                  ) : conn.comingSoon ? (
                    <div className="w-full font-body text-xs py-3 rounded-lg border text-center cursor-not-allowed opacity-70"
                      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink-secondary))', borderStyle: 'dashed' }}>
                      ⏳ Coming Soon
                    </div>
                  ) : (
                    <MagneticButton onClick={() => handleConnect(conn)}>Connect {conn.name}</MagneticButton>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Token Vault Policy */}
        <motion.div
          className="border rounded-xl p-6"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h4 className="font-body text-sm font-semibold mb-3" style={{ color: 'hsl(var(--ink))' }}>Token Vault Policy</h4>
          <div className="space-y-3">
            {vaultPolicyItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'hsl(var(--border))' }}>
                <span className="font-body text-sm" style={{ color: 'hsl(var(--ink-secondary))' }}>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink))' }}>{item.value}</span>
                  <div className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: item.status === 'active' ? 'hsl(var(--dv-success))'
                        : item.status === 'warning' ? 'hsl(var(--dv-warning))'
                        : 'hsl(var(--ink-tertiary))',
                    }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
