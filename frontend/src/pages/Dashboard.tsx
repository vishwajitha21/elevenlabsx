import { useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  MiniMap,
  type Node,
  type Edge,
  Position,
  Handle,
  type NodeProps,
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import MagneticButton from '@/components/MagneticButton';
import DarkModeToggle from '@/components/DarkModeToggle';
import AICoPilot from '@/components/dashboard/AICoPilot';
import CommandPalette from '@/components/dashboard/CommandPalette';
import OnboardingTour, { TourReplayButton } from '@/components/dashboard/OnboardingTour';
import ProposalTemplates from '@/components/dashboard/ProposalTemplates';
import ConfettiEffect from '@/components/dashboard/ConfettiEffect';
import StreakCounter from '@/components/dashboard/StreakCounter';
import ConsentChainViz from '@/components/dashboard/ConsentChainViz';
import AnomalyDetection from '@/components/dashboard/AnomalyDetection';
import MentorCIBAModal from '@/components/dashboard/MentorCIBAModal';
import PaymentLinkModal from '@/components/dashboard/PaymentLinkModal';
import ServiceActionModal from '@/components/dashboard/ServiceActionModal';
import { useAuth, isDemoMode } from '@/contexts/AuthContext';
import {
  getConnections, revokeConnection, getUserStats,
  createProposal, approveStep, revokeStep, delegateStep, shareProposal, getSocket,
} from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mockUser, mockSteps, mockEvents, type ProposalStep } from '@/services/mock';

/* ─── Nav Items ─── */
const navItems = [
  { icon: '⌂', label: 'Home', path: '/dashboard' },
  { icon: '✉', label: 'Proposals', path: '/dashboard/proposals' },
  { icon: '📋', label: 'Audit Log', path: '/dashboard/audit' },
  { icon: '🔗', label: 'Connections', path: '/dashboard/connections' },
  { icon: '⚙', label: 'Settings', path: '/dashboard/settings' },
  { icon: '🛡', label: 'Admin', path: '/admin' },
];

