export type Row = Record<string, any>;
export type Packet = Row & {
  packet: Row;
  household: Row;
  documents: Row[];
  extracted_values: Row[];
  return_versions: Row[];
};
export type Adjustment = {
  id: string;
  target: string;
  original: number;
  value: number;
  category: string;
  direction: number;
  reason: string;
  refs: string[];
  actor: string;
  at: string;
  active: boolean;
  version: string;
  cycle: number;
  federal: number;
  california: number;
};
export type WorkState = {
  revision: number;
  cycle: number;
  batches: Row[];
  links: Row[];
  adjustments: Adjustment[];
  verifications: Record<string, Row>;
  triage: Record<string, Row>;
  findings: Record<string, Row>;
  signoffs: Row[];
  threads: Row[];
  judgments: Row[];
  tasks: Row[];
  evidence: Row[];
  times: Row[];
  checklist: Record<string, Row>;
  outside: Row[];
  notifications: Row[];
  audit: Row[];
  filing: Row;
  freezes: Row[];
  plans: Row[];
  standards: string[];
  seen: Record<string, number>;
};
export type Finding = {
  id: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
  kind: string;
  target: string;
  refs: string[];
  area: string;
  proposed?: number;
  category?: string;
  direction?: number;
  delta?: number;
  independent: boolean;
};
export const areas = [
  { id: 'overview', name: 'Return summary', forms: ['F1040', 'Sch1', 'Sch2', 'Sch3'] },
  { id: 'wages', name: 'Wages & stock compensation', forms: ['W2'] },
  { id: 'business', name: 'Business', forms: ['SchC', 'SchSE', 'F4562-C', 'F8995', 'F8995A'] },
  { id: 'investments', name: 'Sales & digital assets', forms: ['SchB', 'SchD', 'F8949'] },
  { id: 'rentals', name: 'Rentals & passive losses', forms: ['SchE', 'F4797', 'F4562-E', 'F8582'] },
  { id: 'basis', name: 'K-1s & basis', forms: ['F7203'] },
  { id: 'retirement', name: 'Retirement & HSA', forms: ['F8606', 'F8889'] },
  {
    id: 'deductions',
    name: 'Deductions & credits',
    forms: ['SchA', 'F8283', 'F8812', 'F8863', 'F2441', 'F8867'],
  },
  { id: 'foreign', name: 'Foreign reporting', forms: ['F8938', 'ScheduleS'] },
  { id: 'tax', name: 'Tax & payments', forms: ['F6251', 'F8959', 'F8960', 'F2210'] },
  {
    id: 'california',
    name: 'California / Texas',
    forms: ['SchCA540NR', 'F540NR', 'FTB3885A', 'FTB5805'],
  },
];
export function areaOf(line: Row | string) {
  const key = typeof line === 'string' ? line : line.key;
  if (/^F1040\.1[az]$/.test(key)) return 'wages';
  const form = typeof line === 'string' ? line.split('.')[0] : line.form;
  return areas.find((x) => x.forms.includes(form))?.id || 'other';
}
export function emptyState(packet: Packet): WorkState {
  return {
    revision: 0,
    cycle: 0,
    batches: [],
    links: [],
    adjustments: [],
    verifications: {},
    triage: {},
    findings: {},
    signoffs: [],
    threads: [],
    judgments: [],
    tasks: [],
    evidence: [],
    times: [],
    checklist: {},
    outside: [],
    notifications: [],
    audit: [],
    filing: { status: 'in_review' },
    freezes: [],
    plans: [],
    standards: packet.firm?.starter_standards?.rules || [],
    seen: {},
  };
}
export function currentVersion(packet: Packet) {
  return packet.return_versions.at(-1)!;
}
export function workingValue(line: Row, state: WorkState, version: string) {
  return (
    state.adjustments.findLast(
      (a) => a.active && a.target === line.key && a.version === version && a.cycle === state.cycle,
    )?.value ?? line.value
  );
}
export function activeAdjustments(state: WorkState, version: string) {
  return state.adjustments.filter(
    (a) => a.active && a.version === version && a.cycle === state.cycle,
  );
}
export function estimatedTotals(version: Row, state: WorkState) {
  const a = activeAdjustments(state, version.version);
  return {
    federal: a.reduce((s, x) => s + x.federal, 0),
    california: a.reduce((s, x) => s + x.california, 0),
  };
}
export function money(n: any, digits = 0) {
  if (n === null || n === undefined) return '—';
  if (typeof n !== 'number') return String(n);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}
export function human(s: string) {
  return String(s || '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function lineValue(line: Row, value: any = line.value) {
  if (typeof value !== 'number') return value === null || value === undefined ? '—' : String(value);
  if (/miles/i.test(line.label) && !/expenses/i.test(line.label))
    return new Intl.NumberFormat('en-US').format(value) + ' mi';
  if (/ratio|rate|percent/i.test(line.label) && Math.abs(value) <= 1)
    return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
      value,
    );
  return money(value, line.form === 'F8949' ? 2 : 0);
}
