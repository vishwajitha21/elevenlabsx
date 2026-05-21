/**
 * DeliverVault — Backend Server
 * Auth0 Token Vault + CIBA + Groq AI + Service Integrations
 *
 * Stack: Express · Auth0 Management API · Groq (free) · Gmail · Slack · GitHub
 * For hackathon: in-memory store (swap for Postgres/Redis in prod)
 *
 * ENV REQUIRED (see .env.example):
 *   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
 *   AUTH0_AUDIENCE, AUTH0_MGMT_AUDIENCE
 *   GROQ_API_KEY
 *   PORT (default 3001)
 */

import express from 'express';
import cors from 'cors';
import { auth } from 'express-oauth2-jwt-bearer';
import { ManagementClient } from 'auth0';
import Groq from 'groq-sdk';
import { google } from 'googleapis';
import crypto from 'crypto';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Auth0 JWT validation middleware
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
});

// ─── Auth0 Management Client ──────────────────────────────────────────────────
const mgmt = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

// ─── Groq AI Client (free tier) ──────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── In-Memory Store (replace with DB in prod) ───────────────────────────────
const store = {
  proposals: new Map(),
  steps: new Map(),         // stepId → step object
  auditLog: [],
  cibaRequests: new Map(),  // cibaAuthReqId → request state
  mentorTokens: new Map(),  // token → { proposalId, stepId, mentorEmail }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Log to audit trail */
function audit(userId, action, meta = {}) {
  store.auditLog.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId,
    action,
    ...meta,
    status: meta.status || 'success',
  });
  if (store.auditLog.length > 200) store.auditLog.pop();
}

/** Get Auth0 user sub from JWT */
function getSub(req) {
  return req.auth?.payload?.sub;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOKEN VAULT — Core Auth0 Integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a stored OAuth token for a user+connection from Auth0 Token Vault.
 * Auth0 Token Vault stores tokens from Connected Accounts.
 *
 * Token Vault API: GET /api/v2/users/{user_id}/credentials
 * Then exchange for usable token via /oauth/token with subject_token grant.
 */
async function getTokenFromVault(userId, connection) {
  try {
    // Step 1: List user credentials from Token Vault
    const credentials = await mgmt.users.getCredentials({ id: userId });

    // Step 2: Find the matching connection credential
    const cred = credentials.data.find(
      (c) => c.connection_name === connection || c.name === connection
    );

    if (!cred) {
      return { error: `No stored token for connection: ${connection}` };
    }

    // Step 3: Exchange credential for usable access_token
    // Using Token Exchange (RFC 8693) via Auth0's token endpoint
    const tokenRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        subject_token: cred.credential_id,
        subject_token_type: 'urn:auth0:params:oauth:token-type:credential_id',
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        connection: connection,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      // Fallback: some Auth0 plans expose token directly on credential object
      if (cred.access_token) return { token: cred.access_token };
      return { error: tokenData.error_description || tokenData.error };
    }

    return { token: tokenData.access_token, expiresIn: tokenData.expires_in };
  } catch (err) {
    console.error('[TokenVault]', err.message);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CIBA — Client-Initiated Backchannel Authentication
//  Used for human-in-the-loop mentor approval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initiate CIBA flow — send push/notification to mentor's phone.
 * Auth0 CIBA: POST /bc-authorize
 */
async function initiateCIBA({ loginHint, bindingMessage, scope }) {
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/bc-authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.AUTH0_CLIENT_ID}:${process.env.AUTH0_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      login_hint: JSON.stringify({ format: 'iss_sub', iss: `https://${process.env.AUTH0_DOMAIN}/`, sub: loginHint }),
      binding_message: bindingMessage || 'Approve proposal step in DeliverVault',
      scope: scope || 'openid profile',
      request_expiry: '300',
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  return {
    authReqId: data.auth_req_id,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
  };
}

/**
 * Poll CIBA token endpoint until approved/denied/expired.
 * Returns token data or error.
 */
async function pollCIBAToken(authReqId) {
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:openid:params:grant-type:ciba',
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      auth_req_id: authReqId,
    }),
  });

  const data = await res.json();

  if (data.error === 'authorization_pending') return { pending: true };
  if (data.error === 'slow_down') return { pending: true, slowDown: true };
  if (data.error === 'access_denied') return { denied: true };
  if (data.error === 'expired_token') return { expired: true };
  if (data.error) return { error: data.error_description };

  return { approved: true, idToken: data.id_token, accessToken: data.access_token };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SERVICE INTEGRATIONS (via Token Vault)
