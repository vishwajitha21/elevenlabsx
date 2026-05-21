import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ─── StepSchema (embedded in Proposal) ──────────────────────────────────────
const StepSchema = new Schema({
  id:               { type: String, required: true },
  label:            { type: String, required: true },
  description:      { type: String, default: '' },
  status:           { type: String, enum: ['pending', 'active', 'waiting', 'done', 'revoked'], default: 'pending' },
  service:          { type: String, enum: ['gmail', 'slack', 'github', 'notion', null], default: null },
  estimatedDays:    { type: Number, default: 1 },
  requiresApproval: { type: Boolean, default: false },
  approvedAt:       { type: Date },
  revokedAt:        { type: Date },
  revokeReason:     { type: String },
  delegatedTo:      { type: String },
  delegatedAt:      { type: Date },
  mentorComment:    { type: String },
  mentorDecidedAt:  { type: Date },
  approvedByMentor: { type: String },
  waitingForMentor: { type: String },
  serviceResult:    { type: Schema.Types.Mixed },
  cibaAuthReqId:    { type: String },
}, { _id: false });

// ─── Proposal ────────────────────────────────────────────────────────────────
const ProposalSchema = new Schema({
  userId:      { type: String, required: true, index: true },
  title:       { type: String, required: true },
  client:      { type: String, default: '' },
  value:       { type: Number, default: 0 },
  currency:    { type: String, default: 'USD' },
  status:      { type: String, enum: ['draft', 'active', 'approved', 'rejected', 'archived'], default: 'draft' },
  steps:       [StepSchema],
  shareToken:  { type: String, sparse: true },
  rawText:     { type: String, default: '' },
  completedAt: { type: Date },
}, { timestamps: true });

ProposalSchema.index({ userId: 1, createdAt: -1 });
ProposalSchema.index({ userId: 1, status: 1 });
ProposalSchema.index({ shareToken: 1 }, { sparse: true });

export const Proposal = model('Proposal', ProposalSchema);

// ─── AuditLog ────────────────────────────────────────────────────────────────
const AuditLogSchema = new Schema({
  userId:     { type: String, required: true },
  action:     { type: String, required: true },
  proposalId: { type: String },
  stepId:     { type: String },
  status:     { type: String, enum: ['success', 'failure', 'info'], default: 'info' },
  meta:       { type: Schema.Types.Mixed, default: {} },
  createdAt:  { type: Date, default: Date.now, expires: 7776000 }, // TTL: 90 days
});

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });

export const AuditLog = model('AuditLog', AuditLogSchema);

// ─── CIBARequest ─────────────────────────────────────────────────────────────
const CIBARequestSchema = new Schema({
  authReqId:    { type: String, required: true, unique: true },
  proposalId:   { type: String, required: true },
  stepId:       { type: String, required: true },
  mentorUserId: { type: String, required: true },
  requesterId:  { type: String, required: true },
  status:       { type: String, enum: ['pending', 'approved', 'denied', 'expired'], default: 'pending' },
  expiresAt:    { type: Date, required: true, expires: 0 }, // TTL: auto-delete at expiresAt
});

export const CIBARequest = model('CIBARequest', CIBARequestSchema);

// ─── MentorToken ─────────────────────────────────────────────────────────────
const MentorTokenSchema = new Schema({
  token:       { type: String, required: true, unique: true },
  proposalId:  { type: String, required: true },
  stepId:      { type: String, required: true },
  mentorEmail: { type: String, required: true },
  requesterId: { type: String, required: true },
  expiresAt:   { type: Date, required: true, expires: 0 }, // TTL: auto-delete at expiresAt
  usedAt:      { type: Date },
});

export const MentorToken = model('MentorToken', MentorTokenSchema);

// ─── UserStreak ──────────────────────────────────────────────────────────────
const UserStreakSchema = new Schema({
  userId:         { type: String, required: true, unique: true },
  streak:         { type: Number, default: 1 },
  lastActivity:   { type: Date, default: Date.now },
  totalProposals: { type: Number, default: 0 },
  totalApprovals: { type: Number, default: 0 },
});

export const UserStreak = model('UserStreak', UserStreakSchema);

// ─── User (Settings & Preferences) ───────────────────────────────────────────
const UserSchema = new Schema({
  userId:           { type: String, required: true, unique: true, index: true },
  name:             { type: String },
  tokenExpiry:      { type: String, default: '24h' },
  stepUpAuth:       { type: Boolean, default: true },
  mentorDelegation: { type: Boolean, default: true },
  darkMode:         { type: Boolean, default: false },
}, { timestamps: true });

export const User = model('User', UserSchema);
