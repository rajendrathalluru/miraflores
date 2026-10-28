import { createHash } from 'node:crypto';
import type { Packet, Row } from './types';
export function digest(value: any) {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
}
export function validatePacket(p: any): asserts p is Packet {
  if (
    !p ||
    typeof p !== 'object' ||
    !p.packet?.client_id ||
    !p.household?.tax_year ||
    !Array.isArray(p.documents) ||
    !Array.isArray(p.extracted_values) ||
    !Array.isArray(p.return_versions) ||
    !p.return_versions.length
  )
    throw new Error(
      'Expected a pipeline packet with packet.client_id, household.tax_year, documents, extracted_values and at least one return version.',
    );
  const unique = (a: Row[], key: string, label: string) => {
    if (
      a.some((x) => !x || typeof x[key] !== 'string') ||
      new Set(a.map((x) => x[key])).size !== a.length
    )
      throw new Error(`${label} must have unique string ${key} values.`);
  };
  if (
    typeof p.packet.client_id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.packet.client_id) ||
    !Number.isInteger(p.household.tax_year)
  )
    throw new Error(
      'Use a string client ID (letters, digits, hyphens or underscores) and a numeric tax year.',
    );
  if (
    !Array.isArray(p.household.people) ||
    !p.household.people.length ||
    p.household.people.some((x: Row) => typeof x.name !== 'string' || typeof x.role !== 'string')
  )
    throw new Error('Household people must have IDs, names and roles.');
  unique(p.household.people, 'id', 'Household people');
  if (!Array.isArray(p.firm?.staff) || !p.firm.staff.length)
    throw new Error('The packet must define firm.staff roles.');
  const users = [...p.firm.staff, ...(p.firm.client_users || [])];
  unique(users, 'id', 'Staff and client roles');
  if (
    users.some(
      (x: Row) =>
        x.id === 'examiner' ||
        typeof x.name !== 'string' ||
        ![
          'preparer',
          'reviewer',
          'partner',
          'quality_reviewer',
          'firm_administrator',
          'client',
        ].includes(x.role),
    )
  )
    throw new Error('Use supported named staff/client roles; examiner is a reserved persona.');
  unique(p.documents, 'id', 'Documents');
  unique(p.extracted_values, 'id', 'Extracted values');
  unique(p.return_versions, 'version', 'Return versions');
  if (
    p.documents.length > 1000 ||
    p.extracted_values.length > 100000 ||
    p.return_versions.length > 30
  )
    throw new Error('Packet exceeds the supported review size.');
  const docs = new Map<string, Row>(p.documents.map((x: Row) => [x.id, x]));
  for (const d of p.documents)
    if (
      typeof d.title !== 'string' ||
      !Array.isArray(d.pages) ||
      new Set(d.pages.map((x: Row) => x.page)).size !== d.pages.length ||
      d.pages.some((x: Row) => !Number.isInteger(x.page) || typeof x.printed_content !== 'string')
    )
      throw new Error(`Document ${d.id} needs numbered pages with printed_content.`);
  for (const e of p.extracted_values)
    if (!docs.get(e.document_id)?.pages.some((x: Row) => x.page === e.page))
      throw new Error(`Invalid source location for ${e.id}.`);
  for (const v of p.return_versions) {
    if (
      !Array.isArray(v.lines) ||
      !Array.isArray(v.assets) ||
      !Array.isArray(v.documents_used) ||
      !v.summary?.federal ||
      !v.summary?.california ||
      !Number.isFinite(v.summary.federal.balance_due) ||
      !Number.isFinite(v.summary.california.balance_due) ||
      !v.tax_effect_rates
    )
      throw new Error(
        `Version ${v.version} needs lines, assets, documents_used, federal/california balances and tax_effect_rates.`,
      );
    unique(v.lines, 'key', 'Return lines');
    if (
      v.lines.some(
        (l: Row) =>
          typeof l.label !== 'string' ||
          typeof l.form !== 'string' ||
          !Array.isArray(l.inputs) ||
          !Array.isArray(l.sources),
      )
    )
      throw new Error('Each return line needs a label, form, inputs and sources.');
    if (
      v.assets.some(
        (a: Row) =>
          typeof a.asset_id !== 'string' ||
          typeof a.description !== 'string' ||
          !Array.isArray(a.sources),
      )
    )
      throw new Error('Each asset needs asset_id, description and source references.');
    for (const rate of Object.values(v.tax_effect_rates) as Row[])
      if (
        !rate ||
        !Number.isFinite(rate.federal_per_dollar) ||
        !Number.isFinite(rate.california_per_dollar)
      )
        throw new Error(
          'Tax-effect rates must contain finite federal_per_dollar and california_per_dollar values.',
        );
  }
}
export function maskText(s: string) {
  return s
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '•••-••-••••')
    .replace(/\b\d{2}-\d{7}\b/g, '••-•••••••')
    .replace(/\bP\d{8}\b/g, 'P••••••••')
    .replace(
      /((?:account|routing|IP PIN|EFIN|ERO PIN|SSN|EIN)[^\n:]{0,30}[: #]+)\d{5,17}/gi,
      '$1••••••••',
    );
}
export function mask(value: any, key = ''): any {
  if (
    /^(ssn|ein|ip_pin|efin|ero_pin|ptins|routing_number|account_number|prior_year_agi_for_esignature|bank_account_for_refund_or_payment)$/i.test(
      key,
    )
  )
    return '••••••••';
  if (typeof value === 'string') return maskText(value);
  if (Array.isArray(value))
    return value.map((x) => {
      if (x && typeof x === 'object' && ['ssn', 'ein', 'account_number'].includes(x.value_type))
        return { ...mask(x), value: '••••••••', text_as_read: '••••••••' };
      return mask(x);
    });
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mask(v, k)]));
  return value;
}
export function resolveRef(p: Packet, v: Row, ref: string): any {
  const ev = p.extracted_values.find((x) => x.id === ref);
  if (ev)
    return { kind: 'field', value: ev, document: p.documents.find((d) => d.id === ev.document_id) };
  const directDocument = p.documents.find((d) => d.id === ref);
  if (directDocument) return { kind: 'document', document: directDocument, page: 1 };
  const dm = ref.match(/^doc:([^#]+)(?:#page(\d+))?$/);
  if (dm)
    return {
      kind: 'document',
      document: p.documents.find((d) => d.id === dm[1]),
      page: Number(dm[2] || 1),
    };
  const line = v.lines.find((x: Row) => x.key === ref);
  if (line) return { kind: 'line', value: line };
  if (ref.startsWith('asset:'))
    return { kind: 'asset', value: (v.assets || []).find((x: Row) => x.asset_id === ref.slice(6)) };
  if (ref.startsWith('household:'))
    return {
      kind: 'household',
      value: p.household.people.find((x: Row) => x.id === ref.slice(10)),
    };
  const related = p.household.related_returns?.find(
    (x: Row) => x.id === ref || `return:${x.id}` === ref,
  );
  if (related) return { kind: 'related_return', value: related };
  if (ref.startsWith('timeline:'))
    return { kind: 'timeline', value: p.timeline?.find((x: Row) => x.id === ref.slice(9)) };
  if (ref.startsWith('py:/') || ref.startsWith('agency:/')) {
    let x: any = ref.startsWith('py:') ? p.prior_years : p.tax_agency_records;
    for (const k of ref.slice(ref.indexOf('/') + 1).split('/'))
      x = x?.[k.replace(/~1/g, '/').replace(/~0/g, '~')];
    return { kind: 'record', value: x };
  }
  if (ref.startsWith('ref:')) {
    const keys = ref
      .replace(/^ref:param\./, '')
      .replace(/^ref:fx\./, 'fx.')
      .split('.');
    let x: any = p.engine_reference?.parameters;
    for (const k of keys) x = x?.[k];
    return { kind: 'parameter', value: x };
  }
  for (const a of Object.values(p.client || {}))
    if (Array.isArray(a)) {
      const x = a.find((x: Row) => x.id === ref);
      if (x) return { kind: 'message', value: x };
    }
  return { kind: 'unknown', value: null };
}
export function trace(p: Packet, v: Row, key: string) {
  const nodes: Row[] = [];
  const refs = new Set<string>();
  const visited = new Set<string>();
  const walk = (k: string) => {
    if (visited.has(k)) return;
    visited.add(k);
    const l = v.lines.find((x: Row) => x.key === k);
    if (!l) {
      refs.add(k);
      return;
    }
    nodes.push(l);
    (l.sources || []).forEach((r: string) => refs.add(r));
    (l.inputs || []).forEach(walk);
  };
  walk(key);
  return { nodes, refs: [...refs] };
}
