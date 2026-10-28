import type { Packet, Row, WorkState } from './types';
import { workingValue } from './types';
import { workingReference } from './review';
export function booksBridge(p: Packet, v: Row, s?: WorkState) {
  const doc = p.documents.find((d) => /profit and loss/i.test(d.title));
  const ev = p.extracted_values.filter((e) => e.document_id === doc?.id);
  const field = (name: string) => ev.find((e) => e.field === name);
  const val = (l: Row) => (s ? workingValue(l, s, v.version) : l.value);
  const net = field('net_income'),
    income = field('total_income'),
    expenses = field('total_expenses');
  const line = (key: string) => v.lines.find((l: Row) => l.key === key);
  if (!net || !income || !expenses || !line('SchC.31')) return null;
  const source = (e: Row) => (s ? workingReference(e.value, e.id, s, v.version) : e.value);
  const rows: Row[] = [];
  const used = new Set<string>();
  rows.push({
    id: 'receipts',
    label: 'Receipts reconciliation',
    book: source(income),
    tax: val(line('SchC.1')),
    delta: val(line('SchC.1')) - source(income),
    refs: [income.id, 'SchC.1'],
  });
  for (const key of line('SchC.28')?.inputs || []) {
    const l = line(key);
    if (!l) continue;
    let matched = ev.filter(
      (e) => (l.sources || []).includes(e.id) && !/^total|net_income/.test(e.field),
    );
    if (!matched.length && /depreciation/i.test(l.label))
      matched = ev.filter((e) => /^depreciation$/i.test(e.field));
    if (!matched.length && /car and truck expenses/i.test(l.label))
      matched = ev.filter((e) => /car and truck/i.test(e.field));
    matched.forEach((e) => used.add(e.id));
    const book = matched.reduce((sum, e) => sum + Number(source(e) || 0), 0);
    rows.push({
      id: l.key,
      label: l.label,
      book,
      tax: val(l),
      delta: book - val(l),
      refs: [...matched.map((e) => e.id), l.key],
    });
  }
  for (const e of ev.filter(
    (e) =>
      typeof e.value === 'number' &&
      !used.has(e.id) &&
      !/^total_|net_income|Sales\s*-/i.test(e.field),
  ))
    rows.push({
      id: e.id,
      label: `Book-only expense: ${e.label}`,
      book: source(e),
      tax: 0,
      delta: source(e),
      refs: [e.id],
    });
  const home = line('SchC.30');
  if (home)
    rows.push({
      id: home.key,
      label: home.label,
      book: 0,
      tax: val(home),
      delta: -val(home),
      refs: [home.key],
    });
  const start = Number(source(net)),
    expected = start + rows.reduce((sum, r) => sum + r.delta, 0),
    reported = Number(val(line('SchC.31')));
  return {
    document: doc?.id,
    netRef: net.id,
    start,
    rows,
    expected,
    reported,
    gap: Math.round((expected - reported) * 100) / 100,
  };
}
export function paymentRows(p: Packet, v: Row, s?: WorkState, snapshotIndex?: number) {
  const transcripts = p.tax_agency_records?.irs_account_transcript_2025 || [];
  const index = snapshotIndex ?? Math.max(0, transcripts.length - 1);
  const transcript = transcripts[index];
  const transactions = transcript?.transactions || [];
  const value = (key: string) => {
    const l = v.lines.find((l: Row) => l.key === key);
    return l ? (s ? workingValue(l, s, v.version) : l.value) : null;
  };
  const rows: Row[] = [];
  const add = (key: string, label: string, entries: Row[], ref: string, available: boolean) => {
    const reported = value(key);
    if (reported === null) return;
    const agency = available
      ? entries.reduce((sum, e) => sum + (typeof e.amount === 'number' ? e.amount : 0), 0)
      : null;
    rows.push({
      id: key,
      label,
      reported,
      agency,
      gap: agency === null ? null : reported - agency,
      refs: [key, ref],
      asOf: ref.startsWith('agency:/ftb')
        ? p.tax_agency_records.ftb_account?.as_of
        : transcript?.as_of,
    });
  };
  add(
    'F1040.26',
    'Federal estimated payments',
    transactions.filter((t: Row) => t.code === '670' && /estimated/i.test(t.description)),
    `agency:/irs_account_transcript_2025/${index}`,
    !!transcript,
  );
  const extension = transactions.filter(
    (t: Row) => t.code === '670' && /extension/i.test(t.description),
  );
  add(
    'Sch3.10',
    'Federal extension payment',
    extension,
    `agency:/irs_account_transcript_2025/${index}`,
    !!extension.length,
  );
  const ftb = p.tax_agency_records?.ftb_account;
  add(
    'F540NR.72',
    'California estimated payments',
    ftb?.[`tax_year_${p.household.tax_year}_payments`] || [],
    'agency:/ftb_account',
    !!ftb?.[`tax_year_${p.household.tax_year}_payments`],
  );
  return {
    rows,
    transcripts: transcripts.map((t: Row, i: number) => ({ index: i, asOf: t.as_of })),
    index,
    misapplied: ftb?.tax_year_2024_payments_after_filing || [],
  };
}
