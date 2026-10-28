'use client';
import { useState } from 'react';
import { useWork } from './context';
import { money, workingValue, type Row } from '@/lib/types';
import { Badge, RefButton } from './ui';
export function PriorPreparerComparison() {
  const { packet, version, state, working, select } = useWork();
  const [onlyChanged, setOnlyChanged] = useState(true);
  const prior = packet.prior_years?.return_2024?.lines || {};
  const rows = version.lines
    .filter((l: Row) => typeof prior[l.key] === 'number')
    .map((l: Row) => ({
      ...l,
      prior: prior[l.key],
      reviewed: working ? workingValue(l, state as any, version.version) : l.value,
    }))
    .filter((l: Row) => !onlyChanged || l.prior !== l.reviewed);
  return (
    <section className="panel prior-comparison">
      <h2>Prior preparer → our review</h2>
      <p>
        {packet.prior_years?.prior_preparer_workpaper?.summary_memo ||
          'No prior preparer memo supplied.'}
      </p>
      <div className="refs">
        {(packet.household.related_returns || []).map((r: Row, i: number) => (
          <RefButton key={i} onClick={() => select(`return:${i}`)}>
            {r.who} · related return
          </RefButton>
        ))}

        <RefButton onClick={() => select('py:/prior_preparer_workpaper')}>
          Prior notes and open items
        </RefButton>
        <button className="button" onClick={() => setOnlyChanged(!onlyChanged)}>
          {onlyChanged ? 'Show all comparable lines' : 'Only changed amounts'}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Comparable line</th>
              <th className="number">Prior filed</th>
              <th className="number">Current engine</th>
              <th className="number">Our reviewed value</th>
              <th>Our work</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l: Row) => (
              <tr key={l.key}>
                <td>
                  <button className="line-description" onClick={() => select(l.key)}>
                    <code>{l.key}</code>
                    <strong>{l.label}</strong>
                  </button>
                </td>
                <td className="number">
                  <button
                    className="number-button"
                    onClick={() => select(`py:/return_2024/lines/${l.key}`)}
                  >
                    {money(l.prior)}
                  </button>
                </td>
                <td className="number">{money(l.value)}</td>
                <td className="number">
                  <button className="number-button" onClick={() => select(l.key)}>
                    {money(l.reviewed)}
                  </button>
                </td>
                <td>
                  <Badge tone={l.reviewed !== l.value ? 'amber' : 'neutral'}>
                    {l.reviewed !== l.value
                      ? 'Reviewed overlay'
                      : state.verifications[l.key]
                        ? 'Verified'
                        : 'Review pending'}
                  </Badge>
                  {state.adjustments
                    .filter((a: Row) => a.active && a.target === l.key)
                    .map((a: Row) => (
                      <p key={a.id}>{a.reason}</p>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
