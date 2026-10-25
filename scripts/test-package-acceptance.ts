/** Independently inspect generated artifacts without using a live browser or API. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import packet from '../data/packet.json';
import { initialWorkspace } from '../lib/domain';
import { examinationPackage, clientCopy } from '../lib/packages';

async function main() {
  const state = initialWorkspace();
  state.notes.push({ id: 'hostile-fixture', actorId: 'st-01', body: 'Synthetic 123-45-6789 </script><script>alert("fixture")</script>', status: 'open', createdAt: '2026-10-24T12:00:00Z' });
  const bytes = Buffer.from('Synthetic private original fixture\n\x00\xff', 'binary');
  const attachment = { id: 'package-test-fixture', name: 'Synthetic <unsafe> filename.txt', size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), base64: bytes.toString('base64') };
  const html = await examinationPackage(state, [attachment]);
  const embedded = /<script id="miraflores-record" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  assert(embedded, 'The offline record must contain a parseable passive data block.');
  const record = JSON.parse(embedded[1]);
  assert.equal(record.format, 'miraflores-self-contained-exam-v2');
  assert.equal(record.packet.documents.length, 74);
  assert.equal(record.packet.documents.flatMap((document: { pages: unknown[] }) => document.pages).length, 199);
  assert.equal(record.packet.extracted_values.length, 3012);
  assert.deepEqual(record.packet.return_versions.map((version: { lines: unknown[] }) => version.lines.length), [625, 625, 627]);
  for (const key of ['prior_years', 'client', 'timeline', 'tax_agency_records', 'engine_reference', 'what_if', 'planning_reference_2026']) assert(key in record.packet, `Offline package must retain ${key}.`);
  assert.equal(record.attachmentManifest.length, 1);
  assert.deepEqual(record.attachmentManifest[0], { id: attachment.id, name: attachment.name, size: bytes.length, sha256: attachment.sha256 });
  const payload = /href="data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)"/.exec(html);
  assert(payload, 'An uploaded original must be embedded, not linked to a live database.');
  assert.deepEqual(Buffer.from(payload[1], 'base64'), bytes);
  assert.equal(createHash('sha256').update(Buffer.from(payload[1], 'base64')).digest('hex'), attachment.sha256);
  const expectedDigest = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  assert(html.includes(`Record SHA-256: <code>${expectedDigest}</code>`), 'The exported record digest must match the embedded canonical record.');
  assert.equal((html.match(/<script\b/g) ?? []).length, 1, 'No source text may inject an executable script.');
  assert(!/<script(?![^>]*type="application\/json")/i.test(html));
  assert(html.includes("default-src 'none'"), 'Offline package must block network and executable resources.');
  assert(html.includes("base-uri 'none'"));
  assert(!/(?:src|href)="https?:\/\//i.test(html), 'Offline review cannot depend on remote assets or a running app.');
  assert(!html.includes('123-45-6789'), 'Masking must apply to rendered review history as well as embedded data.');
  for (const person of packet.household.people) assert(!html.includes(person.ssn), 'Full household SSNs cannot appear in masked source records.');
  assert.equal((html.match(/id="document-D\d+"/g) ?? []).length, 74);
  assert.equal((html.match(/id="field-ev-\d+"/g) ?? []).length, 3012);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert(ids.has(target), `Offline source link #${target} needs an existing target.`);
  const client = clientCopy(state);
  assert(client.includes('CLIENT COPY'));
  assert(client.includes('not a filed Form 1040'));
  assert(client.includes('Separate reviewed estimates'));
  for (const line of packet.return_versions.at(-1)!.lines) assert(client.includes(line.key), `Client copy must retain the supplied ${line.key} calculation record.`);
  assert(client.includes('Next steps'));
  assert(!client.includes('123-45-6789'));
  assert(!client.includes(attachment.base64), 'The client summary must not silently include private original attachments.');
  console.log('Independent package acceptance passed: all 74 documents/199 pages/3,012 fields/1,877 lines, complete packet context, masked history, valid offline anchors, passive escaped JSON, matching record/attachment hashes, exact original bytes, offline CSP and safe client preview.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
