import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
const base = process.env.TEST_URL || 'http://127.0.0.1:3204';
let cookie = '',
  id,
  w;
async function call(path, options = {}) {
  const r = await fetch(base + path, {
    ...options,
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  return { status: r.status, data: await r.json() };
}
async function workspace() {
  const r = await call('/api/workspace' + (id ? '?id=' + id : ''));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  w = r.data;
}
async function role(actorId) {
  const r = await call('/api/session', {
    method: 'POST',
    body: JSON.stringify({ engagementId: id, actorId }),
  });
  assert.equal(r.status, 200);
  await workspace();
}
async function command(c, expected = 200) {
  const r = await call('/api/command', {
    method: 'POST',
    body: JSON.stringify({
      engagementId: id,
      actorId: w.actor.id,
      expectedRevision: w.state.revision,
      expectedPolicyRevision: w.state.firmPolicyRevision,
      requestId: randomUUID(),
      command: c,
    }),
  });
  assert.equal(r.status, expected, JSON.stringify(r.data));
  await workspace();
}
await workspace();
id = w.id;
await role('st-01');
const p = JSON.parse(await readFile('data/seed-packet.json', 'utf8'));
p.packet.client_id = 'LIFECYCLE-' + randomUUID().slice(0, 8);
p.packet.note =
  'Disposable synthetic acceptance fixture. Conclusions are not professional tax review.';
const imp = await call('/api/import', { method: 'POST', body: JSON.stringify(p) });
assert.equal(imp.status, 200);
id = imp.data.id;
await workspace();
await role('st-01');
await command({
  type: 'extension',
  payment: 36000,
  reason: 'Synthetic lifecycle: extension record, no agency action.',
});
for (const d of p.documents)
  await command({
    type: 'triage',
    target: d.id,
    status: 'used',
    reason: 'Synthetic acceptance fixture disposition, not substantive CPA review.',
  });
for (const f of w.findings.filter((x) => x.severity !== 'info'))
  await command({
    type: 'resolve_finding',
    target: f.id,
    reason: 'Synthetic acceptance fixture: record a conclusion solely to exercise filing gates.',
  });
for (const step of p.firm.starter_standards.required_steps)
  await command({
    type: 'checklist',
    target: step,
    reason: 'Synthetic acceptance fixture completion.',
  });
for (const obligation of w.outsideObligations)
  await command({
    type: 'outside',
    obligationId: obligation.id,
    form: obligation.label,
    owner: 'Synthetic outside provider',
    due: '2026-10-15',
    reason: 'Synthetic scope acknowledgment.',
  });
await role('st-02');
for (const area of Object.keys(w.areaHashes))
  if (
    p.return_versions
      .at(-1)
      .lines.some((l) => w.packet.return_versions.at(-1).lines.find((x) => x.key === l.key))
  )
    await command({ type: 'signoff', area, level: 'reviewer' });
await role('st-03');
await command({ type: 'signoff', area: 'all', level: 'partner' });
for (const client of p.firm.client_users) {
  await role(client.id);
  await command({ type: 'client_approval', signature: true, contentHash: w.contentHash });
}
await role('st-03');
assert(
  w.gates.every((g) => g.count === 0),
  JSON.stringify(w.gates),
);
await writeFile(
  'tmp/audit/lifecycle-ready.json',
  JSON.stringify({ id, base, revision: w.state.revision }),
);
if (process.env.STAGE_ONLY === '1') {
  console.log('Synthetic lifecycle staged with all gates complete: ' + id);
  process.exit(0);
}
await command({ type: 'file' });
assert.equal(w.state.filing.status, 'filed');
const frozen = JSON.stringify(w.state.freezes[0]);
await command(
  { type: 'adjust', target: 'F1040.26', value: 12000, reason: 'Frozen mutation must be rejected.' },
  409,
);
await command({
  type: 'amend',
  reason: 'Synthetic acceptance: open amended cycle over immutable filed snapshot.',
});
await role('st-01');
await command({
  type: 'adjust',
  target: 'F1040.26',
  value: 12000,
  reason: 'Synthetic acceptance: corrected payment in amendment.',
});
assert.equal(JSON.stringify(w.state.freezes[0]), frozen);
assert.equal(w.state.cycle, 1);
assert.equal(w.state.signoffs.length, 0);
console.log(
  'Synthetic lifecycle API passed: extension, all document/check/standard/scope gates, reviewer/partner/client approvals, filing freeze, frozen mutation denial and independent amendment.',
);
