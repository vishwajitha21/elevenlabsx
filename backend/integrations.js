import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { swr, cacheDel } from './cache.js';

// ─── Auth0 Management API token (M2M) ────────────────────────────────────────
let _mgmtToken = null;
let _mgmtTokenExpiry = 0;

async function getMgmtToken() {
  if (_mgmtToken && Date.now() < _mgmtTokenExpiry - 60000) return _mgmtToken;
  console.log('[DEBUG] getMgmtToken: Fetching new M2M token...');

  try {
    const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_MGMT_CLIENT_ID,
        client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
        audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      }),
    });

    console.log('[DEBUG] getMgmtToken: Response status=', res.status);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[DEBUG] getMgmtToken: FAILED!', err);
      return null;
    }
    const data = await res.json();
    _mgmtToken = data.access_token;
    _mgmtTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    console.log('[DEBUG] getMgmtToken: SUCCESS!');
    return _mgmtToken;
  } catch (err) {
    console.error('[DEBUG] getMgmtToken: Fatal error!', err.message);
    return null;
  }
}

// ─── Connection type resolver ─────────────────────────────────────────────────
/**
 * Given any connection identifier (credential ID, connection name, type alias),
 * returns the canonical service type: 'gmail' | 'github' | 'slack' | 'notion'
 *
 * Handles all these formats:
 *   'idp_google-oauth2_google-oauth2'  → 'gmail'
 *   'idp_github_github'                → 'github'
 *   'conn_gmail_demo'                  → 'gmail'   (demo suffix)
 *   'google-oauth2'                    → 'gmail'
 *   'gmail'                            → 'gmail'
 *   'google'                           → 'gmail'
 */
function resolveConnectionType(connection) {
  if (!connection) return null;
  const c = connection.toLowerCase();

  // Strip idp_ prefix: 'idp_google-oauth2_google-oauth2' → 'google-oauth2_google-oauth2'
  const stripped = c.startsWith('idp_') ? c.slice(4) : c;
  // Strip demo suffix
  const withoutDemo = stripped.replace(/_demo$/, '');

  if (withoutDemo.includes('google') || withoutDemo.includes('gmail')) return 'gmail';
  if (withoutDemo.includes('github')) return 'github';
  if (withoutDemo.includes('slack')) return 'slack';
  if (withoutDemo.includes('notion')) return 'notion';

  return withoutDemo; // pass through unknown types
}

// ─── Token Vault ─────────────────────────────────────────────────────────────

export async function listCredentials(userId) {
  const cacheKey = `credentials:${userId}`;
  return swr(cacheKey, async () => {
    const token = await getMgmtToken();
    if (!token) return [];

    let credentials = [];
    const res = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/credentials`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      credentials = await res.json();
    } else if (res.status !== 404) {
      console.warn(`[integrations] listCredentials returned ${res.status}`);
    }

    // Fallback: read from user's identities array (standard Auth0 IDP tokens)
    const userRes = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (userRes.ok) {
      const user = await userRes.json();
      if (user.identities) {
        user.identities.forEach(idp => {
          if (idp.access_token) {
            const type = resolveConnectionType(idp.connection);
            credentials.push({
              id: `idp_${idp.provider}_${idp.connection}`,
              credential_type: 'access_token',
              name: type === 'gmail' ? 'Gmail' : idp.connection,
              connection_name: idp.connection,
              // Store the resolved type so callers don't need to parse the id
              type,
              access_token: idp.access_token,
              scopes: type === 'gmail'
                ? ['gmail.readonly', 'gmail.send', 'gmail.compose']
                : type === 'github'
                ? ['repo', 'read:org']
                : [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });
      }
    }

    return credentials;
  }, 60);
}

const CONNECTION_ALIASES = {
  gmail:  'google-oauth2',
  google: 'google-oauth2',
};

export async function getVaultToken(userId, connection) {
  // Demo connections always succeed
  if (connection.endsWith('_demo') || connection === 'demo-user') {
    return { token: 'demo-access-token', credentialId: connection };
  }

  const resolvedConnection = CONNECTION_ALIASES[connection] || connection;
  const connectionType = resolveConnectionType(connection);

  const credentials = await listCredentials(userId);

  // Match by: exact id, connection_name, type, or resolved alias
  const credential = credentials.find(c =>
    c.credential_type === 'access_token' && (
      c.id === connection ||
      c.connection_name === resolvedConnection ||
      c.connection_name === connection ||
      c.type === connectionType ||
      c.name?.toLowerCase() === connectionType
    )
  );

  if (!credential) {
    return { error: `No credential found for "${connection}" (resolved type: "${connectionType}")` };
  }

  // Credential carries the token directly (IDP identity tokens, some Token Vault plans)
  if (credential.access_token) {
    return { token: credential.access_token, credentialId: credential.id };
  }

  // RFC 8693 token exchange (Token Vault pro)
  const mgmtToken = await getMgmtToken();
  if (!mgmtToken) return { error: 'M2M token unavailable — cannot exchange credential' };

  console.log('[DEBUG] Exchanging credential_id:', credential.id);
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      subject_token: mgmtToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      credential_id: credential.id,
    }),
  });

  console.log('[DEBUG] Token Exchange status:', res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[DEBUG] Token Exchange failed!', err);
    return { error: err.error_description || `Token exchange failed: ${res.status}` };
  }

  const data = await res.json();
  console.log('[DEBUG] Token Exchange SUCCESS! Token length:', data.access_token?.length);
  return { token: data.access_token, expiresIn: data.expires_in, credentialId: credential.id };
}

export async function deleteCredential(userId, credentialId) {
  // Demo credentials — mock success
  if (credentialId.endsWith('_demo')) {
    cacheDel(`credentials:${userId}`);
    return;
  }

  if (credentialId.startsWith('idp_')) {
    throw new Error('Cannot revoke your primary Google login identity from Auth0. To update permissions, please click Connect again or configure scopes in your Auth0 Dashboard.');
  }

  const token = await getMgmtToken();
  if (!token) return;

  const res = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/credentials/${credentialId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteCredential failed: ${res.status}`);
  }
  cacheDel(`credentials:${userId}`);
}

