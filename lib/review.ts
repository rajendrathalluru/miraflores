import type { Row, WorkState } from './types';

// Direct effects describe balances, not marginal taxable-income estimates.
export function directEffect(
  line: Row,
): { sign: number; jurisdiction: string; label: string } | null {
  const key = String(line.key || '');
  const federalPayments = /^F1040\.(25[a-d]?|26|27[a-z]?|28|29|30|31|32|33|36)$/;
  const federalCredits = /^F1040\.(19|20|21)$/;
  const federalTax = /^F1040\.(16|17|18|22|23|24|37|38)$/;
  const caPayments = /^F540NR\.(7[1-9]|8[0-9]|9[0-5])$/;
  const caCredits = /^F540NR\.(39|50|55|58|60)$/;
  if (
    federalPayments.test(key) ||
    federalCredits.test(key) ||
    /^Sch3\.(1|2|3|4|5|6[a-z]?|7|8|9|10|11|12[a-z]?|13|14|15)$/.test(key) ||
    key === 'F8812.12'
  )
    return {
      sign: -1,
      jurisdiction: 'federal',
      label: 'Federal payment / credit · dollar for dollar',
    };
  if (federalTax.test(key))
    return { sign: 1, jurisdiction: 'federal', label: 'Federal tax / balance · dollar for dollar' };
  if (/^F1040\.(34|35a)$/.test(key))
    return { sign: -1, jurisdiction: 'federal', label: 'Federal overpayment · dollar for dollar' };
  if (caPayments.test(key) || caCredits.test(key))
    return {
      sign: -1,
      jurisdiction: 'california',
      label: 'California payment / credit · dollar for dollar',
    };
  if (/^F540NR\.(37|40|61|64|96|98|121)$/.test(key))
    return {
      sign: 1,
      jurisdiction: 'california',
      label: 'California tax / balance · dollar for dollar',
    };
  if (key === 'F540NR.97')
    return { sign: -1, jurisdiction: 'california', label: 'California refund · dollar for dollar' };
  return null;
}
export function readPath(value: any, path: string) {
  if (!path || path.split('.').some((k) => ['__proto__', 'constructor', 'prototype'].includes(k)))
    return undefined;
  return path.split('.').reduce((v, k) => v?.[k], value);
}
export function assetFields(asset: Row): { key: string; value: any }[] {
  const allowed = [
    'cost',
    'land_value_not_depreciated',
    'placed_in_service',
    'method',
    'life_years',
    'disposed',
  ];
  const rows = allowed
    .filter((k) => asset[k] !== undefined && (asset[k] === null || typeof asset[k] !== 'object'))
    .map((key) => ({ key, value: asset[key] }));
  for (const branch of ['federal', 'california', 'amt', 'disposed']) {
    if (!asset[branch] || typeof asset[branch] !== 'object' || Array.isArray(asset[branch]))
      continue;
    for (const [key, value] of Object.entries(asset[branch] || {}))
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'string' ||
        value === null
      )
        rows.push({ key: `${branch}.${key}`, value });
  }
  return rows;
}
export function workingReference(original: any, target: string, state: WorkState, version: string) {
  return (
    state.adjustments.findLast(
      (a) => a.active && a.target === target && a.version === version && a.cycle === state.cycle,
    )?.value ?? original
  );
}
export function reviewedAsset(asset: Row, state: WorkState, version: string) {
  const copy = structuredClone(asset);
  for (const field of assetFields(asset)) {
    const keys = field.key.split('.');
    let parent = copy;
    for (const k of keys.slice(0, -1)) parent = parent[k];
    parent[keys.at(-1)!] = workingReference(
      field.value,
      `asset:${asset.asset_id}/${field.key}`,
      state,
      version,
    );
  }
  return copy;
}
export function changesSince(state: WorkState, actorId: string) {
  const seen = state.seen[actorId] ?? 0;
  const seenPolicy = state.seenPolicy?.[actorId] ?? 0;
  const localIds = new Set(state.audit.map((e) => e.id));
  const firmEvents = (state.firmPolicyEvents || []).filter((e) => !localIds.has(e.id));
  const all = [...state.audit, ...firmEvents]
    .filter((e) => !['seen', 'reveal_log'].includes(e.type))
    .sort((a, b) => a.at.localeCompare(b.at));
  return {
    seen,
    seenPolicy,
    all,
    events: all.filter((e) =>
      e.scope === 'firm' ? e.policyRevision > seenPolicy : e.revision > seen,
    ),
  };
}
