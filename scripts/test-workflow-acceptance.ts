/** Isolated end-to-end domain acceptance for the case brief's people,
 * completeness, change, filing, amendment and handoff requirements.
 * Every conclusion below is a synthetic test decision, not tax advice.
 */
import assert from 'node:assert/strict';
import packet from '../data/packet.json';
import { applyCommand, initialWorkspace, unresolvedIssues } from '../lib/domain';
import { issues } from '../lib/issues';
import { getActor, resolveSource } from '../lib/packet';
import { operationView, REQUIRED_DILIGENCE, REQUIRED_OUTSIDE_FILINGS, REVIEW_AREAS, workflowBlockers, workflowState } from '../lib/workflow';
import type { Command, Workspace } from '../lib/contracts';

const workflow = (state: Workspace, action: string, payload: Record<string, unknown> = {}, actor = 'st-01') =>
  applyCommand(state, { type: 'workflow', action, payload, expectedRevision: state.revision }, actor);
function rejects(state: Workspace, action: () => unknown, pattern: RegExp) {
  const before = JSON.stringify(state);
  assert.throws(action, pattern);
  assert.equal(JSON.stringify(state), before, 'Rejected actions must not partially change the caller state.');
}

let state = initialWorkspace();
assert(workflowBlockers(state).some(blocker => /74 documents/.test(blocker)), 'New and legacy workspaces must enforce firm completeness defaults.');
assert(workflowBlockers(state).some(blocker => /13 tax areas/.test(blocker)));
assert(workflowBlockers(state).some(blocker => /5 due-diligence/.test(blocker)));
assert(workflowBlockers(state).some(blocker => /outside filings/.test(blocker)));
assert.equal(workflowState(state).outsideFilings.length, REQUIRED_OUTSIDE_FILINGS.length);
rejects(state, () => workflow(state, 'verify_value', { ref: 'ev-0492', method: 'recalculated', note: 'Test verification' }, 'cu-01'), /staff/);
rejects(state, () => workflow(state, 'set_standards', { budgetHours: 42 }), /administrator/);
rejects(state, () => workflow(state, 'bulk_adjust', { issueIds: ['duplicate-interest'], reason: 'Test' }, 'st-02'), /preparer/);
rejects(state, () => workflow(state, 'verify_value', { ref: 'ev-does-not-exist', method: 'recalculated', note: 'Test' }), /valid source|unavailable/);

state = workflow(state, 'verify_value', { ref: 'ev-0492', method: 'agreed_to_source_document', note: 'Independent fixture: same bank sweep compared to source.' });
const verification = workflowState(state).verifications['ev-0492'];
assert.equal(verification.actorId, 'st-01');
assert.equal(verification.method, 'agreed_to_source_document');
assert.equal(verification.revision, state.revision);
state = workflow(state, 'verify_value', { ref: 'ev-0492', method: 'recalculated', note: 'Second verification fixture retains the original conclusion.' });
assert(JSON.stringify(state).includes('Independent fixture: same bank sweep compared to source.'), 'Replacing a verification cannot erase its previous evidence note.');
state = workflow(state, 'document_disposition', { documentId: 'D01', status: 'needs_review', reason: 'First disposition fixture must remain in history.' });
state = workflow(state, 'document_disposition', { documentId: 'D01', status: 'used', reason: 'Second disposition fixture replaces the current status only.' });
assert(JSON.stringify(state).includes('First disposition fixture must remain in history.'));
state = workflow(state, 'review_area', { area: REVIEW_AREAS[0], status: 'open', note: 'First area conclusion fixture must remain in history.' });
state = workflow(state, 'review_area', { area: REVIEW_AREAS[0], status: 'reviewed', note: 'Second area conclusion fixture replaces the current status only.' });
assert(JSON.stringify(state).includes('First area conclusion fixture must remain in history.'));
state = workflow(state, 'link_evidence', {
  title: 'Prior basis to current return', body: 'Synthetic fixture link preserves both year references.',
  sourceRefs: ['ev-0492', 'packet:/prior_years/basis_records'],
});
const link = workflowState(state).links.at(-1)!;
assert(!resolveSource(`local:link:${link.id}`, 'st-01', 'v3', state).missing);
rejects(state, () => workflow(state, 'link_evidence', { title: 'Invalid link', body: 'Test', sourceRefs: ['ev-0492', 'missing-reference'] }), /unavailable/);

