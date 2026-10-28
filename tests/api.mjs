import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_URL || 'http://127.0.0.1:3201';
let cookie = '';
let engagement;
async function call(path, options = {}) {
  const r = await fetch(base + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  const c = r.headers.get('set-cookie');
  if (c) cookie = c.split(';')[0];
  const type = r.headers.get('content-type') || '';
  return {
    status: r.status,
    data: type.includes('application/json') ? await r.json() : await r.text(),
  };
}
const workspace = async () => {
  const r = await call('/api/workspace' + (engagement ? '?id=' + engagement : ''));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
};
let w = await workspace();
engagement = w.id;
const foreign = await call('/api/command', {
  method: 'POST',
  headers: { Origin: 'https://foreign.example' },
  body: JSON.stringify({}),
});
assert.equal(foreign.status, 403);
const seed = JSON.parse(await readFile('data/seed-packet.json', 'utf8'));
assert.equal(w.packet.documents.length, 74);
assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(JSON.stringify(w)));
async function role(actorId) {
  const r = await call('/api/session', {
    method: 'POST',
    body: JSON.stringify({ engagementId: engagement, actorId }),
  });
  assert.equal(r.status, 200);
  w = await workspace();
}
await role('st-01');
function body(command, rev = w.state.revision) {
  return {
    engagementId: engagement,
    actorId: w.actor.id,
    expectedRevision: rev,
    requestId: randomUUID(),
    command,
  };
}
const post = (b) => call('/api/command', { method: 'POST', body: JSON.stringify(b) });
assert.equal(
  (
    await post({
      ...body({
        type: 'verify',
        target: 'F1040.11',
        method: 'source',
        reason: 'Must reject an actor mismatch.',
      }),
      actorId: 'st-04',
    })
  ).status,
  409,
);

let source = await call(
  '/api/source?id=' + engagement + '&version=v3&ref=SchC.44a&preferredRef=ev-0404',
);
assert.equal(source.status, 200);
assert.equal(source.data.page, 3);
assert(source.data.fields.some((x) => x.id === 'ev-0404'));
assert(source.data.document.pages[2].printed_content.includes('Second scan'));
assert(!source.data.destinations.some((x) => x.key === 'SchC.44b'));
assert(source.data.destinations.some((x) => x.key === 'SchC.9'));
const command = body({
  type: 'adjust',
  target: 'SchC.44a',
  value: 8100,
  category: 'schc_profit',
  direction: -0.7,
  reason: 'QA: unique log pages support 8,100 miles.',
  refs: ['ev-0404'],
  version: 'v3',
});
const [one, two] = await Promise.all([post(command), post(command)]);
assert.equal(one.status, 200, JSON.stringify(one));
assert.equal(two.status, 200, JSON.stringify(two));
w = await workspace();
assert.equal(w.state.adjustments.filter((x) => x.active).length, 1);
assert.equal(w.state.revision, command.expectedRevision + 1);
const status = await call('/api/command?id=' + engagement + '&requestId=' + command.requestId);
assert.equal(status.data.status, 'committed');
assert.equal((await post({ ...command, command: { ...command.command, value: 0 } })).status, 409);
assert.equal(
  (
    await post(
      body(
        { type: 'verify', target: 'F1040.11', reason: 'Stale should fail', method: 'recalculated' },
        0,
      ),
    )
  ).status,
  409,
);
const races = await Promise.all([
  post(
    body({
      type: 'thread',
      title: 'QA concurrent note A',
      body: 'One atomic winner.',
      recipient: 'st-02',
    }),
  ),
  post(
    body({
      type: 'thread',
      title: 'QA concurrent note B',
      body: 'One atomic winner.',
      recipient: 'st-02',
    }),
  ),
]);
assert.deepEqual(races.map((x) => x.status).sort(), [200, 409]);
w = await workspace();
assert.equal(
  (
    await post(
      body({
        type: 'verify',
        target: 'F1040.11',
        reason: 'Historic',
        method: 'source',
        version: 'v1',
      }),
    )
  ).status,
  409,
);
const fd = new FormData();
fd.set('file', new File(['test evidence bytes'], 'qa.txt', { type: 'text/plain' }));
fd.set('engagementId', engagement);
fd.set('actorId', 'st-01');
fd.set('revision', String(w.state.revision));
fd.set('target', 'SchC.44a');
const upload = await call('/api/attachments', { method: 'POST', body: fd });
assert.equal(upload.status, 200, JSON.stringify(upload));
const download = await call('/api/attachments?id=' + engagement + '&file=' + upload.data.fileId);
assert.equal(download.status, 200);
assert.equal(download.data, 'test evidence bytes');
w = await workspace();
let exported = await call('/api/export?id=' + engagement);
assert.equal(exported.status, 200);
assert(exported.data.attachments.some((x) => x.id === upload.data.fileId));
assert.equal(exported.data.revision, w.state.revision);
const defense = await call('/api/export?id=' + engagement + '&kind=defense');
assert.equal(defense.status, 200);
assert.equal(defense.data.state.threads.length, 0);
assert.equal(defense.data.attachments.length, 0);