/* ─── Dashboard Layout Shell ─── */
export function DashboardLayout({ children, title }: { children: ReactNode; title: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(true);
  const { logout, isDemo, isAdmin, user, isAuthenticated, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Listen for ?tour=true
  useEffect(() => {
    if (searchParams.get('tour') === 'true') {
      setTourOpen(true);
      // Clean up the URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tour');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const displayUser = user || mockUser;
  // Redirect to login when Auth0 is configured but user is not authenticated
  useEffect(() => {
    if (!isDemoMode() && !isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Fetch real stats for streak counter
  const { data: statsData } = useQuery({
    queryKey: ['userStats'],
    queryFn: getUserStats,
    enabled: !isDemoMode() && isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });
  const streak = statsData?.streak || (isDemo ? 7 : 0);

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--bg-primary))' }}>
      <style>{`@keyframes flowDash { to { stroke-dashoffset: -16; } }`}</style>

      <CommandPalette onRevokeAll={() => setRevokeAllOpen(true)} />

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <motion.aside
          className="hidden md:flex flex-col border-r h-screen sticky top-0 overflow-hidden flex-shrink-0 z-20"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}
          animate={{ width: sidebarExpanded ? 240 : 64 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Link to="/" className="flex items-center gap-2 p-4 border-b h-14 flex-shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
            <motion.div className="w-7 h-7 rounded-md border flex items-center justify-center flex-shrink-0"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
              whileHover={{ background: 'hsl(var(--accent))', borderColor: 'hsl(var(--accent))' }}>
              <span className="font-mono text-[10px] font-bold" style={{ color: 'hsl(var(--ink))' }}>DV</span>
            </motion.div>
            {sidebarExpanded && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-display text-sm whitespace-nowrap" style={{ color: 'hsl(var(--ink))' }}>DeliverVault</motion.span>
            )}
          </Link>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const active = location.pathname === item.path;
              const isAdminItem = item.path === '/admin';
              // Hide admin nav item if not admin
              if (isAdminItem && !isAdmin) return null;
              return (
                <Link key={item.label} to={item.path}
                  data-tour={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-[120ms]"
                  style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--ink-secondary))', background: active ? 'hsl(var(--accent-light))' : 'transparent' }}>
                  {active && (
                    <motion.div layoutId="activeNav" className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
                      style={{ background: 'hsl(var(--accent))' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                  )}
                  <span className="flex-shrink-0 text-base w-5 text-center">{item.icon}</span>
                  {sidebarExpanded && (
                    <span className="whitespace-nowrap flex items-center gap-1.5">
                      {item.label}
                      {isAdminItem && isDemo && (
                        <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' }}>DEMO</span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {sidebarExpanded && (
            <div className="px-2 mb-2">
              <StreakCounter streak={streak} />
            </div>
          )}

          {sidebarExpanded && (
            <div className="px-2 space-y-1 mb-2 border-t pt-2" style={{ borderColor: 'hsl(var(--border))' }}>
              <button onClick={() => setTourOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-[120ms] hover:bg-[hsl(var(--bg-surface-hover))]"
                style={{ color: 'hsl(var(--ink-secondary))' }}>
                <span className="flex-shrink-0 text-base w-5 text-center">🎯</span>
                <span>Take a Tour</span>
              </button>

              <button onClick={() => setRevokeAllOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-[120ms] hover:bg-[hsl(var(--dv-danger)/0.08)]"
                style={{ color: 'hsl(var(--dv-danger))' }}>
                <span className="flex-shrink-0 text-base w-5 text-center">⚠</span>
                <span>Revoke All</span>
              </button>
            </div>
          )}

          {!sidebarExpanded && (
            <div className="px-2 space-y-2 mb-2 border-t pt-2 flex flex-col items-center" style={{ borderColor: 'hsl(var(--border))' }}>
              <button onClick={() => setTourOpen(true)} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-[hsl(var(--bg-surface-hover))]" title="Tour">🎯</button>
              <button onClick={() => setRevokeAllOpen(true)} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-[hsl(var(--dv-danger)/0.08)] text-[hsl(var(--dv-danger))]" title="Revoke All">⚠</button>
            </div>
          )}

          {sidebarExpanded && (
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] px-2 py-1.5 rounded-lg"
                style={{ background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink-tertiary))' }}>
                <span className="px-1 py-0.5 rounded border" style={{ borderColor: 'hsl(var(--border))' }}>⌘K</span>
                <span>Command palette</span>
              </div>
            </div>
          )}

          <div className="p-3 border-t flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs flex-shrink-0"
              style={{ background: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' }}>{((displayUser as Record<string, unknown>)?.avatar as string) || (displayUser.name || 'U').split(' ').map((n: string) => n[0]).join('')}</div>
            {sidebarExpanded && (
              <div className="min-w-0 flex-1">
                <div className="font-body text-sm font-medium truncate flex items-center gap-1.5" style={{ color: 'hsl(var(--ink))' }}>
                  {displayUser.name || 'User'}
                  {isDemo && (
                    <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' }}>ADMIN</span>
                  )}
                </div>
                <div className="font-body text-[11px] truncate" style={{ color: 'hsl(var(--ink-tertiary))' }}>{displayUser.email || mockUser.email}</div>
              </div>
            )}
            {sidebarExpanded && (
              <motion.button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ color: 'hsl(var(--ink-tertiary))' }}
                whileHover={{ background: 'hsl(var(--dv-danger) / 0.1)', color: 'hsl(var(--dv-danger))' }}
                title="Logout">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </motion.button>
            )}
            <motion.div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'hsl(var(--dv-success))' }}
              animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
        </motion.aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          <div className="h-14 flex items-center justify-between px-4 md:px-6 border-b sticky top-0 z-10 flex-shrink-0"
            style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
            <div className="flex items-center gap-3">
              <button className="hidden md:block" onClick={() => setSidebarExpanded(!sidebarExpanded)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--ink-secondary))" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h4 className="font-body text-base font-semibold" style={{ color: 'hsl(var(--ink))' }}>{title}</h4>
            </div>
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              <motion.button onClick={() => setCopilotCollapsed(c => !c)}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-body transition-colors"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                whileHover={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>
                🤖 Co-Pilot
              </motion.button>
              <Link to="/dashboard"><MagneticButton>New proposal +</MagneticButton></Link>
            </div>
          </div>

          <div className="flex-1 p-4 md:p-6 overflow-y-auto pb-20 md:pb-6">
            {children}
          </div>
        </main>

        <AICoPilot collapsed={copilotCollapsed} onToggle={() => setCopilotCollapsed(c => !c)} />
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 border-t flex items-center justify-around z-50"
        style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.label} to={item.path} className="flex flex-col items-center gap-0.5 py-1">
              <motion.span className="text-lg" animate={active ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.3 }}>{item.icon}</motion.span>
              <span className="font-body text-[9px]" style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--ink-tertiary))' }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <OnboardingTour forcedOpen={tourOpen} onForceClose={() => setTourOpen(false)} />
      <TourReplayButton onClick={() => setTourOpen(true)} />
      <RevokeAllModal open={revokeAllOpen} onClose={() => setRevokeAllOpen(false)} />
    </div>
  );
}

/* ─── Tooltip Data ─── */
const stepTooltipData: Record<string, { description: string; serviceInfo: string }> = {
  'gmail-read': { description: 'Reads the client\'s brief from Gmail to understand project requirements', serviceInfo: 'Gmail API with read-only access to emails and attachments' },
  'gmail-send': { description: 'Sends the approved proposal or document to the client via Gmail', serviceInfo: 'Gmail API with send permissions, requires step-up auth' },
  'groq': { description: 'AI-powered document drafting using Groq\'s fast LLM inference', serviceInfo: 'Groq Llama-3.1 model, no token required (free tier)' },
  'mentor': { description: 'Delegates approval to a mentor via push notification (CIBA) or email link', serviceInfo: 'CIBA async flow — mentor gets a secure 24hr review link' },
  'github': { description: 'Creates a GitHub issue or repository for the approved deliverable', serviceInfo: 'GitHub API with repo creation and issue management scope' },
  'slack': { description: 'Posts a notification to the configured Slack channel', serviceInfo: 'Slack Webhook API with channel posting permissions' },
  'notion': { description: 'Creates a page in Notion with the proposal or project documentation', serviceInfo: 'Notion API with page creation and database write scope' },
};

const getTooltipKey = (service: string): string => {
  const s = service.toLowerCase();
  if (s.includes('gmail') && s.includes('read')) return 'gmail-read';
  if (s.includes('gmail') && s.includes('send')) return 'gmail-send';
  if (s.includes('groq') || s.includes('ai')) return 'groq';
  if (s.includes('mentor')) return 'mentor';
  if (s.includes('github')) return 'github';
  if (s.includes('slack')) return 'slack';
  if (s.includes('notion')) return 'notion';
  return '';
};

/* ─── Custom Node with Enhanced Toolbar, Tooltips, and Visibility ─── */
function StepNode({ data }: NodeProps) {
  const step = data as unknown as ProposalStep & {
    onApprove: (id: number) => void;
    onRevoke: (id: number) => void;
    onDelegate: (id?: any) => void;
    onMentor: (id?: any) => void;
    totalSteps?: number;
    doneSteps?: number;
    steps?: ProposalStep[];
  };
  const [hovered, setHovered] = useState(false);
  const isActive = step.status === 'active';
  const isDone = step.status === 'done';
  const isRevoked = step.status === 'revoked';
  const prefersReduced = useReducedMotion();
  const getDynamicTooltip = () => {
    const s = (step.service || '').toLowerCase();
    const isStepUp = step.tokenType === 'Step-up';
    
    let description = `Automated ${step.name || 'step'} within your project workflow.`;
    let serviceInfo = step.service || 'Default Integration';

    if (s.includes('gmail') || s.includes('email')) {
      description = `Sends or manages your project documents securely via the Google ecosystem.`;
      serviceInfo = `Gmail API with ${isStepUp ? 'Step-up MFA enforced' : 'Token Vault access'}`;
    } else if (s.includes('github')) {
      description = `Automatically creates or updates repositories and issues based on your approved brief.`;
      serviceInfo = `GitHub OAuth with repository write scope`;
    } else if (s.includes('slack')) {
      description = `Broadcasts professional notifications and approval alerts to your Slack channels.`;
      serviceInfo = `Slack Webhook Bridge — post-only permissions`;
    } else if (s.includes('mentor')) {
      description = `Delegates a secure sign-off request to an external reviewer for quality assurance.`;
      serviceInfo = `CIBA / Email Link — Secure 7-day review window`;
    } else if (s.includes('groq') || s.includes('ai')) {
      description = `AI-powered intelligence is analyzing your brief for anomalies and drafting the proposal.`;
      serviceInfo = `High-speed LLM Inference Gate`;
    }

    return { description, serviceInfo };
  };

  const tooltipInfo = getDynamicTooltip();
  const statusExplanations: Record<string, string> = {
    pending: 'Awaiting your approval or the previous step to complete',
    active: 'This step is currently live and awaiting your command',
    waiting: 'Processing secure authorization or mentor review',
    done: 'Step verified and permanently recorded in audit log',
    revoked: 'Access token revoked — security protocol applied',
  };

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))', label: 'Pending' },
    active: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))', label: 'Active' },
    waiting: { bg: 'hsl(var(--dv-warning) / 0.15)', color: 'hsl(var(--dv-warning))', label: 'Waiting' },
    done: { bg: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))', label: 'Done' },
    revoked: { bg: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))', label: 'Revoked' },
  };
  const s = statusStyles[step.status] || statusStyles.pending;

  const serviceIcon = (svc: string) => {
    if (svc.toLowerCase().includes('gmail')) return '📧';
    if (svc.toLowerCase().includes('github')) return '🐙';
    if (svc.toLowerCase().includes('slack')) return '💬';
    if (svc.toLowerCase().includes('groq') || svc.toLowerCase().includes('ai')) return '🤖';
    if (svc.toLowerCase().includes('mentor')) return '👤';
    if (svc.toLowerCase().includes('notion')) return '📝';
    return '⚡';
  };

  // Animation variants for status transitions
  const nodeAnimation = prefersReduced ? {} : {
    initial: { y: 30, opacity: 0, scale: 0.9 },
    animate: isRevoked ? {
      y: 0, opacity: 1, scale: 1,
      x: [0, -4, 4, -4, 4, -2, 2, 0],
    } : isDone ? {
      y: 0, opacity: 1, scale: 1,
    } : {
      y: 0, opacity: 1, scale: 1,
    },
    whileHover: { scale: 1.03, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' },
    whileTap: { scale: 0.98 },
    transition: {
      delay: (step as any).id * 0.12,
      type: 'spring' as const, stiffness: 200, damping: 20,
    },
  };

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...nodeAnimation}
      className="rounded-xl p-4 w-[240px] relative cursor-grab active:cursor-grabbing dv-step-node"
      style={{
        background: 'hsl(var(--bg-primary))',
        border: `1px solid hsl(var(--border))`,
        borderLeftWidth: isActive || isDone ? 3 : 1,
        borderLeftColor: isDone ? 'hsl(var(--dv-success))' : isActive ? 'hsl(var(--accent))' : isRevoked ? 'hsl(var(--dv-danger))' : 'hsl(var(--border))',
        boxShadow: isActive ? '0 0 20px hsl(var(--accent) / 0.15), 0 0 6px hsl(var(--accent) / 0.1)' : 'none',
      }}>
      <style>{`
        .dv-step-node-tooltip {
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          pointer-events: none;
          min-width: 220px;
          max-width: 280px;
        }
        .dv-step-node-tooltip-inner {
          background: #1a1a2e;
          color: #fff;
          font-size: 11px;
          line-height: 1.5;
          padding: 10px 12px;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          animation: dvTooltipFadeIn 0.2s ease-out;
        }
        .dv-step-node-tooltip-arrow {
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 10px;
          background: #1a1a2e;
          transform: translateX(-50%) rotate(45deg);
          border-radius: 0 0 2px 0;
        }
        .dv-step-node-tooltip-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.5;
          margin-bottom: 4px;
          font-family: monospace;
        }
        .dv-step-node-tooltip-row {
          margin-bottom: 6px;
        }
        .dv-step-node-tooltip-row:last-child {
          margin-bottom: 0;
        }
        .dv-step-node-tooltip-title {
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 6px;
          color: #fff;
        }
        @keyframes dvTooltipFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dvCheckPop {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(0deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes dvShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes dvGlowPulse {
          0%, 100% { box-shadow: 0 0 12px hsl(var(--accent) / 0.12); }
          50% { box-shadow: 0 0 24px hsl(var(--accent) / 0.25), 0 0 8px hsl(var(--accent) / 0.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dv-step-node-tooltip-inner { animation: none; }
          .dv-check-pop { animation: none; }
        }
      `}</style>
      <Handle type="target" position={Position.Left} style={{ background: isDone ? 'hsl(var(--dv-success))' : isActive ? 'hsl(var(--accent))' : 'hsl(var(--border))', width: 8, height: 8, border: '2px solid hsl(var(--bg-primary))' }} />
      <Handle type="source" position={Position.Right} style={{ background: isDone ? 'hsl(var(--dv-success))' : isActive ? 'hsl(var(--accent))' : 'hsl(var(--border))', width: 8, height: 8, border: '2px solid hsl(var(--bg-primary))' }} />

      {/* Tooltip on hover */}
      <AnimatePresence>
        {hovered && tooltipInfo && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="dv-step-node-tooltip"
          >
            <div className="dv-step-node-tooltip-inner">
              <div className="dv-step-node-tooltip-title">{step.name}</div>
              <div className="dv-step-node-tooltip-row">{tooltipInfo.description}</div>
              <div className="dv-step-node-tooltip-row" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 6 }}>
                <div className="dv-step-node-tooltip-label">Service</div>
                <div>{step.service} — {tooltipInfo.serviceInfo}</div>
              </div>
              {step.tokenType && step.tokenType !== 'No token' && (
                <div className="dv-step-node-tooltip-row">
                  <div className="dv-step-node-tooltip-label">Token</div>
                  <div>{step.tokenType} · {step.scope}</div>
                </div>
              )}
              <div className="dv-step-node-tooltip-row" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 6 }}>
                <div className="dv-step-node-tooltip-label">Status</div>
                <div>{statusExplanations[step.status] || 'Unknown status'}</div>
              </div>
            </div>
            <div className="dv-step-node-tooltip-arrow" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating toolbar on hover */}
      <AnimatePresence>
        {hovered && step.status !== 'done' && step.status !== 'revoked' && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 px-2 py-1 rounded-lg border z-50"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
          >
            <button type="button" onClick={(e) => { e.preventDefault(); step.onApprove(step.id); }} className="nodrag font-mono text-[9px] px-2 py-1 rounded hover:bg-[hsl(var(--accent-light))]" style={{ color: 'hsl(var(--accent))' }} title="Approve">✓</button>
            <button type="button" onClick={(e) => { e.preventDefault(); step.onRevoke(step.id); }} className="nodrag font-mono text-[9px] px-2 py-1 rounded hover:bg-[hsl(var(--dv-danger)/0.1)]" style={{ color: 'hsl(var(--dv-danger))' }} title="Revoke">✕</button>
            <button type="button" onClick={(e) => { e.preventDefault(); step.onDelegate(); }} className="nodrag font-mono text-[9px] px-2 py-1 rounded" style={{ color: 'hsl(var(--ink-secondary))' }} title="Delegate">→</button>
            <button type="button" onClick={(e) => { e.preventDefault(); step.onMentor(step.id); }} className="nodrag font-mono text-[9px] px-2 py-1 rounded" style={{ color: 'hsl(var(--dv-warning))' }} title="Mentor">👤</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prominent step number + service icon row */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0"
          style={{
            background: isDone ? 'hsl(var(--dv-success))' : isActive ? 'hsl(var(--accent))' : 'hsl(var(--bg-surface))',
            color: isDone || isActive ? '#fff' : 'hsl(var(--ink-tertiary))',
          }}>
          {isDone && !prefersReduced ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>✓</motion.span>
          ) : isRevoked ? '✕' : step.id}
        </div>
        <span className="text-xl leading-none flex-shrink-0" aria-hidden="true">{serviceIcon(step.service)}</span>
        <div className="flex-1 min-w-0 text-right">
          {(step.tokenType === 'Token Vault' || step.tokenType === 'Step-up') && (
            <div className="w-5 h-5 rounded-md flex items-center justify-center ml-auto" style={{ background: 'hsl(var(--accent-light))' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
          )}
          {step.tokenType === 'CIBA async' && (
            <div className="w-5 h-5 rounded-md flex items-center justify-center ml-auto" style={{ background: 'hsl(var(--dv-warning) / 0.15)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--dv-warning))" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
          )}
        </div>
      </div>

      {/* Step name + description */}
      <div className="font-body text-sm font-semibold mb-0.5"
        style={{ color: 'hsl(var(--ink))', textDecoration: isRevoked ? 'line-through' : 'none' }}>{step.name}</div>
      <div className="font-body text-[10px] mb-1.5" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.service}</div>
      <div className="font-mono text-[10px] mb-2" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.scope}</div>

      {/* Progress indicator: approval chain */}
      {step.totalSteps && step.totalSteps > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
            <div className="h-full rounded-full" style={{
              width: `${(step.doneSteps / step.totalSteps) * 100}%`,
              background: step.doneSteps === step.totalSteps ? 'hsl(var(--dv-success))' : 'hsl(var(--accent))',
            }} />
          </div>
          <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.doneSteps}/{step.totalSteps}</span>
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className="font-body text-[10px] rounded-full px-2.5 py-1 inline-flex items-center gap-1" style={{ background: s.bg, color: s.color }}>
          {isActive && <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />}
          {s.label}
        </span>
        {isDone && (
          <motion.span
            className="inline-flex text-[14px]"
            initial={prefersReduced ? {} : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >✅</motion.span>
        )}
        {isRevoked && (
          <motion.span
            className="inline-flex text-[14px]"
            initial={prefersReduced ? {} : { scale: 0 }}
            animate={prefersReduced ? {} : { scale: 1, x: [0, -3, 3, -3, 3, -2, 2, 0] }}
            transition={{ duration: 0.5 }}
          >🚫</motion.span>
        )}
      </div>

      {/* Mentor Feedback Bubble */}
      {step.mentorComment && (step.status === 'pending' || step.status === 'active') && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 p-2 rounded-lg border text-[10px] leading-relaxed"
          style={{ 
            background: 'hsl(var(--dv-warning) / 0.1)', 
            borderColor: 'hsl(var(--dv-warning) / 0.3)',
            color: 'hsl(var(--ink-secondary))' 
          }}>
          <span className="font-bold text-[hsl(var(--dv-warning))]">Mentor Feedback: </span>
          {step.mentorComment}
        </motion.div>
      )}

      {step.status !== 'done' && step.status !== 'revoked' && (
        <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
          <motion.button 
            type="button" 
            disabled={step.id > 1 && (step.steps || []).some(s => s.id < step.id && s.status !== 'done')}
            onClick={(e) => { e.preventDefault(); step.onApprove(step.id); }} 
            className="nodrag font-body text-[11px] px-2.5 py-1 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'hsl(var(--accent))', background: 'hsl(var(--accent-light))' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            Approve
          </motion.button>
          <motion.button type="button" onClick={(e) => { e.preventDefault(); step.onRevoke(step.id); }} className="nodrag font-body text-[11px] px-2.5 py-1 rounded-md"
            style={{ color: 'hsl(var(--dv-danger))' }}
            whileHover={{ background: 'hsl(var(--dv-danger) / 0.08)' }}>Revoke</motion.button>
          <motion.button type="button" onClick={(e) => { e.preventDefault(); step.onMentor(step.id); }} className="nodrag font-body text-[11px] px-2 py-1 rounded-md border"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
            whileHover={{ borderColor: 'hsl(var(--dv-warning))', color: 'hsl(var(--dv-warning))' }}>👤</motion.button>
        </div>
      )}
    </motion.div>
  );
}

