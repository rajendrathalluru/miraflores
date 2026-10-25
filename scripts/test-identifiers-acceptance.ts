/** Isolated encryption/access tests. No real network, app database or plaintext output. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, chmod, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import packet from '../data/packet.json';
import { assertIdentifierAccess, decryptCorrection, encryptCorrection, getSensitiveSource, type EncryptedIdentifier } from '../lib/identifiers';

function encryptedRecord(prepared: Awaited<ReturnType<typeof encryptCorrection>>): EncryptedIdentifier {
  const [id, owner_id, actor_id, ref, ciphertext, iv, tag, created_at] = prepared.statement.args;
  return { id, owner_id, actor_id, ref, ciphertext, iv, tag, created_at };
}
async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), 'miraflores-identifier-acceptance-'));
  const concurrentDirectory = await mkdtemp(path.join(tmpdir(), 'miraflores-identifier-concurrent-'));
  const invalidDirectory = await mkdtemp(path.join(tmpdir(), 'miraflores-identifier-invalid-'));
  try {
    const ssnRef = packet.extracted_values.find(value => value.value_type === 'ssn')!.id;
    const accountRef = packet.extracted_values.find(value => value.value_type === 'account_number')!.id;
    const pinRef = packet.extracted_values.find(value => value.field === 'ip_pin')!.id;
    assert.throws(() => assertIdentifierAccess('unknown-role'));
    assert.throws(() => getSensitiveSource('st-04', ssnRef), /clearance/);
    assert.throws(() => getSensitiveSource('cu-01', ssnRef), /clearance/);
    assert.throws(() => assertIdentifierAccess('st-05', true), /tax staff/);
    assert.throws(() => getSensitiveSource('st-01', 'ev-1046'), /SSN|EIN|identifier|account/);
    assert.throws(() => getSensitiveSource('st-01', 'not-a-source'));
    const sensitive = getSensitiveSource('st-01', ssnRef);
    assert.equal(sensitive.field.id, ssnRef);
    assert(sensitive.printedContent.length > 0, 'Cleared source inspection needs the exact printed page as well as the reading.');
    const value = '123-45-6789';
    const prepared = await encryptCorrection('isolated-workspace', 'st-01', ssnRef, value,
      'Synthetic fixture: replace 1 2 3 - 4 5 - 6 7 8 9 after source review.', directory);
    assert(!JSON.stringify(prepared).includes(value));
    assert(!prepared.metadata.reason.includes('1 2 3'));
    const record = encryptedRecord(prepared);
    assert.equal(await decryptCorrection(record, directory), value);
    const keyBefore = await readFile(path.join(directory, 'identifier-key.bin'));
    assert.equal(keyBefore.length, 32);
    assert.equal((await stat(path.join(directory, 'identifier-key.bin'))).mode & 0o777, 0o600);
    const repeated = await encryptCorrection('isolated-workspace', 'st-01', ssnRef, value, 'Repeated encryption fixture.', directory);
    assert.notEqual(repeated.statement.args[4], prepared.statement.args[4], 'Fresh random IVs must prevent deterministic ciphertext.');
    assert.equal(await decryptCorrection(encryptedRecord(repeated), directory), value);
    assert.deepEqual(await readFile(path.join(directory, 'identifier-key.bin')), keyBefore, 'A later write cannot replace the protection key.');
    for (const field of ['id', 'owner_id', 'actor_id', 'ref', 'created_at'] as const) {
      await assert.rejects(decryptCorrection({ ...record, [field]: `${record[field]}-tampered` }, directory), /could not be opened/);
    }
    for (const field of ['ciphertext', 'iv', 'tag'] as const) {
      const changed = Buffer.from(record[field], 'base64'); changed[0] ^= 1;
      await assert.rejects(decryptCorrection({ ...record, [field]: changed.toString('base64') }, directory), /could not be opened/);
    }
    const formats = [
      ['ev-1045', '123 456 789', '12-3456789'],
      [accountRef, 'SE12 1234 5678 9012 3456 7890', 'SE1212345678901234567890'],
      [pinRef, '123456', '123456'],
    ];
    for (const [ref, input, expected] of formats) {
      const correction = await encryptCorrection('isolated-workspace', 'st-01', ref, input, 'Synthetic format fixture.', directory);
      assert.equal(await decryptCorrection(encryptedRecord(correction), directory), expected);
    }
    await assert.rejects(encryptCorrection('isolated-workspace', 'st-04', ssnRef, value, 'Denied fixture.', directory), /clearance/);
    await assert.rejects(encryptCorrection('isolated-workspace', 'cu-01', ssnRef, value, 'Denied fixture.', directory), /clearance/);
    await assert.rejects(encryptCorrection('isolated-workspace', 'st-01', ssnRef, '123', 'Bad shape fixture.', directory), /nine digits/);
    await assert.rejects(encryptCorrection('isolated-workspace', 'st-01', ssnRef, value, '', directory), /Explain/);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => encryptCorrection('concurrent-workspace', 'st-01', ssnRef, value, 'Concurrent key initialization fixture.', concurrentDirectory)));
    assert.equal(new Set(concurrent.map(item => item.statement.args[5])).size, 8);
    for (const correction of concurrent) assert.equal(await decryptCorrection(encryptedRecord(correction), concurrentDirectory), value);
    await writeFile(path.join(invalidDirectory, 'actual-key.bin'), keyBefore, { mode: 0o600 });
    await symlink(path.join(invalidDirectory, 'actual-key.bin'), path.join(invalidDirectory, 'identifier-key.bin'));
    await assert.rejects(encryptCorrection('isolated-workspace', 'st-01', ssnRef, value, 'Symlink key fixture.', invalidDirectory), /private owner-only/);
    await chmod(path.join(directory, 'identifier-key.bin'), 0o644);
    await assert.rejects(decryptCorrection(record, directory), /could not be opened/);
    console.log('Independent identifier acceptance passed: cleared-only exact source, staff-only corrections, normalized formats, reason redaction, AES-GCM durable private key, fresh nonces, authenticated metadata/ciphertext, concurrent key initialization, unsafe-key denial and no plaintext output.');
  } finally {
    await Promise.all([directory, concurrentDirectory, invalidDirectory].map(directory => rm(directory, { recursive: true, force: true })));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
