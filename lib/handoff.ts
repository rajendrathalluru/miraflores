import { randomUUID } from 'node:crypto';
import { digest, validatePacket } from './packet';
import { emptyState, type Packet, type Row, type WorkState } from './types';
export function makeHandoff(
  engagement: string,
  packet: Packet,
  state: WorkState,
  attachments: Row[],
  priorArchive?: Row,
) {
  const payload = {
    engagement,
    packet,
    state,
    attachments,
    ...(priorArchive ? { priorArchive } : {}),
  };
  return {
    format: 'miraflores-complete-handoff-2',
    exportedAt: new Date().toISOString(),
    digest: digest(payload),
    payload,
  };
}
export function validateHandoff(bundle: any, depth = 0) {
  if (depth > 20) throw Error('Archive history nesting exceeds 20 engagements.');
  if (
    bundle?.format !== 'miraflores-complete-handoff-2' ||
    !bundle.payload ||
    bundle.digest !== digest(bundle.payload)
  )
    throw Error('Invalid archive format or integrity digest.');
  const { packet, state, attachments } = bundle.payload;
  if (bundle.payload.priorArchive) validateHandoff(bundle.payload.priorArchive, depth + 1);
  validatePacket(packet);
  const shape = emptyState(packet);
  for (const [key, value] of Object.entries(shape)) {
    if (Array.isArray(value) && !Array.isArray(state?.[key]))
      throw Error(`Archive state is missing ${key}.`);
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (!state?.[key] || typeof state[key] !== 'object' || Array.isArray(state[key]))
    )
      throw Error(`Invalid archive state ${key}.`);
  }
  if (
    !Number.isInteger(state.revision) ||
    state.revision < 0 ||
    !Number.isInteger(state.cycle) ||
    state.cycle < 0 ||
    !Array.isArray(attachments)
  )
    throw Error('Invalid archive revision or evidence list.');
  if (
    state.audit.some(
      (e: any) =>
        !e ||
        typeof e.id !== 'string' ||
        typeof e.type !== 'string' ||
        typeof e.at !== 'string' ||
        !Number.isInteger(e.revision),
    )
  )
    throw Error('Archive audit events must have stable identifiers, dates and revisions.');
  if (
    state.adjustments.some(
      (a: any) =>
        !a ||
        typeof a.id !== 'string' ||
        typeof a.target !== 'string' ||
        typeof a.version !== 'string' ||
        typeof a.active !== 'boolean' ||
        !Number.isFinite(a.federal) ||
        !Number.isFinite(a.california),
    )
  )
    throw Error('Archive adjustment records are invalid.');
  const ids = new Set();
  for (const f of attachments) {
    if (
      typeof f.id !== 'string' ||
      ids.has(f.id) ||
      typeof f.name !== 'string' ||
      typeof f.mime !== 'string' ||
      typeof f.data_base64 !== 'string' ||
      digest(f.data_base64) !== f.content_hash ||
      Buffer.from(f.data_base64, 'base64').toString('base64') !== f.data_base64 ||
      Buffer.from(f.data_base64, 'base64').length > 8 * 1024 * 1024
    )
      throw Error('Archive evidence failed integrity or size checks.');
    ids.add(f.id);
  }
  for (const e of state.evidence)
    if (e.fileId && !ids.has(e.fileId))
      throw Error('Archive is incomplete: a linked evidence file is missing.');
  return bundle.payload as {
    engagement: string;
    packet: Packet;
    state: WorkState;
    attachments: Row[];
  };
}
export function inheritedMetadata(bundle: Row, archiveId: string) {
  const p = bundle.payload;
  return {
    archiveId,
    sourceEngagement: p.engagement,
    sourceYear: p.packet.household.tax_year,
    sourceRevision: p.state.revision,
    digest: bundle.digest,
    evidenceFiles: p.attachments.length,
    reviewRecords: p.state.audit.length,
    packetHash: digest(p.packet),
  };
}
export function restoredState(
  payload: ReturnType<typeof validateHandoff>,
  prefix: string,
  actor: Row,
): WorkState {
  const ids = new Map<string, string>();
  const collect = (v: any) => {
    if (!v || typeof v !== 'object') return;
    if (typeof v.id === 'string') ids.set(v.id, `${prefix}-${v.id}`);
    for (const x of Object.values(v)) collect(x);
  };
  collect(payload.state);
  for (const f of payload.attachments) ids.set(f.id, `${prefix}-${f.id}`);
  const remap = (v: any): any =>
    typeof v === 'string'
      ? ids.get(v) || v
      : Array.isArray(v)
        ? v.map(remap)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)]))
          : v;
  const s = remap(payload.state) as WorkState;
  // Imported approval records are retained in the source archive, never accepted as new identity proof.
  s.signoffs = [];
  s.revision++;
  s.seen = {};
  s.seenPolicy = {};
  s.audit.push({
    id: randomUUID(),
    type: 'archive_restored',
    actor: actor.id,
    name: actor.name,
    at: new Date().toISOString(),
    target: 'all',
    revision: s.revision,
    cycle: s.cycle,
    detail:
      'Restored review and evidence into a separate engagement. Imported approval history is archived; fresh approvals are required.',
  });
  return s;
}
