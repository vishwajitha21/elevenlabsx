import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiChat, aiRewrite, isDemoMode } from '@/services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'pricing' | 'risk' | 'timeline' | 'rewrite';
}

const suggestions = [
  'Make more formal',
  'Add pricing table',
  'Shorten to 100 words',
  'Add project timeline',
];

// ─── Mock fallbacks for demo mode ─────────────────────────────────────────────
const mockResponses: Record<string, string> = {
  'Make more formal': "I've adjusted the tone to be more professional. Key changes: removed contractions, replaced casual phrases with industry terminology, and added a stronger closing statement.",
  'Add pricing table': 'Here\'s a suggested pricing breakdown:\n\nDiscovery & Research — $800\nDesign & Prototyping — $1,600\nDevelopment — $1,400\nRevisions & Handoff — $400\n\nTotal: $4,200\n\nWant me to adjust any line items?',
  'Shorten to 100 words': "Condensed the proposal to 98 words while preserving all key deliverables and the timeline. Removed redundant phrases and merged similar sections for clarity.",
  'Add project timeline': "Suggested timeline:\n\nWeek 1 — Discovery & kickoff call\nWeek 2–3 — Design exploration and feedback\nWeek 4–5 — Development and staging\nWeek 6 — Final delivery and handoff\n\nEach phase includes a checkpoint for your approval before moving forward.",
};

