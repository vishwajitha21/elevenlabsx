/**
 * DeliverVault — AI Module
 * 5-Provider Free Tier Waterfall
 *
 * Provider priority (all 100% free, ordered by speed):
 *
 *  1. Groq         — llama-3.3-70b     | 14,400 req/day | ~0.8s
 *  2. Cerebras     — llama-3.3-70b     | 60 RPM, 1M TPD | ~0.3s  ← FASTEST
 *  3. SambaNova    — llama-3.3-70b     | ~1000 req/day  | ~0.6s
 *  4. Google Gemini— gemini-2.0-flash  | 1500 RPD       | ~1.2s
 *  5. OpenRouter   — 10+ free models   | rate-limited   | ~2s
 *
 * Logic:
 *  - On 429/500/503: cascade to next provider → next model within provider
 *  - On timeout >12s: cascade immediately
 *  - On 401/403: skip entire provider (bad key, no point retrying)
 *  - Cache hits return in <1ms for identical prompts (5 min TTL)
 */

import { aiCacheGet, aiCacheSet } from './cache.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Gemini SDK instance (lazy — only created when key is available) ───────────
let _geminiSDK = null;
function getGeminiSDK() {
  if (!_geminiSDK && process.env.GEMINI_API_KEY) {
    _geminiSDK = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _geminiSDK;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
export const SYSTEM = `You are DeliverVault AI Co-Pilot — a sharp, practical assistant for freelancers.
You specialize in:
- Parsing raw proposal text into structured approval workflows
- Improving proposal copy for client communication
- Detecting contract anomalies or risky clauses
- Giving concise, actionable advice

Be direct. No filler. Match the professional tone of the proposal context.
When asked for JSON, return ONLY valid JSON with no markdown fences or explanation.`;

// ─── Status codes that mean "this provider is busy — try the next" ────────────
const CASCADE_CODES = new Set([429, 500, 502, 503, 504]);

// ─── Provider Definitions ─────────────────────────────────────────────────────
const PROVIDERS = [

  // ── 1. Groq ──────────────────────────────────────────────────────────────
  {
    name: 'Groq',
    enabled: () => !!process.env.GROQ_API_KEY,
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
      'llama3-8b-8192',
    ],
    call: async (model, messages, opts) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.maxTokens }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
      if (!res.ok) { const e = new Error(data.error?.message || `HTTP ${res.status}`); e.status = res.status; throw e; }
      return data.choices[0]?.message?.content || '';
    },
  },

  // ── 2. Cerebras ──────────────────────────────────────────────────────────
  {
    name: 'Cerebras',
    enabled: () => !!process.env.CEREBRAS_API_KEY,
    models: [
      'llama-3.3-70b',
      'llama3.1-8b',
    ],
    call: async (model, messages, opts) => {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.maxTokens }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) { const e = new Error(data.message || `HTTP ${res.status}`); e.status = res.status; throw e; }
      return data.choices[0]?.message?.content || '';
    },
  },

  // ── 3. SambaNova ─────────────────────────────────────────────────────────
  {
    name: 'SambaNova',
    enabled: () => !!process.env.SAMBANOVA_API_KEY,
    models: [
      'Meta-Llama-3.3-70B-Instruct',
      'Meta-Llama-3.1-70B-Instruct',
      'Meta-Llama-3.1-8B-Instruct',
    ],
    call: async (model, messages, opts) => {
      const res = await fetch('https://api.sambanova.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.SAMBANOVA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.maxTokens, stream: false }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) { const e = new Error(data.message || `HTTP ${res.status}`); e.status = res.status; throw e; }
      return data.choices[0]?.message?.content || '';
    },
  },

  // ── 4. Google Gemini (uses @google/generative-ai SDK — key sent via header) ──
  {
    name: 'Gemini',
    enabled: () => !!process.env.GEMINI_API_KEY,
    models: [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ],
    call: async (model, messages, opts) => {
      const sdk = getGeminiSDK();
      if (!sdk) throw new Error('Gemini SDK not initialized');

      const systemMsg = messages.find((m) => m.role === 'system');
      const userMsgs = messages.filter((m) => m.role !== 'system');

      const contents = userMsgs.map((m, i) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: i === 0 && systemMsg ? `${systemMsg.content}\n\n---\n\n${m.content}` : m.content }],
      }));

      const genModel = sdk.getGenerativeModel({ model });

      // Wrap in a timeout to match the waterfall pattern
      const result = await Promise.race([
        genModel.generateContent({
          contents,
          generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxTokens },
        }),
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('Timeout'), { name: 'TimeoutError' })), 15000)),
      ]).catch((err) => {
        // Map SDK errors to HTTP-like status codes for the waterfall cascade
        const status = err.status || err.statusCode || (err.message?.includes('429') ? 429 : 0);
        const mapped = new Error(err.message);
        mapped.status = status;
        mapped.name = err.name;
        throw mapped;
      });

      const text = result.response.text();
      if (!text) throw new Error('Gemini returned empty response');
      return text;
    },
  },

  // ── 5. OpenRouter ─────────────────────────────────────────────────────────
  {
    name: 'OpenRouter',
    enabled: () => !!process.env.OPENROUTER_API_KEY,
    models: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'microsoft/phi-3-mini-128k-instruct:free',
    ],
    call: async (model, messages, opts) => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://delivervault.dev',
          'X-Title': 'DeliverVault',
        },
        body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.maxTokens }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok) { const e = new Error(data.error?.message || `HTTP ${res.status}`); e.status = res.status; throw e; }
      return data.choices[0]?.message?.content || '';
    },
  },
];

