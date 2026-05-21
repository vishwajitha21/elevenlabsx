import { Router } from 'express';
import crypto from 'crypto';
import { Proposal, AuditLog, CIBARequest, MentorToken, UserStreak, User } from './models.js';
import { swr, cacheDelPrefix, cacheDel } from './cache.js';
import * as AI from './ai.js';
import {
  listCredentials, deleteCredential, getVaultToken,
  sendEmail, postSlack, createGitHubIssue, createNotionPage,
  initiateCIBA, pollCIBAToken, testConnection,
} from './integrations.js';
import { elevenlabsTTS } from './elevenlabs.js';
export { connectionRoutes } from './connectionRoutes.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_STEPS = 20;
const VALID_CURRENCIES = new Set([
  'usd', 'eur', 'gbp', 'cad', 'aud', 'chf', 'jpy', 'cny', 'inr', 'brl', 'mxn',
  'sgd', 'hkd', 'nzd', 'sek', 'nok', 'dkk', 'zar', 'pln', 'czk', 'huf', 'ils',
]);
const MAX_DESCRIPTION_LENGTH = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape HTML entities to prevent XSS in email templates. */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Validate a MongoDB ObjectId format. */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/** Fire-and-forget audit log write — never blocks a response. */
function audit(userId, action, meta = {}, status = 'info') {
  setImmediate(async () => {
    try {
      await AuditLog.create({ userId, action, status, ...meta });
    } catch (_) { /* non-critical */ }
  });
}

/** Fire-and-forget streak update. */
function updateStreak(userId, type = 'proposal') {
  setImmediate(async () => {
    try {
      const doc = await UserStreak.findOne({ userId });
      const now = new Date();
      if (!doc) {
        await UserStreak.create({
          userId, streak: 1, lastActivity: now,
          totalProposals: type === 'proposal' ? 1 : 0,
          totalApprovals: type === 'approval' ? 1 : 0,
        });
        return;
      }
      const last = doc.lastActivity ? new Date(doc.lastActivity) : null;
      if (last) {
        const diffDays = Math.floor((now - last) / 86400000);
        if (diffDays === 1) doc.streak += 1;
        else if (diffDays > 1) doc.streak = 1;
        // diffDays === 0 → no change to streak
      }
      doc.lastActivity = now;
      if (type === 'proposal') doc.totalProposals += 1;
      if (type === 'approval') doc.totalApprovals += 1;
      await doc.save();
    } catch (_) { /* non-critical */ }
  });
}

// ─── Proposal Routes ─────────────────────────────────────────────────────────
export const proposalRoutes = Router();

// ─── ElevenLabs Voice Routes ──────────────────────────────────────────────────
export const voiceRoutes = Router();

