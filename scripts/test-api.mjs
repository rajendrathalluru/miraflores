import assert from 'node:assert/strict';
const base = process.env.MIRAFLORES_TEST_URL || 'http://127.0.0.1:3000';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname), 'Tests only target local development.');
let cookie = '';
async function call(path, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const value of response.headers.getSetCookie?.() || []) {
    const pair = value.split(';')[0];
    cookie = [...cookie.split('; ').filter(p => p && p.split('=')[0] !== pair.split('=')[0]), pair].join('; ');
  }
  const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, data };
}
assert.equal((await call('/api/bootstrap')).status,200, 'Loopback development workspace must load.');
assert.equal((await call('/api/persona',{actorId:'st-01'})).status,200);
let b = (await call('/api/bootstrap')).data;
assert.equal(b.stats.documentCount,74); assert.equal(b.stats.valueCount,3012);
assert.equal(b.versions.length,3); assert.equal(b.issues.length,16);
assert.equal((await call('/api/persona',{actorId:'unknown-role'})).status,400);
const source = (await call('/api/documents/D62')).data;
assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(JSON.stringify(source)));
assert(!/\b\d{2}-\d{7}\b/.test(JSON.stringify(source)));
assert((await call('/api/trace/SchC.9?version=v3')).data.nodes.some(n=>n.type==='evidence'));
const note={type:'add_note',body:'Development integration test: concurrent edits require an explicit latest revision.'};
const race=await Promise.all([call('/api/commands',{expectedRevision:b.workspace.revision,command:note}),call('/api/commands',{expectedRevision:b.workspace.revision,command:note})]);
assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
b=(await call('/api/bootstrap')).data;
assert.equal((await call('/api/commands',{expectedRevision:b.workspace.revision,command:{type:'resolve_note',noteId:b.workspace.notes.at(-1).id,reason:'Concurrent-write rejection verified in development.'}})).status,200);
assert.equal((await call('/api/persona',{actorId:'cu-01'})).status,200);
b=(await call('/api/bootstrap')).data;
assert.equal((await call('/api/commands',{expectedRevision:b.workspace.revision,command:note})).status,400);
assert.equal((await call('/api/persona',{actorId:'st-03'})).status,200);
b=(await call('/api/bootstrap')).data;
assert.equal((await call('/api/commands',{expectedRevision:b.workspace.revision,command:{type:'freeze'}})).status,400);
assert.equal((await call('/api/persona',{actorId:'st-01'})).status,200);
b=(await call('/api/bootstrap')).data;
if(!b.config.aiEnabled){
  const investigation=await call('/api/investigate',{prompt:'Investigate mileage',expectedRevision:b.workspace.revision});
  assert.equal(investigation.status,200); assert.equal(investigation.data.result.mode,'rules');
  assert(investigation.data.result.findings.some(f=>/miles|mileage/i.test(f.title)));
  assert.equal((await call('/api/investigate')).data.runs.length>0,true);
}
assert.equal((await call('/api/export')).status,200);

// This deliberately synthetic fixture stays labeled in the development data store.
const syntheticIdentifier = '123-45-6789';
const fixture = `Development integration storage fixture. Synthetic identifier ${syntheticIdentifier}; no real client information.\n`;
const form = new FormData();
form.set('file', new File([fixture], `development-storage-test-${syntheticIdentifier}.txt`, { type: 'text/plain' }));
form.set('issueId', 'duplicate-mileage');
const upload = await fetch(`${base}/api/attachments`, { method: 'POST', headers: { ...(cookie ? { cookie } : {}), Origin: base }, body: form });
assert.equal(upload.status, 201, 'A permitted local attachment must save.');
const saved = await upload.json();
assert.equal(typeof saved.id, 'string');
assert(!saved.name.includes(syntheticIdentifier), 'The upload response must mask identifiers in filenames.');
const listing = await call('/api/attachments');
assert.equal(listing.status, 200);
const listed = listing.data.attachments.find(item => item.id === saved.id);
assert(listed, 'Saved attachment metadata must remain queryable.');
assert(!listed.name.includes(syntheticIdentifier), 'Attachment listings must mask sensitive filenames.');
try {
  assert.equal((await call('/api/persona', { actorId: 'cu-01' })).status, 200);
  assert.equal((await call(`/api/attachments/${encodeURIComponent(saved.id)}`)).status, 403, 'Clients cannot retrieve unmasked original attachment bytes.');
  assert.equal((await call('/api/persona', { actorId: 'st-01' })).status, 200);
  const download = await fetch(`${base}/api/attachments/${encodeURIComponent(saved.id)}`, { headers: cookie ? { cookie } : {} });
  assert.equal(download.status, 200, 'Cleared staff must be able to retrieve their original attachment.');
  assert.equal(download.headers.get('content-type'), 'application/octet-stream');
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert(!(download.headers.get('content-disposition') || '').includes(syntheticIdentifier));
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), Buffer.from(fixture), 'Persisted original bytes must survive the upload/download path.');
} finally {
  assert.equal((await call('/api/persona', { actorId: 'st-01' })).status, 200);
}
console.log('Local API checks passed: loopback access, packet, masking, tracing, concurrent writes, role denial, filing gate, guided-run persistence, export, private upload/list and cleared-only exact-byte download.');
