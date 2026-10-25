import packet from '../data/packet.json';
import { getActor, masked, maskSensitiveText } from './packet';
import type { Workspace } from './contracts';
interface SearchRecord { id: string; category: string; title: string; text: string; sourceRefs: string[] }
const index: SearchRecord[] = [];
for (const d of packet.documents) for (const p of d.pages) index.push({ id: `${d.id}-${p.page}`, category: 'Source page', title: `${d.id} · ${d.title} · page ${p.page}`, text: p.printed_content, sourceRefs: [`doc:${d.id}#page${p.page}`] });
for (const v of packet.extracted_values) index.push({ id: v.id, category: 'Exact source field', title: `${v.id} · ${v.label}`, text: `${v.field} ${v.value} ${v.text_as_read}`, sourceRefs: [v.id] });
for (const v of packet.return_versions) for (const l of v.lines) index.push({ id: `${v.version}:${l.key}`, category: `Return ${v.version}`, title: `${l.key} · ${l.label}`, text: `${l.value} ${l.rule} ${l.note ?? ''}`, sourceRefs: [...l.sources] });
for (const records of [packet.client.questionnaire, packet.client.messages, packet.client.call_notes]) for (const r of records) index.push({ id: r.id, category: 'Client communication', title: r.id, text: JSON.stringify(r), sourceRefs: [r.id] });
function walk(value: unknown, path: string, category: string) {
  if (value === null || typeof value !== 'object') {
    index.push({ id: path, category, title: path.split('/').slice(-3).join(' / '), text: String(value ?? ''), sourceRefs: [`packet:${path}`] });
  } else for (const [key, item] of Object.entries(value)) walk(item, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, category);
}
walk(packet.prior_years, '/prior_years', 'Prior years and basis');
walk(packet.household.related_returns, '/household/related_returns', 'Related returns');
walk(packet.return_versions.at(-1)!.assets, '/return_versions/2/assets', 'Asset register');
const safeIndex = masked(index);
export function searchWorkpaper(query: string, actorId: string, state: Workspace) {
  getActor(actorId);
  const q = maskSensitiveText(query.trim()).toLowerCase();
  if (q.length < 2 || q.length > 150) throw new Error('Search using 2 to 150 characters.');
  const owned: SearchRecord[] = [...state.notes.map(n => ({ id: n.id, category: 'Review note', title: n.id, text: n.body, sourceRefs: [`local:note:${n.id}`] })),
    ...state.audit.map(e => ({ id: e.id, category: 'Audit history', title: `Revision ${e.revision}`, text: e.detail, sourceRefs: [] }))];
  for (const key of ['questions', 'judgments', 'notices', 'plans', 'tasks', 'reconciliations', 'links', 'lineAdjustments'] as const) {
    for (const r of state.workpaper?.[key] ?? []) {
      const kind = ({ questions: 'question', judgments: 'judgment', notices: 'notice', plans: 'plan', tasks: 'task', reconciliations: 'reconciliation', links: 'link', lineAdjustments: 'lineAdjustment' })[key];
      owned.push({ id: r.id, category: key, title: String(r.title ?? r.body ?? r.id).slice(0, 160), text: JSON.stringify(r), sourceRefs: kind ? [`local:${kind}:${r.id}`] : r.sourceRefs ?? [] });
    }
  }
  for (const [ref, record] of Object.entries(state.workpaper?.verifications ?? {})) owned.push({ id: record.id, category: 'Verification record', title: `${ref} · ${record.method}`, text: String(record.note ?? ''), sourceRefs: [ref] });
  for (const record of state.workpaper?.history ?? []) owned.push({ id: record.id, category: 'Preserved review history', title: `${record.collection} · ${record.key}`, text: JSON.stringify(record.previous), sourceRefs: [`local:history:${record.id}`] });
  const matches = [...safeIndex, ...masked(owned)].filter(r => `${r.title} ${r.text}`.toLowerCase().includes(q));
  return { query: maskSensitiveText(query), total: matches.length, limit: 75, results: matches.slice(0, 75).map(r => {
    const position = Math.max(0, r.text.toLowerCase().indexOf(q));
    return { id: r.id, category: r.category, title: r.title, snippet: r.text.slice(Math.max(0, position - 80), position + 220), sourceRefs: r.sourceRefs };
  }) };
}