const second = structuredClone(seed);
second.packet.client_id = 'QA-DYNAMIC-' + randomUUID().slice(0, 8);
second.household.people[0].name = 'Dynamic Import';
second.return_versions = Array.from({ length: 5 }, (_, i) => ({
  ...structuredClone(seed.return_versions.at(-1)),
  version: 'release-' + (i + 1),
}));
const imported = await call('/api/import?id=' + engagement, {
  method: 'POST',
  body: JSON.stringify(second),
});
assert.equal(imported.status, 200, JSON.stringify(imported));
const oldId = engagement;
engagement = imported.data.id;
let dynamic = await workspace();
assert.equal(dynamic.packet.return_versions.length, 5);
assert.equal(dynamic.packet.household.people[0].name, 'Dynamic Import');
assert.equal(dynamic.state.revision, 0);
assert.equal(
  (await call('/api/import?id=' + engagement, { method: 'POST', body: JSON.stringify(second) }))
    .data.id,
  engagement,
);
engagement = oldId;
w = await workspace();
assert.equal(w.packet.return_versions.length, 3);
assert(w.state.adjustments.length);
await role('cu-01');
assert(!w.packet.extracted_values);
assert(!w.state.audit);
assert(!w.state.adjustments);
assert.equal((await call('/api/source?id=' + engagement + '&ref=SchC.9&version=v3')).status, 403);
assert.equal(
  (
    await post(
      body({
        type: 'adjust',
        target: 'SchC.44a',
        value: 0,
        category: 'schc_profit',
        reason: 'Client forbidden.',
      }),
    )
  ).status,
  403,
);
assert.equal(
  (await post(body({ type: 'client_approval', signature: true, contentHash: 'old-content' })))
    .status,
  409,
);
assert.equal(
  (await post(body({ type: 'client_approval', signature: true, contentHash: w.contentHash })))
    .status,
  200,
);
await role('examiner');
assert.equal(w.state.threads.length, 0);
assert.equal(
  (await post(body({ type: 'thread', title: 'Forbidden', body: 'Read only', recipient: 'st-01' })))
    .status,
  403,
);
assert.equal((await call('/api/export?id=' + engagement)).data.state.threads.length, 0);
await role('st-04');
assert.equal((await call('/api/export?id=' + engagement)).data.attachments.length, 0);

assert.equal(
  (
    await call('/api/reveal', {
      method: 'POST',
      body: JSON.stringify({
        id: engagement,
        actorId: 'st-04',
        ref: 'ev-1080',
        reason: 'Denied test',
      }),
    })
  ).status,
  403,
);
assert.equal(
  (await call('/api/attachments?id=' + engagement + '&file=' + upload.data.fileId)).status,
  403,
);
await role('st-03');
const frozen = await post(body({ type: 'file' }));
assert.equal(frozen.status, 409);
assert.match(frozen.data.error, /Filing blocked/);
const bad = await call('/api/import?id=' + engagement, {
  method: 'POST',
  body: JSON.stringify({ packet: { client_id: 'bad' } }),
});
assert.equal(bad.status, 400);
console.log(
  'API acceptance passed: persisted overlay, concurrent idempotent retries, CAS conflicts, exact source, files, snapshot export, five-version multi-client import, scoped client/examiner reads, role denial and filing gates.',
);