const nodeTypes = { stepNode: StepNode };

/* ─── Custom Edge with Label ─── */
function FlowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, id } = props;
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const isActive = (style as any)?.strokeWidth === 2;
  return (
    <>
      <BaseEdge path={edgePath} style={{
        stroke: isActive ? 'hsl(var(--accent))' : 'hsl(var(--border))',
        strokeWidth: isActive ? 2 : 1,
        strokeDasharray: isActive ? '8 8' : 'none',
        animation: isActive ? 'flowDash 1s linear infinite' : 'none',
      }} />
      <text x={labelX} y={labelY - 6} textAnchor="middle" fill="hsl(var(--ink-tertiary))" fontSize="9" fontFamily="monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {isActive ? '▶' : '→'}
      </text>
    </>
  );
}

const edgeTypes = { flow: FlowEdge };

/* ─── Canvas Controls ─── */
function CanvasControls({ onAddStep, canUndo, canRedo, onUndo, onRedo, steps }: {
  onAddStep: () => void;
  canUndo: boolean; canRedo: boolean;
  onUndo: () => void; onRedo: () => void;
  steps: ProposalStep[];
}) {
  const { zoomIn, zoomOut, fitView, setViewport, getViewport } = useReactFlow();
  const doneCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  const handleResetView = () => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  const handleZoomToFit = () => {
    fitView({ padding: 0.2, duration: 300 });
  };

  return (
    <>
      <Panel position="top-right">
        <motion.div className="flex gap-1 border rounded-xl p-1.5" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <button onClick={() => zoomIn()} className="w-8 h-8 flex items-center justify-center rounded-lg font-mono text-sm transition-colors"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Zoom In">+</button>
          <button onClick={() => zoomOut()} className="w-8 h-8 flex items-center justify-center rounded-lg font-mono text-sm transition-colors"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Zoom Out">−</button>
          <div className="w-[1px] mx-0.5" style={{ background: 'hsl(var(--border))' }} />
          <button onClick={handleZoomToFit} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Zoom to Fit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          </button>
          <button onClick={handleResetView} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Reset View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
          </button>
          <div className="w-[1px] mx-0.5" style={{ background: 'hsl(var(--border))' }} />
          <button onClick={onUndo} disabled={!canUndo} className="w-8 h-8 flex items-center justify-center rounded-lg font-mono text-xs transition-colors disabled:opacity-30"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Undo">↺</button>
          <button onClick={onRedo} disabled={!canRedo} className="w-8 h-8 flex items-center justify-center rounded-lg font-mono text-xs transition-colors disabled:opacity-30"
            style={{ color: 'hsl(var(--ink-secondary))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Redo">↻</button>
          <div className="w-[1px] mx-0.5" style={{ background: 'hsl(var(--border))' }} />
          <button onClick={onAddStep} className="h-8 flex items-center gap-1 px-2 rounded-lg font-body text-[11px] transition-colors"
            style={{ color: 'hsl(var(--accent))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--accent-light))'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Add Step">+ Step</button>
          {totalCount > 0 && (
            <div className="flex items-center gap-1 ml-1 pl-1 border-l" style={{ borderColor: 'hsl(var(--border))' }}>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full" style={{
                background: allDone ? 'hsl(var(--dv-success) / 0.15)' : 'hsl(var(--bg-surface))',
                color: allDone ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-secondary))',
              }}>
                {doneCount}/{totalCount}
              </span>
              {allDone && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>✅</motion.span>
              )}
            </div>
          )}
        </motion.div>
      </Panel>
      {/* Mini status bar at the bottom */}
      {totalCount > 0 && (
        <Panel position="bottom-center">
          <motion.div className="flex items-center gap-3 px-4 py-2 border rounded-t-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 -4px 12px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-1.5">
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: allDone ? 'hsl(var(--dv-success))' : 'hsl(var(--accent))' }}
                animate={allDone ? {} : { scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span className="font-mono text-[10px]" style={{ color: allDone ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-tertiary))' }}>
                {allDone ? 'All steps complete' : `${doneCount} of ${totalCount} completed`}
              </span>
            </div>
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
              <motion.div className="h-full rounded-full" style={{ background: allDone ? 'hsl(var(--dv-success))' : 'hsl(var(--accent))' }}
                animate={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
            </div>
            <div className="flex items-center gap-2">
              {steps.filter(s => s.status === 'waiting').length > 0 && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(var(--dv-warning) / 0.12)', color: 'hsl(var(--dv-warning))' }}>
                  {steps.filter(s => s.status === 'waiting').length} waiting
                </span>
              )}
              {steps.filter(s => s.status === 'pending').length > 0 && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink-tertiary))' }}>
                  {steps.filter(s => s.status === 'pending').length} pending
                </span>
              )}
            </div>
          </motion.div>
        </Panel>
      )}
    </>
  );
}