// A batch either succeeds in one audited revision or makes no change.
const beforeBulk = JSON.stringify(state);
rejects(state, () => workflow(state, 'bulk_adjust', { issueIds: ['duplicate-interest', 'crypto-basis'], reason: 'Synthetic rejected batch.' }), /numeric adjustment/);
assert.equal(JSON.stringify(state), beforeBulk);
const bulkRevision = state.revision;
state = workflow(state, 'bulk_adjust', { issueIds: ['duplicate-interest', 'federal-payments', 'duplicate-interest'], reason: 'Synthetic fixture: independently reconciled source pair.' });
assert.equal(state.revision, bulkRevision + 1);
assert.equal(state.adjustments.length, 2, 'Duplicate selection IDs cannot apply the same adjustment twice.');
assert.equal(state.audit.at(-1)?.type, 'workflow:bulk_adjust');
const batch = workflowState(state).batches.at(-1)!;
state = workflow(state, 'undo_bulk', { batchId: batch.id, reason: 'Synthetic fixture: test reversible multi-item changes.' });
assert(state.adjustments.every(adjustment => adjustment.status === 'undone'));
assert.equal(state.adjustments.length, 2, 'Undo retains original adjustment records.');
assert.equal(workflowState(state).batches.at(-1)?.status, 'undone');
assert(unresolvedIssues(state).some(issue => issue.id === 'duplicate-interest'));

const beforeScenario = JSON.stringify(state.adjustments);
state = workflow(state, 'save_scenario', { scenarioId: 'hvac_improvement', note: 'Synthetic comparison only; never adopted as a return recomputation.' });
assert.equal(JSON.stringify(state.adjustments), beforeScenario);
const scenario = workflowState(state).scenarios.at(-1)!;
assert.equal(scenario.status, 'sandbox');
assert.deepEqual(scenario.scenario, packet.what_if.alternatives.find(item => item.id === 'hvac_improvement'));
assert.equal(state.audit.at(-1)?.material, false, 'A sandbox comparison must leave approved tax content unchanged.');

