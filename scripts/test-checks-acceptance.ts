import assert from 'node:assert/strict';
import { applyCommand, initialWorkspace } from '../lib/domain';
import { getChecks } from '../lib/checks';
import { actors, resolveSource } from '../lib/packet';

const state = initialWorkspace();
const before = JSON.stringify(state);
const results = getChecks('st-01', state);
assert.equal(results.checks.length, 14);
assert.deepEqual(results.summary, { agrees: 5, mismatch: 8, review: 1 });
const values: Record<string, [number, number, string]> = {
  'unique-mileage': [11800, 8100, 'mismatch'],
  'mileage-deduction': [8260, 5670, 'mismatch'],
  'sweep-interest': [3680, 1840, 'mismatch'],
  'meridian-proceeds': [71715, 71965, 'mismatch'],
  'meridian-gain': [3267, 3207, 'mismatch'],
  'irs-estimates': [13000, 12000, 'mismatch'],
  'ftb-estimates': [14000, 10500, 'mismatch'],
  'books-expense-arithmetic': [61466, 61466, 'agrees'],
  'books-net-arithmetic': [89834, 89834, 'agrees'],
  'books-gross-reconciliation': [163700, 151300, 'mismatch'],
  'books-to-tax-bridge': [81854, 81854, 'agrees'],
  'ca-w2-total': [218400, 218400, 'agrees'],
  'ca-pre-move-allocation': [218400, 129569, 'review'],
};
for (const [id, [comparison, independent, status]] of Object.entries(values)) {
  const check = results.checks.find(check => check.id === id);
  assert(check, `Missing independent reconciliation ${id}.`);
  assert.equal(check.engineValue, comparison, `${id}: supplied comparison population changed.`);
  assert.equal(check.independentValue, independent, `${id}: source arithmetic changed.`);
  assert.equal(check.status, status, `${id}: don't mark judgment as proven agreement.`);
  assert.equal(check.delta, Math.round((comparison - independent) * 100) / 100);
}
assert.equal(results.checks.find(check => check.id === 'mileage-page-arithmetic')?.status, 'agrees',
  'Page arithmetic can agree even while the population includes a duplicate.');
for (const check of results.checks) {
  assert(check.method.length > 30);
  for (const ref of check.sourceRefs) assert(!resolveSource(ref).missing, `${check.id}: each source must resolve.`);
}
assert.equal(JSON.stringify(state), before, 'Independent checks are read-only.');
const changed = applyCommand(state, { type: 'accept_adjustment', issueId: 'duplicate-interest', reason: 'Synthetic fixture: independent checks remain against immutable supplied v3.' }, 'st-01');
const after = getChecks('st-01', changed);
assert.equal(after.revision, changed.revision);
assert.deepEqual(after.checks, results.checks, 'A reviewed overlay cannot quietly replace baseline comparisons.');
assert.throws(() => getChecks('unknown-actor', state));
for (const actor of actors) {
  const serialized = JSON.stringify(getChecks(actor.id, state));
  assert(!/\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b/.test(serialized));
}
console.log('Independent check acceptance passed: 14 source comparisons, exact mileage/deduction/sweep/sales/payments/books/state results, explicit CA judgment, real source refs, all-role masking, read-only behavior and fixed v3 comparison baseline.');
