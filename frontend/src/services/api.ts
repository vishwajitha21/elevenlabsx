/**
 * services/api.ts  (PATCHED)
 *
 * Fixes vs original:
 *  1. getAuditLog now returns { entries, total, pages } (was { logs })
 *     — matches what AuditLog.tsx expects (apiData.entries)
 *  2. connectSocket targets port 3001 explicitly in dev (Vite proxy forwards
 *     HTTP but Socket.io WS must still hit the backend port directly)
 *  3. isDemoMode() re-exported from here (some pages import it from api.ts)
 *  4. Minor: api() no longer swallows non-fetch errors in demo mode
 */

import { io as createSocket, Socket } from 'socket.io-client';

// ─── Environment ──────────────────────────────────────────────────────────────
const HAS_AUTH0 = Boolean(
  import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID
);

export function isDemoMode(): boolean {
  return !HAS_AUTH0;
}

function getApiBase(): string {
  // In development, use empty string → Vite proxy handles /api/* → localhost:3001
  if (import.meta.env.DEV) return '';
  // In production (Netlify), VITE_API_URL must be set to the Render backend URL
  if (!import.meta.env.VITE_API_URL) {
    console.error('[API] VITE_API_URL is not set! API calls will fail in production.');
  }
  return import.meta.env.VITE_API_URL || '';
}

const API = getApiBase();

// ─── Token getter ─────────────────────────────────────────────────────────────
type TokenGetter = () => Promise<string>;
let _getToken: TokenGetter | null = null;
let _socket: Socket | null = null;

export function initApiService(getToken: TokenGetter) {
  _getToken = getToken;
}

// ─── Core fetch ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api<T = any>(
  path: string,
  options: RequestInit = {},
  skipAuth = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (!skipAuth) {
    if (_getToken) {
      try {
        const token = await _getToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch {
        if (!isDemoMode()) throw new Error('Authentication required. Please log in again.');
        // In demo mode, fall through and use demo token
        headers['Authorization'] = 'Bearer demo-token';
        headers['X-Demo-Mode']   = 'true';
      }
    } else if (isDemoMode()) {
      headers['Authorization'] = 'Bearer demo-token';
      headers['X-Demo-Mode']   = 'true';
    }
  }

  const url = `${API}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    if (isDemoMode()) {
      console.warn(`[Demo] Network error for ${path} — backend may not be running`);
      return {} as T;
    }
    throw networkErr;
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.error || err.message || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
export async function connectSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;
  if (isDemoMode()) {
    console.log('[Demo] Socket.io skipped');
    return null as unknown as Socket;
  }

  const token = await _getToken?.();

  // In dev, connect directly to backend port (WS cannot use Vite proxy easily)
  const socketUrl = import.meta.env.DEV
    ? 'http://localhost:3001'
    : (import.meta.env.VITE_API_URL || window.location.origin);

  _socket = createSocket(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  _socket.on('connect',       ()     => console.log('[Socket] Connected'));
  _socket.on('disconnect',    (r)    => console.log('[Socket] Disconnected:', r));
  _socket.on('connect_error', (err)  => console.warn('[Socket] Error:', err.message));

  return _socket;
}

export function getSocket(): Socket | null { return _socket; }

export function watchProposal(proposalId: string, callbacks: {
  onStepApproved?: (data: Record<string, unknown>) => void;
  onStepRevoked?:  (data: Record<string, unknown>) => void;
  onCibaApproved?: (data: Record<string, unknown>) => void;
}) {
  if (!_socket) return () => {};
  _socket.emit('join:proposal', proposalId);
  if (callbacks.onStepApproved) _socket.on('step:approved', callbacks.onStepApproved);
  if (callbacks.onStepRevoked)  _socket.on('step:revoked',  callbacks.onStepRevoked);
  if (callbacks.onCibaApproved) _socket.on('ciba:approved', callbacks.onCibaApproved);
  return () => {
    if (callbacks.onStepApproved) _socket?.off('step:approved', callbacks.onStepApproved);
    if (callbacks.onStepRevoked)  _socket?.off('step:revoked',  callbacks.onStepRevoked);
    if (callbacks.onCibaApproved) _socket?.off('ciba:approved', callbacks.onCibaApproved);
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProposalStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'waiting' | 'done' | 'revoked';
  service?: 'gmail' | 'slack' | 'github' | 'notion' | null;
  estimatedDays?: number;
  requiresApproval?: boolean;
  approvedAt?: string;
  revokedAt?: string;
  delegatedTo?: string;
  mentorComment?: string;
  approvedByMentor?: string;
  serviceResult?: Record<string, unknown>;
}

export interface Proposal {
  _id: string;
  title: string;
  client: string;
  value: number;
  currency: string;
  status: 'draft' | 'active' | 'approved' | 'rejected' | 'archived';
  steps: ProposalStep[];
  rawText?: string;
  shareToken?: string;
  shareUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  _id: string;
  action: string;
  status: string;
  proposalId?: string;
  stepId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  tokenExpiry: string;
  stepUpAuth: boolean;
  mentorDelegation: boolean;
  darkMode: boolean;
}

// ─── Proposals ────────────────────────────────────────────────────────────────
export async function getProposals(filters?: { status?: string }): Promise<{ proposals: Proposal[] }> {
  const params = filters?.status ? `?status=${filters.status}` : '';
  return api(`/api/proposals${params}`);
}

export async function getProposal(id: string): Promise<{ proposal: Proposal }> {
  return api(`/api/proposals/${id}`);
}

export async function createProposal(rawText: string): Promise<{ proposal: Proposal }> {
  return api('/api/proposals', { method: 'POST', body: JSON.stringify({ rawText }) });
}

export async function deleteProposal(id: string): Promise<{ ok: boolean }> {
  return api(`/api/proposals/${id}`, { method: 'DELETE' });
}

export async function shareProposal(id: string): Promise<{ shareUrl: string; shareToken: string }> {
  return api(`/api/proposals/${id}/share`, { method: 'POST' });
}

export async function getSharedProposal(token: string): Promise<{ proposal: Partial<Proposal> }> {
  return api(`/api/proposals/share/${token}`, {}, true);
}

// ─── Step lifecycle ───────────────────────────────────────────────────────────
export interface ApproveOptions {
  executeService?: boolean;
  emailData?:   { to: string; subject?: string; html?: string };
  slackData?:   { channel: string; text?: string };
  githubData?:  { owner: string; repo: string; title?: string; body?: string };
  notionData?:  { databaseId: string; title?: string };
}

export async function approveStep(proposalId: string, stepId: string, options: ApproveOptions = {}) {
  return api(`/api/proposals/${proposalId}/steps/${stepId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ executeService: true, ...options }),
  });
}

