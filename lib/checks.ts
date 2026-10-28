import { areaOf, type Packet, type Row, type Finding } from './types';
import { paymentRows } from './reconciliation';
export function varianceRows(p: Packet, v: Row) {
  const prior = p.prior_years?.return_2024?.lines || {};
  const rule = p.firm?.starter_standards?.variance_review;
  const percent = Number(rule?.flag_if_change_over_percent ?? 10);
  const amount = Number(rule?.and_over_amount ?? 1000);
  return v.lines
    .filter((l: Row) => typeof l.value === 'number' && typeof prior[l.key] === 'number')
    .map((l: Row) => ({
      ...l,
      prior: prior[l.key],
      delta: l.value - prior[l.key],
      percent:
        prior[l.key] === 0 ? null : ((l.value - prior[l.key]) / Math.abs(prior[l.key])) * 100,
    }))
    .filter(
      (l: Row) => Math.abs(l.delta) > amount && (l.prior === 0 || Math.abs(l.percent) > percent),
    );
}
export function additionalChecks(p: Packet, v: Row): Finding[] {
  const out: Finding[] = [];
  const ev = p.extracted_values;
  const docs = p.documents.filter((d) => !v.computed_at || d.received_at <= v.computed_at);
  const byId = new Map(ev.map((e) => [e.id, e]));
  const byDoc = new Map<string, Row[]>();
  for (const e of ev) byDoc.set(e.document_id, [...(byDoc.get(e.document_id) || []), e]);
  const docsById = new Map(p.documents.map((d) => [d.id, d]));
  const fields = (id: string) => byDoc.get(id) || [];
  const docFor = (ref: string) => docsById.get(byId.get(ref)?.document_id);
  const add = (x: Finding) => out.push(x);
  for (const x of varianceRows(p, v))
    add({
      id: `variance-${x.key}`,
      title: `Prior-year swing · ${x.label}`,
      detail: `Prior year ${Number(x.prior).toLocaleString()}; engine ${Number(x.value).toLocaleString()}; change ${Number(x.delta).toLocaleString()}${x.percent === null ? ' (new amount)' : ` (${x.percent.toFixed(1)}%)`}. Exceeds the firm's amount and percentage thresholds. Record the explanation, not an automatic correction.`,
      severity: 'warning',
      kind: 'Prior-year comparison',
      target: x.key,
      refs: [x.key, `py:/return_2024/lines/${x.key}`],
      area: areaOf(x),
      independent: true,
    });
  const payroll = docs.filter((d) => /w-?2/i.test(d.document_type));
  for (let i = 0; i < payroll.length; i++)
    for (let j = i + 1; j < payroll.length; j++) {
      const a = payroll[i],
        b = payroll[j];
      if (a.issuer !== b.issuer || a.belongs_to !== b.belongs_to || a.tax_year !== b.tax_year)
        continue;
      const comparable = ['box1', 'box2', 'box3', 'box5', 'box16'];
      const same = comparable
        .filter((k) => fields(a.id).some((e) => e.field === k))
        .every(
          (k) =>
            fields(a.id).find((e) => e.field === k)?.value ===
            fields(b.id).find((e) => e.field === k)?.value,
        );
      if (!same || !fields(a.id).some((e) => e.field === 'box1')) continue;
      const refA = fields(a.id).find((e) => e.field === 'box1')!,
        refB = fields(b.id).find((e) => e.field === 'box1')!;
      const wages = v.lines.find((l: Row) => l.rule === 'R-W2-BOX1-SUM');
      const twice = wages?.sources.includes(refA.id) && wages?.sources.includes(refB.id);
      add({
        id: `duplicate-document-${a.id}-${b.id}`,
        title: twice
          ? 'Repeated payroll upload may be counted twice'
          : 'Repeated payroll upload · not double counted',
        detail: `${a.id} and ${b.id} match issuer, recipient, year and payroll box amounts. ${twice ? 'Both wage sources feed the engine; reconcile before adjusting.' : 'The engine does not use both wage readings. Retain the original and document the duplicate disposition; no wage correction is proposed.'}`,
        severity: twice ? 'critical' : 'info',
        kind: 'Duplicate-document candidate',
        target: wages?.key || a.id,
        refs: [refA.id, refB.id],
        area: 'wages',
        independent: true,
      });
    }
  const stateCandidates = new Set<string>();
  for (const stub of docs.filter((d) => d.document_type === 'paystub')) {
    const ytd = fields(stub.id).find((e) => /ytd_ca_wages/.test(e.field));
    if (!ytd) continue;
    for (const w2 of payroll.filter(
      (d) =>
        d.issuer === stub.issuer &&
        d.belongs_to === stub.belongs_to &&
        v.documents_used.includes(d.id),
    )) {
      const wages = fields(w2.id).find((e) => e.field === 'box16');
      if (!wages || wages.value === ytd.value) continue;
      const candidate = `${stub.id}|${w2.issuer}|${w2.belongs_to}|${wages.value}`;
      if (stateCandidates.has(candidate)) continue;
      stateCandidates.add(candidate);
      const target = v.lines.find(
        (l: Row) => l.form === 'SchCA540NR' && /\.E$/.test(l.key) && /wage/i.test(l.label),
      );
      add({
        id: `state-wage-${w2.id}-${stub.id}`,
        title: 'State wages disagree with the move-date paystub',
        detail: `${w2.id} reports ${Number(wages.value).toLocaleString()} California wages; ${stub.id} reports ${Number(ytd.value).toLocaleString()} through the move date. Reconcile residency, later earnings and the return's state-source amount. This is a source conflict, not an assumed tax-law correction.`,
        severity: 'critical',
        kind: 'Payroll/state reconciliation',
        target: target?.key || wages.id,
        refs: [wages.id, ytd.id],
        area: 'california',
        independent: true,
      });
    }
  }
  const supplemental = ev.filter(
    (e) =>
      /_adjusted_basis$/.test(e.field) &&
      Number(e.value) > 0 &&
      docs.some((d) => d.id === e.document_id),
  );
  for (const l of v.lines.filter((l: Row) => l.form === 'F8949' && l.rule === 'R-8949-LOT')) {
    const acquired = l.label.match(/acquired ([\d-]+)/)?.[1];
    const baseRef = (l.sources || [])
      .map((r: string) => ev.find((e) => e.id === r))
      .find((e: Row) => e && /_basis$/.test(e.field));
    if (!baseRef) continue;
    const basis = supplemental.find((e) => {
      const stem = e.field.replace(/_adjusted_basis$/, '');
      const date = fields(e.document_id).find((x) => x.field === `${stem}_acquired`);
      const owner = docFor(baseRef.id)?.belongs_to === docFor(e.id)?.belongs_to;
      return date?.value === acquired && owner && /RSU|ESPP/i.test(l.label);
    });
    if (!basis || Number(basis.value) === Number(baseRef.value)) continue;
    const alreadyUsed = l.sources.includes(basis.id);
    const ordinary = fields(basis.document_id).find(
      (e) => e.field === basis.field.replace(/_adjusted_basis$/, '_ordinary'),
    );
    const adjustment = l.label.match(/adjustment\s+\w+\s+(-?[\d,.]+)/i);
    if (
      alreadyUsed &&
      adjustment &&
      Math.abs(Number(adjustment[1].replaceAll(',', ''))) ===
        Math.abs(Number(basis.value) - Number(baseRef.value))
    )
      continue;
    add({
      id: `stock-basis-${l.key}`,
      title: 'Stock-plan basis needs reconciliation',
      detail: `Reported basis ${Number(baseRef.value).toLocaleString()} differs from supplemental adjusted basis ${Number(basis.value).toLocaleString()} for the same acquisition date and owner. Compare compensation already included in wages and the gain adjustment before concluding.`,
      severity: 'critical',
      kind: 'Supplemental-basis comparison',
      target: l.key,
      refs: [baseRef.id, basis.id, ...(ordinary ? [ordinary.id] : [])],
      area: 'investments',
      independent: true,
    });
  }
  for (const invoice of docs.filter((d) => /invoice/i.test(d.document_type + ' ' + d.title))) {
    const text = invoice.pages.map((pg: Row) => pg.printed_content).join(' ');
    if (!/heat pump|HVAC/i.test(text) || !/replace|replacement|new\b/i.test(text)) continue;
    const total = fields(invoice.id).find((e) => e.field === 'total');
    const repair = ev.find(
      (e) =>
        /hvac/i.test(e.field) &&
        e.value === total?.value &&
        v.documents_used.includes(e.document_id),
    );
    if (!repair || !total) continue;
    const line = v.lines.find(
      (l: Row) =>
        l.form === 'SchE' &&
        /repair/i.test(l.label) &&
        (l.sources || []).some((r: string) => docFor(r)?.id === repair.document_id),
    );
    if (!line) continue;
    add({
      id: `capitalization-${invoice.id}`,
      title: 'Replacement equipment is included in rental repairs',
      detail: `${Number(total.value).toLocaleString()} for replacement HVAC appears in the repair inputs. Review capitalization, asset treatment and the supplied HVAC improvement alternative; preserve the invoice and record the supported decision.`,
      severity: 'warning',
      kind: 'Capitalization review candidate',
      target: line.key,
      refs: [total.id, repair.id],
      area: 'rentals',
      independent: true,
    });
  }
  const get = (k: string) => v.lines.find((l: Row) => l.key === k);
  const before = get('F7203.5'),
    distribution = get('F7203.6'),
    gain = get('F7203.excess'),
    ending = get('F7203.7');
  if (before && distribution && gain && ending) {
    const expected = Math.max(0, Number(distribution.value) - Number(before.value));
    const wrong =
      expected !== gain.value || ending.value !== Math.max(0, before.value - distribution.value);
    const incomplete = (v.diagnostics || []).some((d: Row) => d.code === 'SCORP_BASIS_INCOMPLETE');
    add({
      id: 'basis-rollforward-F7203',
      title: wrong
        ? 'S-corporation distribution does not reconcile'
        : incomplete
          ? 'S-corporation starting basis is incomplete'
          : 'S-corporation distribution reconciles to supplied basis',
      detail: `Before distributions: ${Number(before.value).toLocaleString()}; distributions: ${Number(distribution.value).toLocaleString()}; computed excess: ${expected.toLocaleString()}; recorded excess: ${Number(gain.value).toLocaleString()}. ${incomplete ? 'Earlier-year basis evidence is missing; do not treat a mathematical tie as substantiation.' : wrong ? 'Review the supplied rollforward and supporting K-1s.' : 'Arithmetic agrees. Keep the prior-year support and review any remaining historical unknowns.'}`,
      severity: wrong || incomplete ? 'warning' : 'info',
      kind: 'Independent basis arithmetic',
      target: gain.key,
      refs: ['F7203.1', 'F7203.5', 'F7203.6', 'F7203.excess', ...(get('F7203.1')?.sources || [])],
      area: 'basis',
      independent: true,
    });
  }
  for (const r of paymentRows(p, v).rows.filter(
    (r: Row) => r.gap !== null && Math.abs(r.gap) > 0.01,
  ))
    add({
      id: `payment-reconciliation-${r.id}`,
      title: 'Payment does not agree with agency records',
      detail: `${r.label}: return ${Number(r.reported).toLocaleString()}, agency ${Number(r.agency).toLocaleString()} as of ${r.asOf}; difference ${Number(r.gap).toLocaleString()}. Review tax-year designations and documented transfers before changing the payment.`,
      severity: 'warning',
      kind: 'Independent payment reconciliation',
      target: r.id,
      refs: r.refs,
      area: 'tax',
      independent: true,
    });
  return out;
}
