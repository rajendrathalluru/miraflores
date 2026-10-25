/** Independent acceptance checks derived from the case brief, not UI labels.
 * Compile with the other tests in scripts/run-checks.mjs. No network or paid AI.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applyCommand, initialWorkspace } from '../lib/domain';
import { actors, getBootstrap, getDocument, getVersionLines, maskSensitiveText, resolveSource, traceLine } from '../lib/packet';
import { getTaxRecords } from '../lib/records';
import { REVIEW_AREAS } from '../lib/workflow';
import type { ReturnLine } from '../lib/contracts';

interface SourceDocument { id: string; page_count: number; pages: { page: number; printed_content: string }[] }
interface SourceValue { id: string; document_id: string; page: number; field: string; value: unknown; position: unknown }
interface SourceVersion { version: string; lines: ReturnLine[] }
interface SourcePacket {
  documents: SourceDocument[]; extracted_values: SourceValue[]; return_versions: SourceVersion[];
  household: { people: Record<string, unknown>[]; bank_account_for_refund_or_payment: Record<string, unknown> };
}
const packetBytes = readFileSync(`${process.cwd()}/data/packet.json`);
const packet = JSON.parse(packetBytes.toString('utf8')) as SourcePacket;
const hash = () => createHash('sha256').update(readFileSync(`${process.cwd()}/data/packet.json`)).digest('hex');
const expectedHash = 'ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19';
assert.equal(hash(), expectedHash, 'The supplied packet must be loaded byte-for-byte.');
const values = new Map(packet.extracted_values.map(value => [value.id, value]));
const docs = new Map(packet.documents.map(document => [document.id, document]));
const belongsTo = (ref: string, documentId: string) => values.get(ref)?.document_id === documentId ||
  ref === documentId || new RegExp(`^doc:${documentId}#page\\d+$`).test(ref);

// Independently walk each destination BACKWARD to a source. The implementation
// walks reverse dependencies forward, so this checks reachability independently.
let downstreamCases = 0;
let destinationChecks = 0;
for (const version of packet.return_versions) {
  const index = new Map(version.lines.map(line => [line.key, line]));
  const actualLines = getVersionLines(version.version, 'st-01');
  assert.equal(actualLines.length, version.lines.length);
  for (const source of version.lines) {
    const actual = actualLines.find(line => line.key === source.key);
    assert(actual, `${version.version}: missing supplied return line ${source.key}`);
    assert.equal(actual.value, typeof source.value === 'string' ? maskSensitiveText(source.value) : source.value);
    assert.deepEqual(actual.inputs, source.inputs, 'Supplied calculation dependencies must remain intact.');
    const graph = traceLine(source.key, version.version, 'st-01');
    assert(graph.nodes.some(node => node.id === source.key && node.type === 'line'));
    const nodeIds = new Set(graph.nodes.map(node => node.id));
    for (const edge of graph.edges) {
      assert(nodeIds.has(edge.from), `${version.version}: missing trace edge origin ${edge.from}`);
      assert(nodeIds.has(edge.to), `${version.version}: missing trace edge destination ${edge.to}`);
    }
    for (const node of graph.nodes) if (node.evidence) assert(!node.evidence.missing,
      `${version.version}: unresolved source ${node.evidence.ref}`);
  }
  for (const document of packet.documents) {
    const memo = new Map<string, boolean>();
    function reachesDocument(key: string, visiting = new Set<string>()): boolean {
      if (memo.has(key)) return memo.get(key)!;
      if (visiting.has(key)) return false;
      const line = index.get(key);
      if (!line) return false;
      const path = new Set(visiting).add(key);
      const reaches = line.sources.some(ref => belongsTo(ref, document.id)) ||
        line.inputs.some(input => reachesDocument(input, path));
      memo.set(key, reaches);
      return reaches;
    }
    const expected = version.lines.filter(line => reachesDocument(line.key)).map(line => line.key).sort();
    const direct = version.lines.filter(line => line.sources.some(ref => belongsTo(ref, document.id)));
    if (expected.length > direct.length) downstreamCases++;
    const actual = getDocument(document.id, 'st-01').uses.filter(use => use.version === version.version).map(use => use.key).sort();
    assert.deepEqual(actual, expected, `${document.id}/${version.version}: show every direct and downstream destination exactly once.`);
    assert.equal(new Set(actual).size, actual.length);
    destinationChecks++;
  }
}
assert.equal(downstreamCases, 158, 'The fixture must exercise documents that flow into downstream totals.');
assert.equal(destinationChecks, 222, 'Every one of 74 documents is checked in all three versions.');

// Every extracted field resolves to its exact simulated document/page/field;
// unread pages must remain present even though they have no extracted values.
for (const value of packet.extracted_values) {
  const resolved = resolveSource(value.id);
  assert(!resolved.missing);
  assert.equal(resolved.documentId, value.document_id);
  assert.equal(resolved.page, value.page);
  assert.equal(resolved.field, value.field);
  assert(docs.get(value.document_id)?.pages.some(page => page.page === value.page));
}
const unread = getDocument('D31', 'st-01');
assert(unread.document.pages.some(page => page.page === 32 && /M18/.test(page.printed_content)));
assert.equal(unread.values.filter(value => value.page === 32).length, 0,
  'An unread source page cannot be replaced by invented extracted fields.');
assert.match(resolveSource('doc:D31#page32').text ?? '', /M18/);
assert(!resolveSource('packet:/what_if/alternatives/0').missing, 'Supplied alternatives need a source record.');
assert(!resolveSource('packet:/planning_reference_2026').missing, 'Planning references need a source record.');
const firstRule = packet.return_versions.flatMap(version => version.lines).find(line => line.rule)?.rule;
assert(firstRule);
assert(!resolveSource(`ref:rule.${firstRule}`).missing, 'A rule reference must resolve to its supplied explanation.');
assert(resolveSource('packet:/this/path/does/not/exist').missing, 'Missing packet pointers must remain explicit.');
assert(resolveSource('ref:rule.not-a-rule').missing, 'Missing rule explanations must remain explicit.');
const localCollections = {
  questions: [{ id: 'question-fixture', body: 'Client response with synthetic SSN 123-45-6789.' }],
  judgments: [{ id: 'judgment-fixture', body: 'Source-backed judgment.' }],
  notices: [{ id: 'notice-fixture', body: 'Notice response evidence.' }],
  attachments: [{ id: 'attachment-fixture', name: 'Evidence upload.txt' }],
  links: [{ id: 'link-fixture', title: 'Related year basis' }],
};
const localState = { ...initialWorkspace(), workpaper: localCollections } as unknown as ReturnType<typeof initialWorkspace>;
for (const type of ['question', 'judgment', 'notice', 'attachment', 'link']) {
  const evidence = resolveSource(`local:${type}:${type}-fixture`, 'st-01', 'v3', localState);
  assert(!evidence.missing, `Persisted ${type} must be resolvable as evidence in its workspace.`);
  assert(!(evidence.text ?? '').includes('123-45-6789'));
  assert(resolveSource(`local:${type}:missing`, 'st-01', 'v3', localState).missing);
  assert(resolveSource(`local:${type}:${type}-fixture`).missing, 'Local evidence cannot resolve outside its workspace.');
}

// Inspect every document under both cleared and uncleared roles, plus public
// return/state payloads. A badge alone is not evidence of masking.
const forbidden = [
  ...packet.household.people.flatMap(person => ['ssn', 'ip_pin', 'phone', 'email', 'dob'].map(key => person[key])),
  ...['routing', 'account'].map(key => packet.household.bank_account_for_refund_or_payment[key]),
].filter((value): value is string => typeof value === 'string' && value.length >= 4);
for (const actor of actors) {
  const publicParts: unknown[] = [getBootstrap(actor.id, initialWorkspace())];
  for (const document of packet.documents) publicParts.push(getDocument(document.id, actor.id));
  const serialized = JSON.stringify(publicParts);
  for (const secret of forbidden) assert(!serialized.includes(secret), `${actor.id}: a sensitive source identifier leaked.`);
  assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(serialized), `${actor.id}: SSN pattern leaked.`);
  assert(!/\b\d{2}-\d{7}\b/.test(serialized), `${actor.id}: EIN pattern leaked.`);
}
assert.equal(hash(), expectedHash, 'All acceptance reads must preserve original packet bytes.');
const summaries = getTaxRecords('st-01', 'v3', initialWorkspace());
assert.deepEqual(summaries.areaSummaries.map(area => area.title), REVIEW_AREAS, 'Each tax review area needs an actual summary.');
const summaryDocuments = new Set(summaries.areaSummaries.flatMap(area => area.documentIds));
assert.equal(summaryDocuments.size, 74, 'Area summaries cannot silently omit a supplied document.');
for (const area of summaries.areaSummaries) {
  assert.equal(area.baselineVersion, 'v3');
  assert.equal(area.documentCoverage.total, area.documentIds.length);
  assert.equal(area.documentCoverage.reviewed, 0);
  for (const ref of area.sourceRefs) assert(!resolveSource(ref).missing);
  for (const amount of area.keyAmounts) {
    const supplied = packet.return_versions.at(-1)!.lines.find(line => line.key === amount.key);
    assert(supplied);
    assert.equal(amount.value, supplied.value, 'Area amounts must be real supplied figures, not invented aggregates.');
  }
}
assert.equal(summaries.priorPreparerComparisons.length, 8);
for (const comparison of summaries.priorPreparerComparisons) {
  assert(comparison.currentTreatment.length > 0);
  assert(comparison.limitation.length > 20);
  for (const ref of comparison.sourceRefs) assert(!resolveSource(ref).missing, `Prior treatment source ${ref} must resolve.`);
}
assert.match(String(summaries.priorPreparerComparisons.find(comparison => comparison.id === 'stock-compensation')?.priorTreatment), /Unknown/,
  'An absent prior-preparer stock methodology must not become invented history.');
const historicalAssets = summaries.priorPreparerComparisons.find(comparison => comparison.id === 'appliance-depreciation')!.assetPairs;
assert.equal(historicalAssets.length, 6);
assert(historicalAssets.every(pair => pair.prior && pair.current));
let reviewedState = applyCommand(initialWorkspace(), { type: 'accept_adjustment', issueId: 'duplicate-mileage', reason: 'Synthetic summary fixture: document-derived overlay with preserved baseline.' }, 'st-01');
reviewedState = applyCommand(reviewedState, { type: 'workflow', action: 'document_disposition', payload: { documentId: 'D23', status: 'used', reason: 'Synthetic summary fixture source disposition.' } }, 'st-01');
reviewedState = applyCommand(reviewedState, { type: 'workflow', action: 'review_area', payload: { area: 'Business and books to tax', status: 'reviewed', note: 'Synthetic summary fixture only.' } }, 'st-01');
const changedSummaries = getTaxRecords('st-01', 'v3', reviewedState);
const business = changedSummaries.areaSummaries.find(area => area.title === 'Business and books to tax')!;
assert.equal(business.status, 'reviewed');
assert.equal(business.documentCoverage.reviewed, 1);
assert(!business.openFindings.some(issue => issue.id === 'duplicate-mileage'));
const priorBusiness = changedSummaries.priorPreparerComparisons.find(comparison => comparison.id === 'business-methods')!;
assert(priorBusiness.reviewedAdjustments.some(adjustment => adjustment.issueId === 'duplicate-mileage'));
assert(priorBusiness.relatedAudit.some(event => event.type === 'accept_adjustment'));
assert.equal(priorBusiness.currentTreatment.find(line => line.key === 'SchC.44a')!.value, 11800,
  'Prior/current comparison must retain original engine treatment separately from the reviewed adjustment.');
console.log(`Independent acceptance passed: ${destinationChecks} document/version maps including ${downstreamCases} downstream cases; all 1,877 supplied calculation graphs; 3,012 exact field references; unread source page; masking for all 8 roles; immutable packet.`);