// In-app questions are assigned, answered by the right person, and become evidence.
state = workflow(state, 'add_question', { recipientId: 'cu-02', body: 'Synthetic fixture: please describe the transfer-in basis evidence.', sourceRefs: ['msg-07'] });
const question = workflowState(state).questions.at(-1)!;
assert(operationView(state, 'cu-02').notifications.some(notification => notification.targetId === question.id));
rejects(state, () => workflow(state, 'answer_question', { questionId: question.id, body: 'Wrong client response.' }, 'cu-01'), /recipient/);
state = workflow(state, 'answer_question', { questionId: question.id, body: 'Synthetic fixture answer: original trade record still required.' }, 'cu-02');
assert.equal(workflowState(state).questions.at(-1)?.status, 'answered');
assert.match(resolveSource(`local:question:${question.id}`, 'st-01', 'v3', state).text ?? '', /original trade record/);
assert(state.audit.at(-1)?.material, 'A new pre-filing client answer must reopen reviewed content.');
state = workflow(state, 'assign_task', { title: 'Synthetic fixture: review client answer', assigneeId: 'st-02', dueDate: '2026-10-30', sourceRefs: [`local:question:${question.id}`] });
rejects(state, () => workflow(state, 'assign_task', { title: 'Impossible calendar date fixture', assigneeId: 'st-02', dueDate: '2026-02-31' }), /valid deadline|calendar|date/);
const task = workflowState(state).tasks.at(-1)!;
rejects(state, () => workflow(state, 'complete_task', { taskId: task.id }, 'cu-01'), /assignee/);
state = workflow(state, 'complete_task', { taskId: task.id }, 'st-02');
assert.equal(workflowState(state).tasks.at(-1)?.status, 'complete');
state = workflow(state, 'log_time', { minutes: 35, description: 'Synthetic acceptance fixture.' }, 'st-02');
assert.equal(operationView(state, 'st-02').timeMinutes, 35);
rejects(state, () => workflow(state, 'log_time', { minutes: 1, description: 'Client cannot bill time.' }, 'cu-01'), /staff/);
state = workflow(state, 'mark_seen', {}, 'st-02');
assert.equal(workflowState(state).lastSeen['st-02'], state.revision);
assert.equal(operationView(state, 'st-02').unseenEvents.length, 0, 'Acknowledging activity cannot immediately create an unseen acknowledgment.');
state = workflow(state, 'extension', { note: 'Synthetic fixture records supplied April estimate; no payment transmitted.' });
assert.deepEqual(workflowState(state).extensions.at(-1)?.reference, packet.what_if.extension);
assert.equal(operationView(state, 'st-02').unseenEvents.length, 1, 'A subsequent colleague action becomes unseen.');
const baseline = packet.return_versions.at(-1)!.lines.find(line => line.key === 'F1040.2b')!;
rejects(state, () => workflow(state, 'adjust_line', { lineKey: 'F1040.2b', proposed: Number.NaN, federalEffect: 0, californiaEffect: 0, reason: 'Invalid number fixture.' }), /finite/);
state = workflow(state, 'adjust_line', { lineKey: 'F1040.2b', proposed: -100, federalEffect: -20, californiaEffect: -5,
  reason: 'Synthetic independent overlay fixture; never a corrected engine result.' });
