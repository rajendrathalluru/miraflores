import type { Packet, Row, Finding } from './types';
import { areaOf } from './types';
export function inspectPacket(p: Packet, v: Row): Finding[] {
  const findings: Finding[] = [];
  const push = (x: Finding) => findings.push(x);
  const ev = p.extracted_values;
  const line = (rule: string) => v.lines.find((l: Row) => l.rule === rule);
  for (const d of p.documents) {
    if (!v.documents_used?.includes(d.id)) continue;
    const mileage = ev.filter((e) => e.document_id === d.id && e.field === 'page_total');
    const duplicate = d.pages.find((pg: Row) =>
      /second scan|same handwriting|duplicate of page/i.test(pg.printed_content),
    );
    const milesLine = line('R-MILEAGE-PAGE-TOTALS');
    if (duplicate && mileage.length && milesLine) {
      const dup = mileage.find((e) => e.page === duplicate.page);
      const total = mileage
        .filter((e) => e.page !== duplicate.page)
        .reduce((s, e) => s + Number(e.value), 0);
      if (dup && total !== milesLine.value)
        push({
          id: `duplicate-page-${d.id}`,
          title: `A duplicate scan adds ${Number(dup.value).toLocaleString()} miles`,
          detail: `${d.id} page ${duplicate.page} explicitly identifies a repeated sheet. Unique page totals sum to ${total.toLocaleString()} miles; the engine uses ${Number(milesLine.value).toLocaleString()}. Retain the scan and document why it is excluded.`,
          severity: 'critical',
          kind: 'Source reconciliation',
          target: milesLine.key,
          refs: [dup.id, ...mileage.filter((e) => e.page !== duplicate.page).map((e) => e.id)],
          area: 'business',
          proposed: total,
          category: 'schc_profit',
          direction: -Number(p.engine_reference?.parameters?.mileage_rate || 0),
          independent: true,
        });
    }
    const summary = ev.find((e) => e.document_id === d.id && e.field === 'b_summary_proceeds');
    const lots = ev.filter(
      (e) =>
        e.document_id === d.id &&
        /^\w+_proceeds$/.test(e.field) &&
        e.field !== 'b_summary_proceeds',
    );
    if (summary && lots.length) {
      const sum = lots.reduce((s, e) => s + Number(e.value || 0), 0);
      if (Math.abs(Number(summary.value) - sum) > 0.01)
        push({
          id: `broker-gap-${d.id}`,
          title: 'Broker detail does not reach the summary',
          detail: `${d.id}: extracted lots total $${sum.toLocaleString()}, versus printed summary $${Number(summary.value).toLocaleString()}. Gap: $${(Number(summary.value) - sum).toLocaleString()}. Inspect every unextracted page before concluding.`,
          severity: 'critical',
          kind: 'Independent arithmetic',
          target:
            v.lines.find((l: Row) => (l.sources || []).includes(summary.id))?.key || summary.id,
          refs: [
            summary.id,
            ...d.pages
              .filter((pg: Row) => !ev.some((e) => e.document_id === d.id && e.page === pg.page))
              .map((pg: Row) => `doc:${d.id}#page${pg.page}`),
          ],
          area: 'investments',
          independent: true,
        });
    }
  }
  const payers = v.lines.filter((l: Row) => l.rule === 'R-INTEREST-PAYER');
  for (let i = 0; i < payers.length; i++)
    for (let j = i + 1; j < payers.length; j++) {
      const a = payers[i],
        b = payers[j];
      const ea = ev.find((e) => e.id === a.sources?.[0]),
        eb = ev.find((e) => e.id === b.sources?.[0]);
      if (
        typeof a.value === 'number' &&
        a.value > 0 &&
        a.value === b.value &&
        ea &&
        eb &&
        ea.document_id !== eb.document_id &&
        /northlake/i.test(a.label + b.label)
      )
        push({
          id: `duplicate-interest-${b.key}`,
          title: 'The same sweep interest appears twice',
          detail: `Two separate source records carry $${a.value.toLocaleString()} of Northlake sweep interest. Match payer, recipient and account before removing the second reporting instance. Equal amounts alone are not proof.`,
          severity: 'critical',
          kind: 'Cross-document match',
          target: b.key,
          refs: [...a.sources, ...b.sources],
          area: 'investments',
          proposed: 0,
          category: 'interest',
          direction: 1,
          independent: true,
        });
    }
  for (const e of ev.filter((e) => e.confidence < 0.7 && v.documents_used?.includes(e.document_id)))
    push({
      id: `confidence-${e.id}`,
      title: 'A reading needs a second look',
      detail: `${e.label}: ${Math.round(e.confidence * 100)}% extraction confidence. Compare the printed page and obtain corroboration; confidence is not verification.`,
      severity: 'warning',
      kind: 'Extraction check',
      target: v.lines.find((l: Row) => (l.sources || []).includes(e.id))?.key || e.id,
      refs: [e.id],
      area: 'deductions',
      independent: true,
    });
  // The organizer is a separate statement: compare literal source SSNs without disclosing either value.
  for (const person of p.household.people || []) {
    if (!person.ssn) continue;
    const ssns = ev.filter(
      (e) =>
        e.value_type === 'ssn' &&
        e.value !== person.ssn &&
        p.documents.find((d) => d.id === e.document_id)?.belongs_to === `dependent:${person.id}`,
    );
    if (ssns.length)
      push({
        id: `identity-${person.id}`,
        title: 'Identity records disagree',
        detail: `${person.name}: the organizer and an identity/prior-return record have different identifiers. Resolve against the original identity evidence; no full identifier appears in this alert.`,
        severity: 'critical',
        kind: 'Identity comparison',
        target: `household:${person.id}`,
        refs: ssns.slice(0, 3).map((e) => e.id),
        area: 'overview',
        independent: true,
      });
  }
  for (const d of v.diagnostics || [])
    if (
      !findings.some(
        (f) =>
          (f.id.includes('broker-gap') && d.code === 'BROKER_SUMMARY_DETAIL_MISMATCH') ||
          (f.id.startsWith('confidence-') && d.code === 'LOW_CONFIDENCE_READ'),
      )
    )
      push({
        id: `diagnostic-${d.code}`,
        title:
          d.code === 'DIGITAL_ASSET_BASIS_MISSING'
            ? 'Transferred crypto has no substantiated basis'
            : d.message.split(':')[0],
        detail: d.message,
        severity: d.severity === 'warning' ? 'warning' : 'info',
        kind: 'Engine diagnostic · not independent',
        target:
          d.refs?.find((r: string) => v.lines.some((l: Row) => l.key === r)) || d.refs?.[0] || '',
        refs: d.refs || [],
        area: areaOf(d.refs?.[0] || ''),
        independent: false,
      });
  return findings;
}
