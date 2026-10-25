import assert from 'node:assert/strict';
import packet from '../data/packet.json';
import { getTaxRecords } from '../lib/records';
import { actors, resolveSource } from '../lib/packet';
import { applyCommand, initialWorkspace } from '../lib/domain';

for (const version of packet.return_versions) {
  const records = getTaxRecords('st-01', version.version);
  const sales = records.groups.find(group => group.id === 'sales')!;
  assert.equal(sales.records.filter(row => row.form === 'F8949').length,
    version.lines.filter(line => line.form === 'F8949').length, 'Every supplied sale must remain accessible.');
  assert.equal(records.groups.find(group => group.id === 'assets')!.records.length, version.assets.length);
  for (const group of records.groups) for (const row of group.records) {
    if (typeof row.recordRef === 'string') assert.equal(resolveSource(row.recordRef, 'st-01').missing, false, `${row.recordRef} resolves to exact packet evidence`);
  }
  assert.equal(records.scenarios.length, 5);
  assert.equal(records.timeline.length, packet.timeline.length);
  assert.equal(records.groups.find(group => group.id === 'communications')!.records.length,
    packet.client.questionnaire.length + packet.client.messages.length + packet.client.call_notes.length);
}
for (const actor of actors) {
  const serialized = JSON.stringify(getTaxRecords(actor.id));
  for (const person of packet.household.people) assert.equal(serialized.includes(person.ssn), false, 'Every persona receives masked identifiers.');
  assert.equal(serialized.includes(packet.household.bank_account_for_refund_or_payment.account), false);
  assert.equal(serialized.includes(packet.firm.firm_identity.ero_pin), false);
}
assert.throws(() => getTaxRecords('untrusted-actor'));
assert.throws(() => getTaxRecords('st-01', 'missing-version'));
const differences = getTaxRecords('st-01').versionDiffs;
assert.equal(differences.length, 2);
const unchangedAmountWithCorrectedEvidence = differences[0].changes.find(row => row.key === 'F8949.D.M13');
assert.ok(unchangedAmountWithCorrectedEvidence);
assert.equal(unchangedAmountWithCorrectedEvidence.valueChanged, false);
assert.equal(unchangedAmountWithCorrectedEvidence.sourcesChanged, true);
assert.deepEqual(unchangedAmountWithCorrectedEvidence.oldSources, ['ev-0653', 'ev-0655', 'ev-0656', 'ev-0657', 'ev-0658', 'ev-0659']);
assert.deepEqual(unchangedAmountWithCorrectedEvidence.newSources, ['ev-0812', 'ev-0814', 'ev-0815', 'ev-0816', 'ev-0817', 'ev-0818']);
let reviewed = applyCommand(initialWorkspace(), { type: 'workflow', action: 'review_area', payload: { area: 'Intake and identity', status: 'reviewed', note: 'Engagement and identity reviewed against supplied intake records.' } }, 'st-01');
reviewed = applyCommand(reviewed, { type: 'workflow', action: 'document_disposition', payload: { documentId: 'D01', status: 'used', reason: 'Signed engagement supports this engagement.' } }, 'st-01');
const consolidated = getTaxRecords('st-01', 'v3', reviewed);
assert.equal(consolidated.areaSummaries.length, 13);
assert.equal(consolidated.areaSummaries[0].status, 'reviewed');
assert.equal(consolidated.areaSummaries[0].documentCoverage.reviewed, 1);
assert.equal(new Set(consolidated.areaSummaries.flatMap(area => area.documentIds)).size, 74, 'Every supplied document belongs to an explicit work area.');
assert.equal(consolidated.priorPreparerComparisons.length, 8);
const stockComparison = consolidated.priorPreparerComparisons.find(item => item.id === 'stock-compensation')!;
assert.match(String(stockComparison.priorTreatment), /^Unknown:/, 'Missing prior stock treatment is explicit, never invented.');
const basisComparison = consolidated.priorPreparerComparisons.find(item => item.id === 'scorp-basis')!;
assert.equal((basisComparison.priorRecords as { year: number; ending_stock_basis?: number | null }[]).find(item => item.year === 2023)!.ending_stock_basis, null);
console.log('Records: complete evidence and masking; source-only differences; 13 live area summaries; honest paired prior treatments.');
