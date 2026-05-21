// ─── Connection Routes (drop-in replacement for the connectionRoutes block in routes.js)
// ─────────────────────────────────────────────────────────────────────────────
//
// The original code passed the raw URL param (:connection / :credentialId)
// directly to testConnection() and deleteCredential(). When the frontend
// sends the credential *id* (e.g. 'idp_google-oauth2_google-oauth2') instead
// of a service name, the switch statement in testConnection() fell through to
// the default branch and returned { ok: false, error: "Unknown connection: ..." }.
//
// Fix: extract the credential id from the URL, let integrations.js resolve the
// service type internally via resolveConnectionType(). No changes needed in
// testConnection() itself — it already calls resolveConnectionType() in the
// patched integrations.js.

import { Router } from 'express';
import { listCredentials, deleteCredential, testConnection } from './integrations.js';

export const connectionRoutes = Router();

// GET /api/connections
connectionRoutes.get('/', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const credentials = await listCredentials(userId);

    // Normalise shape so the frontend always gets { id, name, type, scopes, createdAt, updatedAt }
    const connections = credentials.map(c => ({
      id:        c.id || c.credential_id,
      name:      c.name || c.connection_name || c.type || 'Unknown',
      type:      c.type || c.connection_name || '',
      scopes:    c.scopes || [],
      createdAt: c.createdAt || c.created_at || new Date().toISOString(),
      updatedAt: c.updatedAt || c.updated_at  || new Date().toISOString(),
    }));

    res.json({ connections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/connections/:credentialId
// credentialId may be 'idp_google-oauth2_google-oauth2', 'conn_gmail_demo', etc.
connectionRoutes.delete('/:credentialId', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    await deleteCredential(userId, req.params.credentialId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/connections/:connection/test
// :connection is the credential id sent by the frontend — may be the full idp_ id.
// integrations.testConnection() resolves it to a service type internally.
connectionRoutes.post('/:connection/test', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const result = await testConnection(userId, req.params.connection);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/connections/revoke-all
connectionRoutes.post('/revoke-all', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const credentials = await listCredentials(userId);
    const results = { revoked: [], failed: [] };

    await Promise.all(credentials.map(async (c) => {
      const credId = c.id || c.credential_id;
      // Skip primary IDP identity revocation (Auth0 blocks this anyway)
      if (credId.startsWith('idp_')) return;
      try {
        await deleteCredential(userId, credId);
        results.revoked.push(credId);
      } catch (err) {
        results.failed.push({ id: credId, error: err.message });
      }
    }));

    res.json({ ok: true, ...results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});