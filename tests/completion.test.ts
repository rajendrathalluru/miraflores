import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommand, emptyState, actorFor, stateHash } from '../lib/workflow';
import { currentVersion, type Packet, type Row } from '../lib/types';
import { inspectPacket } from '../lib/invariants';
import { varianceRows } from '../lib/checks';
import { booksBridge, paymentRows } from '../lib/reconciliation';
import { changesSince, reviewedAsset, directEffect } from '../lib/review';
import { makeHandoff, validateHandoff, restoredState } from '../lib/handoff';
import { digest } from '../lib/packet';
import { reviewReport } from '../lib/report';
import { salesRows } from '../lib/sales';
const p = JSON.parse(readFileSync('data/seed-packet.json', 'utf8')) as Packet,
  v = currentVersion(p),
  actor = actorFor(p, 'st-01');
test('payment and credit effects override arbitrary marginal category and direction', () => {
  for (const [key, expectedFed, expectedCA] of [
    ['F1040.33', -100, 0],
    ['F1040.19', -100, 0],
    ['Sch3.10', -100, 0],
    ['F540NR.72', 0, -100],
    ['F540NR.39', 0, -100],
    ['F1040.24', 100, 0],
  ] as const) {
    const line = v.lines.find((l: any) => l.key === key)!;
    const s = applyCommand(p, emptyState(p), actor, {
      type: 'adjust',
      target: key,
      value: line.value + 100,
      category: 'interest',
      direction: 92,
      reason: 'Test supported direct effect.',
    });
    const a = s.adjustments.at(-1)!;
    assert.equal(a.federal, expectedFed, key);
    assert.equal(a.california, expectedCA, key);
    assert.equal(a.category, 'direct');
  }
  assert.equal(directEffect(v.lines.find((l: any) => l.key === 'F1040.2b'))?.sign, undefined);
});
test('source and asset corrections preserve baseline and invalidate material approvals', () => {
  for (const asset of v.assets)
    assert.deepEqual(reviewedAsset(asset, emptyState(p), v.version), asset);
  const baseline = digest(p);
  let s = emptyState(p);
  const h = stateHash(p, s);
  s = applyCommand(p, s, actor, {
    type: 'adjust',
    target: 'asset:STU-PRINTER/federal.depreciation_2025',
    value: 7600,
    reason: 'Reviewed alternative treatment, tax line remains separate.',
  });
  assert.equal(
    reviewedAsset(
      v.assets.find((a: any) => a.asset_id === 'STU-PRINTER'),
      s,
      v.version,
    ).federal.depreciation_2025,
    7600,
  );
  assert.equal(s.adjustments[0].federal, 0);
  assert.notEqual(stateHash(p, s), h);
  assert.equal(digest(p), baseline);
  const identity =
    p.extracted_values.find((e) => e.value_type === 'ssn' && e.document_id === 'D72') ||
    p.extracted_values.find((e) => e.value_type === 'ssn')!;
  const changed = applyCommand(p, s, actor, {
    type: 'adjust',
    target: identity.id,
    value: identity.value,
    reason: 'Identity correction supported by source.',
  });
  assert.equal(changed.adjustments.at(-1)?.targetType, 'field');
  const uncleared = actorFor(p, 'st-04');
  assert.throws(
    () =>
      applyCommand(p, s, uncleared, {
        type: 'adjust',
        target: identity.id,
        value: identity.value,
        reason: 'Must enforce clearance.',
      }),
    /clearance/,
  );
  assert.throws(() =>
    applyCommand(p, s, actor, {
      type: 'adjust',
      target: 'asset:STU-PRINTER/__proto__.polluted',
      value: 2,
      reason: 'Invalid property.',
    }),
  );
});
test('independent source checks cover the design cases without inventing duplicate wages', () => {
  const findings = inspectPacket(p, v);
  for (const id of [
    'duplicate-document-D09-D10',
    'state-wage-D09-D73',
    'stock-basis-F8949.B.N1',
    'stock-basis-F8949.B.N3',
    'stock-basis-F8949.E.N4',
    'capitalization-D47',
    'basis-rollforward-F7203',
    'payment-reconciliation-F1040.26',
    'payment-reconciliation-F540NR.72',
  ])
    assert(
      findings.some((f) => f.id === id),
      id,
    );
  assert.equal(findings.find((f) => f.id === 'duplicate-document-D09-D10')?.severity, 'info');
  assert.equal(findings.find((f) => f.id === 'basis-rollforward-F7203')?.severity, 'info');
  assert(!findings.some((f) => f.id === 'stock-basis-F8949.A.N2'));
  assert.equal(varianceRows(p, v).length, 51);
  assert.equal(findings.filter((f) => f.id.startsWith('variance-')).length, 51);
  const modified = structuredClone(p);
  modified.extracted_values.find((e) => e.id === 'ev-1081')!.value = 111300;
  assert(
    !inspectPacket(modified, currentVersion(modified)).some((f) => f.id === 'state-wage-D09-D73'),
  );
});
test('since-seen events exclude acknowledgments and preserve per-reviewer markers', () => {
  let s = applyCommand(p, emptyState(p), actor, {
    type: 'judgment',
    target: 'all',
    reason: 'Supported decision',
    authority: 'Source record',
  });
  assert.equal(changesSince(s, actor.id).events.length, 1);
  s = applyCommand(p, s, actor, { type: 'seen' });
  assert.equal(changesSince(s, actor.id).events.length, 0);
  assert.equal(changesSince(s, 'st-02').events.length, 1);
  s = applyCommand(p, s, actor, {
    type: 'plan',
    title: 'Next year',
    body: 'Preserve prior evidence.',
  });
  assert.equal(changesSince(s, actor.id).events.length, 1);
});
test('books bridge ties source profit and individually supported book-tax treatments', () => {
  const b = booksBridge(p, v)!;
  assert.equal(b.start, 89834);
  assert.equal(b.expected, 81854);
  assert.equal(b.gap, 0);
  assert(b.rows.some((r) => /health/i.test(r.label) && r.delta === 14400));
  const s = applyCommand(p, emptyState(p), actor, {
    type: 'adjust',
    target: 'SchC.24b',
    value: 1500,
    category: 'schc_profit',
    direction: -1,
    reason: 'Explicitly reviewed meals input.',
  });
  assert.notEqual(booksBridge(p, v, s)!.gap, 0);
  const payments = paymentRows(p, v);
  assert.equal(payments.rows.find((r) => r.id === 'F1040.26')?.gap, 1000);
  assert.equal(payments.rows.find((r) => r.id === 'F540NR.72')?.gap, 3500);
  assert.equal(paymentRows(p, v, undefined, 0).rows.find((r) => r.id === 'Sch3.10')?.agency, null);
});
test('complete handoff preserves evidence and imported history while clearing live approvals', () => {
  const data = Buffer.from('private source evidence').toString('base64');
  const file = {
    id: 'file-original',
    name: 'source.txt',
    mime: 'text/plain',
    data_base64: data,
    content_hash: digest(data),
  };
  const s = emptyState(p);
  s.evidence.push({ id: 'evidence-original', fileId: file.id });
  s.signoffs.push({ id: 'approval-original', level: 'client' });
  const archive = makeHandoff('source-engagement', p, s, [file]);
  assert.equal(validateHandoff(archive).attachments[0].data_base64, data);
  const restored = restoredState(validateHandoff(archive), 'copy', actor);
  assert.equal(restored.signoffs.length, 0);
  assert.equal(restored.evidence[0].fileId, 'copy-file-original');
  assert.equal(archive.payload.state.signoffs.length, 1);
  const nested = makeHandoff('following-year', p, s, [file], archive);
  assert.equal(validateHandoff(nested).state.revision, s.revision);
  const broken = structuredClone(archive);
  broken.payload.attachments[0].data_base64 = 'broken';
  assert.throws(() => validateHandoff(broken), /integrity/);
  const missing = makeHandoff('source', p, s, []);
  assert.throws(() => validateHandoff(missing), /missing/);
});
test('self-contained printable record escapes source text and preserves evidence bytes', () => {
  const q = structuredClone(p);
  q.documents[0].title = '<script>bad()</script>';
  const s = emptyState(q);
  const html = reviewReport(q, s, {
    kind: 'defense',
    engagement: 'test',
    packetHash: digest(q),
    files: [{ name: 'evidence.txt', data_base64: 'YWJj', content_hash: 'hash' }],
  });
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
  assert(html.includes('data:application/octet-stream;base64,YWJj'));
  assert(html.includes('Source documents'));
  assert(html.includes('Captured review history'));
});