// ─────────────────────────────────────────────────────────────────────────────

/** Send email via Gmail using Token Vault stored token */
async function sendGmailEmail(userId, { to, subject, body }) {
  const { token, error } = await getTokenFromVault(userId, 'google-oauth2');
  if (error) throw new Error(`Gmail token error: ${error}`);

  const auth2 = new google.auth.OAuth2();
  auth2.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: 'v1', auth: auth2 });

  const message = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ].join('\n');

  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  return res.data;
}

/** Post message to Slack channel via Token Vault stored token */
async function postToSlack(userId, { channel, text, blocks }) {
  const { token, error } = await getTokenFromVault(userId, 'slack');
  if (error) throw new Error(`Slack token error: ${error}`);

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text, blocks }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return data;
}

/** Create GitHub issue via Token Vault stored token */
async function createGithubIssue(userId, { owner, repo, title, body, labels }) {
  const { token, error } = await getTokenFromVault(userId, 'github');
  if (error) throw new Error(`GitHub token error: ${error}`);

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  const data = await res.json();
  if (data.message) throw new Error(`GitHub error: ${data.message}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
//  AI — GROQ (Free Tier, llama-3.3-70b)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DeliverVault AI Co-Pilot — an expert assistant for freelancers.
You help parse proposal text into structured workflow steps, suggest improvements,
generate professional proposal copy, and advise on client communication.
Be concise, practical, and professional. Respond in JSON when asked.`;

/** Parse raw proposal text into structured workflow steps */
async function parseProposalWithAI(rawText) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Parse this freelance proposal into workflow steps. Return ONLY valid JSON.
Format: { "title": string, "client": string, "value": number, "currency": string, "steps": [{ "id": string, "label": string, "description": string, "requiresApproval": boolean, "service": "gmail"|"slack"|"github"|"notion"|null, "estimatedDays": number }] }

Proposal:
${rawText}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const text = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { error: 'Parse failed', raw: text };
  }
}

/** AI Co-Pilot chat completion */
async function aiCopilotChat(messages, proposalContext) {
  const contextMsg = proposalContext
    ? `Current proposal context: ${JSON.stringify(proposalContext)}\n\n`
    : '';

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextMsg },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 600,
    stream: false,
  });

  return completion.choices[0]?.message?.content || 'No response';
}

