/** Run with tsx, or compile this entry with tsc to a temporary CommonJS directory. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { applyCommand, initialWorkspace, unresolvedIssues } from '../lib/domain';
import { getBootstrap, getDocument, getVersionLines, resolveSource, traceLine } from '../lib/packet';
import { issues } from '../lib/issues';
import type { Command, Workspace } from '../lib/contracts';

const originalPath = '/Users/rajendrathalluru/Documents/miraflores/okafor_lindqvist_2025_packet.json';
const packetPath = `${process.cwd()}/data/packet.json`;
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const beforeHash = digest(packetPath);
if (existsSync(originalPath)) assert.equal(beforeHash, digest(originalPath), 'Imported packet must be byte-for-byte unchanged.');
assert.equal(beforeHash, 'ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19');

const initial = initialWorkspace();
const initialJson = JSON.stringify(initial);
assert.equal(initial.revision, 0);
for (const [key, value] of Object.entries(initial)) if (key !== 'revision') assert.deepEqual(value, []);

assert.throws(() => applyCommand(initial, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Verified source' }, 'cu-01'), /Only a preparer/);
assert.throws(() => applyCommand(initial, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Verified source' }, 'st-02'), /Only a preparer/);
assert.throws(() => applyCommand(initial, { type: 'accept_adjustment', issueId: 'duplicate-interest' }, 'st-01'), /Explain why/);
assert.throws(() => applyCommand(initial, { type: 'freeze' }, 'st-03'), /Filing is blocked/);
assert.throws(() => getBootstrap('invented-role', initial), /valid workspace role/);
assert.throws(() => applyCommand(initial, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Verified', expectedRevision: 9 }, 'st-01'), /another session/);
assert.equal(JSON.stringify(initial), initialJson, 'Rejected commands must not mutate state.');

let state = applyCommand(initial, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Same sweep interest verified on both source forms.' }, 'st-01');
assert.equal(state.revision, 1);
assert.equal(state.audit.length, 1);
assert.equal(state.adjustments[0].status, 'active');
assert.equal(initial.adjustments.length, 0, 'The reducer must return an independent state.');
assert.throws(() => applyCommand(state, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Duplicate' }, 'st-01'), /already active/);
assert.throws(() => applyCommand(state, { type: 'save_investigation', issueId: 'receipts-overlap', body: 'Reviewed', result: 'resolved' }, 'st-02'), /must be accepted/);
assert.throws(() => applyCommand(state, { type: 'accept_adjustment', issueId: 'crypto-basis', reason: 'Guess' }, 'st-01'), /documented judgment/);

state = applyCommand(state, { type: 'undo_adjustment', adjustmentId: state.adjustments[0].id, reason: 'Reopen for more evidence.' }, 'st-01');
assert.equal(state.adjustments[0].status, 'undone');
assert.equal(state.adjustments[0].undoReason, 'Reopen for more evidence.');
assert.equal(state.audit.length, 2);
assert(unresolvedIssues(state).some(issue => issue.id === 'duplicate-interest'));

state = applyCommand(state, { type: 'save_investigation', issueId: 'crypto-basis', body: 'Documented basis uncertainty and authority in the case record.', result: 'resolved',
  authority: 'Supplied packet basis rule; synthetic test conclusion only.', sourceRefs: ['ev-0918', 'ev-0919'] } as Command, 'st-01');
assert(!unresolvedIssues(state).some(issue => issue.id === 'crypto-basis'));
state = applyCommand(state, { type: 'save_investigation', issueId: 'crypto-basis', body: 'Contradictory evidence arrived; reopen.', result: 'open' }, 'st-01');
assert(unresolvedIssues(state).some(issue => issue.id === 'crypto-basis'), 'The latest investigation must reopen a previously resolved issue.');
assert(getBootstrap('st-01', state).stats.openHighIssues > 0);

const bootstrap = getBootstrap('st-04', state);
assert.equal(bootstrap.stats.documentCount, 74);
assert.equal(bootstrap.stats.pageCount, 199);
assert.equal(bootstrap.stats.valueCount, 3012);
assert.equal(Object.keys(bootstrap.sourceIndex).length, 3211);
assert.equal(bootstrap.issues.length, 16);
const lineKeys = new Set(getVersionLines().map(line => line.key));
for (const version of ['v1', 'v2', 'v3']) {
  const refs = new Set(getVersionLines(version).flatMap(line => line.sources));
  for (const ref of refs) assert(!resolveSource(ref, 'st-01', version).missing, `${version} has unresolved source ${ref}`);
}
for (const issue of issues) {
  for (const key of issue.lineKeys) assert(lineKeys.has(key), `${issue.id} has missing line ${key}`);
  for (const ref of issue.sourceRefs) assert(!resolveSource(ref).missing, `${issue.id} has missing source ${ref}`);
}

const raw = JSON.parse(readFileSync(packetPath, 'utf8'));
const publicReads = JSON.stringify([
  bootstrap, getDocument('D03', 'st-04', state), getDocument('D08', 'st-01', state),
  getDocument('D36', 'st-01', state), getDocument('D71', 'cu-01', state),
  resolveSource('household:ngozi'), traceLine('F2441.1b'),
]);
for (const person of raw.household.people) {
  for (const key of ['ssn', 'ip_pin', 'phone', 'email', 'dob']) {
    if (person[key]) assert(!publicReads.includes(person[key]), `${key} leaked in a public read`);
  }
}
for (const key of ['routing', 'account']) assert(!publicReads.includes(raw.household.bank_account_for_refund_or_payment[key]), `Bank ${key} leaked`);
assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(publicReads), 'SSN patterns must be absent.');
assert(!/\b\d{2}-\d{7}\b/.test(publicReads), 'Provider/employer tax IDs must be absent.');
assert.equal(resolveSource('ref:fx.SEK.2025_average').text, '9.86');
assert(!resolveSource('asset:STU-PRINTER').missing, 'Current-year equipment source must resolve.');
assert(!resolveSource('asset:SAC-BLDG').missing, 'Legacy asset source must resolve.');
for (const ref of ['qa-25', 'msg-07', 'call-01', 'agency:/ftb_account']) assert(!resolveSource(ref).missing);
const trace = traceLine('F1040.2b');
assert(trace.nodes.some(node => node.type === 'rule'));
assert(trace.nodes.some(node => node.evidence?.documentId === 'D29'));
assert(trace.edges.some(edge => edge.relation === 'input'));

// Resolve the initial queue in an isolated scenario, then exercise the entire review gate.
// Isolate the original approval lifecycle tests from completeness/signature gates.
// The separate independent workflow acceptance suite exercises every default gate
// with all 74 document dispositions, all 13 tax areas, required due diligence,
// outside-filing responsibilities and both client signatures.
let ready: Workspace = applyCommand(initialWorkspace(), { type: 'workflow', action: 'set_standards', payload: {
  requireAllDocuments: false, requireAllAreas: false, requireSignature: false,
  requireDueDiligence: false, requireOutsideFilings: false,
} }, 'st-05');
for (const issue of issues) {
  if (issue.kind === 'adjustment') ready = applyCommand(ready, { type: 'accept_adjustment', issueId: issue.id, reason: 'Source evidence verified for this test scenario.' }, 'st-01');
  else ready = applyCommand(ready, { type: 'save_investigation', issueId: issue.id, body: 'Test scenario judgment with source evidence and documented authority; not an assertion about real tax filing readiness.', result: 'resolved',
    authority: 'Supplied packet rule and cited case evidence; synthetic test scenario only.', sourceRefs: issue.sourceRefs } as Command, 'st-01');
}
assert.equal(unresolvedIssues(ready).length, 0);
assert.throws(() => applyCommand(ready, { type: 'sign_off', level: 'reviewer' }, 'st-01'), /independent reviewer/);
// A reviewer who authors a judgment cannot independently sign it off.
const selfReview = applyCommand(ready, { type: 'save_investigation', issueId: 'crypto-basis', body: 'Reviewer authored substantive conclusion.', result: 'resolved',
  authority: 'Supplied packet basis rule; synthetic test scenario only.', sourceRefs: ['ev-0918', 'ev-0919'] } as Command, 'st-02');
assert.throws(() => applyCommand(selfReview, { type: 'sign_off' }, 'st-02'), /work you prepared/);

ready = applyCommand(ready, { type: 'sign_off' }, 'st-02');
assert.equal(ready.signoffs[0].status, 'active');
const beforeNote = JSON.stringify(ready);
const changed = applyCommand(ready, { type: 'add_note', body: 'New evidence needs attention.' }, 'st-01');
assert.equal(changed.signoffs[0].status, 'invalidated');
assert.equal(JSON.stringify(ready), beforeNote);
assert.throws(() => applyCommand(changed, { type: 'sign_off' }, 'st-03'), /open review notes/);
const noteResolved = applyCommand(changed, { type: 'resolve_note', noteId: changed.notes[0].id, reason: 'Source reconciled.' }, 'st-01');
assert.equal(noteResolved.notes[0].status, 'resolved');

ready = applyCommand(ready, { type: 'sign_off' }, 'st-03');
ready = applyCommand(ready, { type: 'client_approve' }, 'cu-01');
const frozen = applyCommand(ready, { type: 'freeze' }, 'st-03');
assert.equal(frozen.filings.length, 1);
assert.equal(frozen.filings[0].snapshot.signoffs.length, 3);
assert.notEqual(frozen.filings[0].snapshot.adjustments, frozen.adjustments);
assert.throws(() => applyCommand(frozen, { type: 'add_note', body: 'Material change' }, 'st-01'), /snapshot is frozen/);
assert.throws(() => applyCommand(frozen, { type: 'undo_adjustment', adjustmentId: frozen.adjustments[0].id, reason: 'Change' }, 'st-01'), /snapshot is frozen/);
const afterDraft = applyCommand(frozen, { type: 'draft_question', body: 'Question draft after filing.' }, 'st-01');
assert.equal(afterDraft.signoffs[0].status, 'active');
assert.deepEqual(afterDraft.filings[0].snapshot, frozen.filings[0].snapshot);

assert.equal(digest(packetPath), beforeHash, 'Domain work must not modify original packet bytes.');
if (existsSync(originalPath)) assert.equal(digest(originalPath), beforeHash, 'The user source must remain unchanged.');
console.log('Domain checks passed: permissions, immutability, source links, redaction, latest-investigation reopening, undo, invalidation, independent approvals, blocked/frozen filing, packet hash.');