// ─── Core waterfall ──────────────────────────────────────────────────────────

async function complete(messages, {
  temperature = 0.3,
  maxTokens = 1000,
  useCache = true,
  label = '',
} = {}) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const cacheKey = `${temperature}:${maxTokens}:${lastUser.slice(0, 300)}`;

  if (useCache) {
    const hit = aiCacheGet(cacheKey);
    if (hit) { console.log(`[AI:cache] ${label}`); return hit; }
  }

  const log = [];

  for (const provider of PROVIDERS) {
    if (!provider.enabled()) continue;

    for (const model of provider.models) {
      try {
        const t0 = Date.now();
        const text = await provider.call(model, messages, { temperature, maxTokens });
        const ms = Date.now() - t0;

        if (!text?.trim()) { log.push(`${provider.name}/${model}: empty`); continue; }

        console.log(`[AI] ${provider.name}/${model} ✅ ${ms}ms${label ? ` · ${label}` : ''}`);
        if (useCache) aiCacheSet(cacheKey, text);
        return text;

      } catch (err) {
        const code = err.status || 0;
        log.push(`${provider.name}/${model}: ${err.message}`);

        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          console.warn(`[AI] ${provider.name}/${model} ⏱ timeout`);
          continue;
        }
        if (CASCADE_CODES.has(code)) {
          console.warn(`[AI] ${provider.name}/${model} ⚠️ ${code}`);
          continue;
        }
        if (code === 401 || code === 403) {
          console.warn(`[AI] ${provider.name} 🔑 auth error — skipping`);
          break;
        }
        console.warn(`[AI] ${provider.name}/${model} ❌ ${err.message}`);
        continue;
      }
    }
  }

  throw new Error(`All AI providers exhausted:\n  ${log.join('\n  ')}`);
}

// ─── JSON extraction ─────────────────────────────────────────────────────────
function extractJSON(text) {
  try { return JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim()); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return null;
}

// ─── Provider status (for /health) ───────────────────────────────────────────
export function getProviderStatus() {
  return PROVIDERS.map((p) => ({ name: p.name, configured: p.enabled(), models: p.models }));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function parseProposal(rawText) {
  const prompt = `Parse this freelance proposal into a structured workflow.
Return ONLY valid JSON matching this exact schema:
{
  "title": "Short proposal title",
  "client": "Client name or company",
  "value": 5000,
  "currency": "USD",
  "steps": [
    {
      "id": "step-1",
      "label": "Step name (max 4 words)",
      "description": "One sentence describing this step",
      "requiresApproval": true,
      "service": "gmail" | "slack" | "github" | "notion" | null,
      "estimatedDays": 2
    }
  ]
}
Rules: 3-7 steps. Assign service = gmail (sending docs/contracts), slack (notifications), github (code delivery), notion (docs), null (calls/reviews). requiresApproval=true for client sign-off steps.

Proposal:
${rawText}`;

  const text = await complete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { temperature: 0.15, maxTokens: 1200, label: 'parse' }
  );
  return extractJSON(text) || { error: 'Parse failed', raw: text.slice(0, 300) };
}

export async function chat(messages, proposalContext) {
  const ctx = proposalContext
    ? `\n\nActive proposal: "${proposalContext.title}" · Client: ${proposalContext.client}`
    : '';

  // Chat-specific system prompt — rich styles, NO RAW JSON
  const chatSystem = `You are DeliverVault AI Co-Pilot — the ultimate executive assistant for elite freelancers.
Your goal is to provide advice that feels expensive, clear, and ready-to-use.

STYLING RULES:
1. Use bolding (**) for emphasis on key results or names.
2. Use clear, hierarchical headers:
   - # For main proposal titles
   - ## For major sections
   - ### For sub-points (Discovery, Strategy, etc.)
3. Use specialized "Dashboard Badges" by starting a line with these icons:
   - 📅 (Timeline/Schedule)
   - 💰 (Pricing/Budget)
   - 🚀 (Package Deals/Growth)
   - 🛡 (Security/Risks)
   - 💡 (Advice/Suggestions)
   - ✅ (Deliverables/Done)
4. Bullet points (•) should be used for simple, indented lists.
5. NEVER return raw JSON code blocks. Always respond in high-fidelity, stylized Markdown.

${ctx}`;

  return complete(
    [{ role: 'system', content: chatSystem }, ...messages.slice(-10)],
    { temperature: 0.7, maxTokens: 600, useCache: false, label: 'chat' }
  );
}

