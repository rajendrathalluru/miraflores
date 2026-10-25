import { getActor, maskSensitiveText } from './packet';
import { getIssue, issues } from './issues';
import type { Actor, AuditEvent, Command, Signoff, Workspace } from './contracts';

export function initialWorkspace(): Workspace {
  return { revision: 0, adjustments: [], notes: [], signoffs: [], audit: [], filings: [], questions: [], investigations: [] };
}

export function unresolvedIssues(state: Workspace) {
  return issues.filter(issue => !state.adjustments.some(item => item.issueId === issue.id && item.status === 'active') &&
    !(issue.kind !== 'adjustment' && [...state.investigations].reverse().find(item => item.issueId === issue.id)?.result === 'resolved'));
}

const staffRoles = ['preparer', 'reviewer', 'partner', 'quality_reviewer'];
function staff(actor: Actor): void {
  if (!staffRoles.includes(actor.role)) throw new Error('Only tax preparation or review staff can make this change.');
}
function requireText(value: string | undefined, message: string): string {
  const text = value?.trim();
  if (!text) throw new Error(message);
  if (text.length > 20000) throw new Error('Keep this entry below 20,000 characters.');
  return maskSensitiveText(text);
}
function issueId(command: Command): string {
  const id = requireText(command.issueId, 'Choose the issue this decision belongs to.');
  getIssue(id);
  return id;
}
function materialRevision(state: Workspace): number {
  return state.audit.reduce((latest, event) => event.material ? Math.max(latest, event.revision) : latest, 0);
}
function preparedBy(state: Workspace): Set<string> {
  // Include reversed adjustments as preparation history, and resolved judgment authors.
  return new Set([
    ...state.adjustments.map(item => item.actorId),
    ...state.investigations.filter(item => item.result === 'resolved').map(item => item.actorId),
  ]);
}
function assertCanReview(actor: Actor, state: Workspace, level: Signoff['level']): void {
  if (level === 'client') {
    if (actor.role !== 'client') throw new Error('Client approval must be recorded by a client role.');
    return;
  }
  if (level === 'reviewer' && !['reviewer', 'quality_reviewer'].includes(actor.role)) {
    throw new Error('Reviewer sign-off requires an independent reviewer role.');
  }
  if (level === 'partner' && actor.role !== 'partner') throw new Error('Partner sign-off requires the partner role.');
  if (preparedBy(state).has(actor.id)) throw new Error('You cannot review or sign off on work you prepared.');
}

/** Immutable command reducer. External persistence and optimistic compare-and-swap belong
 * in the API. The original packet and raw engine versions are never mutated here.
 */
