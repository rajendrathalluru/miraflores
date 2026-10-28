import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePacket, digest, mask, trace, resolveRef } from '../lib/packet';
import { inspectPacket } from '../lib/invariants';
import {
  applyCommand,
  emptyState,
  actorFor,
  stateHash,
  filingGates,
  outsideObligations,
} from '../lib/workflow';
import { currentVersion, workingValue, estimatedTotals, type Packet } from '../lib/types';
const p = JSON.parse(readFileSync('data/seed-packet.json', 'utf8')) as Packet;
const v = currentVersion(p),
  a = actorFor(p, 'st-01');
test('delivered packet: unique identities, dynamic versions, full tracing', () => {
  validatePacket(p);
  assert.equal(p.documents.length, 74);
  assert.equal(p.extracted_values.length, 3012);
  for (const ver of p.return_versions) {
    for (const l of ver.lines) {
      const t = trace(p, ver, l.key);
      assert(t.nodes.some((n) => n.key === l.key));
      for (const r of t.refs) {
        assert.notEqual(resolveRef(p, ver, r).kind, 'unknown', `${ver.version}/${l.key}: ${r}`);
      }
    }
  }
});
test('invariants are computed from the selected version and literal evidence', () => {
  const f = inspectPacket(p, v);
  const mile = f.find((x) => x.id === 'duplicate-page-D23')!;
  assert.equal(mile.proposed, 8100);
  assert.equal(mile.target, 'SchC.44a');
  assert.equal(mile.refs[0], 'ev-0404');
  const gap = f.find((x) => x.id === 'broker-gap-D31')!;
  assert(gap.detail.includes('$250'));
  assert(f.some((x) => x.id === 'identity-theo'));
  assert(!f.some((x) => x.id === 'identity-ngozi' || x.id === 'identity-erik'));
  assert(f.some((x) => x.id === 'duplicate-interest-SchB.1.2'));
  assert.equal(f.find((x) => x.id === 'duplicate-document-D09-D10')?.severity, 'info');
  assert(!f.some((x) => x.id === 'duplicate-document-D09-D10' && x.severity === 'critical'));
});
test('ordinary overlays preserve engine output, estimate conversion and complete undo history', () => {
  const before = digest(p);
  const base = emptyState(p);
  const changed = applyCommand(p, base, a, {
    type: 'adjust',
    target: 'SchC.44a',
    value: 8100,
    category: 'schc_profit',
    direction: -0.7,
    reason: 'Page three repeats page two; unique page totals support 8,100 miles.',
    refs: ['ev-0404'],
  });
  assert.equal(v.lines.find((x: any) => x.key === 'SchC.44a').value, 11800);
  assert.equal(
    workingValue(
      v.lines.find((x: any) => x.key === 'SchC.44a'),
      changed,
      v.version,
    ),
    8100,
  );
  assert.equal(estimatedTotals(v, changed).federal, 919.45);
  assert.equal(digest(p), before);
  assert.equal(base.revision, 0);
  const undone = applyCommand(p, changed, a, {
    type: 'undo',
    id: changed.adjustments[0].id,
    reason: 'Reopen source analysis.',
  });
  assert.equal(estimatedTotals(v, undone).federal, 0);
  assert.equal(undone.audit.length, 2);
  assert.equal(undone.adjustments.length, 1);
});
test('source and computation stays separate across five arbitrary engine versions', () => {
  const q = structuredClone(p);
  q.return_versions = Array.from({ length: 5 }, (_, i) => ({
    ...structuredClone(v),
    version: `release-${i + 1}`,
  }));
  validatePacket(q);
  const s = applyCommand(q, emptyState(q), a, {
    type: 'adjust',
    target: 'SchB.1.2',
    value: 0,
    category: 'interest',
    reason: 'Duplicate reporting supported by two sources.',
  });
  assert.equal(s.adjustments[0].version, 'release-5');
  assert.throws(
    () =>
      applyCommand(q, s, a, {
        type: 'verify',
        version: 'release-2',
        target: 'SchB.1.2',
        method: 'recalculated',
        reason: 'Historical must not change.',
      }),
    /read-only/,
  );
});
test('role, replay, own-review, required reason and frozen gates enforce on the server', () => {
  const s = emptyState(p);
  for (const id of ['cu-01', 'examiner', 'st-05'])
    assert.throws(() =>
      applyCommand(p, s, actorFor(p, id), {
        type: 'adjust',
        target: 'SchC.44a',
        value: 0,
        category: 'schc_profit',
        reason: 'Attempt',
      }),
    );
  assert.throws(
    () =>
      applyCommand(p, s, a, {
        type: 'verify',
        target: 'F1040.11',
        replay: true,
        method: 'source',
        reason: 'Replay',
      }),
    /read-only/,
  );
  assert.throws(
    () =>
      applyCommand(p, s, a, {
        type: 'adjust',
        target: 'SchB.1.2',
        value: 0,
        category: 'interest',
        reason: '',
      }),
    /Reason/,
  );
  const signed = applyCommand(p, s, a, { type: 'signoff', area: 'business', level: 'preparer' });
  assert.throws(() =>
    applyCommand(p, signed, a, { type: 'signoff', area: 'business', level: 'reviewer' }),
  );
  const frozen = { ...s, filing: { status: 'filed' } };
  assert.throws(
    () =>
      applyCommand(p, frozen, a, {
        type: 'verify',
        target: 'F1040.11',
        method: 'source',
        reason: 'Cannot mutate frozen',
      }),
    /frozen/,
  );
  assert(filingGates(p, s).some((g) => g.count > 0));
  assert.throws(() => applyCommand(p, s, actorFor(p, 'st-03'), { type: 'file' }), /Filing blocked/);
});
test('approval hashes reopen on material changes; invalid bulk edits roll back entirely', () => {
  const s = emptyState(p);
  const signed = applyCommand(p, s, actorFor(p, 'st-02'), {
    type: 'signoff',
    area: 'business',
    level: 'reviewer',
  });
  assert.equal(signed.signoffs[0].hash, stateHash(p, signed, 'business'));
  const changed = applyCommand(p, signed, a, {
    type: 'adjust',
    target: 'SchC.44a',
    value: 8100,
    direction: -0.7,
    category: 'schc_profit',
    reason: 'Distinct log pages.',
  });
  assert.notEqual(changed.signoffs[0].hash, stateHash(p, changed, 'business'));
  assert.throws(() =>
    applyCommand(p, s, a, {
      type: 'bulk_verify',
      targets: ['F1040.11', 'not-a-line'],
      method: 'recalculated',
      reason: 'Atomic bulk test',
    }),
  );
  assert.equal(Object.keys(s.verifications).length, 0);
  assert.equal(s.revision, 0);
});
test('default projections mask all typed sensitive fields and literal SSN/EIN patterns', () => {
  const safe = mask(p);
  assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(JSON.stringify(safe)));
  assert(!/\b\d{2}-\d{7}\b/.test(JSON.stringify(safe)));
  for (const e of safe.extracted_values.filter((e: any) =>
    ['ssn', 'ein', 'account_number'].includes(e.value_type),
  ))
    assert.equal(e.value, '••••••••');
  assert.equal(safe.household.people[0].ssn, '••••••••');
});
test('malformed imports fail before a baseline can be created', () => {
  const q = structuredClone(p);
  q.documents.push(q.documents[0]);
  assert.throws(() => validatePacket(q), /unique/);
  const r = structuredClone(p);
  r.extracted_values[0].page = 999;
  assert.throws(() => validatePacket(r), /source location/);
  const incomplete = structuredClone(p);
  delete incomplete.return_versions[0].assets;
  assert.throws(() => validatePacket(incomplete), /assets/);
  const unsafeRole = structuredClone(p);
  unsafeRole.firm.staff[0].role = 'superuser';
  assert.throws(() => validatePacket(unsafeRole), /supported/);
});
test('bulk verification undo is atomic and will not erase a colleague’s later verification', () => {
  const s = emptyState(p);
  const b = applyCommand(p, s, a, {
    type: 'bulk_verify',
    targets: ['F1040.11', 'F1040.15'],
    method: 'recalculated',
    reason: 'Both numbers agreed to the supplied graph.',
  });
  assert.equal(Object.keys(b.verifications).length, 2);
  const undone = applyCommand(p, b, a, {
    type: 'undo_batch',
    id: b.batches[0].id,
    reason: 'Reopen the batch.',
  });
  assert.equal(Object.keys(undone.verifications).length, 0);
  assert.equal(undone.batches[0].active, false);
  const later = applyCommand(p, b, actorFor(p, 'st-02'), {
    type: 'verify',
    target: 'F1040.11',
    method: 'confirmed_with_client',
    reason: 'A later colleague changed this verification.',
  });
  assert.throws(
    () =>
      applyCommand(p, later, a, {
        type: 'undo_batch',
        id: b.batches[0].id,
        reason: 'Must not overwrite a later verification.',
      }),
    /later verification/,
  );
});
test('a fully reviewed simulation can freeze, amend above it, and preserve the frozen record', () => {
  let s = emptyState(p);
  for (const d of p.documents)
    s = applyCommand(p, s, a, {
      type: 'triage',
      target: d.id,
      status: 'used',
      reason: 'Synthetic lifecycle fixture: disposition recorded.',
    });
  for (const f of inspectPacket(p, v).filter((x) => x.severity !== 'info'))
    s = applyCommand(p, s, a, {
      type: 'resolve_finding',
      target: f.id,
      reason: 'Synthetic lifecycle fixture: evidence conclusion recorded.',
    });
  for (const step of p.firm.starter_standards.required_steps)
    s = applyCommand(p, s, a, {
      type: 'checklist',
      target: step,
      reason: 'Synthetic lifecycle fixture: complete.',
    });
  for (const o of outsideObligations(p))
    s = applyCommand(p, s, a, {
      type: 'outside',
      obligationId: o.id,
      form: o.label,
      owner: 'Outside provider',
      due: '2026-10-15',
      reason: 'Synthetic fixture: outside engagement.',
    });
  for (const area of awaitAreas())
    s = applyCommand(p, s, actorFor(p, 'st-02'), { type: 'signoff', area, level: 'reviewer' });
  s = applyCommand(p, s, actorFor(p, 'st-03'), { type: 'signoff', area: 'all', level: 'partner' });
  for (const client of p.firm.client_users)
    s = applyCommand(p, s, actorFor(p, client.id), {
      type: 'client_approval',
      signature: true,
      contentHash: stateHash(p, s),
    });
  assert(filingGates(p, s).every((g) => g.count === 0));
  s = applyCommand(p, s, actorFor(p, 'st-03'), { type: 'file' });
  const frozen = digest(s.freezes[0]);
  assert.equal(s.filing.status, 'filed');
  s = applyCommand(p, s, actorFor(p, 'st-03'), {
    type: 'amend',
    reason: 'Synthetic fixture: amend above the frozen record.',
  });
  s = applyCommand(p, s, a, {
    type: 'adjust',
    target: 'SchB.1.2',
    value: 0,
    category: 'interest',
    reason: 'New amended-cycle overlay.',
  });
  assert.equal(s.cycle, 1);
  assert.equal(digest(s.freezes[0]), frozen);
  assert.equal(s.signoffs.length, 0);
});
function awaitAreas() {
  return [
    'overview',
    'wages',
    'business',
    'investments',
    'rentals',
    'basis',
    'retirement',
    'deductions',
    'foreign',
    'tax',
    'california',
  ];
}
test('cross-year evidence links resolve stable packet references and preserve a reason', () => {
  const s = applyCommand(p, emptyState(p), a, {
    type: 'link',
    target: 'F1040.11',
    related: 'py:/return_2024/lines/F1040.11',
    reason: 'Tie the current AGI comparison to the filed prior year.',
  });
  assert.equal(s.links.length, 1);
  assert.equal(s.links[0].related, 'py:/return_2024/lines/F1040.11');
  assert.throws(() =>
    applyCommand(p, s, a, {
      type: 'link',
      target: 'F1040.11',
      related: 'not-real',
      reason: 'Invalid link must fail.',
    }),
  );
});