// ─── CIBA ────────────────────────────────────────────────────────────────────

export async function initiateCIBA({ mentorUserId, bindingMessage }) {
  const credentials = Buffer.from(
    `${process.env.AUTH0_MGMT_CLIENT_ID}:${process.env.AUTH0_MGMT_CLIENT_SECRET}`
  ).toString('base64');

  const loginHint = JSON.stringify({
    format: 'iss_sub',
    iss: `https://${process.env.AUTH0_DOMAIN}/`,
    sub: mentorUserId,
  });

  const body = new URLSearchParams({
    client_id: process.env.AUTH0_MGMT_CLIENT_ID,
    scope: 'openid',
    login_hint: loginHint,
    binding_message: bindingMessage || 'Approve proposal step in DeliverVault',
  });

  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/bc-authorize`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || `CIBA initiate failed: ${res.status}`);
  }

  const data = await res.json();
  return { authReqId: data.auth_req_id, expiresIn: data.expires_in || 300, interval: data.interval || 5 };
}

export async function inviteMentor(userId, proposalId, stepId, mentorEmail) {
  const jwt = (await import('jsonwebtoken')).default;
  const { Proposal } = await import('./models.js');

  // 1. Generate a secure token for the mentor (expires in 7 days)
  const reviewToken = jwt.sign(
    { proposalId, stepId, mentorEmail, type: 'mentor_review' },
    process.env.AUTH0_MGMT_CLIENT_SECRET,
    { expiresIn: '7d' }
  );

  const reviewUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/mentor/${reviewToken}`;

  // 2. Try to send via Gmail if connected
  try {
    const proposal = await Proposal.findById(proposalId);
    const subject = `Review Request: ${proposal?.title || 'DeliverVault Proposal'}`;
    const body = ` Hello, \n\n You've been invited to review and approve a step in a DeliverVault proposal. \n\n Please click the link below to view the details and sign off: \n ${reviewUrl} \n\n Regards, \n DeliverVault`;

    await sendEmail(userId, { to: mentorEmail, subject, body });
    return { success: true, reviewUrl };
  } catch (err) {
    console.error('[DEBUG] Email failed, providing manual link:', err.message);
    return { success: true, reviewUrl, emailError: err.message };
  }
}

export async function pollCIBAToken(authReqId) {
  const credentials = Buffer.from(
    `${process.env.AUTH0_MGMT_CLIENT_ID}:${process.env.AUTH0_MGMT_CLIENT_SECRET}`
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'urn:openid:params:grant-type:ciba',
    auth_req_id: authReqId,
    client_id: process.env.AUTH0_MGMT_CLIENT_ID,
  });

  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (res.ok) return { status: 'approved' };

  const err = await res.json().catch(() => ({}));
  const code = err.error;
  if (code === 'authorization_pending') return { status: 'pending' };
  if (code === 'access_denied')         return { status: 'denied' };
  if (code === 'expired_token')         return { status: 'expired' };
  return { status: 'error', detail: err.error_description || code };
}

// ─── Gmail ───────────────────────────────────────────────────────────────────

export async function sendGmail(userId, { to, subject, html }) {
  // Try both 'google-oauth2' (standard Auth0) and 'gmail' aliases
  let vault = await getVaultToken(userId, 'google-oauth2');
  if (vault.error || !vault.token) {
    vault = await getVaultToken(userId, 'gmail');
  }

  if (vault.error || !vault.token) {
    throw new Error('Gmail not connected or token not available in Vault');
  }

  console.log('[DEBUG] sendGmail: Attempting send with token length:', vault.token.length);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: vault.token });
  const gmail = google.gmail({ version: 'v1', auth });

  // Standard Gmail MIME format
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    html,
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log('[DEBUG] Gmail Send: SUCCESS!', result.data.id);
    return { messageId: result.data.id, threadId: result.data.threadId };
  } catch (err) {
    console.error('[DEBUG] Gmail API actually rejected the token:', err.message);
    throw err; // Re-throw to trigger SMTP fallback
  }
}