/** AI rewrite/improve proposal section */
async function aiRewriteSection(section, instruction) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Rewrite this proposal section. Instruction: "${instruction}"\n\nOriginal:\n${section}\n\nReturn ONLY the rewritten text, no explanation.`,
      },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || section;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — Proposals
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/proposals', checkJwt, (req, res) => {
  const userId = getSub(req);
  const userProposals = [...store.proposals.values()].filter((p) => p.userId === userId);
  res.json({ proposals: userProposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.post('/api/proposals', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const { rawText, template } = req.body;

  if (!rawText && !template) {
    return res.status(400).json({ error: 'rawText or template required' });
  }

  try {
    // Parse with AI
    const parsed = await parseProposalWithAI(rawText || template);

    const proposalId = crypto.randomUUID();
    const proposal = {
      id: proposalId,
      userId,
      rawText: rawText || template,
      title: parsed.title || 'Untitled Proposal',
      client: parsed.client || 'Unknown Client',
      value: parsed.value || 0,
      currency: parsed.currency || 'USD',
      status: 'draft',
      steps: (parsed.steps || []).map((s, i) => ({
        ...s,
        id: s.id || `step-${i + 1}`,
        status: i === 0 ? 'active' : 'pending',
        createdAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.proposals.set(proposalId, proposal);
    audit(userId, 'proposal.created', { proposalId, title: proposal.title });

    res.json({ proposal, parsed });
  } catch (err) {
    console.error('[Parse]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/proposals/:id', checkJwt, (req, res) => {
  const proposal = store.proposals.get(req.params.id);
  if (!proposal || proposal.userId !== getSub(req)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ proposal });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — Workflow Steps
// ─────────────────────────────────────────────────────────────────────────────

/** Approve a step — triggers connected service action */
app.post('/api/proposals/:id/steps/:stepId/approve', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const proposal = store.proposals.get(req.params.id);

  if (!proposal || proposal.userId !== userId) {
    return res.status(404).json({ error: 'Not found' });
  }

  const step = proposal.steps.find((s) => s.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });

  const actions = [];

  // Execute connected service action if configured
  if (step.service && req.body.executeService !== false) {
    try {
      if (step.service === 'gmail') {
        const emailData = req.body.emailData || {
          to: proposal.client,
          subject: `Update: ${proposal.title} — ${step.label}`,
          body: `<p>Hi,</p><p>Step <strong>${step.label}</strong> has been approved in your proposal workflow.</p><p>— DeliverVault</p>`,
        };
        await sendGmailEmail(userId, emailData);
        actions.push({ service: 'gmail', status: 'sent' });
        audit(userId, 'gmail.sent', { proposalId: proposal.id, stepId: step.id, to: emailData.to });
      }

      if (step.service === 'slack') {
        const slackData = req.body.slackData || {
          channel: process.env.DEFAULT_SLACK_CHANNEL || '#general',
          text: `✅ Step approved: *${step.label}* in proposal _${proposal.title}_`,
        };
        await postToSlack(userId, slackData);
        actions.push({ service: 'slack', status: 'posted' });
        audit(userId, 'slack.posted', { proposalId: proposal.id, stepId: step.id });
      }

      if (step.service === 'github') {
        const ghData = req.body.githubData || {
          owner: req.body.owner || 'delivervault',
          repo: req.body.repo || 'projects',
          title: `${step.label} — ${proposal.title}`,
          body: `Proposal step approved.\n\nClient: ${proposal.client}\nStep: ${step.description}`,
          labels: ['proposal', 'approved'],
        };
        const issue = await createGithubIssue(userId, ghData);
        actions.push({ service: 'github', status: 'created', issueUrl: issue.html_url });
        audit(userId, 'github.issue_created', { proposalId: proposal.id, stepId: step.id, issueUrl: issue.html_url });
      }
    } catch (serviceErr) {
      console.error('[Service]', serviceErr.message);
      actions.push({ service: step.service, status: 'error', error: serviceErr.message });
    }
  }

  // Update step status
  step.status = 'done';
  step.approvedAt = new Date().toISOString();

  // Advance to next pending step
  const nextStep = proposal.steps.find((s) => s.status === 'pending');
  if (nextStep) nextStep.status = 'active';
  else proposal.status = 'approved';

  proposal.updatedAt = new Date().toISOString();
  audit(userId, 'step.approved', { proposalId: proposal.id, stepId: step.id, service: step.service });

  res.json({ proposal, step, actions });
});

/** Revoke a step (and optionally revoke Token Vault token) */
app.post('/api/proposals/:id/steps/:stepId/revoke', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const proposal = store.proposals.get(req.params.id);

  if (!proposal || proposal.userId !== userId) {
    return res.status(404).json({ error: 'Not found' });
  }

  const step = proposal.steps.find((s) => s.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });

  step.status = 'revoked';
  step.revokedAt = new Date().toISOString();
  step.revokeReason = req.body.reason || 'Manual revoke';
  proposal.updatedAt = new Date().toISOString();

  // Optionally revoke Token Vault credential
  if (req.body.revokeToken && step.service) {
    try {
      const credentials = await mgmt.users.getCredentials({ id: userId });
      const cred = credentials.data.find((c) => c.connection_name?.includes(step.service));
      if (cred) {
        await mgmt.users.deleteCredential({ id: userId, credential_id: cred.credential_id });
        audit(userId, 'token.revoked', { service: step.service, credentialId: cred.credential_id });
      }
    } catch (err) {
      console.error('[RevokeToken]', err.message);
    }
  }

  audit(userId, 'step.revoked', { proposalId: proposal.id, stepId: step.id, reason: step.revokeReason });
  res.json({ proposal, step });
});

/** Delegate step to another user */
app.post('/api/proposals/:id/steps/:stepId/delegate', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const { delegateTo, message } = req.body;
  const proposal = store.proposals.get(req.params.id);

  if (!proposal || proposal.userId !== userId) return res.status(404).json({ error: 'Not found' });

  const step = proposal.steps.find((s) => s.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });

  step.delegatedTo = delegateTo;
  step.status = 'waiting';
  step.delegatedAt = new Date().toISOString();

  // Send delegation email via Gmail if available
  try {
    await sendGmailEmail(userId, {
      to: delegateTo,
      subject: `Action required: ${step.label} — ${proposal.title}`,
      body: `<p>You've been delegated to review a proposal step.</p>
        <p><strong>Step:</strong> ${step.label}</p>
        <p><strong>Proposal:</strong> ${proposal.title}</p>
        <p><strong>Message:</strong> ${message || 'Please review and approve.'}</p>
        <p><a href="${process.env.FRONTEND_URL}/dashboard">Review in DeliverVault →</a></p>`,
    });
  } catch (emailErr) {
    console.warn('[Delegate email failed]', emailErr.message);
  }

  audit(userId, 'step.delegated', { proposalId: proposal.id, stepId: step.id, delegateTo });
  res.json({ proposal, step });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — CIBA (Human-in-the-Loop Mentor Approval)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initiate CIBA — sends push notification to mentor's registered device.
 * Mentor must have Auth0 Guardian/MFA enrolled.
 */
app.post('/api/proposals/:id/steps/:stepId/ciba-request', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const { mentorUserId, bindingMessage } = req.body;
  const proposal = store.proposals.get(req.params.id);

  if (!proposal || proposal.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const step = proposal.steps.find((s) => s.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });

  try {
    const ciba = await initiateCIBA({
      loginHint: mentorUserId,
      bindingMessage: bindingMessage || `Approve "${step.label}" in ${proposal.title}?`,
      scope: 'openid profile',
    });

    // Store CIBA request
    store.cibaRequests.set(ciba.authReqId, {
      proposalId: proposal.id,
      stepId: step.id,
      mentorUserId,
      requesterId: userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    step.status = 'waiting';
    step.cibaAuthReqId = ciba.authReqId;
    step.waitingForMentor = mentorUserId;

    audit(userId, 'ciba.initiated', { proposalId: proposal.id, stepId: step.id, mentorUserId });

    res.json({
      authReqId: ciba.authReqId,
      expiresIn: ciba.expiresIn,
      pollInterval: ciba.interval,
      message: 'Push notification sent to mentor device',
    });
  } catch (err) {
    console.error('[CIBA]', err);
    res.status(500).json({ error: err.message });
  }
});

/** Poll CIBA status — client polls this every N seconds */
app.get('/api/ciba/poll/:authReqId', checkJwt, async (req, res) => {
  const { authReqId } = req.params;
  const cibaReq = store.cibaRequests.get(authReqId);

  if (!cibaReq) return res.status(404).json({ error: 'CIBA request not found' });

  try {
    const result = await pollCIBAToken(authReqId);

    if (result.approved) {
      cibaReq.status = 'approved';
      store.cibaRequests.set(authReqId, cibaReq);

      // Auto-approve the step
      const proposal = store.proposals.get(cibaReq.proposalId);
      if (proposal) {
        const step = proposal.steps.find((s) => s.id === cibaReq.stepId);
        if (step) {
          step.status = 'done';
          step.approvedAt = new Date().toISOString();
          step.approvedByMentor = cibaReq.mentorUserId;
          const next = proposal.steps.find((s) => s.status === 'pending');
          if (next) next.status = 'active';
          else proposal.status = 'approved';
        }
      }

      audit(cibaReq.requesterId, 'ciba.approved', {
        proposalId: cibaReq.proposalId,
        stepId: cibaReq.stepId,
        mentor: cibaReq.mentorUserId,
      });

      return res.json({ status: 'approved', proposal });
    }

    if (result.denied) {
      cibaReq.status = 'denied';
      audit(cibaReq.requesterId, 'ciba.denied', { proposalId: cibaReq.proposalId });
      return res.json({ status: 'denied' });
    }

    if (result.expired) return res.json({ status: 'expired' });
    if (result.pending) return res.json({ status: 'pending', slowDown: result.slowDown });

    res.json({ status: 'error', error: result.error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — Token Vault / Connections
// ─────────────────────────────────────────────────────────────────────────────

/** List user's stored credentials from Auth0 Token Vault */
app.get('/api/connections', checkJwt, async (req, res) => {
  const userId = getSub(req);
  try {
    const credentials = await mgmt.users.getCredentials({ id: userId });
    const connections = (credentials.data || []).map((c) => ({
      id: c.credential_id,
      name: c.connection_name || c.name,
      type: c.credential_type,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      scopes: c.scopes || [],
    }));
    res.json({ connections });
  } catch (err) {
    console.error('[Connections]', err.message);
    res.json({ connections: [] }); // Graceful degradation
  }
});

/** Revoke a stored credential (Token Vault) */
app.delete('/api/connections/:credentialId', checkJwt, async (req, res) => {
  const userId = getSub(req);
  try {
    await mgmt.users.deleteCredential({
      id: userId,
      credential_id: req.params.credentialId,
    });
    audit(userId, 'connection.revoked', { credentialId: req.params.credentialId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Test a connection by making a simple API call */
app.post('/api/connections/:connection/test', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const { connection } = req.params;
  const { token, error } = await getTokenFromVault(userId, connection);

  if (error) return res.json({ ok: false, error });

  let result = { ok: true, service: connection };

  try {
    if (connection === 'google-oauth2') {
      const auth2 = new google.auth.OAuth2();
      auth2.setCredentials({ access_token: token });
      const oauth2 = google.oauth2({ version: 'v2', auth: auth2 });
      const info = await oauth2.userinfo.get();
      result.userEmail = info.data.email;
    }
    if (connection === 'github') {
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await userRes.json();
      result.githubLogin = user.login;
    }
    if (connection === 'slack') {
      const testRes = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const test = await testRes.json();
      result.slackUser = test.user;
      result.slackTeam = test.team;
    }
  } catch (testErr) {
    result.warning = testErr.message;
  }

  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — AI Co-Pilot
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/ai/chat', checkJwt, async (req, res) => {
  const { messages, proposalId } = req.body;
  const proposal = proposalId ? store.proposals.get(proposalId) : null;

  try {
    const reply = await aiCopilotChat(
      messages || [],
      proposal ? { title: proposal.title, client: proposal.client, steps: proposal.steps } : null
    );
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/rewrite', checkJwt, async (req, res) => {
  const { section, instruction } = req.body;
  try {
    const rewritten = await aiRewriteSection(section, instruction);
    res.json({ rewritten });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/parse', checkJwt, async (req, res) => {
  const { rawText } = req.body;
  try {
    const parsed = await parseProposalWithAI(rawText);
    res.json({ parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Generate proposal from template + AI */
app.post('/api/ai/generate', checkJwt, async (req, res) => {
  const { templateType, context } = req.body;

  const prompts = {
    brandRefresh: `Generate a professional freelance proposal for a brand refresh project. Client: ${context?.client || 'Client'}. Budget: ${context?.budget || '$5,000'}. Timeline: ${context?.timeline || '4 weeks'}.`,
    webDev: `Generate a professional freelance proposal for web development. Client: ${context?.client || 'Client'}. Tech stack: ${context?.stack || 'React + Node.js'}.`,
    marketing: `Generate a professional freelance proposal for digital marketing. Client: ${context?.client || 'Client'}.`,
    consulting: `Generate a professional freelance consulting proposal. Client: ${context?.client || 'Client'}. Focus: ${context?.focus || 'Business strategy'}.`,
  };

  const prompt = prompts[templateType] || prompts.webDev;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt + '\n\nReturn a full, professional proposal text (300-500 words).' },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    res.json({ proposal: completion.choices[0]?.message?.content || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — Audit Log
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/audit', checkJwt, (req, res) => {
  const userId = getSub(req);
  const { limit = 50, action, status } = req.query;

  let logs = store.auditLog.filter((l) => l.userId === userId);
  if (action) logs = logs.filter((l) => l.action === action);
  if (status) logs = logs.filter((l) => l.status === status);

  res.json({ logs: logs.slice(0, parseInt(limit)) });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — Mentor Approval (email-link fallback for non-Auth0 mentors)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/mentor/invite', checkJwt, async (req, res) => {
  const userId = getSub(req);
  const { proposalId, stepId, mentorEmail } = req.body;

  const proposal = store.proposals.get(proposalId);
  if (!proposal || proposal.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h

  store.mentorTokens.set(token, { proposalId, stepId, mentorEmail, requesterId: userId, expiresAt });

  const approveUrl = `${process.env.FRONTEND_URL}/mentor/${token}`;

  // Send mentor email
  try {
    await sendGmailEmail(userId, {
      to: mentorEmail,
      subject: `Review requested: ${proposal.title}`,
      body: `<p>Hi,</p>
      <p>You've been invited to review a proposal step.</p>
      <p><strong>Proposal:</strong> ${proposal.title}</p>
      <p><strong>Client:</strong> ${proposal.client}</p>
      <p>Please click below to approve or reject:</p>
      <p><a href="${approveUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Review Proposal →</a></p>
      <p><small>This link expires in 48 hours.</small></p>`,
    });
  } catch (emailErr) {
    console.warn('[MentorEmail]', emailErr.message);
    // Return token anyway — user can copy link manually
  }

  audit(userId, 'mentor.invited', { proposalId, stepId, mentorEmail });
  res.json({ token, approveUrl, expiresAt });
});

app.get('/api/mentor/:token', (req, res) => {
  const record = store.mentorTokens.get(req.params.token);
  if (!record) return res.status(404).json({ error: 'Invalid or expired token' });
  if (new Date(record.expiresAt) < new Date()) return res.status(410).json({ error: 'Token expired' });

  const proposal = store.proposals.get(record.proposalId);
  const step = proposal?.steps.find((s) => s.id === record.stepId);

  res.json({ proposal: { title: proposal?.title, client: proposal?.client }, step, mentorEmail: record.mentorEmail });
});

app.post('/api/mentor/:token/approve', (req, res) => {
  const record = store.mentorTokens.get(req.params.token);
  if (!record) return res.status(404).json({ error: 'Invalid token' });
  if (new Date(record.expiresAt) < new Date()) return res.status(410).json({ error: 'Expired' });

  const { action, comment } = req.body; // action: 'approve' | 'reject'
  const proposal = store.proposals.get(record.proposalId);
  const step = proposal?.steps.find((s) => s.id === record.stepId);

  if (step) {
    step.status = action === 'approve' ? 'done' : 'revoked';
    step.mentorComment = comment;
    step.mentorDecidedAt = new Date().toISOString();
    if (action === 'approve') {
      const next = proposal.steps.find((s) => s.status === 'pending');
      if (next) next.status = 'active';
    }
  }

  store.mentorTokens.delete(req.params.token);
  audit(record.requesterId, `mentor.${action}d`, { proposalId: record.proposalId, stepId: record.stepId, mentor: record.mentorEmail });

  res.json({ success: true, action, message: `Step ${action}d successfully` });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES — Share Link (public read-only proposal view)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/proposals/:id/share', checkJwt, (req, res) => {
  const userId = getSub(req);
  const proposal = store.proposals.get(req.params.id);

  if (!proposal || proposal.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  const shareToken = crypto.randomBytes(16).toString('hex');
  proposal.shareToken = shareToken;
  proposal.shareUrl = `${process.env.FRONTEND_URL}/share/${shareToken}`;

  audit(userId, 'proposal.shared', { proposalId: proposal.id, shareUrl: proposal.shareUrl });
  res.json({ shareUrl: proposal.shareUrl, token: shareToken });
});

app.get('/api/share/:token', (req, res) => {
  const proposal = [...store.proposals.values()].find((p) => p.shareToken === req.params.token);
  if (!proposal) return res.status(404).json({ error: 'Not found' });

  // Return sanitized public view
  res.json({
    title: proposal.title,
    client: proposal.client,
    value: proposal.value,
    currency: proposal.currency,
    status: proposal.status,
    steps: proposal.steps.map((s) => ({ label: s.label, status: s.status, description: s.description })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    services: {
      auth0: !!process.env.AUTH0_DOMAIN,
      groq: !!process.env.GROQ_API_KEY,
    },
  });
});

app.listen(PORT, () => {
  console.log(`\n🔐 DeliverVault Backend running on http://localhost:${PORT}`);
  console.log(`   Auth0 Domain: ${process.env.AUTH0_DOMAIN || '⚠️  NOT SET'}`);
  console.log(`   Groq: ${process.env.GROQ_API_KEY ? '✅ Connected' : '⚠️  NOT SET'}\n`);
});

export default app;
