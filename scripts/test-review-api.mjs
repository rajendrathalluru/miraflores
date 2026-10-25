import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Run only against the coordinator's disposable isolated loopback server/data dir.
const base = process.env.MIRAFLORES_TEST_URL || 'http://127.0.0.1:3000';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Integration checks only target loopback.');
let cookie = '';
async function call(path, body) {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: {
    ...(cookie ? { cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const value of response.headers.getSetCookie?.() || []) {
    const pair = value.split(';')[0];
    cookie = [...cookie.split('; ').filter(item => item && item.split('=')[0] !== pair.split('=')[0]), pair].join('; ');
  }
  return { status: response.status, data: await response.json() };
}
assert.equal((await call('/api/persona', { actorId: 'st-01' })).status, 200);
const before = await call('/api/bootstrap');
assert.equal(before.status, 200);
const context = await call('/api/review-context?issueId=duplicate-mileage&version=v3');
assert.equal(context.status, 200);
assert.equal(context.data.token.editRevision, before.data.workspace.revision);
assert.equal(context.data.token.engineVersion, 'v3');
assert.equal(context.data.token.packetSha256.length, 64);
assert(context.data.documents.some(item => item.document.id === 'D23' && item.document.pages.some(page => page.page === 3)));
assert(context.data.evidence.some(item => item.ref === 'ev-0226' && item.field));
assert(context.data.permittedActions.includes('workflow:document_disposition'));
assert.equal((await call('/api/review-context?ref=SchC.9&version=v2')).data.permittedActions.length, 0);
assert.equal((await call('/api/review-context?ref=line%3Av1%3ASchC.9&version=v3')).status, 400);
assert.equal((await call('/api/review-context?ref=missing-record')).status, 404);
const requestId = randomUUID();
const payload = { expectedRevision: before.data.workspace.revision, requestId,
  actorId: 'st-01',
  command: { type: 'add_note', issueId: 'duplicate-mileage', body: `Isolated API receipt acceptance ${requestId}: internal staff note.` } };
const results = await Promise.all([call('/api/commands', payload), call('/api/commands', payload)]);
assert(results.every(result => result.status === 200), 'Concurrent exact retries must reconcile to one committed result.');
assert.equal(results[0].data.workspace.revision, before.data.workspace.revision + 1);
assert.deepEqual(results[0].data.workspace, results[1].data.workspace);
const committed = results[0].data.workspace;
assert.equal(committed.notes.filter(note => note.body.includes(requestId)).length, 1);
assert.equal(results[0].data.request.id, requestId);
assert.equal(results[0].data.request.revision, committed.revision);
const receipt = await call(`/api/commands?requestId=${requestId}`);
assert.equal(receipt.status, 200);
assert.equal(receipt.data.status, 'committed');
assert.equal(receipt.data.revision, committed.revision);
const changedBody = await call('/api/commands', { ...payload, command: { ...payload.command, body: 'Different content with the same identity must be rejected.' } });
assert.equal(changedBody.status, 409);
assert.equal(changedBody.data.conflict.currentRevision, committed.revision);
assert(changedBody.data.conflict.changedRefs.includes('duplicate-mileage'));
const stale = await call('/api/commands', { ...payload, requestId: randomUUID() });
assert.equal(stale.status, 409);
assert.equal(stale.data.conflict.contentRevision, committed.revision);
assert(stale.data.conflict.changes.length > 0);
assert.equal((await call('/api/bootstrap')).data.workspace.revision, committed.revision);

assert.equal((await call('/api/persona', { actorId: 'cu-01' })).status, 200);
assert.equal((await call(`/api/commands?requestId=${requestId}`)).data.status, 'unknown', 'Receipt status must not cross actor identity.');
assert.equal((await call(`/api/commands?requestId=${requestId}&actorId=st-01`)).status, 409, 'An expected actor mismatch must not reconcile under a different persona.');
const wrongActorRequest = randomUUID();
const wrongActor = await call('/api/commands', { expectedRevision: committed.revision, requestId: wrongActorRequest, actorId: 'st-01',
  command: { type: 'client_approve' } });
assert.equal(wrongActor.status, 409, 'A shared-cookie role change cannot execute a pending command under the new persona.');
assert.equal((await call('/api/bootstrap')).data.workspace.revision, committed.revision);
assert.equal((await call(`/api/commands?requestId=${wrongActorRequest}`)).data.status, 'unknown');
const clientContext = await call('/api/review-context?issueId=duplicate-mileage');
assert.equal(clientContext.status, 200);
assert.equal(clientContext.data.decisions.notes.length, 0);
assert.equal(clientContext.data.decisions.adjustments.length, 0);
assert(!JSON.stringify(clientContext.data).includes('internal staff note'));
assert.equal(clientContext.data.accessMode, 'local-evaluator-sandbox');
assert.equal((await call('/api/persona', { actorId: 'st-01' })).status, 200);
// A later mutation does not change the original request receipt/result.
const noteId = committed.notes.find(note => note.body.includes(requestId)).id;
const resolved = await call('/api/commands', { expectedRevision: committed.revision, requestId: randomUUID(),
  command: { type: 'resolve_note', noteId, reason: 'Isolated API receipt regression complete.' } });
assert.equal(resolved.status, 200);
const originalRetry = await call('/api/commands', payload);
assert.equal(originalRetry.status, 200);
assert.equal(originalRetry.data.workspace.revision, committed.revision);
assert.equal((await call('/api/bootstrap')).data.workspace.revision, resolved.data.workspace.revision);
assert.equal((await call(`/api/commands?requestId=${requestId}`)).data.workspaceRevision, resolved.data.workspace.revision);
const records = (await call('/api/records?version=v3')).data;
const firstComputation = Date.parse(before.data.versions[0].computedAt);
const finalComputation = Date.parse(before.data.versions[2].computedAt);
const event = records.timeline.find(item => Date.parse(item.at) > firstComputation && Date.parse(item.at) < finalComputation);
assert(event, 'Fixture must include a historical stage after v1 and before v3.');
const replay = await call('/api/commands', { expectedRevision: resolved.data.workspace.revision, requestId: randomUUID(),
  command: { type: 'workflow', action: 'set_replay', payload: { eventId: event.id } } });
assert.equal(replay.status, 200);
const historical = await call('/api/review-context?issueId=duplicate-mileage&version=v1');
assert.equal(historical.status, 200);
assert.equal(historical.data.token.replay.readOnly, true);
assert.equal(historical.data.token.replay.eventId, event.id);
assert.equal(historical.data.permittedActions.length, 0);
assert.equal((await call('/api/review-context?issueId=duplicate-mileage&version=v3')).status, 400);
const leaveReplay = await call('/api/commands', { expectedRevision: replay.data.workspace.revision, requestId: randomUUID(), actorId: 'st-01',
  command: { type: 'workflow', action: 'set_replay', payload: { eventId: null } } });
assert.equal(leaveReplay.status, 200);
const currentAgain = await call('/api/review-context?issueId=duplicate-mileage&version=v3');
assert.equal(currentAgain.status, 200);
assert.equal(currentAgain.data.token.replay, null);
assert(currentAgain.data.permittedActions.includes('workflow:verify_value'));
const guardRevision = currentAgain.data.token.editRevision;
const protectedMismatch = await call('/api/identifier-corrections', { actorId: 'st-02', expectedRevision: guardRevision, ref: 'ev-0404', value: '', reason: 'Actor-guard regression; rejected before encryption.' });
assert.equal(protectedMismatch.status, 409, 'Protected correction must reject a stale persona before processing any value.');
const upload = new FormData();
upload.append('actorId', 'st-02'); upload.append('expectedRevision', String(guardRevision));
upload.append('file', new Blob(['actor guard regression'], { type: 'text/plain' }), 'guard-test.txt');
const uploadMismatch = await fetch(`${base}/api/attachments`, { method: 'POST', headers: { cookie, Origin: base }, body: upload });
assert.equal(uploadMismatch.status, 409, 'Evidence upload must reject a stale persona before writing bytes.');
assert.equal((await call('/api/bootstrap')).data.workspace.revision, guardRevision, 'Denied private writes cannot advance the review revision.');
console.log('Review API checks passed: captured context, historical/read-only replay, idempotent concurrent retry/status/body binding, enriched stale conflicts, actor-scoped commands/private writes and client decision visibility.');
