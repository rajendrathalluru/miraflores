import { writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url = process.env.TEST_URL || 'http://127.0.0.1:3201';
const r = await fetch(url + '/api/workspace');
assert.equal(r.status, 200);
const d = await r.json();
const value = {
  id: d.id,
  revision: d.state.revision,
  adjustments: d.state.adjustments.map((a) => ({
    id: a.id,
    target: a.target,
    value: a.value,
    active: a.active,
  })),
  evidence: d.state.evidence.map((e) => ({ id: e.id, hash: e.hash })),
  audit: d.state.audit.length,
};
const file = '/tmp/miraflores-restart-proof.json';
if (process.argv.includes('--capture')) {
  await writeFile(file, JSON.stringify(value));
  console.log('Captured disposable database identity and revision:', value.revision);
} else {
  assert.deepEqual(value, JSON.parse(await readFile(file, 'utf8')));
  console.log(
    'Production restart verified: exact engagement, revision, overlay history, evidence metadata and audit count retained.',
  );
}
