import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_URL || 'http://127.0.0.1:3204';
let cookie = '',
  id,
  w;
async function call(path, options = {}) {
  const r = await fetch(base + path, {
    ...options,
    headers: {
      Origin: base,
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  const data = r.headers.get('content-type')?.includes('application/json')
    ? await r.json()
    : await r.text();
  return { status: r.status, data };
}
async function workspace() {
  const r = await call('/api/workspace' + (id ? '?id=' + id : ''));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  w = r.data;
  return w;
}
async function role(actorId) {
  const r = await call('/api/session', {
    method: 'POST',
    body: JSON.stringify({ engagementId: id, actorId }),
  });
  assert.equal(r.status, 200);
  await workspace();
}
const post = (command, extra = {}) =>
  call('/api/command', {
    method: 'POST',
    body: JSON.stringify({
      engagementId: id,
      actorId: w.actor.id,
      expectedRevision: w.state.revision,
      expectedPolicyRevision: w.state.firmPolicyRevision,
      requestId: randomUUID(),
      command,
      ...extra,
    }),
  });
async function command(c) {
  const r = await post(c);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  await workspace();
}
await workspace();
id = w.id;
await role('st-01');
const seed = JSON.parse(await readFile('data/seed-packet.json', 'utf8'));
const packet = structuredClone(seed);
packet.packet.client_id = 'COMPLETION-' + randomUUID().slice(0, 8);
const imported = await call('/api/import', { method: 'POST', body: JSON.stringify(packet) });
assert.equal(imported.status, 200);
id = imported.data.id;
await workspace();
await role('st-01');
assert.equal(w.findings.filter((f) => f.id.startsWith('variance-')).length, 51);
const baseline = w.packet.return_versions.at(-1);
const payment = baseline.lines.find((l) => l.key === 'F1040.33');
await command({
  type: 'adjust',
  target: payment.key,
  value: payment.value + 100,
  category: 'interest',
  direction: 92,
  reason: 'Integration: direct payment must reduce balance by exactly 100.',
});
assert.equal(w.state.adjustments.at(-1).federal, -100);
await command({
  type: 'adjust',
  target: 'asset:STU-PRINTER/cost',
  value: 14201,
  reason: 'Integration: supported reviewed asset record.',
});
assert.equal(w.state.adjustments.at(-1).evidenceOnly, true);
await command({
  type: 'adjust',
  target: 'ev-0047',
  value: 22469,
  reason: 'Integration: source correction with no automatic downstream tax change.',
});
assert.equal(w.state.adjustments.at(-1).category, 'evidence_only');
await command({
  type: 'judgment',
  kind: 'reconciliation',
  target: 'reconcile:books',
  reason: 'Integration: books bridge reviewed.',
  authority: 'Source profit and loss and Schedule C.',
});
assert(w.state.judgments.at(-1).basisHash);
await command({ type: 'seen' });
const seen = w.state.seen[w.actor.id];
await command({
  type: 'plan',
  title: 'Integration handoff',
  body: 'Retain unknown basis and source evidence.',
});
assert(w.state.audit.some((e) => e.revision > seen && e.type === 'plan'));
await command({
  type: 'thread',
  recipient: 'st-02',
  target: 'all',
  title: 'Private reviewer note',
  body: 'INTERNAL-ONLY-AUDIT-THREAD',
  visibility: 'internal',
});
const bytes = 'Original archive evidence: never lose these bytes.';
const form = new FormData();
form.set('file', new File([bytes], 'archive-evidence.txt', { type: 'text/plain' }));
form.set('engagementId', id);
form.set('actorId', w.actor.id);
form.set('revision', String(w.state.revision));
form.set('target', 'D23');
form.set('visibility', 'examiner');
const attached = await call('/api/attachments', { method: 'POST', body: form });
assert.equal(attached.status, 200, JSON.stringify(attached.data));
await workspace();
const root = id;
// A policy added on engagement A must be visible on B, and invalidate an old policy revision.
const second = structuredClone(packet);
second.packet.client_id += '-B';
const i2 = await call('/api/import', { method: 'POST', body: JSON.stringify(second) });
assert.equal(i2.status, 200);
const beforePolicy = w.state.firmPolicyRevision;
await role('st-05');
await command({ type: 'standard', body: 'Integration-wide standard ' + randomUUID() });
const standard = w.state.standards.at(-1);
assert.equal(w.state.firmPolicyRevision, beforePolicy + 1);
id = i2.data.id;
await workspace();
assert(w.state.standards.includes(standard));
await role('st-01');
const stale = await post(
  { type: 'time', area: 'business', hours: 1, body: 'Must reject stale policy.' },
  { expectedPolicyRevision: beforePolicy },
);
assert.equal(stale.status, 409);
id = root;
await workspace();
await role('st-01');
const client = await call('/api/report?id=' + id + '&kind=client');
assert.equal(client.status, 200);
assert(!client.data.includes('INTERNAL-ONLY-AUDIT-THREAD'));
assert(!client.data.includes('data:application/octet-stream;base64,'));
const defense = await call('/api/report?id=' + id + '&kind=defense');
assert.equal(defense.status, 200);
assert(defense.data.includes('data:application/octet-stream;base64,'));
assert(!defense.data.includes('INTERNAL-ONLY-AUDIT-THREAD'));
assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(defense.data));
await workspace();
const exported = await call('/api/export?id=' + id + '&kind=carryforward');
assert.equal(exported.status, 200);
const archive = exported.data;
assert.equal(archive.format, 'miraflores-complete-handoff-2');
assert.equal(Buffer.from(archive.payload.attachments[0].data_base64, 'base64').toString(), bytes);
assert(archive.payload.state.threads.some((t) => t.body === 'INTERNAL-ONLY-AUDIT-THREAD'));
assert(archive.payload.state.adjustments.some((a) => a.target === 'asset:STU-PRINTER/cost'));
await role('st-04');
assert.equal((await call('/api/export?id=' + id + '&kind=carryforward')).status, 403);
await role('st-01');
const restore = await call('/api/handoff?id=' + id, {
  method: 'POST',
  body: JSON.stringify({ mode: 'restore', actorId: w.actor.id, handoff: archive }),
});
assert.equal(restore.status, 200, JSON.stringify(restore.data));
id = restore.data.id;
await workspace();
assert.equal(w.state.signoffs.length, 0);
assert.equal(w.state.adjustments.length, archive.payload.state.adjustments.length);
assert(w.state.inherited.archiveId);
const file = w.state.evidence.find((e) => e.fileId);
const downloaded = await call('/api/attachments?id=' + id + '&file=' + file.fileId);
assert.equal(downloaded.status, 200);
assert.equal(downloaded.data, bytes);
const repeat = await call('/api/handoff?id=' + id, {
  method: 'POST',
  body: JSON.stringify({ mode: 'restore', actorId: w.actor.id, handoff: archive }),
});
assert.equal(repeat.status, 200);
assert.equal(repeat.data.id, id);
const nextPacket = structuredClone(packet);
nextPacket.household.tax_year = 2026;
nextPacket.packet.note = 'Explicitly synthetic integration fixture; not a computed future return.';
const next = await call('/api/handoff?id=' + id, {
  method: 'POST',
  body: JSON.stringify({
    mode: 'next_year',
    actorId: w.actor.id,
    handoff: archive,
    packet: nextPacket,
  }),
});
assert.equal(next.status, 200, JSON.stringify(next.data));
id = next.data.id;
await workspace();
assert.equal(w.packet.household.tax_year, 2026);
assert.equal(w.state.adjustments.length, 0);
assert.equal(w.state.signoffs.length, 0);
const history = await call('/api/handoff?id=' + id + '&view=history');
assert.equal(history.status, 200);
assert(history.data.state.threads.length);
assert(!JSON.stringify(history.data).includes('data_base64'));
const inherited = await call('/api/handoff?id=' + id);
assert.equal(inherited.status, 200);
assert.equal(inherited.data.digest, archive.digest);
const nested = await call('/api/export?id=' + id + '&kind=carryforward');
assert.equal(nested.status, 200);
assert.equal(nested.data.payload.priorArchive.digest, archive.digest);
const broken = structuredClone(archive);
broken.payload.attachments[0].data_base64 = 'tampered';
const invalid = await call('/api/handoff?id=' + id, {
  method: 'POST',
  body: JSON.stringify({ mode: 'restore', actorId: w.actor.id, handoff: broken }),
});
assert.equal(invalid.status, 400);
await role('examiner');
assert.equal((await call('/api/handoff?id=' + id + '&view=history')).status, 403);
await role('cu-01');
assert.equal((await call('/api/handoff?id=' + id)).status, 403);
assert.equal((await call('/api/report?id=' + id + '&kind=defense')).status, 403);
console.log(
  'Completion API acceptance passed: direct effects, source/asset overlays, shared firm policy, stale-policy conflict, readable scoped reports, complete archive bytes, independent restore, idempotency, linked next-year history, nested carryforward integrity and role denial.',
);