const manualLine = workflowState(state).lineAdjustments.at(-1)!;
assert.equal(manualLine.original, baseline.value);
assert.equal(manualLine.proposed, -100, 'Numeric overlays preserve the sign rather than silently dropping losses.');
assert.equal(packet.return_versions.at(-1)!.lines.find(line => line.key === 'F1040.2b')!.value, baseline.value);
rejects(state, () => applyCommand(state, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Overlapping curated correction fixture.' }, 'st-01'), /overlap|overlay|line adjustment/);
rejects(state, () => workflow(state, 'bulk_adjust', { issueIds: ['duplicate-interest'], reason: 'Overlapping batch correction fixture.' }), /overlap|overlay|line adjustment/);
rejects(state, () => workflow(state, 'adjust_line', { lineKey: 'F1040.2b', proposed: 200, federalEffect: 0, californiaEffect: 0, reason: 'Duplicate overlay.' }), /active adjustment/);
state = workflow(state, 'undo_line', { adjustmentId: manualLine.id, reason: 'Synthetic overlay reversal test.' });
assert.equal(workflowState(state).lineAdjustments.at(-1)?.status, 'undone');
state = workflow(state, 'reconcile', { title: 'Synthetic source reconciliation', expected: 1840, actual: 3680,
  note: 'Synthetic fixture records an unexplained duplicate instead of asserting agreement.', sourceRefs: ['ev-0492', 'ev-0538'] });
assert.equal(workflowState(state).reconciliations.at(-1)?.difference, 1840);
assert.equal(workflowState(state).reconciliations.at(-1)?.status, 'difference_documented');
const firstEvent = packet.timeline[0];
state = workflow(state, 'set_replay', { eventId: firstEvent.id });
const replay = operationView(state, 'st-01').replayReadModel;
assert(replay?.readOnly, 'Season replay cannot silently replace the current reviewed return.');
assert.equal(replay.eventId, firstEvent.id);
assert.deepEqual(replay.availableDocIds, packet.documents.filter(document => Date.parse(document.received_at) <= Date.parse(firstEvent.at)).map(document => document.id));
assert.deepEqual(replay.versions.map(version => version.version), packet.return_versions.filter(version => Date.parse(version.computed_at) <= Date.parse(firstEvent.at)).map(version => version.version));
assert.equal(state.audit.at(-1)?.material, false);
rejects(state, () => workflow(state, 'set_replay', { eventId: firstEvent.id }, 'cu-01'), /firm team/);
state = workflow(state, 'attach_evidence', { id: 'synthetic-original-fixture', name: 'Synthetic original fixture.pdf', size: 10, contentType: 'application/pdf' });
rejects(state, () => workflow(state, 'bind_original', { documentId: 'D62', attachmentId: 'does-not-exist' }), /existing|registered/);
rejects(state, () => workflow(state, 'bind_original', { documentId: 'D62', attachmentId: 'synthetic-original-fixture' }, 'st-04'), /Clearance/);
state = workflow(state, 'bind_original', { documentId: 'D62', attachmentId: 'synthetic-original-fixture' });
assert.equal(workflowState(state).originals.D62.attachmentId, 'synthetic-original-fixture');

// Complete the numeric and judgment queue using clearly labeled synthetic decisions.
for (const issue of issues) {
  const command: Command = issue.kind === 'adjustment'
    ? { type: 'accept_adjustment', issueId: issue.id, reason: 'Synthetic acceptance fixture: source reviewed, not a real filing conclusion.' }
    : { type: 'save_investigation', issueId: issue.id, body: 'Synthetic acceptance fixture: source evidence and the supplied case rule reviewed, not a real tax conclusion.', result: 'resolved',
      authority: 'Supplied case rule and source evidence, used only to test workflow gates.', sourceRefs: issue.sourceRefs } as Command;
  state = applyCommand(state, command, 'st-01');
}
assert.equal(unresolvedIssues(state).length, 0);
rejects(state, () => workflow(state, 'adjust_line', { lineKey: 'F1040.2b', proposed: 200, federalEffect: 0, californiaEffect: 0, reason: 'Cannot add a second estimate for an already accepted curated correction.' }), /overlap|curated|finding/);
rejects(state, () => applyCommand(state, { type: 'sign_off' }, 'st-02'), /documents|areas/);
for (const document of packet.documents) state = workflow(state, 'document_disposition', {
  documentId: document.id, status: 'used', reason: 'Synthetic completeness fixture: document reviewed for acceptance test only.',
});
rejects(state, () => applyCommand(state, { type: 'sign_off' }, 'st-02'), /areas/);
for (const area of REVIEW_AREAS) state = workflow(state, 'review_area', {
  area, status: 'reviewed', note: 'Synthetic completeness fixture: tax area considered for acceptance test only.',
});
rejects(state, () => applyCommand(state, { type: 'sign_off' }, 'st-02'), /due-diligence|outside filings/);
rejects(state, () => workflow(state, 'due_diligence', { itemId: REQUIRED_DILIGENCE[0].id, applicability: 'not_applicable', conclusion: 'Missing authority fixture.', sourceRefs: ['packet:/household/filing_status'] }), /authority/);
rejects(state, () => workflow(state, 'due_diligence', { itemId: REQUIRED_DILIGENCE[0].id, applicability: 'not_applicable', conclusion: 'Missing source fixture.', authority: 'Synthetic case reference only.' }), /source|reference/);
for (const item of REQUIRED_DILIGENCE) state = workflow(state, 'due_diligence', { itemId: item.id, applicability: 'not_applicable',
  conclusion: 'Synthetic applicability fixture only; not a real eligibility conclusion.', authority: 'Supplied household facts and case rules, used only to exercise completeness gates.', sourceRefs: ['packet:/household/filing_status'] });
rejects(state, () => applyCommand(state, { type: 'sign_off' }, 'st-02'), /outside filings/);
rejects(state, () => workflow(state, 'outside_filing', { filingId: REQUIRED_OUTSIDE_FILINGS[0].id, status: 'prepared_elsewhere', body: 'Missing responsible adviser fixture.' }), /responsible/);
for (const filing of REQUIRED_OUTSIDE_FILINGS) state = workflow(state, 'outside_filing', { filingId: filing.id, status: 'prepared_elsewhere',
  responsible: 'Synthetic separate adviser fixture', dueDate: filing.dueDate || '2026-10-15', body: 'Synthetic fixture records responsibility and disposition; no outside filing was made.', sourceRefs: filing.sourceRefs });
assert.deepEqual(workflowBlockers(state), []);
rejects(state, () => workflow(state, 'judgment', { category: 'election', title: 'Missing authority', body: 'Insufficient explicit authority.', sourceRefs: ['ev-0492'] }), /authority/);
const reviewerPrepared = workflow(state, 'judgment', {
  category: 'election', title: 'Reviewer-authored preparation', body: 'Synthetic substantive election conclusion.',
  authority: 'Supplied equipment alternative; acceptance fixture only.', sourceRefs: ['packet:/what_if/alternatives/0'],
}, 'st-02');
rejects(reviewerPrepared, () => applyCommand(reviewerPrepared, { type: 'sign_off' }, 'st-02'), /work you prepared|independent/);
const reviewerCorrection = workflow(state, 'identifier_correction', { id: 'synthetic-encrypted-correction-id', ref: 'ev-1045', reason: 'Synthetic metadata fixture; no plaintext identifier.' }, 'st-02');
rejects(reviewerCorrection, () => applyCommand(reviewerCorrection, { type: 'sign_off' }, 'st-02'), /work you prepared|independent/);

state = applyCommand(state, { type: 'sign_off' }, 'st-02');
state = applyCommand(state, { type: 'sign_off' }, 'st-03');
state = applyCommand(state, { type: 'client_approve' }, 'cu-01');
rejects(state, () => applyCommand(state, { type: 'freeze' }, 'st-03'), /authorization|signature/);
for (const client of ['cu-01', 'cu-02']) {
  state = workflow(state, 'record_signature', { name: getActor(client).name, attestation: true }, client);
  if (client === 'cu-01') rejects(state, () => applyCommand(state, { type: 'freeze' }, 'st-03'), /authorization|signature/);
}

// Every material evidence change invalidates all approvals and signatures by revision.
const approved = state;
const changed = workflow(approved, 'verify_value', { ref: 'ev-0492', method: 'recalculated', note: 'Synthetic new evidence after approvals.' });
assert(changed.signoffs.every(signoff => signoff.status === 'invalidated'));
assert(workflowBlockers(changed, true).some(blocker => /authorization|signature/.test(blocker)));
assert(approved.signoffs.every(signoff => signoff.status === 'active'), 'Reducer must preserve the previous approved state.');
const newEvidence = workflow(approved, 'attach_evidence', { id: 'synthetic-evidence-fixture', name: 'Synthetic acceptance fixture.txt', size: 10, contentType: 'text/plain', issueId: 'duplicate-interest' });
assert(newEvidence.signoffs.every(signoff => signoff.status === 'invalidated'), 'Private attachment registration must invalidate prior approvals.');
assert(workflowBlockers(newEvidence, true).some(blocker => /authorization|signature/.test(blocker)));
state = applyCommand(approved, { type: 'freeze' }, 'st-03');
const original = structuredClone(state.filings[0]);
assert.equal(original.cycle ?? 0, 0);
assert(original.snapshot.workpaper, 'Frozen content includes verification, judgment and correspondence records.');
rejects(state, () => workflow(state, 'verify_value', { ref: 'ev-0492', method: 'recalculated', note: 'Cannot alter filed content.' }), /frozen/);
rejects(state, () => workflow(state, 'adjust_line', { lineKey: 'F1040.2b', proposed: -200, federalEffect: -20, californiaEffect: -5, reason: 'Cannot alter filed content.' }), /frozen/);
rejects(state, () => workflow(state, 'bind_original', { documentId: 'D62', attachmentId: 'synthetic-original-fixture' }), /frozen/);
rejects(state, () => workflow(state, 'start_amendment', { reason: 'Unauthorized amendment.' }), /partner/);
state = workflow(state, 'file_return', { note: 'Synthetic test submission; no transmission.' }, 'st-03');
assert.equal(operationView(state, 'st-03').status, 'submitted');
state = workflow(state, 'record_rejection', { code: 'TEST-REJECT', reason: 'Synthetic transmission metadata issue.' }, 'st-02');
assert.equal(operationView(state, 'st-03').status, 'rejected');
const correctionCycle = workflow(state, 'start_correction', { jurisdiction: 'federal', reason: 'Synthetic fixture: typed identifier correction requires fresh review.' }, 'st-03');
assert.equal(workflowState(correctionCycle).cycle, 1);
assert.equal(workflowState(correctionCycle).amendments.at(-1)?.kind, 'rejection_correction');
assert.equal(workflowState(correctionCycle).amendments.at(-1)?.originalFilingId, original.id);
assert(correctionCycle.signoffs.every(signoff => signoff.status === 'invalidated'));
assert.deepEqual(correctionCycle.filings[0], original);
rejects(correctionCycle, () => workflow(correctionCycle, 'file_return', { note: 'Cannot submit corrections without new reviewed frozen record.' }, 'st-03'), /Freeze|frozen/);
state = workflow(state, 'resubmit', { note: 'Synthetic test metadata corrected.' }, 'st-03');
state = workflow(state, 'record_acceptance', { confirmation: 'SYNTHETIC-ACCEPTANCE-NOT-TRANSMITTED' }, 'st-03');
assert.equal(operationView(state, 'st-03').jurisdictions.federal, 'accepted');
assert.equal(operationView(state, 'st-03').jurisdictions.california, 'submitted', 'Federal acceptance cannot imply California acceptance.');
assert.equal(operationView(state, 'st-03').status, 'submitted');
state = workflow(state, 'record_acceptance', { jurisdiction: 'california', confirmation: 'SYNTHETIC-CALIFORNIA-ACCEPTANCE' }, 'st-03');
assert.equal(operationView(state, 'st-03').status, 'accepted');
assert(workflowState(state).filingEvents.every(event => event.simulated === true));
state = workflow(state, 'notice_record', { title: 'Synthetic examiner request', body: 'Source page and verification rationale supplied.', sourceRefs: ['doc:D31#page32', 'ev-0492'] });
assert(!resolveSource(`local:notice:${workflowState(state).notices.at(-1)!.id}`, 'st-01', 'v3', state).missing);
state = workflow(state, 'carry_forward', { year: 2026, note: 'Synthetic fixture: overlays require reconciliation before next-year preparation.' });
const handoff = workflowState(state).carryforwards.at(-1)!;
assert.deepEqual(handoff.carryovers, packet.return_versions.at(-1)!.carryovers_out);
assert(handoff.history && typeof handoff.history === 'object');
state = workflow(state, 'plan', { title: 'Synthetic 2026 estimates', body: 'Use supplied safe-harbor reference and reconcile changed facts.', year: 2026, sourceRefs: ['packet:/planning_reference_2026'] });
assert.deepEqual(state.filings[0], original, 'Post-filing correspondence and next-year planning cannot rewrite the original snapshot.');
state = workflow(state, 'start_amendment', { reason: 'Synthetic fixture: later evidence requires revised reviewed return.' }, 'st-03');
assert.equal(workflowState(state).cycle, 1);
assert.equal(workflowState(state).amendments.at(-1)?.originalFilingId, original.id);
assert(state.signoffs.every(signoff => signoff.status === 'invalidated'));
state = workflow(state, 'verify_value', { ref: 'ev-0492', method: 'recalculated', note: 'Synthetic amendment evidence review.' });
assert.deepEqual(state.filings[0], original);
rejects(state, () => applyCommand(state, { type: 'freeze' }, 'st-03'), /approval|authorization|signature/);
console.log('Independent workflow acceptance passed: default completeness gates, permissions, recorded verification, linked evidence, atomic bulk/undo, isolated what-if, assigned questions and answers, tasks/notifications/time, authority and independence, revision-bound approvals/signatures, frozen filing, rejection/resubmission, notice, 2026 handoff, planning and preserved amendment ancestry.');
