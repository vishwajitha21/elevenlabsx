// Mock service layer — easy to swap for real endpoints later
const MOCK_DELAY = 1500;

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export const mockUser: MockUser = {
  id: 'usr_a3f8k2m1',
  name: 'Alex Chen',
  email: 'alex@delivervault.dev',
  avatar: 'AC',
};

export interface ProposalStep {
  id: number;
  name: string;
  service: string;
  tokenType: string;
  status: 'pending' | 'active' | 'waiting' | 'done' | 'revoked';
  scope?: string;
  mentorComment?: string;
  mentorDecidedAt?: Date | string;
  approvedByMentor?: string;
  steps?: ProposalStep[];
}

export const mockSteps: ProposalStep[] = [
  { id: 1, name: 'Read brief', service: 'Gmail read', tokenType: 'Token Vault', status: 'done', scope: 'gmail.readonly' },
  { id: 2, name: 'AI drafts', service: 'Groq Llama', tokenType: 'No token', status: 'done', scope: 'groq.inference' },
  { id: 3, name: 'Delegate', service: 'Mentor', tokenType: 'CIBA async', status: 'waiting', scope: 'ciba.delegate' },
  { id: 4, name: 'Approve & send', service: 'Gmail send', tokenType: 'Step-up', status: 'pending', scope: 'gmail.send' },
  { id: 5, name: 'Kickoff', service: 'GitHub repo', tokenType: 'Token Vault', status: 'pending', scope: 'repo.create' },
];

export const mockEvents = [
  'gmail_read · token issued · 24h scope',
  'brief_parsed · 847 tokens used',
  'draft_generated · 312 words',
  'delegation_sent · mentor@email.com',
  'ciba_waiting · agent paused',
  'mentor_approved · 8 minutes',
  'step_up_auth · push sent',
  'step_up_approved · user confirmed',
  'gmail_send · proposal delivered',
  'github_token · issued · 24h scope',
  'repo_created · client-project-2026',
  'token_revoked · gmail_read · expired',
];

export const mockAuditRows = [
  { time: '10:42:31', action: 'Token Issued', token: 'tok_gmail_r4f8', scopes: 'gmail.readonly', status: 'success', duration: '24h' },
  { time: '10:42:45', action: 'Brief Parsed', token: 'tok_groq_k2m1', scopes: 'groq.inference', status: 'success', duration: '2.1s' },
  { time: '10:43:02', action: 'Delegation Sent', token: 'tok_ciba_p9q3', scopes: 'ciba.delegate', status: 'pending', duration: '—' },
  { time: '10:43:18', action: 'Step-up Auth', token: 'tok_step_v7w2', scopes: 'gmail.send', status: 'pending', duration: '—' },
  { time: '10:43:24', action: 'Send Approved', token: 'tok_gmail_s5t9', scopes: 'gmail.send', status: 'success', duration: '0.3s' },
  { time: '10:43:25', action: 'Repo Created', token: 'tok_gh_x1y6', scopes: 'repo.create', status: 'success', duration: '1.8s' },
  { time: '10:44:01', action: 'Token Expired', token: 'tok_gmail_r4f8', scopes: 'gmail.readonly', status: 'revoked', duration: '24h' },
  { time: '10:44:15', action: 'Token Issued', token: 'tok_gmail_r9k2', scopes: 'gmail.readonly', status: 'success', duration: '24h' },
  { time: '10:45:02', action: 'Delegation Approved', token: 'tok_ciba_p9q3', scopes: 'ciba.delegate', status: 'success', duration: '14m' },
  { time: '10:45:18', action: 'Step-up Confirmed', token: 'tok_step_v7w2', scopes: 'gmail.send', status: 'success', duration: '12s' },
  { time: '10:46:01', action: 'Token Revoked', token: 'tok_gh_x1y6', scopes: 'repo.create', status: 'revoked', duration: '2m' },
  { time: '10:46:30', action: 'Session End', token: '—', scopes: '—', status: 'info', duration: '4m 02s' },
];

export const mockProposalText = `Dear Sarah,

Thank you for reaching out about your brand refresh project. I've reviewed the brief you shared and I'm excited about the direction you're considering.

Based on your requirements, I propose a 3-week timeline broken into three distinct phases: Discovery & Research (Week 1), Design Exploration (Week 2), and Final Delivery & Handoff (Week 3).

The total investment for this project would be $4,200, which includes all deliverables outlined below plus two rounds of revisions at each phase.

I look forward to hearing your thoughts.

Best regards,
Alex Chen`;

export const delay = (ms: number = MOCK_DELAY) => new Promise(r => setTimeout(r, ms));

export async function mockParseProposal() {
  await delay(2000);
  return { steps: mockSteps, success: true };
}

export async function mockSendDelegation(email: string) {
  await delay(1500);
  return { success: true, message: `Sent! Mentor at ${email} notified.` };
}

export async function mockApproveStep(stepId: number) {
  await delay(800);
  return { success: true, stepId };
}

export async function mockRevokeToken(stepId: number) {
  await delay(500);
  return { success: true, stepId };
}

export async function mockExportPdf() {
  await delay(3000);
  return { success: true, filename: 'audit-log.pdf' };
}

export async function mockMentorApprove() {
  await delay(1000);
  return { success: true };
}

export async function mockMentorReject() {
  await delay(800);
  return { success: true };
}