export async function rewrite(section, instruction) {
  const prompt = `Rewrite this proposal section per the instruction.
Instruction: "${instruction}"
Original:
${section.slice(0, 2000)}
Return ONLY the rewritten text. No explanation, no quotes.`;

  return complete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { temperature: 0.5, maxTokens: 800, label: 'rewrite' }
  );
}

const TEMPLATE_PROMPTS = {
  brandRefresh: (c) => `Freelance brand identity refresh proposal. Client: ${c.client || 'client'} · Timeline: ${c.timeline || '4 weeks'} · Budget: ${c.budget || '$3k–$6k'}. Scope: logo, guidelines, palette, typography.`,
  webDev:       (c) => `Freelance web development proposal. Client: ${c.client || 'client'} · Stack: ${c.stack || 'React + Node.js'} · Budget: ${c.budget || '$5k–$12k'}. Deliverables: app, design, admin, deployment.`,
  marketing:    (c) => `Freelance digital marketing retainer proposal. Client: ${c.client || 'client'} · Timeline: ${c.timeline || '3-month retainer'} · Budget: ${c.budget || '$2k/month'}. Scope: SEO, content, ads, reporting.`,
  consulting:   (c) => `Freelance business consulting proposal. Client: ${c.client || 'client'} · Focus: ${c.focus || 'growth strategy'} · Budget: ${c.budget || '$4k–$8k'}. Deliverables: discovery, analysis, 90-day plan.`,
  design:       (c) => `Freelance UX/UI design proposal. Client: ${c.client || 'client'} · Platform: ${c.platform || 'Web + Mobile'} · Budget: ${c.budget || '$4k–$9k'}. Deliverables: research, wireframes, mockups, handoff.`,
  copywriting:  (c) => `Freelance copywriting proposal. Client: ${c.client || 'client'} · Scope: ${c.scope || 'website + emails'} · Budget: ${c.budget || '$1.5k–$4k'}.`,
};

export async function generate(templateType, context = {}) {
  const base = (TEMPLATE_PROMPTS[templateType] || TEMPLATE_PROMPTS.webDev)(context);
  const prompt = `${base}\n\nWrite a 350-500 word professional proposal in paragraphs (no bullet lists). Cover: opening, deliverables, process, investment, next steps.`;
  return complete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { temperature: 0.72, maxTokens: 900, label: 'generate' }
  );
}

export async function detectAnomalies(text) {
  const prompt = `Analyze this freelance proposal for risks and red flags.
Return ONLY valid JSON:
{
  "riskLevel": "low"|"medium"|"high",
  "score": 0-100,
  "anomalies": [{ "type": "payment_terms"|"scope_creep"|"ip_ownership"|"liability"|"cancellation"|"revision_policy"|"other", "severity": "low"|"medium"|"high", "description": "one sentence", "clause": "exact phrase max 20 words", "suggestion": "concrete fix" }],
  "positives": ["what this proposal does well"],
  "summary": "one sentence assessment"
}
If no issues: { "riskLevel":"low","score":5,"anomalies":[],"positives":[],"summary":"No significant risks." }

Text: ${text.slice(0, 3500)}`;

  const raw = await complete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { temperature: 0.1, maxTokens: 900, label: 'anomaly' }
  );
  return extractJSON(raw) || { riskLevel: 'low', score: 0, anomalies: [], positives: [], summary: 'Analysis complete.' };
}

export async function generatePaymentEmail(proposal) {
  const prompt = `Write a professional payment request email.
Project: ${proposal.title} · Client: ${proposal.client} · Amount: ${proposal.value} ${proposal.currency}
Return ONLY JSON: { "subject": "string", "body": "HTML string" }
Tone: professional, warm, confident. Include amount, net-14 payment terms, thank you.`;

  const raw = await complete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { temperature: 0.4, maxTokens: 600, label: 'paymentEmail' }
  );
  return extractJSON(raw) || {
    subject: `Payment Request: ${proposal.title}`,
    body: `<p>Hi ${proposal.client},</p><p>Thank you for working with me on <strong>${proposal.title}</strong>. Please process payment of <strong>${proposal.value} ${proposal.currency}</strong> within 14 days.</p>`,
  };
}

export async function enhanceStepDescription(stepLabel, context) {
  const prompt = `One professional sentence describing this workflow step: "${stepLabel}" in a ${context || 'freelance'} project. No preamble.`;
  return complete(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    { temperature: 0.4, maxTokens: 80, label: 'enhanceStep' }
  );
}
