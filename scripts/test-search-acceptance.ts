import assert from 'node:assert/strict';
import packet from '../data/packet.json';
import { applyCommand, initialWorkspace } from '../lib/domain';
import { searchWorkpaper } from '../lib/search';
import { actors, resolveSource } from '../lib/packet';
import { workflowState } from '../lib/workflow';

let state = initialWorkspace();
const act = (action: string, payload: Record<string, unknown>) => {
  state = applyCommand(state, { type: 'workflow', action, payload }, 'st-01');
};
state = applyCommand(state, { type: 'add_note', body: 'IndependentSearchNoteFixture preserves source context.' }, 'st-01');
const note = state.notes.at(-1)!;
act('plan', { title: 'IndependentSearchPlanFixture', body: 'Next-year continuity assumptions.', year: 2026 });
const plan = workflowState(state).plans.at(-1)!;
act('assign_task', { title: 'IndependentSearchTaskFixture', assigneeId: 'st-02', dueDate: '2026-10-30' });
const task = workflowState(state).tasks.at(-1)!;
act('reconcile', { title: 'IndependentSearchReconciliationFixture', expected: 1840, actual: 3680, note: 'Documented source population difference.' });
const reconciliation = workflowState(state).reconciliations.at(-1)!;
act('adjust_line', { lineKey: 'F1040.2b', proposed: 0, federalEffect: 0, californiaEffect: 0, reason: 'IndependentSearchLineOverlayFixture' });
const overlay = workflowState(state).lineAdjustments.at(-1)!;
act('verify_value', { ref: 'ev-1046', method: 'agreed_to_source_document', note: 'IndependentSearchVerificationFixture' });
const verification = workflowState(state).verifications['ev-1046'];
const fixtures = [
  ['IndependentSearchNoteFixture', note.id, `local:note:${note.id}`],
  ['IndependentSearchPlanFixture', plan.id, `local:plan:${plan.id}`],
  ['IndependentSearchTaskFixture', task.id, `local:task:${task.id}`],
  ['IndependentSearchReconciliationFixture', reconciliation.id, `local:reconciliation:${reconciliation.id}`],
  ['IndependentSearchLineOverlayFixture', overlay.id, `local:lineAdjustment:${overlay.id}`],
  ['IndependentSearchVerificationFixture', verification.id, 'ev-1046'],
];
for (const [query, id, reference] of fixtures) {
  const result = searchWorkpaper(query, 'st-01', state).results.find(result => result.id === id);
  assert(result, `${query}: persisted workpaper content must be searchable.`);
  assert(result.sourceRefs.includes(reference), `${query}: results need a usable evidence reference.`);
  assert(!resolveSource(reference, 'st-01', 'v3', state).missing);
}
const omitted = searchWorkpaper('M18', 'st-01', state);
assert(omitted.results.some(result => result.sourceRefs.includes('doc:D31#page32')), 'Search must find evidence on an unextracted page.');
const before = JSON.stringify(state);
for (const query of ['Meridian', 'Roth', 'carryover', 'stock basis', '2023', 'IndependentSearch']) {
  const results = searchWorkpaper(query, 'st-01', state);
  assert(results.total >= results.results.length);
  assert(results.results.length <= results.limit);
  for (const result of results.results) for (const reference of result.sourceRefs) assert(!resolveSource(reference, 'st-01', 'v3', state).missing, `Search reference ${reference} must resolve.`);
}
assert.equal(JSON.stringify(state), before, 'Search must not mutate workpaper content.');
assert.throws(() => searchWorkpaper('x', 'st-01', state));
assert.throws(() => searchWorkpaper('x'.repeat(151), 'st-01', state));
assert.throws(() => searchWorkpaper('Meridian', 'unknown-role', state));
for (const actor of actors) {
  const result = JSON.stringify(searchWorkpaper(packet.household.people[0].ssn, actor.id, state));
  assert(!result.includes(packet.household.people[0].ssn), 'Search terms and results must both protect identifiers.');
}
for (const version of ['v1', 'v2', 'v3']) {
  const key = 'F1040.24';
  const evidence = resolveSource(`line:${version}:${key}`, 'st-01', 'v3', state);
  assert(!evidence.missing);
  assert.equal(evidence.value, packet.return_versions.find(item => item.version === version)!.lines.find(line => line.key === key)!.value);
}
assert(!resolveSource('F1040.24', 'st-01', 'v3', state).missing, 'A displayed calculation key can be opened as evidence.');
console.log('Independent search acceptance passed: source-only pages, client/prior/return evidence, persisted notes/plans/tasks/reconciliations/line overlays/verification, usable isolated references, bounded results, version-bound line refs, all-role masking and read-only behavior.');