export function applyCommand(state: Workspace, command: Command, actorId: string): Workspace {
  const actor = getActor(actorId);
  if (command.expectedRevision !== undefined && command.expectedRevision !== state.revision) {
    throw new Error('This workspace changed in another session. Refresh before saving your decision.');
  }
  if (state.filings.some(filing => filing.status === 'frozen') &&
    command.type !== 'draft_question') {
    throw new Error('This filing snapshot is frozen. Create an amendment workflow before changing reviewed content.');
  }
  const next: Workspace = structuredClone(state);
  const revision = state.revision + 1;
  const at = new Date().toISOString();
  const id = `${command.type}-${revision}`;
  let material = false;
  let detail = '';
  let relatedIssue: string | undefined;
  let targetId: string | undefined;

  switch (command.type) {
    case 'accept_adjustment': {
      if (actor.role !== 'preparer') throw new Error('Only a preparer can accept an adjustment; review roles provide independent sign-off.');
      relatedIssue = issueId(command);
      const issue = getIssue(relatedIssue);
      if (issue.kind !== 'adjustment') throw new Error('This item requires an investigation and documented judgment, not an automatic numeric adjustment.');
      if (next.adjustments.some(item => item.issueId === issue.id && item.status === 'active')) throw new Error('This adjustment is already active. Undo it before accepting another decision.');
      const reason = requireText(command.reason, 'Explain why you are accepting this adjustment.');
      next.adjustments.push({ id, issueId: issue.id, actorId: actor.id, reason, createdAt: at,
        revision, original: issue.original, proposed: issue.proposed, taxEffect: { ...issue.taxEffect }, status: 'active' });
      detail = `Accepted “${issue.title}”: ${reason}`; targetId = id; material = true;
      break;
    }
    case 'undo_adjustment': {
      if (actor.role !== 'preparer') throw new Error('Only a preparer can reverse an adjustment.');
      const adjustment = next.adjustments.find(item => item.id === command.adjustmentId);
      if (!adjustment || adjustment.status !== 'active') throw new Error('Choose an active adjustment to undo.');
      const reason = requireText(command.reason, 'Explain why you are undoing this adjustment.');
      adjustment.status = 'undone'; adjustment.undoneAt = at; adjustment.undoReason = reason;
      relatedIssue = adjustment.issueId; targetId = adjustment.id;
      detail = `Reversed adjustment without deleting its history: ${reason}`; material = true;
      break;
    }
    case 'add_note': {
      staff(actor);
      relatedIssue = command.issueId ? issueId(command) : undefined;
      const body = requireText(command.body ?? command.text, 'Write the review note before saving it.');
      next.notes.push({ id, actorId: actor.id, ...(relatedIssue ? { issueId: relatedIssue } : {}), body, status: 'open', createdAt: at });
      detail = `Opened review note: ${body}`; targetId = id; material = true;
      break;
    }
    case 'resolve_note': {
      staff(actor);
      const note = next.notes.find(item => item.id === command.noteId);
      if (!note || note.status !== 'open') throw new Error('Choose an open review note to resolve.');
      const reason = requireText(command.reason ?? command.body ?? command.text, 'Record how this review note was resolved.');
      note.status = 'resolved'; note.resolvedAt = at; note.resolvedBy = actor.id; note.resolution = reason;
      relatedIssue = note.issueId; targetId = note.id;
      detail = `Resolved review note: ${reason}`; material = true;
      break;
    }
    case 'save_investigation': {
      staff(actor);
      relatedIssue = issueId(command);
      const body = requireText(command.body ?? command.text ?? command.reason, 'Record the evidence reviewed and the conclusion.');
      const result = requireText(command.result, 'Choose an investigation result, such as open or resolved.');
      if (result === 'resolved' && getIssue(relatedIssue).kind === 'adjustment') {
        throw new Error('A numeric adjustment must be accepted by a preparer. An investigation alone cannot resolve it.');
      }
      next.investigations.push({ id, actorId: actor.id, issueId: relatedIssue, body, result, createdAt: at });
      detail = `Saved investigation (${result}): ${body}`; targetId = id; material = true;
      break;
    }
    case 'draft_question': {
      staff(actor);
      relatedIssue = command.issueId ? issueId(command) : undefined;
      const body = requireText(command.body ?? command.text, 'Write the question before saving a draft.');
      next.questions.push({ id, actorId: actor.id, ...(relatedIssue ? { issueId: relatedIssue } : {}), body, status: 'draft', createdAt: at });
      detail = `Saved question draft; no message was sent: ${body}`; targetId = id;
      break;
    }
    case 'client_approve':
    case 'sign_off': {
      const level = command.type === 'client_approve' ? 'client' : command.level ??
        (actor.role === 'partner' ? 'partner' : actor.role === 'client' ? 'client' : 'reviewer');
      assertCanReview(actor, state, level);
      if (next.notes.some(note => note.status === 'open')) throw new Error('Resolve open review notes before signing off.');
      if (unresolvedIssues(next).some(issue => issue.severity === 'high')) throw new Error('Resolve high-priority issues before signing off.');
      if (next.signoffs.some(item => item.status === 'active' && item.level === level)) throw new Error(`An active ${level} sign-off already exists for this content.`);
      if (level === 'partner' && !next.signoffs.some(item => item.status === 'active' && item.level === 'reviewer')) throw new Error('Complete independent reviewer sign-off before partner sign-off.');
      if (level === 'client' && !next.signoffs.some(item => item.status === 'active' && item.level === 'partner')) throw new Error('Complete partner review before requesting client approval.');
      next.signoffs.push({ id, actorId: actor.id, level, revision, contentRevision: materialRevision(state), createdAt: at, status: 'active' });
      detail = level === 'client' ? 'Client approved this reviewed content; this prototype approval is not a real e-file authorization.' : `${level} sign-off on reviewed content revision ${materialRevision(state)}.`;
      targetId = id;
      break;
    }
    case 'freeze': {
      if (actor.role !== 'partner') throw new Error('Only the partner can freeze the filing snapshot.');
      const blockers: string[] = [];
      if (next.notes.some(note => note.status === 'open')) blockers.push('open review notes');
      if (unresolvedIssues(next).some(issue => issue.severity === 'high')) blockers.push('unresolved high-priority issues');
      for (const level of ['reviewer', 'partner', 'client'] as const) {
        if (!next.signoffs.some(item => item.status === 'active' && item.level === level && item.contentRevision === materialRevision(next))) blockers.push(`${level} approval`);
      }
      if (blockers.length) throw new Error(`Filing is blocked: ${blockers.join(', ')}.`);
      next.filings.push({ id, actorId: actor.id, at, revision, status: 'frozen', version: 'v3',
        adjustmentIds: next.adjustments.filter(item => item.status === 'active').map(item => item.id),
        signoffIds: next.signoffs.filter(item => item.status === 'active').map(item => item.id),
        packetSha256: 'ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19',
        snapshot: structuredClone({ revision: state.revision, adjustments: next.adjustments,
          notes: next.notes, signoffs: next.signoffs, investigations: next.investigations }),
        note: 'Immutable reviewed overlay on supplied v3. Tax effects remain estimates; no return was transmitted.' });
      detail = 'Frozen reviewed content and its approval IDs. No tax return was transmitted.'; targetId = id;
      break;
    }
    default: throw new Error('That workspace action is not supported.');
  }

  if (material) {
    for (const signoff of next.signoffs) if (signoff.status === 'active') {
      signoff.status = 'invalidated'; signoff.invalidatedAt = at; signoff.invalidatedByRevision = revision;
    }
  }
  const event: AuditEvent = { id: `audit-${revision}`, revision, actorId: actor.id, type: command.type, at,
    material, detail, ...(relatedIssue ? { issueId: relatedIssue } : {}), ...(targetId ? { targetId } : {}) };
  next.revision = revision;
  next.audit.push(event);
  return next;
}