test('unknown source basis is not replaced by the engine zero-basis assumption', () => {
  const sale = salesRows(p, v).find((s: Row) => s.key === 'F8949.H.C6');
  assert.equal(sale?.basis, null);
  assert.equal(sale?.gain, 5325);
});
test('dependent total overlays cannot double-count an existing tax effect', () => {
  const s = applyCommand(p, emptyState(p), actor, {
    type: 'adjust',
    target: 'F1040.26',
    value: 12000,
    reason: 'Agency payment reconciliation.',
  });
  assert.throws(
    () =>
      applyCommand(p, s, actor, {
        type: 'adjust',
        target: 'F1040.33',
        value: 76742,
        reason: 'Must not count the same payment change again.',
      }),
    /overlaps/,
  );
});

test('firm policy changes are unread across engagements until acknowledged', () => {
  let s = emptyState(p);
  s.firmPolicyRevision = 2;
  s.firmPolicyEvents = [
    {
      id: 'policy-event',
      scope: 'firm',
      policyRevision: 2,
      at: '2026-10-28T17:00:00Z',
      type: 'standard',
      detail: 'Shared standard',
      revision: 8,
    },
  ];
  assert.equal(changesSince(s, actor.id).events.length, 1);
  s = applyCommand(p, s, actor, { type: 'seen' });
  assert.equal(changesSince(s, actor.id).events.length, 0);
  assert.equal(changesSince(s, 'st-02').events.length, 1);
});
test('source verification and related-return links use validated references', () => {
  let s = applyCommand(p, emptyState(p), actor, {
    type: 'verify',
    target: 'ev-0404',
    method: 'recalculated',
    reason: 'Unique page total corroborated.',
  });
  assert.equal(s.verifications['ev-0404'].value, 3700);
  s = applyCommand(p, s, actor, {
    type: 'verify',
    target: 'asset:STU-PRINTER/cost',
    method: 'agreed_to_source_document',
    reason: 'Invoice agreed.',
  });
  assert.equal(s.verifications['asset:STU-PRINTER/cost'].value, 14200);
  s = applyCommand(p, s, actor, {
    type: 'link',
    target: 'F7203.1',
    related: 'return:1',
    reason: 'Related entity prepared by another firm; K-1s supplied.',
  });
  assert.equal(s.links.at(-1)?.related, 'return:1');
  assert.throws(() =>
    applyCommand(p, s, actor, {
      type: 'link',
      target: 'F7203.1',
      related: 'py:/not_a_record',
      reason: 'Must reject missing reference.',
    }),
  );
});