// ─── High-Fidelity RichText Renderer for "Premium" feel ─────────────────────
function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  // Split into lines and process each
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let inList = false;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) inList = false;
      elements.push(<div key={`br-${idx}`} className="h-2" />);
      return;
    }

    // Emoji/Badge Detection (e.g. 📅, 💰, 🚀)
    const hasSpecialEmoji = /^[📅💰🚀🛡🤖✅✕💡]/.test(trimmed);

    // Header Detection
    if (trimmed.startsWith('####')) {
      elements.push(<h6 key={idx} className="font-display text-[11px] font-bold mt-3 mb-1 tracking-wider uppercase" style={{ color: 'hsl(var(--accent))' }}>{trimmed.replace(/^####\s*/, '')}</h6>);
      return;
    }
    if (trimmed.startsWith('###')) {
      elements.push(<h5 key={idx} className="font-display text-xs font-bold mt-4 mb-1.5" style={{ color: 'hsl(var(--ink))' }}>{trimmed.replace(/^###\s*/, '')}</h5>);
      return;
    }
    if (trimmed.startsWith('##')) {
      elements.push(<h4 key={idx} className="font-display text-sm font-bold mt-5 mb-2 border-b pb-1" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink))' }}>{trimmed.replace(/^##\s*/, '')}</h4>);
      return;
    }
    if (trimmed.startsWith('#')) {
      elements.push(<h3 key={idx} className="font-display text-base font-bold mt-6 mb-3" style={{ color: 'hsl(var(--accent))' }}>{trimmed.replace(/^#\s*/, '')}</h3>);
      return;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={idx} className="my-4 border-none h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border)), transparent)' }} />);
      return;
    }

    // List Detection
    const listMatch = trimmed.match(/^[\*\-\+] (.*)/);
    const numListMatch = trimmed.match(/^\d+\. (.*)/);

    if (listMatch || numListMatch) {
      const content = listMatch ? listMatch[1] : numListMatch![1];
      elements.push(
        <div key={idx} className="flex gap-2 ml-1 my-1">
          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'hsl(var(--accent))' }} />
          <span className="flex-1 opacity-90">{parseInlines(content)}</span>
        </div>
      );
      inList = true;
      return;
    }

    // Special Badge/Callout wrapping
    if (hasSpecialEmoji) {
      elements.push(
        <div key={idx} className="my-3 p-3 rounded-xl border flex gap-3 shadow-sm" style={{ 
          background: 'hsl(var(--bg-surface))', 
          borderColor: 'hsl(var(--accent) / 0.15)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <span className="text-lg flex-shrink-0 leading-none">{trimmed.substring(0, 2)}</span>
          <div className="flex-1 font-medium leading-relaxed" style={{ color: 'hsl(var(--ink))' }}>
            {parseInlines(trimmed.substring(2).trim())}
          </div>
        </div>
      );
      return;
    }

    // Standard line with inline parsing
    elements.push(<p key={idx} className="leading-relaxed my-1.5 opacity-90">{parseInlines(trimmed)}</p>);
  });

  return <div className="formatted-content w-full">{elements}</div>;
}

// Helper for inline styles (bold, italic)
function parseInlines(text: string) {
  // Simple regex for bold **text**
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold underline-offset-2 decoration-accent/30" style={{ color: 'hsl(var(--ink))' }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const trimmed = content.trim();

  // Try to detect and render JSON responses gracefully
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      // 1. Pricing table
      if (parsed.pricing && Array.isArray(parsed.pricing)) {
        const total = parsed.pricing.reduce(
          (sum: number, item: any) => sum + (item.rate || item.price || item.amount || 0), 0
        );
        return (
          <div className="space-y-1.5 w-full">
            <p className="font-semibold text-xs mb-2" style={{ color: 'hsl(var(--ink))' }}>
              💰 Pricing Breakdown
            </p>
            {parsed.pricing.map((item: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center text-xs py-1.5 border-b"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                <span style={{ color: 'hsl(var(--ink-secondary))' }}>
                  {item.service || item.item || item.name}
                </span>
                <span className="font-mono font-semibold" style={{ color: 'hsl(var(--ink))' }}>
                  ${(item.rate || item.price || item.amount || 0).toLocaleString()}
                </span>
              </div>
            ))}
            <div
              className="flex justify-between items-center text-xs pt-1.5 font-bold"
              style={{ color: 'hsl(var(--ink))' }}
            >
              <span>Total</span>
              <span className="font-mono">
                ${(parsed.total || total).toLocaleString()}
              </span>
            </div>
          </div>
        );
      }

      // 2. Risk / anomaly result
      if (parsed.riskLevel !== undefined) {
        const colorMap: Record<string, string> = {
          low: '#16a34a',
          medium: '#d97706',
          high: '#dc2626',
        };
        const bgMap: Record<string, string> = {
          low: 'rgba(22,163,74,0.08)',
          medium: 'rgba(217,119,6,0.08)',
          high: 'rgba(220,38,38,0.08)',
        };
        const riskKey = (parsed.riskLevel || '').toLowerCase();
        const color = colorMap[riskKey] || 'hsl(var(--ink-secondary))';
        const bg = bgMap[riskKey] || 'hsl(var(--bg-surface))';
        return (
          <div className="space-y-2 w-full">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: bg, color }}
              >
                {(parsed.riskLevel || 'UNKNOWN').toUpperCase()} RISK
              </span>
              {parsed.score !== undefined && (
                <span className="text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                  Score: {parsed.score}/100
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--ink-secondary))' }}>
              {parsed.summary}
            </p>
            {parsed.anomalies?.length > 0 && (
              <div className="space-y-1.5 mt-1">
                {parsed.anomalies.map((a: any, i: number) => (
                  <div
                    key={i}
                    className="text-xs p-2 rounded-lg"
                    style={{ background: 'hsl(var(--bg-surface))' }}
                  >
                    <span className="font-semibold capitalize" style={{ color: 'hsl(var(--ink))' }}>
                      {a.type?.replace(/_/g, ' ')}:{' '}
                    </span>
                    <span style={{ color: 'hsl(var(--ink-secondary))' }}>{a.description}</span>
                    {a.suggestion && (
                      <p className="mt-1 text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                        💡 {a.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {parsed.positives?.length > 0 && (
              <div className="space-y-1 mt-1">
                {parsed.positives.map((p: string, i: number) => (
                  <p key={i} className="text-xs" style={{ color: '#16a34a' }}>
                    ✓ {p}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      }

      // 3. Workflow Steps
      if (parsed.steps && Array.isArray(parsed.steps)) {
        return (
          <div className="space-y-1.5 w-full">
            <p className="font-semibold text-xs mb-2" style={{ color: 'hsl(var(--ink))' }}>
              📋 Workflow Steps
            </p>
            {parsed.steps.map((step: any, i: number) => (
              <div
                key={i}
                className="flex gap-2 text-xs py-1.5 border-b"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' }}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium" style={{ color: 'hsl(var(--ink))' }}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p style={{ color: 'hsl(var(--ink-tertiary))' }}>{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // 4. Specialized Timeline / Roadmap
      if (parsed.timeline) {
        return (
          <div className="space-y-3 w-full p-3 rounded-xl border" style={{ borderColor: 'hsl(var(--accent) / 0.3)', background: 'hsl(var(--accent-light) / 0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">📅</span>
              <p className="font-semibold text-xs" style={{ color: 'hsl(var(--ink))' }}>
                {parsed.name || parsed.project || 'Project Roadmap'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono" style={{ color: 'hsl(var(--ink-tertiary))' }}>
                <span>Start: {parsed.timeline.start || 'TBD'}</span>
                <span>End: {parsed.timeline.end || 'TBD'}</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: '100%' }} 
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full" 
                  style={{ background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--dv-success)))' }} 
                />
              </div>
              {parsed.timeline.phases && Array.isArray(parsed.timeline.phases) && (
                <div className="space-y-2 mt-3 pt-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                  {parsed.timeline.phases.map((p: any, i: number) => (
                    <div key={i} className="flex gap-2 text-[11px]">
                      <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: 'hsl(var(--accent))' }} />
                      <div className="flex-1">
                        <span className="font-semibold" style={{ color: 'hsl(var(--ink))' }}>{p.name || p.phase}: </span>
                        <span style={{ color: 'hsl(var(--ink-secondary))' }}>{p.duration || p.dates || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Generic JSON — render as readable key/value pairs
      return (
        <div className="space-y-1 text-xs w-full">
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="font-semibold capitalize" style={{ color: 'hsl(var(--ink))' }}>
                {k.replace(/_/g, ' ')}:
              </span>
              <span style={{ color: 'hsl(var(--ink-secondary))' }}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      );
    } catch {
      // Not valid JSON — fall through to plain text
    }
  }

  // Use the new Premium RichText renderer for everything else
  return <FormattedText text={content} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AICoPilot({
  collapsed,
  onToggle,
  proposalId,
}: {
  collapsed: boolean;
  onToggle: () => void;
  proposalId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm your AI co-pilot. I can help refine proposals, suggest pricing, or restructure your workflow. Try a suggestion below or ask me anything!",
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const addMessage = (msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: Date.now().toString() + Math.random() }]);
  };

  const sendMessage = async (text: string) => {
    addMessage({ role: 'user', content: text });
    setInput('');
    setTyping(true);

    try {
      if (!isDemoMode()) {
        // Check if this is a rewrite suggestion
        const rewriteMap: Record<string, string> = {
          'Make more formal': 'Make this more formal and professional',
          'Shorten to 100 words': 'Shorten to approximately 100 words, keep all key points',
        };

        if (rewriteMap[text]) {
          // Use rewrite endpoint for style suggestions
          const { rewritten } = await aiRewrite(
            messages.filter((m) => m.role === 'assistant').pop()?.content || text,
            rewriteMap[text]
          );
          addMessage({ role: 'assistant', content: rewritten });
        } else {
          // Use chat endpoint for everything else
          const history = [
            ...messages,
            { id: 'tmp', role: 'user' as const, content: text },
          ].map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

          const { reply } = await aiChat(history.slice(-10), proposalId);
          addMessage({ role: 'assistant', content: reply });
        }

        setTyping(false);
        return;
      }
    } catch (err) {
      console.warn('[AICoPilot] API error, falling back to mock:', err);
      // Fall through to mock
    }

    // Mock fallback
    setTimeout(() => {
      const response =
        mockResponses[text] ||
        `I'd suggest: ${text.toLowerCase()}. This would improve clarity and impact. Want me to apply this change to the proposal?`;
      addMessage({ role: 'assistant', content: response });
      setTyping(false);
    }, 1200 + Math.random() * 800);
  };

  // ── Collapsed state ──────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <motion.button
        onClick={onToggle}
        className="fixed right-4 top-20 z-30 w-10 h-10 rounded-xl border flex items-center justify-center"
        style={{
          background: 'hsl(var(--bg-primary))',
          borderColor: 'hsl(var(--border))',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        title="Open AI Co-Pilot"
      >
        <span style={{ fontSize: 16 }}>🤖</span>
      </motion.button>
    );
  }

  // ── Expanded state ───────────────────────────────────────────────────────────
  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 300, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden xl:flex flex-col border-l h-screen sticky top-0 overflow-hidden flex-shrink-0 z-20"
      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}
    >
      {/* Header */}
      <div
        className="p-4 border-b flex items-center justify-between h-14 flex-shrink-0"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14 }}>🤖</span>
          <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--ink))' }}>
            AI Co-Pilot
          </span>
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' }}
          >
            {isDemoMode() ? 'demo' : 'live'}
          </span>
        </div>
        <motion.button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-lg"
          style={{ color: 'hsl(var(--ink-tertiary))' }}
          whileHover={{ background: 'hsl(var(--bg-surface))' }}
          title="Collapse"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
          </svg>
        </motion.button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[88%] rounded-xl px-3 py-2.5 font-body text-xs"
                style={{
                  background:
                    msg.role === 'user'
                      ? 'hsl(var(--accent))'
                      : 'hsl(var(--bg-surface))',
                  color:
                    msg.role === 'user'
                      ? 'hsl(var(--primary-foreground))'
                      : 'hsl(var(--ink-secondary))',
                }}
              >
                <MessageContent content={msg.content} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {typing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-1 px-3 py-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'hsl(var(--ink-tertiary))' }}
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Suggestion chips */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <motion.button
            key={s}
            onClick={() => !typing && sendMessage(s)}
            disabled={typing}
            className="font-body text-[10px] px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
            whileHover={!typing ? { borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' } : {}}
            whileTap={!typing ? { scale: 0.95 } : {}}
          >
            {s}
          </motion.button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && input.trim() && !typing) {
                e.preventDefault();
                sendMessage(input.trim());
              }
            }}
            placeholder="Ask anything..."
            disabled={typing}
            className="flex-1 border rounded-lg px-3 py-2 font-body text-xs focus:outline-none focus:ring-1 disabled:opacity-50"
            style={{
              borderColor: 'hsl(var(--border))',
              background: 'hsl(var(--bg-surface))',
              color: 'hsl(var(--ink))',
              '--tw-ring-color': 'hsl(var(--accent) / 0.3)',
            } as React.CSSProperties}
          />
          <motion.button
            onClick={() => {
              if (input.trim() && !typing) sendMessage(input.trim());
            }}
            disabled={!input.trim() || typing}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'hsl(var(--accent))', color: 'white' }}
            whileHover={input.trim() && !typing ? { scale: 1.05 } : {}}
            whileTap={input.trim() && !typing ? { scale: 0.95 } : {}}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </motion.button>
        </div>
        <p className="text-[9px] mt-1.5 text-center" style={{ color: 'hsl(var(--ink-tertiary))' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </motion.aside>
  );
}