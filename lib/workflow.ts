import packet from '../data/packet.json';
import { getActor, getBootstrap, maskSensitiveText, masked, resolveSource } from './packet';
import { getIssue } from './issues';
import type { Actor, Command, Workspace } from './contracts';
import type { Entry, WorkflowState } from './workflow-types';

export const REVIEW_AREAS = ['Intake and identity', 'Wages and stock compensation', 'Investments and digital assets',
  'Business and books to tax', 'Rentals and property sale', 'K-1s and S corporation basis', 'Retirement',
  'Foreign reporting', 'Deductions and credits', 'Payments and penalties', 'California allocation',
  'Carryovers and prior preparer', 'Outside filings'];
export const VERIFICATION_METHODS = packet.firm.starter_standards.verification_types;
export const REQUIRED_DILIGENCE = [
  { id: 'child_tax_credit', title: 'Child tax credit' }, { id: 'other_dependent_credit', title: 'Credit for other dependents' },
  { id: 'american_opportunity_credit', title: 'American opportunity credit' }, { id: 'earned_income_credit', title: 'Earned income credit' },
  { id: 'head_of_household', title: 'Head of household filing status' },
];
export const REQUIRED_OUTSIDE_FILINGS = [
  ...packet.household.related_returns.map((r, i) => ({ id: `related-${i}`, title: `${r.who} · ${r.return}`, dueDate: '', responsible: r.prepared_by, sourceRefs: [`packet:/household/related_returns/${i}`] })),
  { id: 'fbar', title: 'FinCEN 114 (FBAR)', dueDate: '2026-10-15', responsible: 'Client / separate adviser', sourceRefs: ['packet:/firm/deadlines/4'] },
  { id: '1099-nec', title: 'Contractor Forms 1099-NEC', dueDate: '2026-02-02', responsible: 'Client / separate adviser', sourceRefs: ['packet:/firm/deadlines/5'] },
];
export function initialWorkflow(): WorkflowState {
  return { cycle: 0, history: [], amendments: [], verifications: {}, documents: {}, areas: {}, judgments: [], dueDiligence: {}, identifierCorrections: [], questions: [],
    tasks: [], notifications: [], scenarios: [], lineAdjustments: [], reconciliations: [], originals: {}, replayAt: null,
    batches: [], extensions: [], signatures: [], filingEvents: [],
    notices: [], carryforwards: [], plans: [], outsideFilings: REQUIRED_OUTSIDE_FILINGS.map(f => ({ ...f, filingId: f.id, actorId: 'system', at: '2026-01-12T17:06:00Z', status: 'pending' })), links: [], attachments: [], time: [], lastSeen: {},
    standards: { requireAllDocuments: true, requireAllAreas: true, requireSignature: true, requireDueDiligence: true, requireOutsideFilings: true,
      budgetHours: Object.values(packet.firm.budget_hours).reduce((a, b) => a + b, 0), retentionYears: 7,
      variancePercent: 10, varianceAmount: 1000 } };
}
export function workflowState(state: Workspace): WorkflowState {
  const defaults = initialWorkflow();
  return state.workpaper ? { ...defaults, ...state.workpaper, standards: { ...defaults.standards, ...state.workpaper.standards } } : defaults;
}
export function currentFrozen(state: Workspace) {
  const cycle = workflowState(state).cycle;
  return state.filings.find(f => (f.cycle ?? 0) === cycle);
}
export function contentRevision(state: Workspace) {
  return state.audit.reduce((n, e) => e.material ? Math.max(n, e.revision) : n, 0);
}
export function workflowBlockers(state: Workspace, includeSignature = false): string[] {
  const w = workflowState(state); const blockers: string[] = [];
  if (w.standards.requireAllDocuments) {
    const missing = packet.documents.filter(d => !['used', 'unused'].includes(String(w.documents[d.id]?.status)));
    if (missing.length) blockers.push(`${missing.length} documents lack a reviewed disposition`);
  }
  if (w.standards.requireAllAreas) {
    const missing = REVIEW_AREAS.filter(a => w.areas[a]?.status !== 'reviewed');
    if (missing.length) blockers.push(`${missing.length} tax areas need review`);
  }
  if (w.standards.requireDueDiligence) {
    const missing = REQUIRED_DILIGENCE.filter(d => !w.dueDiligence[d.id]?.authority || !['applies', 'not_applicable'].includes(String(w.dueDiligence[d.id]?.applicability)));
    if (missing.length) blockers.push(`${missing.length} due-diligence applicability and authority records`);
  }
  if (w.standards.requireOutsideFilings) {
    const missing = REQUIRED_OUTSIDE_FILINGS.filter(f => !w.outsideFilings.some(r => r.filingId === f.id && ['prepared_elsewhere', 'completed', 'not_required'].includes(String(r.status)) && r.responsible && r.body));
    if (missing.length) blockers.push(`${missing.length} outside filings need responsibility and disposition`);
  }
  if (includeSignature && w.standards.requireSignature) for (const client of packet.firm.client_users) {
    if (!w.signatures.some(s => s.actorId === client.id && s.cycle === w.cycle && s.contentRevision === contentRevision(state))) blockers.push(`current e-file authorization from ${client.name}`);
  }
  return blockers;
}
function text(value: unknown, label: string, max = 20000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Provide ${label} (up to ${max} characters).`);
  return maskSensitiveText(value.trim());
}
function staff(actor: Actor) {
  if (!['preparer', 'reviewer', 'partner', 'quality_reviewer'].includes(actor.role)) throw new Error('Only tax staff can make this change.');
}
function preparer(actor: Actor) { if (actor.role !== 'preparer') throw new Error('Only a preparer can change return inputs.'); }
function references(value: unknown, state: Workspace): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100 || value.some(v => typeof v !== 'string')) throw new Error('Provide valid source references.');
  const refs = [...new Set(value as string[])];
  for (const ref of refs) if (resolveSource(ref, 'st-01', 'v3', state).missing) throw new Error(`Source reference is unavailable: ${ref.slice(0, 100)}`);
  return refs;
}
function selectedIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 100 || value.some(v => typeof v !== 'string')) throw new Error('Select between one and 100 items.');
  return [...new Set(value as string[])];
}
function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error(`Provide a finite ${label}.`);
  return value;
}
function calendarDate(value: unknown): string {
  const date = text(value, 'a calendar date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Provide a valid calendar date.');
  return date;
}
function find(items: Entry[], id: unknown, label: string): Entry {
  const item = items.find(i => i.id === id);
  if (!item) throw new Error(`Choose an existing ${label}.`);
  return item;
}

/** All local operations share the workspace CAS, audit, permission and approval boundary. */
export function applyWorkflow(state: Workspace, command: Command, actor: Actor): Workspace {
  const action = text(command.action, 'workflow action', 80);
  const p = command.payload ?? {};
  const jurisdiction = p.jurisdiction ?? 'federal';
  if (['record_rejection', 'resubmit', 'record_acceptance'].includes(action) && !['federal', 'california'].includes(String(jurisdiction))) throw new Error('Choose federal or California.');
  const next = structuredClone(state); const w = workflowState(next); next.workpaper = w;
  const revision = state.revision + 1; const at = new Date().toISOString(); const id = `work-${action}-${revision}`;
  const entry = (values: Record<string, unknown> = {}): Entry => ({ id, actorId: actor.id, at, ...masked(values) });
  const preserve = (collection: string, key: string, previous: unknown) => {
    if (previous !== undefined) w.history.push(entry({ id: `history-${revision}-${collection}`, collection, key, previous: structuredClone(previous) }));
  };
  let material = false; let detail = ''; let targetId: string | undefined;
  const afterFreeze = new Set(['mark_seen', 'acknowledge', 'assign_task', 'complete_task', 'log_time', 'extension',
    'record_rejection', 'resubmit', 'record_acceptance', 'start_amendment', 'start_correction', 'notice_record', 'carry_forward', 'plan', 'add_question', 'answer_question', 'file_return', 'set_replay']);
  if (currentFrozen(state) && !afterFreeze.has(action)) throw new Error('Reviewed content is frozen. Start an amendment before changing it.');
  switch (action) {
    case 'verify_value': {
      staff(actor); const ref = text(p.ref, 'a source or line reference', 250); const method = text(p.method, 'verification method', 100);
      const source = resolveSource(ref, actor.id, 'v3', state);
      if (source.missing && !getBootstrap(actor.id, state).lines.some(l => l.key === ref)) throw new Error('Select a valid source or return-line reference.');
      if (!VERIFICATION_METHODS.includes(method)) throw new Error('Choose a firm verification method.');
      preserve('verifications', ref, w.verifications[ref]);
      w.verifications[ref] = entry({ ref, method, note: text(p.note, 'verification evidence'), revision });
      material = true; detail = `Verified ${ref}: ${method}`; break;
    }
    case 'document_disposition': {
      staff(actor); const documentId = text(p.documentId, 'document ID', 20);
      if (!packet.documents.some(d => d.id === documentId)) throw new Error('Select a supplied document.');
      if (!['used', 'unused', 'needs_review'].includes(String(p.status))) throw new Error('Choose a document disposition.');
      preserve('documents', documentId, w.documents[documentId]);
      w.documents[documentId] = entry({ documentId, status: p.status, reason: text(p.reason, 'a disposition reason') });
      material = true; detail = `Document ${documentId}: ${p.status}`; break;
    }
    case 'review_area': {
      staff(actor); const area = text(p.area, 'tax area', 150);
      if (!REVIEW_AREAS.includes(area) || !['reviewed', 'open'].includes(String(p.status))) throw new Error('Select a valid area and status.');
      preserve('areas', area, w.areas[area]);
      w.areas[area] = entry({ area, status: p.status, note: text(p.note, 'review conclusion') });
      material = true; detail = `Area ${area}: ${p.status}`; break;
    }
    case 'judgment': {
      staff(actor); if (!['election', 'due_diligence', 'penalty', 'judgment'].includes(String(p.category))) throw new Error('Select a judgment category.');
      w.judgments.push(entry({ category: p.category, title: text(p.title, 'decision title', 200), body: text(p.body, 'decision rationale'), sourceRefs: references(p.sourceRefs, state), authority: text(p.authority, 'authority relied on') }));
      material = true; detail = `Recorded ${p.category}: ${p.title}`; break;
    }
    case 'due_diligence': {
      staff(actor); const itemId = text(p.itemId, 'due-diligence item', 100);
      if (!REQUIRED_DILIGENCE.some(d => d.id === itemId) || !['applies', 'not_applicable'].includes(String(p.applicability))) throw new Error('Choose a required due-diligence item and applicability.');
      const refs = references(p.sourceRefs, state);
      if (!refs.length) throw new Error('Due diligence requires a source or calculation reference.');
      preserve('dueDiligence', itemId, w.dueDiligence[itemId]);
      w.dueDiligence[itemId] = entry({ itemId, applicability: p.applicability, conclusion: text(p.conclusion, 'due-diligence conclusion'), authority: text(p.authority, 'specific authority relied on'), sourceRefs: refs });
      material = true; detail = `Recorded due diligence for ${itemId}`; break;
    }
    case 'identifier_correction': {
      staff(actor); if (!actor.clearance) throw new Error('Clearance is required to correct a sensitive identifier.');
      const ref = text(p.ref, 'identifier source reference', 100);
      if (resolveSource(ref, actor.id, 'v3', state).missing) throw new Error('Choose an existing identifier source.');
      w.identifierCorrections.push(entry({ id: text(p.id, 'encrypted correction ID', 100), ref, reason: text(p.reason, 'correction reason'), status: 'encrypted', cycle: w.cycle }));
      material = true; detail = `Recorded encrypted identifier correction for ${ref}; original reading preserved`; break;
    }
    case 'add_question': {
      staff(actor); const recipient = getActor(text(p.recipientId, 'recipient', 30));
      w.questions.push(entry({ body: text(p.body, 'question'), recipientId: recipient.id, sourceRefs: references(p.sourceRefs, state), status: 'open', answers: [] }));
      w.notifications.push(entry({ recipientId: recipient.id, body: 'A workpaper question needs your response.', targetId: id, read: false }));
      detail = 'Opened an in-app question; no external message sent'; break;
    }
    case 'answer_question': {
      const q = find(w.questions, p.questionId, 'question');
      if (q.recipientId !== actor.id && actor.role !== 'partner') throw new Error('Only the assigned recipient or partner can answer this question.');
      const answers = Array.isArray(q.answers) ? q.answers : [];
      q.answers = [...answers, entry({ body: text(p.body, 'answer') })]; q.status = 'answered';
      w.notifications.push(entry({ recipientId: q.actorId, body: 'Your question has a new response.', targetId: q.id, read: false }));
      // Post-filing correspondence is appended without changing the frozen return. It is
      // evidence for a notice/amendment, never a silent modification of the filed snapshot.
      material = !currentFrozen(state); detail = 'Saved a response as linked evidence'; break;
    }
    case 'link_evidence': {
      staff(actor); const sourceRefs = references(p.sourceRefs, state);
      if (sourceRefs.length < 2) throw new Error('Choose at least two sources to link.');
      w.links.push(entry({ title: text(p.title, 'link description', 200), body: text(p.body, 'link rationale'), sourceRefs }));
      material = true; detail = 'Linked evidence across records, years or related returns'; break;
    }
    case 'attach_evidence': {
      staff(actor); const attachmentId = text(p.id, 'attachment ID', 100);
      if (w.attachments.some(a => a.id === attachmentId)) throw new Error('This attachment is already registered.');
      w.attachments.push(entry({ id: attachmentId, name: text(p.name, 'filename', 160), size: p.size,
        contentType: p.contentType, issueId: p.issueId ?? null, ...(p.sha256 ? { sha256: p.sha256 } : {}) }));
      material = true; detail = 'Registered private evidence attachment'; targetId = attachmentId; break;
    }
    case 'assign_task': {
      if (!['preparer', 'reviewer', 'partner', 'firm_administrator', 'quality_reviewer'].includes(actor.role)) throw new Error('Only staff can assign work.');
      const assignee = getActor(text(p.assigneeId, 'assignee', 30));
      const dueDate = calendarDate(p.dueDate);
      w.tasks.push(entry({ title: text(p.title, 'task title', 300), assigneeId: assignee.id, dueDate, sourceRefs: references(p.sourceRefs, state), status: 'open' }));
      w.notifications.push(entry({ recipientId: assignee.id, body: `Assigned: ${text(p.title, 'task title', 300)}`, targetId: id, read: false }));
      detail = `Assigned work to ${assignee.name}, due ${dueDate}`; break;
    }
    case 'complete_task': {
      const task = find(w.tasks, p.taskId, 'task');
      if (task.assigneeId !== actor.id && !['partner', 'firm_administrator'].includes(actor.role)) throw new Error('Only the assignee or engagement administrator can complete this task.');
      task.status = 'complete'; task.completedAt = at; detail = `Completed task ${task.title}`; break;
    }
    case 'mark_seen': w.lastSeen[actor.id] = revision; detail = `Acknowledged changes through revision ${state.revision}`; break;
    case 'acknowledge': {
      const notification = find(w.notifications, p.notificationId, 'notification');
      if (notification.recipientId !== actor.id) throw new Error('This notification belongs to another person.');
      notification.read = true; detail = 'Acknowledged notification'; break;
    }
    case 'save_scenario': {
      staff(actor); const scenarioId = text(p.scenarioId, 'scenario', 100);
      const scenario = packet.what_if.alternatives.find(s => s.id === scenarioId);
      if (!scenario) throw new Error('Choose a supplied computed what-if scenario.');
      w.scenarios.push(entry({ scenarioId, note: text(p.note, 'scenario rationale'), baseRevision: state.revision,
        baseline: 'v3', scenario: masked(scenario), status: 'sandbox' }));
      detail = 'Saved a what-if comparison; reviewed return unchanged'; break;
    }
    case 'bulk_adjust': {
      preparer(actor); const ids = selectedIds(p.issueIds); const reason = text(p.reason, 'bulk adjustment reason');
      const selections = ids.map(getIssue);
      if (selections.some(i => i.kind !== 'adjustment')) throw new Error('Bulk changes require numeric adjustment findings.');
      if (selections.some(i => w.lineAdjustments.some(a => a.status === 'active' && i.lineKeys.includes(String(a.lineKey))))) throw new Error('A general line overlay overlaps this batch. Undo the overlapping treatment first.');
      if (selections.some(i => next.adjustments.some(a => a.issueId === i.id && a.status === 'active'))) throw new Error('One or more selected adjustments is already active.');
      const adjustmentIds = selections.map((issue, index) => {
        const adjustmentId = `${id}-${index}`;
        next.adjustments.push({ id: adjustmentId, issueId: issue.id, actorId: actor.id, reason, createdAt: at,
          revision, original: issue.original, proposed: issue.proposed, taxEffect: { ...issue.taxEffect }, status: 'active' });
        return adjustmentId;
      });
      w.batches.push(entry({ adjustmentIds, issueIds: ids, reason, status: 'active' }));
      material = true; detail = `Accepted ${ids.length} adjustments atomically`; break;
    }
    case 'adjust_line': {
      preparer(actor); const lineKey = text(p.lineKey, 'return-line key', 100);
      const line = getBootstrap(actor.id, state).lines.find(l => l.key === lineKey);
      if (!line || typeof line.value !== 'number') throw new Error('Choose an existing numeric v3 line.');
      if (next.adjustments.some(a => a.status === 'active' && getIssue(a.issueId).lineKeys.includes(lineKey))) throw new Error('An accepted finding already affects this line. Undo the overlapping treatment first.');
      if (w.lineAdjustments.some(a => a.lineKey === lineKey && a.status === 'active')) throw new Error('Undo the active adjustment to this line before replacing it.');
      w.lineAdjustments.push(entry({ lineKey, label: line.label, original: line.value, proposed: number(p.proposed, 'proposed value'),
        reason: text(p.reason, 'adjustment reason'), sourceRefs: [...line.sources], status: 'active', cycle: w.cycle,
        taxEffect: { federal: number(p.federalEffect, 'federal estimate'), california: number(p.californiaEffect, 'California estimate'), method: 'User-entered estimate; dependencies and tax engine are not recomputed.' } }));
      material = true; detail = `Recorded reviewed overlay for ${lineKey}; baseline and dependent computations preserved`; break;
    }
    case 'undo_line': {
      preparer(actor); const adjustment = find(w.lineAdjustments, p.adjustmentId, 'line adjustment');
      if (adjustment.status !== 'active') throw new Error('Choose an active line adjustment.');
      adjustment.status = 'undone'; adjustment.undoReason = text(p.reason, 'undo reason'); adjustment.undoneAt = at;
      material = true; detail = 'Reversed line overlay; original and review history preserved'; break;
    }
    case 'reconcile': {
      staff(actor); const expected = number(p.expected, 'expected amount'); const actual = number(p.actual, 'actual amount');
      w.reconciliations.push(entry({ title: text(p.title, 'reconciliation title', 200), expected, actual,
        difference: Math.round((actual - expected) * 1e8) / 1e8, note: text(p.note, 'reconciliation conclusion'), sourceRefs: references(p.sourceRefs, state),
        status: expected === actual ? 'matched' : 'difference_documented' }));
      material = true; detail = 'Recorded independent reconciliation with source amounts and difference'; break;
    }
    case 'bind_original': {
      staff(actor); if (!actor.clearance) throw new Error('Clearance is required to bind a private original.');
      const documentId = text(p.documentId, 'document ID', 20);
      if (!packet.documents.some(d => d.id === documentId)) throw new Error('Choose a supplied source document.');
      const attachment = find(w.attachments, p.attachmentId, 'registered original attachment');
      preserve('originals', documentId, w.originals[documentId]);
      w.originals[documentId] = entry({ documentId, attachmentId: attachment.id, name: attachment.name, contentType: attachment.contentType,
        note: 'Linked original uses the existing document/page/field reference identity. Synthetic positions do not certify original layout.' });
      material = true; detail = `Bound a private original to stable source document ${documentId}`; break;
    }
    case 'set_replay': {
      if (actor.role === 'client') throw new Error('Season replay is available to the firm team.');
      if (p.eventId === null) {
        w.replayAt = null; delete w.replayEventId;
        detail = 'Left read-only season replay; current reviewed return unchanged'; break;
      }
      const event = packet.timeline.find(e => e.id === p.eventId);
      if (!event) throw new Error('Choose a supplied season event.');
      w.replayAt = event.at; w.replayEventId = event.id;
      detail = `Selected read-only season context ${event.id}; current reviewed return unchanged`; break;
    }
    case 'undo_bulk': {
      preparer(actor); const batch = find(w.batches, p.batchId, 'adjustment batch'); const reason = text(p.reason, 'bulk undo reason');
      if (batch.status !== 'active') throw new Error('That batch was already undone.');
      const ids = batch.adjustmentIds as string[];
      for (const a of next.adjustments.filter(a => ids.includes(a.id) && a.status === 'active')) {
        a.status = 'undone'; a.undoneAt = at; a.undoReason = reason;
      }
      batch.status = 'undone'; batch.undoReason = reason; batch.undoneAt = at;
      material = true; detail = 'Reversed bulk adjustments without deleting history'; break;
    }
    case 'extension': {
      staff(actor); w.extensions.push(entry({ note: text(p.note, 'extension decision'), reference: masked(packet.what_if.extension), status: 'recorded_simulation', cycle: w.cycle }));
      detail = 'Recorded extension simulation; payment deadline remains unchanged'; break;
    }
    case 'record_signature': {
      if (actor.role !== 'client') throw new Error('Only a client can record their e-file authorization.');
      if (p.attestation !== true) throw new Error('Confirm the e-file authorization attestation.');
      const name = text(p.name, 'signer name', 200);
      if (name.toLowerCase() !== actor.name.toLowerCase()) throw new Error('The typed signer must match the active client.');
      if (!next.signoffs.some(s => s.status === 'active' && s.level === 'partner' && s.contentRevision === contentRevision(state))) throw new Error('Partner review must be complete before e-file authorization.');
      w.signatures.push(entry({ name, attestation: true, cycle: w.cycle, contentRevision: contentRevision(state), status: 'simulated',
        statement: 'I reviewed this client copy and authorize the simulated e-file workflow. This is not a transmitted IRS signature.' }));
      detail = 'Client recorded simulated e-file authorization'; break;
    }
    case 'file_return': {
      if (actor.role !== 'partner') throw new Error('Only the partner can record filing.');
      const frozen = currentFrozen(state);
      if (!frozen) throw new Error('Freeze reviewed content before recording filing.');
      const blockers = workflowBlockers(state, true);
      if (blockers.length) throw new Error(`Filing is blocked: ${blockers.join(', ')}.`);
      if (w.filingEvents.some(e => e.cycle === w.cycle)) throw new Error('This cycle already has a submission. Use rejection/resubmission instead.');
      const note = text(p.note, 'filing record');
      for (const j of ['federal', 'california']) w.filingEvents.push(entry({ id: `${id}-${j}`, jurisdiction: j, cycle: w.cycle, status: 'submitted', filingId: frozen.id, note, simulated: true }));
      detail = 'Recorded filing simulation for both jurisdictions; no return transmitted'; break;
    }
    case 'record_rejection': {
      staff(actor); const last = [...w.filingEvents].reverse().find(e => e.cycle === w.cycle && (e.jurisdiction ?? 'federal') === jurisdiction);
      if (!last || last.status !== 'submitted') throw new Error('A submitted return is required before a rejection.');
      w.filingEvents.push(entry({ jurisdiction, cycle: w.cycle, status: 'rejected', code: text(p.code, 'rejection code', 100), reason: text(p.reason, 'rejection details'), simulated: true }));
      detail = 'Recorded simulated e-file rejection'; break;
    }
    case 'resubmit': {
      if (actor.role !== 'partner') throw new Error('Only the partner can record resubmission.');
      const last = [...w.filingEvents].reverse().find(e => e.cycle === w.cycle && (e.jurisdiction ?? 'federal') === jurisdiction);
      if (!last || last.status !== 'rejected') throw new Error('Record a rejection before resubmission.');
      const frozen = currentFrozen(state);
      if (!frozen || workflowBlockers(state, true).length) throw new Error('A current frozen and authorized snapshot is required.');
      w.filingEvents.push(entry({ jurisdiction, cycle: w.cycle, status: 'submitted', filingId: frozen.id, note: text(p.note, 'rejection correction and resubmission reason'), simulated: true }));
      detail = 'Recorded corrected transmission metadata; reviewed tax snapshot unchanged'; break;
    }
    case 'record_acceptance': {
      if (actor.role !== 'partner') throw new Error('Only the partner can record acceptance.');
      const last = [...w.filingEvents].reverse().find(e => e.cycle === w.cycle && (e.jurisdiction ?? 'federal') === jurisdiction);
      if (!last || last.status !== 'submitted') throw new Error('Record a submission before acceptance.');
      w.filingEvents.push(entry({ jurisdiction, cycle: w.cycle, status: 'accepted', confirmation: text(p.confirmation, 'agency confirmation', 200), simulated: true }));
      detail = 'Recorded simulated agency acceptance'; break;
    }
    case 'start_amendment': {
      if (actor.role !== 'partner') throw new Error('Only the partner can open an amendment.');
      const frozen = currentFrozen(state);
      if (!frozen) throw new Error('A frozen original return is required before amendment.');
      w.cycle += 1; w.amendments.push(entry({ originalFilingId: frozen.id, cycle: w.cycle, reason: text(p.reason, 'amendment reason'), openedAtRevision: revision }));
      material = true; detail = `Opened amendment ${w.cycle} above preserved snapshot ${frozen.id}`; break;
    }
    case 'start_correction': {
      if (actor.role !== 'partner') throw new Error('Only the partner can reopen a rejected submission.');
      const j = p.jurisdiction ?? 'federal';
      if (!['federal', 'california'].includes(String(j))) throw new Error('Choose the rejected jurisdiction.');
      const last = [...w.filingEvents].reverse().find(e => e.cycle === w.cycle && (e.jurisdiction ?? 'federal') === j);
      const frozen = currentFrozen(state);
      if (!frozen || last?.status !== 'rejected') throw new Error('A rejected frozen submission is required before reopening correction review.');
      w.cycle += 1;
      w.amendments.push(entry({ kind: 'rejection_correction', jurisdiction: j, originalFilingId: frozen.id, cycle: w.cycle, reason: text(p.reason, 'rejection correction reason'), openedAtRevision: revision }));
      material = true; detail = 'Opened rejection-correction review above preserved failed attempt; fresh approvals and signatures required'; break;
    }
    case 'notice_record': {
      staff(actor); w.notices.push(entry({ title: text(p.title, 'notice title', 200), body: text(p.body, 'notice response'), sourceRefs: references(p.sourceRefs, state), cycle: w.cycle }));
      detail = 'Saved notice response with linked evidence'; break;
    }
    case 'carry_forward': {
      staff(actor); const year = Number(p.year);
      if (!Number.isInteger(year) || year !== packet.household.tax_year + 1) throw new Error('This case carries forward into 2026.');
      if (!currentFrozen(state)) throw new Error('Freeze reviewed content before carrying it forward.');
      if (w.carryforwards.some(c => c.year === year && c.cycle === w.cycle)) throw new Error('This filing cycle is already carried forward.');
      const v = packet.return_versions.at(-1)!;
      w.carryforwards.push(entry({ year, cycle: w.cycle, note: text(p.note, 'handoff note'), sourceRevision: state.revision,
        carryovers: masked(v.carryovers_out), assets: masked(v.assets), priorBasis: masked(packet.prior_years.basis_records),
        history: { audit: structuredClone(state.audit), adjustments: structuredClone(state.adjustments), notes: structuredClone(state.notes),
          judgments: structuredClone(w.judgments), verifications: structuredClone(w.verifications), filingIds: state.filings.map(f => f.id),
          workpaper: structuredClone({ ...w, carryforwards: [] }), priorHandoffIds: w.carryforwards.map(c => c.id) },
        estimateWarning: 'Imported v3 carryovers are supplied engine outputs; reconcile reviewed overlays before preparing 2026.' }));
      detail = `Created ${year} handoff with source history and supplied carryovers`; break;
    }
    case 'plan': {
      staff(actor); const year = Number(p.year);
      if (!Number.isInteger(year) || year < 2026 || year > 2035) throw new Error('Choose a planning year from 2026 through 2035.');
      w.plans.push(entry({ title: text(p.title, 'planning title', 200), body: text(p.body, 'planning decision'), year, sourceRefs: references(p.sourceRefs, state) }));
      detail = `Recorded ${year} planning decision`; break;
    }
    case 'outside_filing': {
      staff(actor); const filingId = p.filingId === undefined ? null : text(p.filingId, 'outside filing ID', 100);
      const required = filingId ? REQUIRED_OUTSIDE_FILINGS.find(f => f.id === filingId) : undefined;
      if (filingId && !required) throw new Error('Choose an identified outside filing.');
      if (!['pending', 'prepared_elsewhere', 'completed', 'not_required'].includes(String(p.status))) throw new Error('Choose an outside filing disposition.');
      const oldIndex = filingId ? w.outsideFilings.findIndex(f => f.filingId === filingId) : -1;
      const updated = entry({ filingId, title: required?.title ?? text(p.title, 'outside filing', 500), status: p.status,
        responsible: text(p.responsible, 'responsible preparer or adviser', 300), dueDate: p.dueDate ? calendarDate(p.dueDate) : required?.dueDate || '',
        body: text(p.body, 'responsibility and conclusion'), sourceRefs: references(p.sourceRefs ?? required?.sourceRefs, state) });
      if (oldIndex >= 0) { preserve('outsideFilings', String(filingId), w.outsideFilings[oldIndex]); w.outsideFilings[oldIndex] = updated; }
      else w.outsideFilings.push(updated);
      material = true; detail = 'Documented outside filing and responsibility'; break;
    }
    case 'set_standards': {
      if (actor.role !== 'firm_administrator') throw new Error('Only the firm administrator can change standards.');
      preserve('standards', 'firm', w.standards);
      for (const k of ['requireAllDocuments', 'requireAllAreas', 'requireSignature', 'requireDueDiligence', 'requireOutsideFilings'] as const) {
        if (typeof p[k] === 'boolean') w.standards[k] = p[k];
      }
      for (const k of ['budgetHours', 'retentionYears', 'variancePercent', 'varianceAmount'] as const) {
        if (p[k] !== undefined) {
          const n = Number(p[k]); if (!Number.isFinite(n) || n < 0 || n > 100000 || (k === 'retentionYears' && n < 1)) throw new Error('Provide a valid positive firm setting.');
          w.standards[k] = n;
        }
      }
      material = true; detail = 'Firm administrator updated standards and engagement budget'; break;
    }
    case 'log_time': {
      if (actor.role === 'client') throw new Error('Only staff can record time.');
      const minutes = Number(p.minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error('Record between one and 1,440 minutes.');
      const area = p.area === undefined || p.area === '' ? 'General' : text(p.area, 'work area', 150);
      if (area !== 'General' && !REVIEW_AREAS.includes(area)) throw new Error('Choose a valid work area.');
      w.time.push(entry({ minutes, area, description: text(p.description, 'time description', 1000) }));
      detail = `Recorded ${minutes} minutes against engagement budget`; break;
    }
    default: throw new Error('That workflow action is not supported.');
  }
  if (material) for (const signoff of next.signoffs) if (signoff.status === 'active') {
    signoff.status = 'invalidated'; signoff.invalidatedAt = at; signoff.invalidatedByRevision = revision;
  }
  // Keep client signature records as evidence, but their contentRevision makes them stale
  // whenever a material change reopens review.
  next.revision = revision;
  next.audit.push({ id: `audit-${revision}`, revision, actorId: actor.id, type: `workflow:${action}`, at, material,
    detail: maskSensitiveText(detail), ...(targetId ? { targetId } : {}) });
  return next;
}

export function operationView(state: Workspace, actorId: string) {
  const actor = getActor(actorId); const w = workflowState(state);
  const jurisdictions = Object.fromEntries(['federal', 'california'].map(j => [j, [...w.filingEvents].reverse().find(e => e.cycle === w.cycle && (e.jurisdiction ?? 'federal') === j)?.status ?? (currentFrozen(state) ? 'frozen' : 'in_review')]));
  const cutoff = w.replayAt ? Date.parse(w.replayAt) : null;
  const replayReadModel = cutoff === null ? null : {
    eventId: w.replayEventId, at: w.replayAt, readOnly: true,
    availableDocIds: packet.documents.filter(d => Date.parse(d.received_at) <= cutoff).map(d => d.id),
    availableDocuments: packet.documents.filter(d => Date.parse(d.received_at) <= cutoff).map(d => ({ id: d.id, title: d.title, receivedAt: d.received_at })),
    versions: packet.return_versions.filter(v => Date.parse(v.computed_at) <= cutoff).map(v => ({ version: v.version, computedAt: v.computed_at })),
    events: packet.timeline.filter(e => Date.parse(e.at) <= cutoff),
    note: 'Historical read-only availability view. Current v3 review decisions are not rewound or rewritten.',
  };
  return masked({ workpaper: w, areas: REVIEW_AREAS, verificationMethods: VERIFICATION_METHODS,
    blockers: workflowBlockers(state, true), unseenEvents: state.audit.filter(e => e.revision > (w.lastSeen[actor.id] ?? 0)),
    notifications: w.notifications.filter(n => n.recipientId === actor.id && !n.read),
    replayReadModel, requiredDiligence: REQUIRED_DILIGENCE, requiredOutsideFilings: REQUIRED_OUTSIDE_FILINGS,
    defaults: { deadlines: packet.firm.deadlines, assignments: packet.firm.assignment_at_start,
      budget: packet.firm.budget_hours, standards: packet.firm.starter_standards,
      outsideFilings: packet.household.related_returns, extension: packet.what_if.extension,
      planning: packet.planning_reference_2026, postFilingRates: packet.post_filing_rates },
    jurisdictions, status: Object.values(jurisdictions).includes('rejected') ? 'rejected' : Object.values(jurisdictions).every(s => s === 'accepted') ? 'accepted' : Object.values(jurisdictions).includes('submitted') ? 'submitted' : currentFrozen(state) ? 'frozen' : 'in_review',
    timeMinutes: w.time.reduce((sum, e) => sum + Number(e.minutes || 0), 0) });
}