export async function sendSmtpEmail({ to, subject, html }) {
  let transporter;
  
  // Use real SMTP if a genuine password is provided
  if (process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('DEMOPASSWORD')) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Zero-config Ethereal Email for local testing
    console.log('[SMTP] Creating temporary Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  // Use SMTP_FROM from env, or fallback to SMTP_USER if it looks like an email, 
  // or a generic onboarding address (common for Resend/SMTP-as-service)
  const from = process.env.SMTP_FROM || 
               (process.env.SMTP_USER?.includes('@') ? process.env.SMTP_USER : 'DeliverVault <onboarding@resend.dev>');

  const info = await transporter.sendMail({ from, to, subject, html });
  
  if (transporter.options.host === 'smtp.ethereal.email') {
    const url = nodemailer.getTestMessageUrl(info);
    console.log(`\n💌 [LOCAL EMAIL SENT!] Preview your email here: ${url}\n`);
  }
  
  return { messageId: info.messageId };
}

export async function sendEmail(userId, options) {
  try {
    return { ...(await sendGmail(userId, options)), via: 'gmail' };
  } catch (gmailErr) {
    console.warn('[email] Gmail failed, falling back to SMTP:', gmailErr.message);
    try {
      return { ...(await sendSmtpEmail(options)), via: 'smtp' };
    } catch (smtpErr) {
      throw new Error(`Email failed. Gmail: ${gmailErr.message}. SMTP: ${smtpErr.message}`);
    }
  }
}

// ─── Slack ───────────────────────────────────────────────────────────────────

export async function postSlack(userId, { channel, text, blocks }) {
  const vault = await getVaultToken(userId, 'slack');
  if (vault.error) throw new Error(vault.error);

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vault.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channel || process.env.DEFAULT_SLACK_CHANNEL || '#general', text, blocks }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return { ts: data.ts, channel: data.channel };
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

export async function createGitHubIssue(userId, { owner, repo, title, body, labels = [] }) {
  const vault = await getVaultToken(userId, 'github');
  if (vault.error) throw new Error(vault.error);

  const resolvedOwner = owner || process.env.GITHUB_DEFAULT_OWNER;
  if (!resolvedOwner || !repo) throw new Error('GitHub owner and repo are required');

  const res = await fetch(`https://api.github.com/repos/${resolvedOwner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vault.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: ['delivervault', 'approved', ...labels] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub issue failed: ${err.message || res.status}`);
  }
  const issue = await res.json();
  return { issueUrl: issue.html_url, issueNumber: issue.number };
}

// ─── Notion ──────────────────────────────────────────────────────────────────

export async function createNotionPage(userId, { databaseId, title, content }) {
  const vault = await getVaultToken(userId, 'notion');
  if (vault.error) throw new Error(vault.error);

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vault.token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
      children: content ? [{ object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content } }] } }] : [],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion page failed: ${err.message || res.status}`);
  }
  const page = await res.json();
  return { pageId: page.id, pageUrl: page.url };
}

// ─── Test Connection ─────────────────────────────────────────────────────────

/**
 * Test a connection by calling the service's userinfo endpoint.
 *
 * FIX: `connection` can be a raw credential ID like 'idp_google-oauth2_google-oauth2'.
 * We resolve it to a canonical type first, then branch on that type.
 */
export async function testConnection(userId, connection) {
  // Demo shortcut
  if (connection.endsWith('_demo')) {
    const type = resolveConnectionType(connection.replace(/_demo$/, ''));
    return { ok: true, email: 'demo@example.com', name: 'Demo User', service: type || connection };
  }

  // Resolve 'idp_google-oauth2_google-oauth2' → 'gmail', etc.
  const serviceType = resolveConnectionType(connection);

  const vault = await getVaultToken(userId, connection);
  if (vault.error) return { ok: false, error: vault.error };

  try {
    switch (serviceType) {
      case 'gmail': {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: vault.token });
        const oauth2 = google.oauth2({ version: 'v2', auth });
        const info = await oauth2.userinfo.get();
        return { ok: true, email: info.data.email, name: info.data.name, service: 'gmail' };
      }
      case 'github': {
        const res = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${vault.token}` },
        });
        const data = await res.json();
        return { ok: res.ok, login: data.login, name: data.name, service: 'github' };
      }
      case 'slack': {
        const res = await fetch('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${vault.token}` },
        });
        const data = await res.json();
        return { ok: data.ok, user: data.user, team: data.team, service: 'slack' };
      }
      case 'notion': {
        const res = await fetch('https://api.notion.com/v1/users/me', {
          headers: { Authorization: `Bearer ${vault.token}`, 'Notion-Version': '2022-06-28' },
        });
        const data = await res.json();
        return { ok: res.ok, user: data.name, service: 'notion' };
      }
      default:
        return {
          ok: false,
          error: `Cannot test unknown service type "${serviceType}" (from connection "${connection}")`,
        };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}