voiceRoutes.post('/narrate', async (req, res) => {
  try {
    const { text, voiceId, modelId } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' });
    if (text.length > 2000) return res.status(400).json({ error: 'text too long (max 2000 chars)' });

    const { audioBuffer, mimeType, ...meta } = await elevenlabsTTS({ text, voiceId, modelId });
    res.json({
      ...meta,
      mimeType,
      audioBase64: audioBuffer.toString('base64'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals
proposalRoutes.get('/', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { status } = req.query;
    const cacheKey = `proposals:${userId}:${status || 'all'}`;

    const proposals = await swr(cacheKey, () => {
      const filter = { userId };
      if (status) filter.status = status;
      return Proposal.find(filter).sort({ createdAt: -1 }).lean();
    }, 30);

    res.json({ proposals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals — parse raw text, create proposal
proposalRoutes.post('/', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { rawText } = req.body;
    if (!rawText?.trim()) return res.status(400).json({ error: 'rawText is required' });

    const parsed = await AI.parseProposal(rawText);
    const steps = (parsed.steps || []).slice(0, MAX_STEPS).map((s, i) => ({
      ...s,
      id: s.id || `step-${i + 1}`,
      status: i === 0 ? 'active' : 'pending',
    }));

    if ((parsed.steps || []).length > MAX_STEPS) {
      console.warn(`[proposal] Truncated steps from ${(parsed.steps || []).length} to ${MAX_STEPS}`);
    }

    const proposal = await Proposal.create({
      userId,
      rawText,
      title: parsed.title || 'Untitled Proposal',
      client: parsed.client || '',
      value: parsed.value || 0,
      currency: parsed.currency || 'USD',
      status: 'active',
      steps,
    });

    cacheDelPrefix(`proposals:${userId}`);
    updateStreak(userId, 'proposal');
    audit(userId, 'proposal.created', { proposalId: proposal._id.toString() }, 'success');

    req.io?.to(`user:${userId}`).emit('proposal:created', { proposal });
    res.status(201).json({ proposal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals/share/:token — public, no auth
proposalRoutes.get('/share/:token', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ shareToken: req.params.token }).lean();
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    // Sanitize — remove internal fields
    const { userId, rawText, ...safe } = proposal;
    res.json({ proposal: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals/mentor/:token — public, verifies JWT
proposalRoutes.get('/mentor/:token', async (req, res) => {
  const jwt = (await import('jsonwebtoken')).default;
  try {
    const decoded = jwt.verify(req.params.token, process.env.AUTH0_MGMT_CLIENT_SECRET);
    if (!decoded || decoded.type !== 'mentor_review') {
      return res.status(403).json({ error: 'Invalid or unauthorized token' });
    }

    const proposal = await Proposal.findById(decoded.proposalId).lean();
    if (!proposal) return res.status(404).json({ error: 'Proposal no longer exists' });

    const step = proposal.steps.find(s => s.id === decoded.stepId);
    
    res.json({
      proposal: {
        title: proposal.title,
        client: proposal.client,
        value: proposal.value,
        currency: proposal.currency,
        steps: proposal.steps.map(s => ({
          id: s.id,
          label: s.label,
          description: s.description,
          status: s.status
        }))
      },
      step: step ? {
        id: step.id,
        label: step.label,
        description: step.description,
        status: step.status
      } : null,
      mentorEmail: decoded.mentorEmail
    });
  } catch (err) {
    res.status(401).json({ error: 'Token expired or invalid: ' + err.message });
  }
});

// POST /api/proposals/mentor/:token — submit approval or rejection
proposalRoutes.post('/mentor/:token', async (req, res) => {
  const jwt = (await import('jsonwebtoken')).default;
  try {
    const { decision, reason } = req.body;
    const decoded = jwt.verify(req.params.token, process.env.AUTH0_MGMT_CLIENT_SECRET);
    if (!decoded || decoded.type !== 'mentor_review') {
      return res.status(403).json({ error: 'Invalid or unauthorized token' });
    }

    const proposal = await Proposal.findById(decoded.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal no longer exists' });

    const step = proposal.steps.find(s => s.id === decoded.stepId);
    if (!step) return res.status(404).json({ error: 'Step no longer exists' });

    if (decision === 'approve') {
      step.status = 'done';
      step.mentorComment = reason || 'Approved via mentor review link';
      step.mentorDecidedAt = new Date();
      step.approvedByMentor = decoded.mentorEmail;
      audit(decoded.mentorEmail, 'mentor.approved', { proposalId: decoded.proposalId, stepId: decoded.stepId }, 'success');
    } else {
      step.status = 'pending'; // revert to pending for freelancer to fix
      step.mentorComment = reason || 'Changes requested by mentor';
      step.mentorDecidedAt = new Date();
      audit(decoded.mentorEmail, 'mentor.rejected', { proposalId: decoded.proposalId, stepId: decoded.stepId, reason }, 'info');
    }

    await proposal.save();
    cacheDelPrefix(`proposals:${proposal.userId}`);

    // Emit real-time update to the freelancer
    req.io?.to(`user:${proposal.userId}`).emit('step:mentor_decision', { 
      proposalId: proposal._id, 
      stepId: decoded.stepId, 
      decision, 
      reason: reason || step.mentorComment,
      proposal 
    });

    res.json({ message: 'Decision submitted successfully' });
  } catch (err) {
    res.status(401).json({ error: 'Token expired or invalid: ' + err.message });
  }
});

// GET /api/proposals/:id
proposalRoutes.get('/:id', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
    const proposal = await Proposal.findOne({ _id: req.params.id, userId }).lean();
    if (!proposal) return res.status(404).json({ error: 'Not found' });
    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/proposals/:id
proposalRoutes.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
    const proposal = await Proposal.findOneAndDelete({ _id: req.params.id, userId });
    if (!proposal) return res.status(404).json({ error: 'Not found' });
    cacheDelPrefix(`proposals:${userId}`);
    audit(userId, 'proposal.deleted', { proposalId: req.params.id }, 'info');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/share
proposalRoutes.post('/:id/share', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
    const shareToken = crypto.randomBytes(32).toString('hex');
    const proposal = await Proposal.findOneAndUpdate(
      { _id: req.params.id, userId },
      { shareToken },
      { new: true }
    );
    if (!proposal) return res.status(404).json({ error: 'Not found' });
    const shareUrl = `${process.env.FRONTEND_URL}/share/${shareToken}`;
    res.json({ shareUrl, shareToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/steps/:stepId/approve
proposalRoutes.post('/:id/steps/:stepId/approve', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { id, stepId } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid ID format' });
    const { executeService = false, emailData, slackData, githubData, notionData } = req.body;

    const proposal = await Proposal.findOne({ _id: id, userId });
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    const stepIdx = proposal.steps.findIndex(s => s.id === stepId);
    if (stepIdx === -1) return res.status(404).json({ error: 'Step not found' });

    const step = proposal.steps[stepIdx];
    const serviceActions = [];

    // Execute service action if requested
    if (executeService && step.service) {
      try {
        let serviceResult;
        if (step.service === 'gmail' && emailData) {
          serviceResult = await sendEmail(userId, emailData);
          serviceActions.push({ service: 'gmail', status: 'success', result: serviceResult });
          step.serviceResult = serviceResult;
        } else if (step.service === 'slack' && slackData) {
          serviceResult = await postSlack(userId, slackData);
          serviceActions.push({ service: 'slack', status: 'success', result: serviceResult });
          step.serviceResult = serviceResult;
        } else if (step.service === 'github' && githubData) {
          serviceResult = await createGitHubIssue(userId, githubData);
          serviceActions.push({ service: 'github', status: 'success', result: serviceResult });
          step.serviceResult = serviceResult;
        } else if (step.service === 'notion' && notionData) {
          serviceResult = await createNotionPage(userId, notionData);
          serviceActions.push({ service: 'notion', status: 'success', result: serviceResult });
          step.serviceResult = serviceResult;
        }
        audit(userId, `${step.service}.action_executed`, { proposalId: id, stepId }, 'success');
      } catch (svcErr) {
        serviceActions.push({ service: step.service, status: 'failed', error: svcErr.message });
        audit(userId, `${step.service}.action_failed`, { proposalId: id, stepId, error: svcErr.message }, 'failure');
        // Continue — still approve the step even if service call fails
      }
    }

    // Advance step
    step.status = 'done';
    step.approvedAt = new Date();

    // Activate next pending step
    const nextStep = proposal.steps.find((s, i) => i > stepIdx && s.status === 'pending');
    if (nextStep) nextStep.status = 'active';

    // Check if all steps done
    const allDone = proposal.steps.every(s => s.status === 'done');
    if (allDone) {
      proposal.status = 'approved';
      proposal.completedAt = new Date();
      updateStreak(userId, 'approval');
    }

    await proposal.save();
    cacheDelPrefix(`proposals:${userId}`);
    audit(userId, 'step.approved', { proposalId: id, stepId }, 'success');

    req.io?.to(`user:${userId}`).emit('step:approved', { proposal, stepId, serviceActions });
    res.json({ proposal, serviceActions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/steps/:stepId/revoke
proposalRoutes.post('/:id/steps/:stepId/revoke', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { id, stepId } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid ID format' });

    const proposal = await Proposal.findOne({ _id: id, userId });
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    const step = proposal.steps.find(s => s.id === stepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    step.status = 'revoked';
    step.revokedAt = new Date();
    await proposal.save();
    cacheDelPrefix(`proposals:${userId}`);
    audit(userId, 'step.revoked', { proposalId: id, stepId }, 'info');

    req.io?.to(`user:${userId}`).emit('step:revoked', { proposalId: id, stepId });
    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/steps/:stepId/delegate
proposalRoutes.post('/:id/steps/:stepId/delegate', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { id, stepId } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid ID format' });
    const { email, message } = req.body;

    if (!email) return res.status(400).json({ error: 'email is required' });

    const proposal = await Proposal.findOne({ _id: id, userId });
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    const step = proposal.steps.find(s => s.id === stepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const delegateUrl = `${process.env.FRONTEND_URL}/dashboard`;
    // Generate a direct review URL (if we have a special mentor view, otherwise dashboard)
    const reviewUrl = `${process.env.FRONTEND_URL}/dashboard?proposal=${id}&step=${stepId}`;

    let emailError = null;
    let emailResult = null;

    try {
      emailResult = await sendEmail(userId, {
        to: email,
        subject: `Action required: "${escapeHtml(step.label)}" in ${escapeHtml(proposal.title)}`,
        html: `<p>${message ? escapeHtml(message) : `Please review and approve the step: <strong>${escapeHtml(step.label)}</strong>`}</p>
               <p>Proposal: ${escapeHtml(proposal.title)} (Client: ${escapeHtml(proposal.client)})</p>
               <p><a href="${escapeHtml(reviewUrl)}">View in DeliverVault</a></p>`,
      });
    } catch (err) {
      console.error('[delegate] Email failed:', err.message);
      emailError = err.message;
    }

    step.status = 'waiting';
    step.delegatedTo = email;
    await proposal.save();
    cacheDelPrefix(`proposals:${userId}`);
    audit(userId, 'step.delegated', { proposalId: id, stepId, to: email, emailError }, emailError ? 'warning' : 'success');

    res.json({ proposal, emailResult, reviewUrl, emailError });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/steps/:stepId/ciba
proposalRoutes.post('/:id/steps/:stepId/ciba', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { id, stepId } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid ID format' });
    const { mentorUserId, bindingMessage } = req.body;

    if (!mentorUserId) return res.status(400).json({ error: 'mentorUserId is required' });

    const proposal = await Proposal.findOne({ _id: id, userId });
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    const step = proposal.steps.find(s => s.id === stepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const { authReqId, expiresIn, interval } = await initiateCIBA({
      mentorUserId,
      bindingMessage: bindingMessage || `Approve "${step.label}" in ${proposal.title}`,
    });

    await CIBARequest.create({
      authReqId,
      proposalId: id,
      stepId,
      mentorUserId,
      requesterId: userId,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });

    step.status = 'waiting';
    step.cibaAuthReqId = authReqId;
    await proposal.save();
    cacheDelPrefix(`proposals:${userId}`);
    audit(userId, 'ciba.initiated', { proposalId: id, stepId, mentorUserId }, 'info');

    res.json({ authReqId, pollInterval: interval, expiresIn, message: 'Push notification sent to mentor' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/steps/:stepId/invite-mentor
proposalRoutes.post('/:id/steps/:stepId/invite-mentor', async (req, res) => {
  const { inviteMentor } = await import('./integrations.js');
  try {
    const { id, stepId } = req.params;
    const { email } = req.body;
    const userId = req.auth.payload.sub;
    
    if (!email) return res.status(400).json({ error: 'Mentor email is required' });
    
    const result = await inviteMentor(userId, id, stepId, email);
    res.json({ ...result, message: 'Mentor invitation generated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Routes ────────────────────────────────────────────────────────────────
export const aiRoutes = Router();

aiRoutes.post('/parse', async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText?.trim()) return res.status(400).json({ error: 'rawText is required' });
    const result = await AI.parseProposal(rawText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiRoutes.post('/chat', async (req, res) => {
  try {
    const { messages, proposalId } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'messages are required' });

    let proposalContext = null;
    if (proposalId) {
      const userId = req.auth.payload.sub;
      proposalContext = await Proposal.findOne({ _id: proposalId, userId }).lean();
    }

    const reply = await AI.chat(messages, proposalContext);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiRoutes.post('/rewrite', async (req, res) => {
  try {
    const { section, instruction } = req.body;
    if (!section || !instruction) return res.status(400).json({ error: 'section and instruction are required' });
    const rewritten = await AI.rewrite(section, instruction);
    res.json({ rewritten });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiRoutes.post('/generate', async (req, res) => {
  try {
    const { templateType, context } = req.body;
    if (!templateType) return res.status(400).json({ error: 'templateType is required' });
    const result = await AI.generate(templateType, context || {});
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiRoutes.post('/anomaly', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { proposalId, text } = req.body;

    let analysisText = text;
    if (proposalId && !text) {
      const proposal = await Proposal.findOne({ _id: proposalId, userId }).lean();
      if (!proposal) return res.status(404).json({ error: 'Not found' });
      analysisText = proposal.rawText || `${proposal.title}\n${proposal.steps?.map(s => s.label).join('\n')}`;
    }

    if (!analysisText?.trim()) return res.status(400).json({ error: 'text or proposalId is required' });
    const result = await AI.detectAnomalies(analysisText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Audit Routes ─────────────────────────────────────────────────────────────
export const auditRoutes = Router();

auditRoutes.get('/', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { action, status, limit = 50, page = 1 } = req.query;

    const filter = { userId };
    if (action) filter.action = action;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      AuditLog.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / parseInt(limit));
    res.json({ entries, total, page: parseInt(page), limit: parseInt(limit), pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/export — CSV download
auditRoutes.get('/export', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { action, status } = req.query;

    const filter = { userId };
    if (action) filter.action = action;
    if (status) filter.status = status;

    const entries = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    const header = 'Time,Action,Status,Proposal ID,Step ID,Details';
    const lines = entries.map(e => {
      const d = new Date(e.createdAt).toISOString();
      const details = (e.meta && typeof e.meta === 'object')
        ? JSON.stringify(e.meta).replace(/"/g, '""')
        : '';
      return `${d},${e.action},${e.status},${e.proposalId || ''},${e.stepId || ''},"${details}"`;
    });

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=delivervault-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mentor Routes ────────────────────────────────────────────────────────────

// Authenticated mentor routes (POST /invite requires auth)
export const mentorAuthRoutes = Router();

// POST /api/mentor/invite (requires auth)
mentorAuthRoutes.post('/invite', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { proposalId, stepId, mentorEmail } = req.body;
    if (!proposalId || !stepId || !mentorEmail) {
      return res.status(400).json({ error: 'proposalId, stepId, mentorEmail are required' });
    }

    const proposal = await Proposal.findOne({ _id: proposalId, userId });
    if (!proposal) return res.status(404).json({ error: 'Not found' });

    const step = proposal.steps.find(s => s.id === stepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await MentorToken.create({ token, proposalId, stepId, mentorEmail, requesterId: userId, expiresAt });

    const reviewUrl = `${process.env.FRONTEND_URL}/mentor/${token}`;
    await sendEmail(userId, {
      to: mentorEmail,
      subject: `Mentor review requested: "${escapeHtml(step.label)}" in ${escapeHtml(proposal.title)}`,
      html: `<p>You've been asked to review a proposal step.</p>
             <h3>${escapeHtml(step.label)}</h3>
             <p>${escapeHtml(step.description || '')}</p>
             <p>Proposal: <strong>${escapeHtml(proposal.title)}</strong> (Client: ${escapeHtml(proposal.client)})</p>
             <p><a href="${escapeHtml(reviewUrl)}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Review &amp; Approve</a></p>
             <p><small>This link expires in 48 hours.</small></p>`,
    });

    audit(userId, 'mentor.invited', { proposalId, stepId, to: mentorEmail }, 'success');
    res.json({ ok: true, reviewUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public mentor routes (GET /:token and POST /:token/decide are token-based auth)
export const mentorPublicRoutes = Router();

// GET /api/mentor/:token (public)
mentorPublicRoutes.get('/:token', async (req, res) => {
  try {
    const tokenDoc = await MentorToken.findOne({
      token: req.params.token,
      expiresAt: { $gt: new Date() },
      usedAt: null,
    }).lean();

    if (!tokenDoc) return res.status(404).json({ error: 'Token not found or expired' });

    const proposal = await Proposal.findById(tokenDoc.proposalId).lean();
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const step = proposal.steps.find(s => s.id === tokenDoc.stepId);
    const { userId, rawText, ...safeProposal } = proposal;
    res.json({ proposal: safeProposal, step, mentorEmail: tokenDoc.mentorEmail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mentor/:token/decide (public)
mentorPublicRoutes.post('/:token/decide', async (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const tokenDoc = await MentorToken.findOne({
      token: req.params.token,
      expiresAt: { $gt: new Date() },
      usedAt: null,
    });

    if (!tokenDoc) return res.status(404).json({ error: 'Token not found, expired, or already used' });

    // Mark token as used
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    const proposal = await Proposal.findById(tokenDoc.proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const step = proposal.steps.find(s => s.id === tokenDoc.stepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    if (action === 'approve') {
      step.status = 'done';
      step.approvedAt = new Date();
      step.mentorComment = comment || '';
      const nextStep = proposal.steps.find(s => s.status === 'pending');
      if (nextStep) nextStep.status = 'active';
      const allDone = proposal.steps.every(s => s.status === 'done');
      if (allDone) { proposal.status = 'approved'; proposal.completedAt = new Date(); }
    } else {
      step.status = 'revoked';
      step.revokedAt = new Date();
      step.mentorComment = comment || '';
    }

    await proposal.save();
    audit(tokenDoc.requesterId, `mentor.step.${action}d`, {
      proposalId: tokenDoc.proposalId,
      stepId: tokenDoc.stepId,
      by: tokenDoc.mentorEmail,
    }, 'success');

    req.io?.to(`user:${tokenDoc.requesterId}`).emit('mentor:decided', {
      proposalId: tokenDoc.proposalId, stepId: tokenDoc.stepId, action, comment,
    });

    res.json({ ok: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keep legacy export for backward compatibility
export const mentorRoutes = Router();
mentorRoutes.use(mentorAuthRoutes);
mentorRoutes.use(mentorPublicRoutes);

// ─── CIBA Routes ──────────────────────────────────────────────────────────────
export const cibaRoutes = Router();

cibaRoutes.get('/poll/:authReqId', async (req, res) => {
  try {
    const { authReqId } = req.params;
    const cibaReq = await CIBARequest.findOne({ authReqId });
    if (!cibaReq) return res.status(404).json({ status: 'expired' });

    if (cibaReq.status !== 'pending') {
      return res.json({ status: cibaReq.status });
    }

    const pollResult = await pollCIBAToken(authReqId);
    cibaReq.status = pollResult.status;
    await cibaReq.save();

    if (pollResult.status === 'approved') {
      const proposal = await Proposal.findById(cibaReq.proposalId);
      if (proposal) {
        const step = proposal.steps.find(s => s.id === cibaReq.stepId);
        if (step) {
          step.status = 'done';
          step.approvedAt = new Date();
          step.cibaAuthReqId = null;
          const nextStep = proposal.steps.find(s => s.status === 'pending');
          if (nextStep) nextStep.status = 'active';
          const allDone = proposal.steps.every(s => s.status === 'done');
          if (allDone) { proposal.status = 'approved'; proposal.completedAt = new Date(); }
          await proposal.save();
          cacheDelPrefix(`proposals:${cibaReq.requesterId}`);
          req.io?.to(`user:${cibaReq.requesterId}`).emit('ciba:approved', {
            proposalId: cibaReq.proposalId, stepId: cibaReq.stepId, proposal,
          });
          audit(cibaReq.requesterId, 'ciba.approved', {
            proposalId: cibaReq.proposalId, stepId: cibaReq.stepId,
          }, 'success');
        }
      }
    }

    res.json({ status: pollResult.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Payment Routes ───────────────────────────────────────────────────────────
export const paymentRoutes = Router();

paymentRoutes.post('/create-link', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { proposalId, amount, currency = 'USD', description, email } = req.body;

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (amount < 0.50) {
      return res.status(400).json({ error: 'amount must be at least 0.50' });
    }
    if (amount > 999999.99) {
      return res.status(400).json({ error: 'amount must not exceed 999999.99' });
    }

    // Validate currency
    if (typeof currency !== 'string' || !VALID_CURRENCIES.has(currency.toLowerCase())) {
      return res.status(400).json({ error: `Unsupported currency. Supported: ${[...VALID_CURRENCIES].join(', ')}` });
    }

    // Validate description
    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: 'description must be a string' });
    }
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return res.status(400).json({ error: `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` });
    }

    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: currency.toLowerCase(),
              product_data: { name: description || 'Freelance Services' },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          customer_email: email,
          success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success`,
          cancel_url: `${process.env.FRONTEND_URL}/dashboard?payment=cancelled`,
          metadata: { proposalId: proposalId || '', userId },
        });
        return res.json({ url: session.url, mode: 'stripe' });
      } catch (stripeErr) {
        console.warn('[payment] Stripe failed, using demo:', stripeErr.message);
      }
    }

    // Demo fallback
    const params = new URLSearchParams({ amount, currency, description: description || 'Freelance Services' });
    const url = `${process.env.FRONTEND_URL}/pay?${params.toString()}`;
    res.json({ url, mode: 'demo' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats Routes ─────────────────────────────────────────────────────────────
export const statsRoutes = Router();

statsRoutes.get('/', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const [streak, proposalCount, approvalCount] = await Promise.all([
      UserStreak.findOne({ userId }).lean(),
      Proposal.countDocuments({ userId }),
      Proposal.countDocuments({ userId, status: 'approved' }),
    ]);
    res.json({
      streak: streak?.streak || 0,
      totalProposals: proposalCount,
      totalApprovals: approvalCount,
      lastActivity: streak?.lastActivity || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── User Routes ──────────────────────────────────────────────────────────────
export const userRoutes = Router();

userRoutes.get('/profile', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    let userRecord = await User.findOne({ userId }).lean();
    if (!userRecord) {
      // Create default user record if not exists.
      // We use upsert-style to handle potential race conditions.
      userRecord = await User.findOneAndUpdate(
        { userId },
        { $setOnInsert: { name: req.auth.payload.name || 'User' } },
        { upsert: true, new: true, lean: true }
      );
    }
    res.json({ user: userRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

userRoutes.put('/profile', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { name, tokenExpiry, stepUpAuth, mentorDelegation, darkMode } = req.body;
    const userUpdate = await User.findOneAndUpdate(
      { userId },
      { $set: { name, tokenExpiry, stepUpAuth, mentorDelegation, darkMode } },
      { new: true, upsert: true, lean: true }
    );
    res.json({ user: userUpdate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

userRoutes.delete('/', async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    // Cascading delete
    await Promise.all([
      User.deleteOne({ userId }),
      Proposal.deleteMany({ userId }),
      UserStreak.deleteOne({ userId }),
      AuditLog.deleteMany({ userId }),
    ]);
    audit(userId, 'user.account_deleted', {}, 'info');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Routes (no auth — public, for admin panel) ─────────────────────────
export const adminRoutes = Router();

adminRoutes.get('/overview', async (req, res) => {
  try {
    const [totalUsers, totalProposals, totalApprovals, recentEntries] = await Promise.all([
      UserStreak.countDocuments(),
      Proposal.countDocuments(),
      Proposal.countDocuments({ status: 'approved' }),
      AuditLog.find().sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    res.json({
      totalUsers,
      totalProposals,
      totalApprovals,
      recentEntries,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRoutes.get('/users', async (req, res) => {
  try {
    const users = await UserStreak.find().lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRoutes.get('/proposals', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const proposals = await Proposal.find()
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();
    const total = await Proposal.countDocuments();
    res.json({ proposals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRoutes.get('/audit', async (req, res) => {
  try {
    const { action, status, limit = 100, page = 1 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ entries, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRoutes.get('/audit/export', async (req, res) => {
  try {
    const { action, status } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (status) filter.status = status;

    const entries = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const header = 'Time,Action,Status,User ID,Proposal ID,Step ID,Details';
    const lines = entries.map(e => {
      const d = new Date(e.createdAt).toISOString();
      const details = (e.meta && typeof e.meta === 'object')
        ? JSON.stringify(e.meta).replace(/"/g, '""')
        : '';
      return `${d},${e.action},${e.status},${e.userId || ''},${e.proposalId || ''},${e.stepId || ''},"${details}"`;
    });

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=delivervault-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRoutes.delete('/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid ID format' });
    const proposal = await Proposal.findByIdAndDelete(id);
    if (!proposal) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, deleted: proposal.title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