export async function revokeStep(proposalId: string, stepId: string, reason?: string) {
  return api(`/api/proposals/${proposalId}/steps/${stepId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function delegateStep(proposalId: string, stepId: string, email: string, message?: string) {
  return api(`/api/proposals/${proposalId}/steps/${stepId}/delegate`, {
    method: 'POST',
    body: JSON.stringify({ email, message }),
  });
}

// ─── CIBA ─────────────────────────────────────────────────────────────────────
export async function requestCIBAApproval(proposalId: string, stepId: string, mentorUserId: string, bindingMessage?: string) {
  return api(`/api/proposals/${proposalId}/steps/${stepId}/ciba`, {
    method: 'POST',
    body: JSON.stringify({ mentorUserId, bindingMessage }),
  });
}

export async function pollCIBAStatus(authReqId: string) {
  return api(`/api/ciba/poll/${authReqId}`);
}

// ─── Mentor ───────────────────────────────────────────────────────────────────
export async function inviteMentor(proposalId: string, stepId: string, mentorEmail: string) {
  return api('/api/mentor/invite', {
    method: 'POST',
    body: JSON.stringify({ proposalId, stepId, mentorEmail }),
  });
}

export async function getMentorRequest(token: string) {
  return api(`/api/mentor/${token}`, {}, true);
}

export async function submitMentorDecision(token: string, action: 'approve' | 'reject', comment?: string) {
  return api(`/api/mentor/${token}/decide`, {
    method: 'POST',
    body: JSON.stringify({ action, comment }),
  }, true);
}

// ─── Connections ──────────────────────────────────────────────────────────────
export interface Connection {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt?: string;
  scopes?: string[];
}

export async function getConnections(): Promise<{ connections: Connection[] }> {
  return api('/api/connections');
}

export async function revokeConnection(credentialId: string): Promise<{ success: boolean }> {
  return api(`/api/connections/${credentialId}`, { method: 'DELETE' });
}

export async function revokeAllConnections(): Promise<{ ok: boolean; revoked: string[]; failed: any[] }> {
  return api('/api/connections/revoke-all', { method: 'POST' });
}

export async function testConnectionStatus(connection: string): Promise<{ ok: boolean; [key: string]: unknown }> {
  return api(`/api/connections/${connection}/test`, { method: 'POST' });
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export async function aiChat(messages: Array<{ role: string; content: string }>, proposalId?: string): Promise<{ reply: string }> {
  return api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages, proposalId }) });
}

export async function aiRewrite(section: string, instruction: string): Promise<{ rewritten: string }> {
  return api('/api/ai/rewrite', { method: 'POST', body: JSON.stringify({ section, instruction }) });
}

export async function aiParseProposal(rawText: string) {
  return api('/api/ai/parse', { method: 'POST', body: JSON.stringify({ rawText }) });
}

export async function aiGenerateProposal(templateType: string, context?: Record<string, string>) {
  return api('/api/ai/generate', { method: 'POST', body: JSON.stringify({ templateType, context }) });
}

export async function aiDetectAnomalies(proposalId?: string, text?: string) {
  return api('/api/ai/anomaly', { method: 'POST', body: JSON.stringify({ proposalId, text }) });
}

// ─── Audit ────────────────────────────────────────────────────────────────────
/**
 * FIX: backend routes.js returns { entries, total, pages, page, limit }.
 * Original api.ts returned { logs } which caused AuditLog.tsx to always
 * show empty (apiData.entries was undefined).
 */
export async function getAuditLog(filters?: {
  action?: string;
  status?: string;
  limit?:  number;
  page?:   number;
  proposalId?: string;
}): Promise<{ entries: AuditEntry[]; total: number; pages: number; page: number }> {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(filters || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return api(`/api/audit${params ? `?${params}` : ''}`);
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function createPaymentLink(options: {
  proposalId?: string | null;
  amount?: number;
  currency?: string;
  clientEmail?: string;
  description?: string;
}): Promise<{ url: string; sessionId?: string; demo?: boolean }> {
  // Map clientEmail to email for backend
  const payload = { ...options, email: options.clientEmail };
  return api('/api/payments/create-link', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export async function getUserStats(): Promise<{
  streak: number;
  totalProposals: number;
  totalApprovals: number;
  lastActivity?: string;
}> {
  return api('/api/stats');
}

// ─── User ────────────────────────────────────────────────────────────────────
export async function getUserProfile(): Promise<{ user: UserProfile }> {
  return api('/api/user/profile');
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<{ user: UserProfile }> {
  return api('/api/user/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAccount(): Promise<{ ok: boolean }> {
  return api('/api/user', { method: 'DELETE' });
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function healthCheck() {
  return api('/health', {}, true);
}