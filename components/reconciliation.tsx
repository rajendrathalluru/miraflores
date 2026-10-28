'use client';
import { useState } from 'react';
import { useWork } from './context';
import { Badge, Form, RefButton, Empty } from './ui';
import { booksBridge, paymentRows } from '@/lib/reconciliation';
import { money, type Row } from '@/lib/types';
export function BooksReconciliation() {
  const { packet, version, state, working, select, command, readOnly, busy } = useWork();
  const bridge = booksBridge(packet as any, version, working ? (state as any) : undefined);
  if (!bridge)
    return (
      <Empty
        title="No compatible business books supplied"
        detail="Import a pipeline packet with a profit-and-loss record and Schedule C to build the bridge."
      />
    );
  return (
    <section className="reconciliation">
      <h2>Books → tax reconciliation</h2>
      <p className="muted">
        Book profit plus each supported treatment must tie to the reviewed Schedule C profit. An
        upstream source overlay does not silently recompute downstream engine lines.
      </p>
      <div className="reconciliation-totals">
        <button onClick={() => select(bridge.netRef)}>
          <span>Book net income</span>
          <strong>{money(bridge.start)}</strong>
        </button>
        <div>
          <span>Bridge result</span>
          <strong>{money(bridge.expected)}</strong>
        </div>
        <button onClick={() => select('SchC.31')}>
          <span>Reviewed Schedule C profit</span>
          <strong>{money(bridge.reported)}</strong>
        </button>
        <div>
          <span>Unreconciled difference</span>
          <strong>{money(bridge.gap)}</strong>
          <Badge tone={bridge.gap ? 'amber' : 'green'}>
            {bridge.gap ? 'Needs reconciliation' : 'Tied'}
          </Badge>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supported treatment</th>
              <th className="number">Books</th>
              <th className="number">Tax input</th>
              <th className="number">Profit adjustment</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {bridge.rows.map((r: Row) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td className="number">{money(r.book)}</td>
                <td className="number">{money(r.tax)}</td>
                <td className="number">{money(r.delta)}</td>
                <td>
                  <div className="refs">
                    {r.refs.map((ref: string) => (
                      <RefButton key={ref} onClick={() => select(ref)}>
                        {ref}
                      </RefButton>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReconciliationConclusion
        target="reconcile:books"
        command={command}
        busy={busy}
        readOnly={readOnly}
        state={state}
      />
    </section>
  );
}
export function PaymentsReconciliation() {
  const { packet, version, state, working, select, command, busy, readOnly } = useWork();
  const [snapshot, setSnapshot] = useState<number | undefined>();
  const result = paymentRows(
    packet as any,
    version,
    working ? (state as any) : undefined,
    snapshot,
  );
  return (
    <section className="reconciliation">
      <h2>Return payments → agency record</h2>
      <p className="muted">
        Compare only numeric, identified payments. A missing transcript entry is unknown, not a
        zero. Scripted post-filing amounts stay symbolic.
      </p>
      <label>
        IRS transcript snapshot
        <select value={result.index} onChange={(e) => setSnapshot(Number(e.target.value))}>
          {result.transcripts.map((t: Row) => (
            <option key={t.index} value={t.index}>
              {t.asOf}
            </option>
          ))}
        </select>
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th className="number">Return</th>
              <th className="number">Agency</th>
              <th className="number">Difference</th>
              <th>Evidence / as of</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r: Row) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td className="number">
                  <button className="number-button" onClick={() => select(r.id)}>
                    {money(r.reported)}
                  </button>
                </td>
                <td className="number">{r.agency === null ? 'Not available' : money(r.agency)}</td>
                <td className="number">
                  <Badge tone={r.gap ? 'amber' : r.gap === null ? 'neutral' : 'green'}>
                    {r.gap === null ? 'Unknown' : money(r.gap)}
                  </Badge>
                </td>
                <td>
                  {r.asOf}
                  <div className="refs">
                    {r.refs.map((ref: string) => (
                      <RefButton key={ref} onClick={() => select(ref)}>
                        {ref}
                      </RefButton>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!result.misapplied.length && (
        <div className="notice">
          <p>
            A California payment is designated to a different tax year. Review the agency record and
            request/document any transfer; do not silently count it as a current-year payment.
          </p>
          <RefButton
            onClick={() => select('agency:/ftb_account/tax_year_2024_payments_after_filing')}
          >
            Inspect tax-year designation
          </RefButton>
        </div>
      )}
      <ReconciliationConclusion
        target="reconcile:payments"
        command={command}
        busy={busy}
        readOnly={readOnly}
        state={state}
      />
    </section>
  );
}
function ReconciliationConclusion({
  target,
  command,
  busy,
  readOnly,
  state,
}: {
  target: string;
  command: (c: Row) => Promise<boolean>;
  busy: boolean;
  readOnly: boolean;
  state: Row;
}) {
  const records = state.judgments.filter(
    (j: Row) => j.kind === 'reconciliation' && j.target === target,
  );
  return (
    <>
      <div className="review-list">
        {records.map((r: Row) => (
          <article className="panel" key={r.id}>
            <Badge>Reconciliation conclusion</Badge>
            <p>{r.reason}</p>
            <small>{r.authority}</small>
            <code>Evidence fingerprint {r.basisHash?.slice(0, 16)}</code>
          </article>
        ))}
      </div>
      {!readOnly && (
        <Form
          title="Document the reconciliation"
          busy={busy}
          fields={[
            { name: 'reason', label: 'Conclusion, differences and next action', type: 'textarea' },
            {
              name: 'authority',
              label: 'Supporting documents / agency confirmation',
              type: 'textarea',
            },
          ]}
          onSubmit={(d) => command({ type: 'judgment', kind: 'reconciliation', target, ...d })}
        />
      )}
    </>
  );
}
