/** Focused regression: interleaved evidence cannot enter a captured export revision. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialWorkspace, applyCommand } from '../lib/domain';
import { captureExportManifest, ExportManifestError, verifyExportBytes, type ExportAttachmentRow } from '../lib/export-manifest';
import type { EncryptedIdentifier } from '../lib/identifiers';

const owner = 'manifest-test-owner';
const bytes = Buffer.from('Synthetic private evidence for captured revision.');
const hash = createHash('sha256').update(bytes).digest('hex');
const file: ExportAttachmentRow = { id: 'original-one', owner_id: owner, name: 'Synthetic.txt', object_key: 'private/original-one', size: bytes.length };
const correction: EncryptedIdentifier = { id: 'correction-one', owner_id: owner, actor_id: 'st-01', ref: 'ev-1045', ciphertext: 'ciphertext-fixture', iv: 'iv-fixture', tag: 'tag-fixture', created_at: '2026-10-24T12:00:00Z' };
let selected = applyCommand(initialWorkspace(), { type: 'workflow', action: 'attach_evidence', payload: { id: file.id, name: file.name, size: file.size, contentType: 'text/plain', sha256: hash } }, 'st-01');
selected = applyCommand(selected, { type: 'workflow', action: 'identifier_correction', payload: { id: correction.id, ref: correction.ref, reason: 'Synthetic source-supported correction metadata.' } }, 'st-01');
const selectedRevision = selected.revision;
const capturedState = structuredClone(selected);

// Simulate the old route's interleaving: state was captured, then a newer upload
// and correction committed before metadata lookup. Only captured IDs may export.
const laterFile = { ...file, id: 'original-two', object_key: 'private/original-two' };
const laterCorrection = { ...correction, id: 'correction-two' };
let later = applyCommand(selected, { type: 'workflow', action: 'attach_evidence', payload: { id: laterFile.id, name: laterFile.name, size: laterFile.size, contentType: 'text/plain', sha256: hash } }, 'st-01');
later = applyCommand(later, { type: 'workflow', action: 'identifier_correction', payload: { id: laterCorrection.id, ref: laterCorrection.ref, reason: 'Later synthetic source correction.' } }, 'st-01');
const manifest = captureExportManifest(capturedState, owner, [file, laterFile], [correction, laterCorrection]);
assert.equal(manifest.state.revision, selectedRevision);
assert.deepEqual(manifest.attachments.map(item => item.id), [file.id]);
assert.deepEqual(manifest.corrections.map(item => item.id), [correction.id], 'A later correction to the same field cannot replace captured evidence.');
assert.equal(captureExportManifest(later, owner, [file, laterFile], [correction, laterCorrection]).attachments.length, 2);

verifyExportBytes(manifest.attachments[0], bytes);
assert.throws(() => verifyExportBytes(manifest.attachments[0], Buffer.from('Tampered original')), ExportManifestError);
assert.throws(() => verifyExportBytes(manifest.attachments[0], Buffer.alloc(bytes.length)), ExportManifestError, 'Equal size alone cannot prove byte identity.');
assert.throws(() => captureExportManifest(capturedState, owner, [], [correction]), ExportManifestError, 'Missing selected originals must fail, not silently shrink the export.');
assert.throws(() => captureExportManifest(capturedState, owner, [file], []), ExportManifestError);
assert.throws(() => captureExportManifest(capturedState, owner, [{ ...file, owner_id: 'another-owner' }], [correction]), ExportManifestError);
assert.throws(() => captureExportManifest(capturedState, owner, [{ ...file, name: 'Changed.txt' }], [correction]), ExportManifestError);
assert.throws(() => captureExportManifest(capturedState, owner, [file], [{ ...correction, ref: 'ev-9999' }]), ExportManifestError);
assert.throws(() => captureExportManifest(capturedState, owner, [file], [{ ...correction, actor_id: 'st-03' }]), ExportManifestError);
assert.throws(() => captureExportManifest(capturedState, owner, [file, file], [correction]), ExportManifestError);
const missingHash = structuredClone(capturedState);
delete missingHash.workpaper!.attachments[0].sha256;
assert.throws(() => captureExportManifest(missingHash, owner, [file], [correction]), ExportManifestError, 'Every included original requires a recorded expected hash.');

capturedState.revision += 100;
capturedState.workpaper!.attachments[0].name = 'Mutated state';
file.name = 'Mutated row';
correction.ciphertext = 'Mutated ciphertext';
assert.equal(manifest.state.revision, selectedRevision);
assert.equal(manifest.attachments[0].name, 'Synthetic.txt');
assert.equal(manifest.corrections[0].ciphertext, 'ciphertext-fixture');
console.log('Export manifest regression passed: captured revision, exact evidence IDs, later upload/correction exclusion, missing metadata/hash denial, immutable capture and byte tamper rejection.');