/* ─── Canvas Inner ─── */
function CanvasInner({ steps, onApproveStep, onRevokeStep, onDelegate, onMentor }: {
  steps: ProposalStep[];
  onApproveStep: (id: number) => void;
  onRevokeStep: (id: number) => void;
  onDelegate: (id?: any) => void;
  onMentor: (id?: any) => void;
}) {
  const doneCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;

  const initialNodes: Node[] = steps.map((step, i) => ({
    id: `step-${step.id}`,
    type: 'stepNode',
    position: { x: i * 280, y: 50 + (i % 2 === 1 ? 30 : 0) },
    data: { ...step, steps, onApprove: onApproveStep, onRevoke: onRevokeStep, onDelegate, onMentor, totalSteps: totalCount, doneSteps: doneCount },
  }));

  const initialEdges: Edge[] = steps.slice(0, -1).map((step, i) => {
    const nextStep = steps[i + 1];
    const isActive = step.status === 'done' || step.status === 'active';
    return {
      id: `edge-${step.id}-${nextStep.id}`,
      source: `step-${step.id}`,
      target: `step-${nextStep.id}`,
      type: 'flow',
      style: { strokeWidth: isActive ? 2 : 1 },
    };
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [nextStepId, setNextStepId] = useState(steps.length + 1);
  const [expanded, setExpanded] = useState(false);
  const [eventFeedOpen, setEventFeedOpen] = useState(false);
  const [canvasEvents, setCanvasEvents] = useState<{ text: string; time: string; id: number; type: string }[]>([]);
  const { fitView } = useReactFlow();

  // Generate canvas-local event feed
  useEffect(() => {
    if (steps.length === 0) return;
    const addEvent = () => {
      const mockCanvasEvents = [
        { text: 'gmail_read · token issued · 24h scope', type: 'success' },
        { text: 'brief_parsed · 847 tokens used', type: 'info' },
        { text: 'draft_generated · 312 words', type: 'success' },
        { text: 'delegation_sent · mentor@email.com', type: 'info' },
        { text: 'ciba_waiting · agent paused', type: 'warning' },
        { text: 'step_up_auth · push sent', type: 'warning' },
        { text: 'token_revoked · expired', type: 'error' },
        { text: 'repo_created · client-project-2026', type: 'success' },
        { text: 'scope_validated · all permissions OK', type: 'success' },
        { text: 'webhook_fired · slack notification', type: 'info' },
      ];
      const event = mockCanvasEvents[Math.floor(Math.random() * mockCanvasEvents.length)];
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setCanvasEvents(prev => [{ text: event.text, time, id: Date.now(), type: event.type }, ...prev].slice(0, 20));
    };
    addEvent();
    const interval = setInterval(addEvent, 5000);
    return () => clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    const newNodes: Node[] = steps.map((step, i) => ({
      id: `step-${step.id}`,
      type: 'stepNode',
      position: nodes.find(n => n.id === `step-${step.id}`)?.position || { x: i * 280, y: 50 + (i % 2 === 1 ? 30 : 0) },
      data: { ...step, steps, onApprove: onApproveStep, onRevoke: onRevokeStep, onDelegate, onMentor, totalSteps: totalCount, doneSteps: doneCount },
    }));
    const customNodes = nodes.filter(n => !n.id.startsWith('step-') || !steps.find(s => `step-${s.id}` === n.id));
    setNodes([...newNodes, ...customNodes.filter(cn => !newNodes.find(nn => nn.id === cn.id))]);

    const newEdges: Edge[] = steps.slice(0, -1).map((step, i) => {
      const nextStep = steps[i + 1];
      const isActive = step.status === 'done' || step.status === 'active';
      return {
        id: `edge-${step.id}-${nextStep.id}`,
        source: `step-${step.id}`,
        target: `step-${nextStep.id}`,
        type: 'flow',
        style: { strokeWidth: isActive ? 2 : 1 },
      };
    });
    const customEdges = edges.filter(e => !e.id.startsWith('edge-'));
    setEdges([...newEdges, ...customEdges]);
  }, [steps]);

  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(0, historyIdx + 1), { nodes: [...nodes], edges: [...edges] }]);
    setHistoryIdx(prev => prev + 1);
  }, [nodes, edges, historyIdx]);

  const handleUndo = useCallback(() => {
    if (historyIdx < 0) return;
    const state = history[historyIdx];
    setNodes(state.nodes);
    setEdges(state.edges);
    setHistoryIdx(i => i - 1);
  }, [history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const state = history[historyIdx + 1];
    setNodes(state.nodes);
    setEdges(state.edges);
    setHistoryIdx(i => i + 1);
  }, [history, historyIdx]);

  const onConnect = useCallback((params: Connection) => {
    saveHistory();
    setEdges(eds => addEdge({ ...params, type: 'flow' }, eds));
  }, [saveHistory]);

  const handleAddStep = useCallback(() => {
    saveHistory();
    const id = nextStepId;
    setNextStepId(id + 1);
    const newNode: Node = {
      id: `step-${id}`,
      type: 'stepNode',
      position: { x: (nodes.length) * 280, y: 80 },
      data: {
        id, name: `Custom Step ${id}`, service: 'Custom', tokenType: 'Token Vault',
        status: 'pending', scope: 'custom.action',
        onApprove: onApproveStep, onRevoke: onRevokeStep, onDelegate, onMentor,
      },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes, nextStepId, saveHistory, onApproveStep, onRevokeStep, onDelegate, onMentor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  return (
    <div className={expanded ? 'fixed inset-0 z-[200]' : ''}>
      <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="p-3 md:p-4 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
          <div className="flex items-center gap-3">
            <motion.div className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
              animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Proposal workflow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
                animate={{ width: `${steps.length > 0 ? (steps.filter(s => s.status === 'done').length / steps.length) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
            </div>
            <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{steps.filter(s => s.status === 'done').length}/{steps.length}</span>
            <motion.button onClick={() => { setExpanded(e => !e); setTimeout(() => fitView({ padding: 0.3 }), 100); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg border ml-2"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
              whileHover={{ borderColor: 'hsl(var(--accent))' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {expanded ? <><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></> : <><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></>}
              </svg>
            </motion.button>
          </div>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
          style={{ height: expanded ? 'calc(100vh - 56px)' : 420, background: 'hsl(var(--bg-surface))' }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            nodesDraggable panOnDrag zoomOnScroll fitView
            fitViewOptions={{ padding: 0.35 }} attributionPosition="bottom-right"
            style={{ background: 'transparent' }} minZoom={0.2} maxZoom={3}
            onNodeDragStop={saveHistory}>
            <Background gap={20} size={1} color="hsl(var(--border))" />
            {expanded && <MiniMap style={{ background: 'hsl(var(--bg-surface))' }} nodeColor="hsl(var(--accent-light))" maskColor="hsl(var(--bg-primary) / 0.7)" />}
            <CanvasControls onAddStep={handleAddStep} canUndo={historyIdx >= 0} canRedo={historyIdx < history.length - 1} onUndo={handleUndo} onRedo={handleRedo} steps={steps} />
          </ReactFlow>
          {/* Event Feed Toggle */}
          {steps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 }}
              className="absolute bottom-14 left-3 z-10"
            >
              <motion.button
                onClick={() => setEventFeedOpen(v => !v)}
                className="w-9 h-9 rounded-lg border flex items-center justify-center"
                style={{
                  background: eventFeedOpen ? 'hsl(var(--bg-primary))' : 'hsl(var(--bg-primary) / 0.8)',
                  borderColor: eventFeedOpen ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                  color: eventFeedOpen ? 'hsl(var(--accent))' : 'hsl(var(--ink-secondary))',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={eventFeedOpen ? 'Hide events' : 'Show events'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </motion.button>
            </motion.div>
          )}
          {/* Event Feed Panel */}
          <AnimatePresence>
            {eventFeedOpen && steps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="absolute top-3 left-3 bottom-14 w-[220px] z-10 border rounded-xl overflow-hidden"
                style={{
                  background: 'hsl(var(--bg-primary) / 0.95)',
                  borderColor: 'hsl(var(--border))',
                  boxShadow: '4px 0 16px rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="p-2.5 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))' }}>
                  <div className="flex items-center gap-1.5">
                    <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
                      animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                    <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>Events</span>
                  </div>
                  <button onClick={() => setEventFeedOpen(false)} className="w-5 h-5 flex items-center justify-center rounded text-[10px]"
                    style={{ color: 'hsl(var(--ink-tertiary))' }}>×</button>
                </div>
                <div className="overflow-y-auto max-h-[340px] p-2">
                  <AnimatePresence initial={false}>
                    {canvasEvents.slice(0, 15).map((event, i) => {
                      const eventColor = event.type === 'success' ? 'hsl(var(--dv-success))' :
                        event.type === 'warning' ? 'hsl(var(--dv-warning))' :
                        event.type === 'error' ? 'hsl(var(--dv-danger))' : 'hsl(var(--ink-tertiary))';
                      const dotColor = event.type === 'success' ? 'bg-green-400' :
                        event.type === 'warning' ? 'bg-yellow-400' :
                        event.type === 'error' ? 'bg-red-400' : 'bg-blue-400';
                      return (
                        <motion.div key={event.id} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-start gap-2 py-1.5 px-1 rounded-md cursor-default transition-colors"
                          style={{ color: eventColor }}
                          onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[9px] leading-relaxed">{event.text}</div>
                            <div className="font-mono text-[8px] mt-0.5" style={{ color: 'hsl(var(--ink-tertiary))' }}>{event.time}</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Dashboard Home ─── */
export default function Dashboard() {
  console.log('--- [DEBUG] DASHBOARD LOADED VERSION 3.2 ---');
  const [steps, setSteps] = useState<ProposalStep[]>([]);
  const [parsing, setParsing] = useState(false);
  const [events, setEvents] = useState<{ text: string; time: string; id: number }[]>([]);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [stepUpActive, setStepUpActive] = useState(false);
  const [briefText, setBriefText] = useState('');
  const [exportState, setExportState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [mobileEventsOpen, setMobileEventsOpen] = useState(false);
  const [canvasRevealed, setCanvasRevealed] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  // New feature states
  const [tourOpen, setTourOpen] = useState(false);
  const [consentChainOpen, setConsentChainOpen] = useState(false);
  const [anomalyOpen, setAnomalyOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [serviceActionOpen, setServiceActionOpen] = useState(false);
  const [activeServiceStep, setActiveServiceStep] = useState<ProposalStep | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const stepIdMap = useRef<Record<number, string>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { isDemo, user, isAuthenticated, loginWithRedirect } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: ['userStats'],
    queryFn: getUserStats,
    enabled: !isDemoMode() && isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });

  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const addEvent = useCallback((text: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setEvents(prev => [{ text, time, id: Date.now() }, ...prev].slice(0, 10));
  }, []);

  // ─── Load existing proposal if ID is in URL ───
  useEffect(() => {
    if (initialId && !isDemoMode() && isAuthenticated && !proposalId) {
      const loadProposal = async () => {
        setParsing(true);
        try {
          const { getProposal } = await import('@/services/api');
          const { proposal } = await getProposal(initialId);
          setProposalId(proposal._id);
          setBriefText(proposal.rawText || '');
          
          const mapped: ProposalStep[] = proposal.steps.map((s, i) => {
            const numId = i + 1;
            stepIdMap.current[numId] = s.id;
            return {
              id: numId,
              name: s.label,
              service: s.service || '',
              tokenType: s.requiresApproval ? 'Step-up' : 'Token Vault',
              status: s.status as ProposalStep['status'],
              mentorComment: s.mentorComment,
              approvedByMentor: s.approvedByMentor,
              scope: '',
            };
          });
          setSteps(mapped);
          setCanvasRevealed(true);
          addEvent(`proposal_loaded · ${proposal.title}`);
        } catch (err) {
          toast.error('Failed to load proposal details');
        } finally {
          setParsing(false);
        }
      };
      loadProposal();
    }
  }, [initialId, isAuthenticated, proposalId, addEvent]);

  const { data: connectionsData } = useQuery({
    queryKey: ['connections'],
    queryFn: getConnections,
    enabled: !isDemoMode() && isAuthenticated,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleStepApproved = (d: { stepId: string; label: string }) =>
        addEvent(`step_approved · ${d.label || d.stepId}`);
      const handleStepRevoked = (d: { stepId: string; label: string }) =>
        addEvent(`token_revoked · ${d.label || d.stepId}`);
      const handleCibaApproved = (d: { stepId: string }) =>
        addEvent(`mentor_approved · ${d.stepId}`);
      const handleMentorDecision = (d: any) => {
        addEvent(`mentor_${d.decision} · ${d.stepId}`);
        // If the socket provides the updated proposal, we could re-map here
        // For now, let's trigger a light refetch or local update if possible
        if (d.proposal) {
          const mapped: ProposalStep[] = d.proposal.steps.map((s: any, i: number) => ({
            id: i + 1,
            name: s.label,
            service: s.service || '',
            tokenType: s.requiresApproval ? 'Step-up' : 'Token Vault',
            status: s.status as ProposalStep['status'],
            mentorComment: s.mentorComment,
            approvedByMentor: s.approvedByMentor,
            scope: '',
          }));
          setSteps(mapped);
          if (d.decision === 'reject') {
            toast.info(`Mentor requested changes: ${d.reason || ''}`);
          } else {
            toast.success('Mentor approved step!');
          }
        }
      };

      socket.on('step:approved', handleStepApproved);
      socket.on('step:revoked', handleStepRevoked);
      socket.on('ciba:approved', handleCibaApproved);
      socket.on('step:mentor_decision', handleMentorDecision);

      return () => {
        socket.off('step:approved', handleStepApproved);
        socket.off('step:revoked', handleStepRevoked);
        socket.off('ciba:approved', handleCibaApproved);
        socket.off('step:mentor_decision', handleMentorDecision);
      };
    }
    // Demo fallback: cycle through mock events
    const demoAddEvent = () => addEvent(mockEvents[Math.floor(Math.random() * mockEvents.length)]);
    demoAddEvent();
    const interval = setInterval(demoAddEvent, 4000);
    return () => clearInterval(interval);
  }, [addEvent]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleParse = async () => {
    if (!briefText.trim()) { toast.error('Enter a proposal brief first'); return; }
    setParsing(true);
    setCanvasRevealed(false);
    try {
      if (isDemoMode() || !isAuthenticated) {
        await new Promise(r => setTimeout(r, 1500));
        setSteps(mockSteps);
        stepIdMap.current = {};
      } else {
        const result = await createProposal(briefText);
        const proposal = result.proposal;
        setProposalId(proposal._id);
        // Map API steps to local ProposalStep shape
        const mapped: ProposalStep[] = proposal.steps.map((s, i) => {
          const numId = i + 1;
          stepIdMap.current[numId] = s.id;
          return {
            id: numId,
            name: s.label,
            service: s.service || '',
            tokenType: s.requiresApproval ? 'Step-up' : 'Token Vault',
            status: s.status as ProposalStep['status'],
            mentorComment: s.mentorComment,
            approvedByMentor: s.approvedByMentor,
            scope: '',
          };
        });
        setSteps(mapped.length > 0 ? mapped : mockSteps);
        addEvent(`proposal_created · ${proposal.title}`);
      }
    } catch (err) {
      toast.error('Failed to parse proposal. Using demo steps.');
      setSteps(mockSteps);
    } finally {
      setParsing(false);
    }
    setTimeout(() => setAnomalyOpen(true), 800);
    setTimeout(() => {
      setCanvasRevealed(true);
      setTimeout(() => canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }, 300);
  };

  const handleApproveStep = useCallback(async (id: any) => {
    console.log('%c [DEBUG] handleApproveStep button clicked! ID: ' + id, 'background: #ff00ff; color: #fff; padding: 5px; font-weight: bold;');
    const step = steps.find(s => String(s.id) === String(id));
    if (!step) {
      console.warn('[DEBUG] Step not found for ID:', id, 'Existing step IDs:', steps.map(s => s.id));
      return;
    }

    // Step-up auth for high-value steps
    if (id === 4 || step.tokenType === 'Step-up') {
      console.log('[DEBUG] Triggering Step-up Auth for Step:', id);
      setActiveStepId(stepIdMap.current[id] || null);
      setStepUpActive(true);
      return;
    }

    // If service has fields, show service action modal
    const svc = (step.service || '').toLowerCase();
    console.log('[DEBUG] Approving step details:', { id, name: step.name, service: step.service, normalized: svc });

    if (svc === 'gmail' || svc === 'gmail send' || svc.includes('github') || svc.includes('slack') || svc.includes('notion')) {
      console.log('[DEBUG] Triggering Service Modal for:', svc);
      setActiveStepId(stepIdMap.current[id] || null);
      setActiveServiceStep(step);
      setServiceActionOpen(true);
      return;
    }

    // Manual step feedback
    toast.info(`Manual step "${step.name}" approved.`);

    // Optimistic local update
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status: 'done' as const } : s));
    setConfettiTrigger(c => c + 1);
    if ('vibrate' in navigator) navigator.vibrate(50);

    const toasts: Record<string, string> = {
      'Gmail read': '📧 Email read token issued',
      'Groq Llama': '🤖 AI draft generated',
      Mentor: '👤 Delegation sent',
    };
    showToast(toasts[step.service] || '✓ Step approved');

    // API call
    if (proposalId && stepIdMap.current[id]) {
      try {
        await approveStep(proposalId, stepIdMap.current[id]);
        addEvent(`step_approved · ${step.name}`);
      } catch { toast.error('Failed to sync approval with server'); }
    }

    // Check if all steps done → payment link
    const updatedSteps = steps.map(s => s.id === id ? { ...s, status: 'done' as const } : s);
    if (updatedSteps.every(s => s.status === 'done' || s.status === 'revoked')) {
      setTimeout(() => setPaymentOpen(true), 1500);
    }
  }, [steps, proposalId, addEvent]);

  const handleServiceConfirm = useCallback(async (data: Record<string, string>) => {
    if (!activeServiceStep) return;
    // Optimistic local update
    setSteps(prev => prev.map(s => s.id === activeServiceStep.id ? { ...s, status: 'done' as const } : s));
    setConfettiTrigger(c => c + 1);
    if ('vibrate' in navigator) navigator.vibrate(50);

    const toasts: Record<string, string> = {
      'Gmail send': `📧 Email sent via Gmail${data.to ? ' to ' + data.to : ''}`,
      'GitHub repo': `🐙 GitHub issue created${data.owner_repo ? ' in ' + data.owner_repo : ''}`,
      Slack: `💬 Posted to Slack ${data.channel || '#general'}`,
      Notion: `📝 Notion page created${data.title ? ': ' + data.title : ''}`,
    };
    showToast(toasts[activeServiceStep.service] || '✓ Step approved');

    // API call with service data
    if (proposalId && activeStepId) {
      console.log('[DEBUG] Executing service:', { activeServiceStep, activeStepId, data });
      try {
        const opts: Record<string, any> = { executeService: true };
        const sc = (activeServiceStep.service || '').toLowerCase();
        if (sc === 'gmail' || sc === 'gmail send') {
          opts.emailData = { to: data.to, subject: data.subject, html: data.body };
        }
        if (sc.includes('github')) {
          const [owner, repo] = (data.owner_repo || '/').split('/');
          opts.githubData = { owner, repo, title: data.title, body: data.body };
        }
        if (sc.includes('slack')) {
          opts.slackData = { channel: data.channel, text: data.message };
        }
        if (sc.includes('notion')) {
          opts.notionData = { databaseId: data.databaseId, title: data.title, content: data.body };
        }
        console.log('[DEBUG] Calling API approveStep with opts:', opts);
        await approveStep(proposalId, activeStepId, opts);
        addEvent(`service_executed · ${activeServiceStep.service}`);
      } catch (err: any) {
        console.error('[DEBUG] Service failed:', err);
        toast.error(`Service failed: ${err.message}`);
      }
    }

    const currentStepId = activeServiceStep.id;
    setActiveServiceStep(null);
    setActiveStepId(null);

    const updatedSteps = steps.map(s => s.id === currentStepId ? { ...s, status: 'done' as const } : s);
    if (updatedSteps.every(s => s.status === 'done' || s.status === 'revoked')) {
      setTimeout(() => setPaymentOpen(true), 1500);
    }
  }, [activeServiceStep, activeStepId, steps, proposalId, addEvent]);

  const handleRevokeStep = useCallback(async (id: number) => {
    const step = steps.find(s => s.id === id);
    // Optimistic local update
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status: 'revoked' as const } : s));
    if ('vibrate' in navigator) navigator.vibrate([20, 30, 20]);
    showToast('🔒 Token revoked');
    // API call
    if (proposalId && stepIdMap.current[id]) {
      try {
        await revokeStep(proposalId, stepIdMap.current[id]);
        addEvent(`token_revoked · ${step?.name || id}`);
      } catch { toast.error('Failed to sync revocation with server'); }
    }
  }, [steps, proposalId, addEvent]);

  const handleDelegate = useCallback((stepId?: number) => {
    if (stepId !== undefined) setActiveStepId(stepIdMap.current[stepId] || null);
    setDelegateOpen(true);
  }, []);
  const handleMentor = useCallback((stepId?: any) => {
    console.log('[DEBUG] handleMentor called for step:', stepId);
    if (stepId !== undefined) {
      const realId = stepIdMap.current[stepId] || stepId;
      setActiveStepId(realId);
    }
    setMentorOpen(true);
  }, []);

  const handleExportPdf = async () => {
    setExportState('loading');
    try {
      if (proposalId && !isDemoMode()) {
        const { getAuditLog } = await import('@/services/api');
        await getAuditLog({ proposalId });
      }
    } catch { /* silent */ }
    setTimeout(() => { setExportState('done'); setTimeout(() => setExportState('idle'), 2000); }, 2000);
  };

  const handleShareLink = async () => {
    if (proposalId && !isDemoMode()) {
      try {
        const result = await shareProposal(proposalId);
        navigator.clipboard?.writeText(result.shareUrl);
        addEvent(`share_link_generated · ${result.shareToken}`);
      } catch {
        navigator.clipboard?.writeText(`${window.location.origin}/share/demo`);
      }
    } else {
      navigator.clipboard?.writeText(`${window.location.origin}/share/demo`);
    }
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2000);
  };

  const doneCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;

  const getEventColor = (text: string) => {
    if (text.includes('revoked') || text.includes('denied')) return 'hsl(var(--dv-danger))';
    if (text.includes('waiting') || text.includes('delegation') || text.includes('auth')) return 'hsl(var(--dv-warning))';
    if (text.includes('issued') || text.includes('approved') || text.includes('created') || text.includes('delivered') || text.includes('confirmed')) return 'hsl(var(--dv-success))';
    return 'hsl(var(--ink-tertiary))';
  };

  return (
    <DashboardLayout title="Dashboard">
      <ConfettiEffect trigger={confettiTrigger} />

      {/* Modals */}
      <ConsentChainViz steps={steps} open={consentChainOpen} onClose={() => setConsentChainOpen(false)} />
      <AnomalyDetection open={anomalyOpen} onClose={() => setAnomalyOpen(false)} proposalAmount={4200}
        proposalText={briefText} proposalId={proposalId} />
      <MentorCIBAModal open={mentorOpen} onClose={() => setMentorOpen(false)}
        proposalId={proposalId} stepId={activeStepId}
        onApproved={() => {
          setSteps(prev => prev.map(s => s.id === 3 ? { ...s, status: 'done' as const } : s));
          setConfettiTrigger(c => c + 1);
          addEvent('mentor_approved · ciba_flow');
          showToast('👤 Mentor approved the step!');
        }} />
      <PaymentLinkModal open={paymentOpen} onClose={() => setPaymentOpen(false)} amount="$4,200" proposalId={proposalId} />
      <ServiceActionModal open={serviceActionOpen} onClose={() => { setServiceActionOpen(false); setActiveServiceStep(null); setActiveStepId(null); }}
        service={activeServiceStep?.service || ''} stepName={activeServiceStep?.name || ''}
        onConfirm={handleServiceConfirm} />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Greeting */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
            <h2 className="font-display text-xl md:text-2xl mb-1" style={{ color: 'hsl(var(--ink))' }}>
              Welcome back, {(user?.name || mockUser.name).split(' ')[0]}
              {isDemo && (
                <span className="inline-flex items-center gap-1 ml-2 font-mono text-[10px] px-2 py-0.5 rounded-full align-middle"
                  style={{ background: 'hsl(var(--dv-success) / 0.12)', color: 'hsl(var(--dv-success))', verticalAlign: 'middle' }}>
                  🛡 Admin
                </span>
              )}
            </h2>
            <p className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>
              {isDemo ? 'Running in demo mode — all features are fully accessible.' : 'Manage your proposal workflow and connections.'}
            </p>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active tokens', value: String(connectionsData?.connections?.length ?? 3), color: 'hsl(var(--accent))' },
              { label: 'Proposals sent', value: String(statsData?.totalProposals ?? 12), color: 'hsl(var(--dv-success))' },
              { label: 'Pending review', value: String(statsData?.totalApprovals ?? 2), color: 'hsl(var(--dv-warning))' },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                className="border rounded-xl p-4 cursor-default" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
                whileHover={!prefersReduced ? { y: -2, borderColor: 'hsl(var(--accent))' } : {}}>
                <div className="font-display text-2xl md:text-3xl" style={{ color: stat.color }}>{stat.value}</div>
                <div className="font-body text-[11px] mt-1" style={{ color: 'hsl(var(--ink-tertiary))' }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Connections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {connectionsData?.connections?.length ? (
              connectionsData.connections.map(conn => (
                <ConnectionCard
                  key={conn.id}
                  name={conn.name}
                  icon={conn.name.slice(0, 2).toUpperCase()}
                  status="connected"
                  scope={conn.scopes?.join(', ')}
                  onRevoke={() => revokeConnection(conn.id).catch(() => {})}
                />
              ))
            ) : (
              <>
                <ConnectionCard 
                  name="Gmail" 
                  icon="G" 
                  status="connected" 
                  scope="gmail.readonly, gmail.send" 
                  onConnect={() => isDemoMode() ? toast.success('Connected to Gmail (demo)') : loginWithRedirect({ authorizationParams: { connection: 'google-oauth2', access_type: 'offline', prompt: 'consent' } })}
                  onRevoke={() => toast.success('Connection revoked locally')} 
                />
                <ConnectionCard 
                  name="GitHub" 
                  icon="GH" 
                  status="disconnected" 
                  onConnect={() => isDemoMode() ? toast.success('Connected to GitHub (demo)') : loginWithRedirect({ authorizationParams: { connection: 'github' } })}
                  onRevoke={() => toast.success('Connection revoked locally')} 
                />
              </>
            )}
          </div>

          {/* Proposal input */}
          <motion.div id="proposal-input" className="border rounded-xl p-4 md:p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>New proposal</span>
              <div className="flex items-center gap-2">
                <motion.button onClick={() => setTemplatesOpen(true)}
                  className="font-body text-[11px] px-2.5 py-1 rounded-lg border transition-colors"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                  whileHover={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>
                  📋 Templates
                </motion.button>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>Groq Llama-3.1</span>
              </div>
            </div>
            <textarea value={briefText} onChange={e => setBriefText(e.target.value)}
              placeholder="Paste your client's brief here..."
              className="w-full min-h-[140px] md:min-h-[180px] border rounded-lg p-3 md:p-4 font-body text-sm md:text-[15px] resize-y mb-4 focus:outline-none focus:ring-2 transition-shadow"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink))', lineHeight: 1.6, '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as any} />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <MagneticButton loading={parsing} onClick={handleParse}>Parse with Groq →</MagneticButton>
                {steps.length > 0 && (
                  <>
                    <motion.button onClick={() => setConsentChainOpen(true)}
                      className="font-body text-[11px] px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                      whileHover={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}>
                      🔗 Consent Chain
                    </motion.button>
                    <motion.button onClick={handleShareLink}
                      className="font-body text-[11px] px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: 'hsl(var(--border))', color: shareLinkCopied ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-secondary))' }}
                      whileHover={{ borderColor: 'hsl(var(--accent))' }}>
                      {shareLinkCopied ? 'Copied! ✓' : '🔗 Share'}
                    </motion.button>
                  </>
                )}
              </div>
              {steps.length > 0 && (
                <span className="font-mono text-[11px]" style={{ color: 'hsl(var(--dv-success))' }}>{doneCount}/{totalCount} complete</span>
              )}
            </div>
          </motion.div>

          <ProposalTemplates open={templatesOpen} onClose={() => setTemplatesOpen(false)} onSelect={(brief) => setBriefText(brief)} />

          {/* Step-up auth gate */}
          <AnimatePresence>
            {stepUpActive && (
              <StepUpGate
                onApprove={async () => {
                  setStepUpActive(false);
                  const stepIdToUpdate = steps.find(s => stepIdMap.current[s.id] === activeStepId)?.id || 1;
                  console.log('[DEBUG] Finalizing Step-Up Approval:', { proposalId, activeStepId });
                  
                  try {
                    if (proposalId && activeStepId) {
                      await (await import('@/services/api')).approveStep(proposalId, activeStepId, { executeService: true });
                    }
                    setSteps(prev => prev.map(s => s.id === stepIdToUpdate ? { ...s, status: 'done' as const } : s));
                    setConfettiTrigger(c => c + 1);
                    addEvent(`step_up_approved · step_${stepIdToUpdate}`);
                    showToast('✓ Step-up authorization confirmed');
                  } catch (err: any) {
                    console.error('[DEBUG] Step-up finalization failed:', err);
                    toast.error(`Step-up failed: ${err.message}`);
                  }
                }}
                onCancel={() => setStepUpActive(false)}
              />
            )}
          </AnimatePresence>

          {/* React Flow Canvas — Dramatic Reveal */}
          <AnimatePresence>
            {steps.length > 0 && (
              <motion.div ref={canvasRef} id="canvas-area"
                initial={{ height: 0, opacity: 0, scale: 0.95 }}
                animate={canvasRevealed ? { height: 'auto', opacity: 1, scale: 1 } : { height: 0, opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                className="overflow-hidden"
              >
                {/* Desktop: ReactFlow */}
                <div className="hidden md:block">
                  <ReactFlowProvider>
                    <CanvasInner steps={steps} onApproveStep={handleApproveStep} onRevokeStep={handleRevokeStep} onDelegate={handleDelegate} onMentor={handleMentor} />
                  </ReactFlowProvider>
                </div>

                {/* Mobile stepper */}
                <div className="md:hidden border rounded-xl p-4" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Proposal workflow</span>
                    <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{doneCount}/{totalCount}</span>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute left-[11px] top-0 bottom-0 w-[1px]" style={{ background: 'hsl(var(--border))' }} />
                    {steps.map((step, i) => (
                      <motion.div key={step.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="relative mb-4 last:mb-0">
                        <div className="absolute -left-6 top-3 w-[9px] h-[9px] rounded-full border-2"
                          style={{
                            borderColor: step.status === 'done' ? 'hsl(var(--dv-success))' : step.status === 'active' ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                            background: step.status === 'done' ? 'hsl(var(--dv-success))' : 'transparent',
                          }} />
                        <div className="border rounded-xl p-3" style={{
                          borderColor: 'hsl(var(--border))',
                          borderLeftWidth: step.status === 'active' ? 3 : 1,
                          borderLeftColor: step.status === 'active' ? 'hsl(var(--accent))' : 'hsl(var(--border))',
                          background: 'hsl(var(--bg-primary))',
                        }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>{step.name}</span>
                            <StatusBadge status={step.status} />
                          </div>
                          <div className="font-mono text-[11px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.scope}</div>
                          {step.status !== 'done' && step.status !== 'revoked' && (
                            <div className="flex gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                              <button type="button" onClick={(e) => { e.preventDefault(); console.log('[DEBUG] Mobile Approve Clicked'); handleApproveStep(step.id); }} className="font-body text-[11px]" style={{ color: 'hsl(var(--accent))' }}>Approve</button>
                              <button type="button" onClick={(e) => { e.preventDefault(); handleRevokeStep(step.id); }} className="font-body text-[11px]" style={{ color: 'hsl(var(--dv-danger))' }}>Revoke</button>
                              <button type="button" onClick={(e) => { e.preventDefault(); handleMentor(step.id); }} className="font-body text-[11px]" style={{ color: 'hsl(var(--dv-warning))' }}>👤 Mentor</button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live event feed - desktop */}
        <aside id="live-events" className="hidden lg:flex flex-col border rounded-xl w-[280px] flex-shrink-0 self-start sticky top-20"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}>
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'hsl(var(--border))' }}>
            <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>Live events</span>
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
              animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
          <div className="p-4 max-h-[400px] overflow-hidden">
            <AnimatePresence initial={false}>
              {events.map((event, i) => (
                <motion.div key={event.id} initial={{ y: -8, opacity: 0, height: 0 }}
                  animate={{ y: 0, opacity: i > 8 ? 0 : i > 7 ? 0.35 : i > 6 ? 0.6 : 1, height: 'auto' }}
                  transition={{ duration: 0.15 }}
                  className="font-mono text-[11px] mb-2 leading-relaxed cursor-pointer rounded px-1 -mx-1 transition-colors"
                  style={{ color: getEventColor(event.text) }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface-hover))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  [{event.time}] {event.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="p-4 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
            <motion.button onClick={handleExportPdf}
              className="w-full font-body text-xs border rounded-lg py-2.5 transition-colors duration-[120ms]"
              style={{ borderColor: 'hsl(var(--border))', color: exportState === 'done' ? 'hsl(var(--dv-success))' : 'hsl(var(--ink-secondary))' }}
              whileHover={{ borderColor: 'hsl(var(--accent))' }}>
              {exportState === 'loading' ? 'Generating PDF...' : exportState === 'done' ? 'Downloaded! ✓' : 'Export as PDF'}
            </motion.button>
          </div>
        </aside>

        {/* Mobile events FAB */}
        <div className="lg:hidden fixed bottom-16 right-4 z-40">
          <motion.button onClick={() => setMobileEventsOpen(!mobileEventsOpen)}
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg border"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
              animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.button>
        </div>

        {/* Mobile events sheet */}
        <AnimatePresence>
          {mobileEventsOpen && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed bottom-14 left-0 right-0 z-30 rounded-t-2xl border-t max-h-[60vh] overflow-y-auto"
              style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))' }}>
              <div className="flex justify-center py-2">
                <div className="w-8 h-1 rounded-full" style={{ background: 'hsl(var(--border))' }} />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>Live events</span>
                  <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--dv-success))' }}
                    animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                </div>
                {events.slice(0, 6).map(event => (
                  <div key={event.id} className="font-mono text-[11px] mb-2 leading-relaxed" style={{ color: getEventColor(event.text) }}>
                    [{event.time}] {event.text}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DelegateModal open={delegateOpen} onClose={() => setDelegateOpen(false)} proposalId={proposalId} stepId={activeStepId} />

      {/* Success toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-6 right-6 rounded-lg px-4 py-3 font-body text-sm z-[400] shadow-lg border"
            style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--dv-success))', color: 'hsl(var(--dv-success))' }}>
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

/* ─── Sub-components ─── */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'hsl(var(--bg-surface-hover))', color: 'hsl(var(--ink-tertiary))', label: 'Pending' },
    active: { bg: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))', label: 'Active' },
    waiting: { bg: 'hsl(var(--dv-warning) / 0.15)', color: 'hsl(var(--dv-warning))', label: 'Waiting' },
    done: { bg: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))', label: 'Done ✓' },
    revoked: { bg: 'hsl(var(--dv-danger) / 0.15)', color: 'hsl(var(--dv-danger))', label: 'Revoked' },
  };
  const s = styles[status] || styles.pending;
  return <span className="font-body text-[10px] rounded-full px-2 py-0.5" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

export function ConnectionCard({ name, icon, status, scope, onConnect, onRevoke }: {
  name: string; icon: string; status: 'connected' | 'disconnected' | 'error'; scope?: string;
  onConnect?: () => void; onRevoke?: () => void;
}) {
  const [countdown, setCountdown] = useState(86399);
  const [connectLoading, setConnectLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<'connected' | 'disconnected' | 'error'>(status);

  useEffect(() => {
    if (localStatus !== 'connected') return;
    const i = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, [localStatus]);

  const hrs = Math.floor(countdown / 3600).toString().padStart(2, '0');
  const mins = Math.floor((countdown % 3600) / 60).toString().padStart(2, '0');
  const secs = (countdown % 60).toString().padStart(2, '0');
  const timeColor = countdown < 300 ? 'hsl(var(--dv-danger))' : countdown < 1800 ? 'hsl(var(--dv-warning))' : 'hsl(var(--ink-secondary))';

  const statusConfig = {
    connected: { dotColor: 'hsl(var(--dv-success))', label: 'Connected', bgTint: 'hsl(var(--dv-success) / 0.04)' },
    disconnected: { dotColor: 'hsl(var(--ink-tertiary))', label: 'Not connected', bgTint: 'transparent' },
    error: { dotColor: 'hsl(var(--dv-danger))', label: 'Error', bgTint: 'hsl(var(--dv-danger) / 0.04)' },
  };
  const sc = statusConfig[localStatus];

  const handleConnect = () => {
    setConnectLoading(true);
    setTimeout(() => { setConnectLoading(false); setLocalStatus('connected'); onConnect?.(); }, 1500);
  };
  const handleRevoke = () => { setLocalStatus('disconnected'); setCountdown(86399); onRevoke?.(); };

  const scopeBadges = scope ? scope.split(',').map(s => s.trim()).filter(Boolean) : [];

  return (
    <motion.div className="border rounded-xl p-3 sm:p-4 md:p-5"
      style={{ borderColor: localStatus === 'error' ? 'hsl(var(--dv-danger) / 0.3)' : 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ borderColor: localStatus === 'error' ? 'hsl(var(--dv-danger) / 0.5)' : 'hsl(var(--accent))', y: -2 }} transition={{ duration: 0.2 }}>
      {/* Status indicator bar at top */}
      <div className="flex items-center gap-1.5 mb-3">
        <motion.div className="w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={{ background: sc.dotColor }}
          animate={localStatus === 'connected' ? { scale: [1, 1.3, 1] } : localStatus === 'error' ? { opacity: [1, 0.4, 1] } : {}}
          transition={{ duration: localStatus === 'error' ? 1 : 2, repeat: Infinity }} />
        <span className="font-body text-[11px] font-medium" style={{ color: sc.dotColor }}>{sc.label}</span>
      </div>

      {/* Icon + Name row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg border flex items-center justify-center font-mono text-xs font-bold flex-shrink-0"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink))', background: 'hsl(var(--bg-primary))' }}>{icon}</div>
          <div>
            <span className="font-body text-sm font-semibold block" style={{ color: 'hsl(var(--ink))' }}>{name}</span>
            {localStatus === 'disconnected' && (
              <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>Click to connect</span>
            )}
          </div>
        </div>
      </div>

      {/* Scope badges when connected */}
      {localStatus === 'connected' && scopeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {scopeBadges.map((s) => (
            <span key={s} className="font-mono text-[9px] px-1.5 py-0.5 rounded-md"
              style={{ background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink-secondary))', border: '1px solid hsl(var(--border))' }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {localStatus === 'connected' && (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Token expires in</span>
            <span className="font-mono text-xs sm:text-sm font-semibold" style={{ color: timeColor }}>{hrs}:{mins}:{secs}</span>
          </div>
          <div className="w-full h-[3px] rounded-full mb-3 overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
            <motion.div className="h-full rounded-full" style={{ width: `${(countdown / 86400) * 100}%`, background: timeColor }} />
          </div>
          <motion.button onClick={handleRevoke}
            className="w-full font-body text-xs py-2 rounded-lg border text-center transition-colors"
            style={{ borderColor: 'hsl(var(--dv-danger) / 0.2)', color: 'hsl(var(--dv-danger))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--dv-danger) / 0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            Disconnect & Revoke Token
          </motion.button>
        </>
      )}
      {localStatus === 'error' && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: 'hsl(var(--dv-danger) / 0.06)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--dv-danger))" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span className="font-body text-[11px]" style={{ color: 'hsl(var(--dv-danger))' }}>Connection failed. Token may have expired.</span>
        </div>
      )}
      {(localStatus === 'disconnected' || localStatus === 'error') && (
        <MagneticButton loading={connectLoading} onClick={handleConnect}>Connect {name}</MagneticButton>
      )}
    </motion.div>
  );
}

function StepUpGate({ onApprove, onCancel }: { onApprove: () => void; onCancel: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
      className="border-l-[3px] rounded-xl p-4 md:p-6"
      style={{ borderLeftColor: 'hsl(var(--dv-warning))', background: 'hsl(var(--dv-warning) / 0.06)' }}>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <motion.svg width="32" height="48" viewBox="0 0 40 60" fill="none" className="flex-shrink-0"
          animate={{ rotate: [-4, 4, -4, 4, 0] }} transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 3 }}>
          <rect x="4" y="2" width="32" height="56" rx="6" stroke="hsl(var(--dv-warning))" strokeWidth="1.5" />
          <line x1="16" y1="50" x2="24" y2="50" stroke="hsl(var(--dv-warning))" strokeWidth="1.5" />
        </motion.svg>
        <div className="flex-1 min-w-0">
          <h4 className="font-body text-sm md:text-base font-semibold mb-1" style={{ color: 'hsl(var(--ink))' }}>Step-Up Auth Required</h4>
          <p className="font-body text-xs md:text-sm mb-2" style={{ color: 'hsl(var(--ink-secondary))' }}>
            This action requires re-authentication. Auth0 sent a push notification to your device.
          </p>
          <p className="font-mono text-[10px] mb-4" style={{ color: 'hsl(var(--dv-warning))' }}>
            acr_values: http://schemas.openid.net/pec/phase1/loa/1
          </p>
          <div className="w-full h-[2px] rounded-full mb-4 overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
            <motion.div className="h-full w-1/3 rounded-full" style={{ background: 'hsl(var(--dv-warning))' }}
              animate={{ x: ['-100%', '400%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <motion.button onClick={onApprove} className="font-body text-sm px-4 py-2 rounded-lg text-white"
              style={{ background: 'hsl(var(--dv-success))' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>I approved it ✓</motion.button>
            <motion.button onClick={onCancel} className="font-body text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'hsl(var(--dv-danger))', color: 'hsl(var(--dv-danger))' }}
              whileHover={{ background: 'hsl(var(--dv-danger) / 0.08)' }}>Cancel send</motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DelegateModal({ open, onClose, proposalId, stepId }: {
  open: boolean; onClose: () => void;
  proposalId?: string | null; stepId?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reviewUrl, setReviewUrl] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!email.trim()) { toast.error('Enter a mentor email'); return; }
    setSending(true);
    try {
      if (proposalId && stepId && !isDemoMode()) {
        const result = await delegateStep(proposalId, stepId, email, message || undefined);
        setReviewUrl(result?.reviewUrl || '');
        if (result?.emailError) {
          setEmailError(result.emailError);
          toast.warning('Email failed: ' + result.emailError);
        } else {
          setEmailError(null);
          toast.success('Delegated successfully');
        }
      } else {
        await new Promise(r => setTimeout(r, 1500));
        setReviewUrl(`${window.location.origin}/mentor/demo`);
        toast.success('Delegated (demo)');
      }
      setSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send delegation');
    } finally {
      setSending(false);
    }
  };

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
        className="relative z-10 w-full max-w-[520px] rounded-2xl border overflow-hidden"
        style={{ background: 'hsl(var(--bg-primary))', borderColor: 'hsl(var(--border))', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))' }}>
          <div>
            <h3 className="font-display text-lg" style={{ color: 'hsl(var(--ink))' }}>✉️ Delegate for Review</h3>
            <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Request a mentor sign-off via email</p>
          </div>
          <motion.button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: 'hsl(var(--ink-tertiary))' }}
            whileHover={{ background: 'hsl(var(--bg-surface))' }}>×</motion.button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.div key="form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <div>
                  <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Mentor's email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
                    placeholder="mentor@example.com" />
                </div>
                <div>
                  <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Message (optional)</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 font-body text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2"
                    style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
                    placeholder="Please review this step..." />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <motion.button onClick={onClose} className="px-4 py-2 rounded-lg font-body text-sm border"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                    whileHover={{ background: 'hsl(var(--bg-surface))' }}>Cancel</motion.button>
                  <MagneticButton loading={sending} onClick={handleSend}>Send Invite</MagneticButton>
                </div>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
                <div className="text-5xl mb-4">✉️</div>
                <h4 className="font-display text-xl mb-2" style={{ color: emailError ? 'hsl(var(--dv-warning))' : 'hsl(var(--dv-success))' }}>
                  {emailError ? 'Invitation Created' : 'Invitation Sent!'}
                </h4>
                <p className="font-body text-sm mb-6 px-4" style={{ color: 'hsl(var(--ink-secondary))' }}>
                  {emailError 
                    ? `The invitation is active, but the email couldn't be sent: ${emailError}. You can manually share the link below.`
                    : `An email has been sent to ${email} with a secure sign-off link.`}
                </p>
                {reviewUrl && (
                  <div className="bg-[hsl(var(--bg-surface))] p-4 rounded-xl border mb-6" style={{ borderColor: 'hsl(var(--border))' }}>
                    <p className="font-body text-[11px] mb-2 text-left" style={{ color: 'hsl(var(--ink-tertiary))' }}>Direct Review Link:</p>
                    <div className="flex gap-2">
                      <code className="flex-1 text-[10px] bg-black/5 p-2 rounded truncate border overflow-hidden" style={{ color: 'hsl(var(--ink-secondary))', borderColor: 'hsl(var(--border))' }}>{reviewUrl}</code>
                      <motion.button onClick={() => { navigator.clipboard.writeText(reviewUrl); toast.success('Link copied!'); }}
                        className="px-3 py-1.5 rounded-lg bg-[hsl(var(--accent))] text-white text-xs font-body"
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Copy</motion.button>
                    </div>
                  </div>
                )}
                <motion.button onClick={() => { setSent(false); onClose(); setEmail(''); setMessage(''); }}
                  className="w-full py-3 rounded-xl font-body font-semibold text-white"
                  style={{ background: 'hsl(var(--accent))' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Done</motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function RevokeAllModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [revoking, setRevoking] = useState(false);
  const queryClient = useQueryClient();

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const { connections } = await getConnections();
      await Promise.all((connections || []).map(c => revokeConnection(c.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('All tokens revoked successfully');
      setRevoking(false);
      onClose();
    },
    onError: () => {
      toast.error('Failed to revoke all tokens');
      setRevoking(false);
    },
  });

  const handleConfirm = useCallback(() => {
    setRevoking(true);
    if (isDemoMode()) {
      setTimeout(() => {
        toast.success('All tokens revoked (demo)');
        setRevoking(false);
        onClose();
        queryClient.invalidateQueries({ queryKey: ['connections'] });
      }, 1200);
    } else {
      revokeAllMutation.mutate();
    }
  }, [onClose, revokeAllMutation, queryClient]);

  // Sync open state
  useEffect(() => {
    if (!open) setRevoking(false);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => !revoking && onClose()} />
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="relative z-10 w-full max-w-[360px] rounded-2xl p-6"
            style={{ background: 'hsl(var(--bg-primary))', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div className="text-center">
              <motion.div className="text-3xl mb-3"
                animate={revoking ? { rotate: [0, 360] } : { rotate: [0, -10, 10, 0] }}
                transition={revoking ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}>
                ⚠️
              </motion.div>
              <p className="font-body text-sm mb-6" style={{ color: 'hsl(var(--ink-secondary))' }}>
                {revoking ? 'Revoking all active tokens…' : 'This will revoke all active tokens. Are you sure?'}
              </p>
              <div className="flex gap-3 justify-center">
                <motion.button onClick={handleConfirm} disabled={revoking}
                  className="font-body text-sm px-4 py-2 rounded-lg text-white disabled:opacity-70"
                  style={{ background: 'hsl(var(--dv-danger))' }} whileHover={{ scale: revoking ? 1 : 1.02 }} whileTap={{ scale: revoking ? 1 : 0.98 }}>
                  {revoking ? 'Revoking…' : 'Yes, revoke all'}
                </motion.button>
                <motion.button onClick={onClose} disabled={revoking}
                  className="font-body text-sm px-4 py-2 rounded-lg border disabled:opacity-50"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                  whileHover={{ borderColor: 'hsl(var(--accent))' }}>Cancel</motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
