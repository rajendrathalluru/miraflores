/** SERVER DATA MODULE. Import only from server routes/domain/tests, never a client component.
 * The public contracts and curated issues are separate so importing their types cannot bundle
 * the 1.9 MB packet or its identifiers into the browser. All exported reads are masked.
 */
import packetJson from '../data/packet.json';
import { issues } from './issues';
import type {
  Actor, Bootstrap, DocumentDetail, DocumentMeta, Evidence, ExtractedValue, ReturnLine,
  Scalar, TraceGraph, VersionMeta, Workspace,
} from './contracts';

interface RawDocument {
  id: string; title: string; document_type: string; issuer: string; belongs_to: string;
  tax_year: number; received_at: string; file_name: string; page_count: number;
  pages: { page: number; printed_content: string }[]; marked_corrected?: boolean;
  extraction: { status: string; values: number; reason: string | null };
}
interface RawVersion {
  version: string; computed_at: string; trigger: string; documents_used: string[];
  documents_superseded: string[]; summary: Record<string, Record<string, Scalar>>;
  diagnostics: unknown[]; lines: ReturnLine[]; assets: Record<string, unknown>[];
}
interface RawPacket {
  documents: RawDocument[]; extracted_values: ExtractedValue[]; return_versions: RawVersion[];
  firm: { staff: { id: string; name: string; role: Actor['role']; sensitive_data_clearance: boolean; active_from: string }[];
    client_users: { id: string; name: string; role: 'client' }[]; firm_identity: Record<string, unknown> };
  household: { people: Record<string, unknown>[]; bank_account_for_refund_or_payment: Record<string, unknown> };
  engine_reference: { rules: Record<string, string>; parameters: Record<string, unknown> };
  client: { questionnaire: Record<string, unknown>[]; messages: Record<string, unknown>[]; call_notes: Record<string, unknown>[] };
  timeline: Record<string, unknown>[]; prior_years: Record<string, unknown>;
  tax_agency_records: Record<string, unknown>;
}
const packet = packetJson as unknown as RawPacket;
const valueIndex = new Map(packet.extracted_values.map(value => [value.id, value]));
const documentIndex = new Map(packet.documents.map(document => [document.id, document]));

export const actors: Actor[] = [
  ...packet.firm.staff.map(staff => ({ id: staff.id, name: staff.name, role: staff.role,
    clearance: staff.sensitive_data_clearance, activeFrom: staff.active_from })),
  ...packet.firm.client_users.map(client => ({ id: client.id, name: client.name,
    role: client.role, clearance: false })),
];
export function getActor(actorId: string): Actor {
  const actor = actors.find(item => item.id === actorId);
  if (!actor) throw new Error('Choose a valid workspace role before continuing.');
  return { ...actor };
}

// Exact source secrets supplement contextual patterns. Names remain visible because the
// fictional household and named collaborators are the product's navigation identities.
const secrets = new Set<string>();
const sensitiveKey = /^(ssn|ip_pin|dob|phone|email|routing|account|ein|efin|ero_pin|ptin|address)$/i;
function collectSecrets(value: unknown, key = ''): void {
  if (typeof value === 'string' && sensitiveKey.test(key) && value.length >= 4) secrets.add(value);
  if (Array.isArray(value)) value.forEach(item => collectSecrets(item));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, item]) => collectSecrets(item, k));
}
collectSecrets(packet.household);
collectSecrets(packet.firm.firm_identity);
const homeAddresses = (packetJson as unknown as { household: { addresses: { address: string }[] } }).household.addresses;
for (const address of homeAddresses) secrets.add(address.address.split(',')[0]);
const ptins = packet.firm.firm_identity.ptins;
if (ptins && typeof ptins === 'object') Object.values(ptins).forEach(value => {
  if (typeof value === 'string') secrets.add(value);
});
for (const value of packet.extracted_values) {
  if (['ssn', 'ein', 'account_number'].includes(value.value_type) && typeof value.value === 'string') secrets.add(value.value);
}
const orderedSecrets = [...secrets].sort((a, b) => b.length - a.length);

export function maskSensitiveText(text: string): string {
  let result = text;
  for (const secret of orderedSecrets) result = result.split(secret).join('[masked]');
  return result
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[masked SSN]')
    .replace(/\b\d{2}-\d{7}\b/g, '[masked tax ID]')
    .replace(/\b(?:SE\d{2})(?:[ \d]){15,30}/g, '[masked account]')
    .replace(/((?:account|IRA|Roth IRA)\s+ending\s+)\d{4}\b/gi, '$1••••')
    .replace(/((?:taxpayer|spouse|ERO|IP)\s*PIN\s*[:=]?\s*)\d{5,6}\b/gi, '$1[masked]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[masked email]')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[masked phone]');
}

/** Sanitize arbitrary app-owned notes/history as well as imported evidence. */
export function masked<T>(value: T): T {
  if (typeof value === 'string') return maskSensitiveText(value) as T;
  if (Array.isArray(value)) return value.map(item => masked(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = sensitiveKey.test(key) && item != null ? '[masked]' : masked(item);
    }
    return out as T;
  }
  return value;
}

function safeValue(value: ExtractedValue): ExtractedValue {
  if (['ssn', 'ein', 'account_number'].includes(value.value_type)) {
    return { ...masked(value), value: '[masked]', text_as_read: '[masked]' };
  }
  return masked(value);
}
function getVersion(version: string): RawVersion {
  const found = packet.return_versions.find(item => item.version === version);
  if (!found) throw new Error('That engine version does not exist.');
  return found;
}

function metadata(document: RawDocument): DocumentMeta {
  return masked({
    id: document.id, title: document.title, documentType: document.document_type,
    issuer: document.issuer, belongsTo: document.belongs_to, taxYear: document.tax_year,
    receivedAt: document.received_at, fileName: document.file_name, pageCount: document.page_count,
    extraction: { ...document.extraction }, corrected: !!document.marked_corrected,
    usedIn: packet.return_versions.filter(version => version.documents_used.includes(document.id)).map(version => version.version),
    supersededIn: packet.return_versions.filter(version => version.documents_superseded.includes(document.id)).map(version => version.version),
    issueIds: issues.filter(issue => issue.sourceRefs.some(ref => ref.startsWith(`doc:${document.id}#`) || valueIndex.get(ref)?.document_id === document.id)).map(issue => issue.id),
  });
}

function sourceDocumentId(ref: string): string | undefined {
  if (valueIndex.has(ref)) return valueIndex.get(ref)?.document_id;
  return /^doc:(D\d+)#page\d+$/.exec(ref)?.[1] ?? (documentIndex.has(ref) ? ref : undefined);
}

/** Include every downstream destination, rather than only the lines that cite a
 * document directly. The supplied calculation graph is the source of this map;
 * it does not claim an adjustment has been recomputed by the tax engine.
 */
function documentDestinations(version: RawVersion, documentId: string): ReturnLine[] {
  const dependentLines = new Map<string, string[]>();
  for (const line of version.lines) for (const input of line.inputs) {
    const dependents = dependentLines.get(input) ?? [];
    dependents.push(line.key);
    dependentLines.set(input, dependents);
  }
  const destinations = new Set(version.lines
    .filter(line => line.sources.some(ref => sourceDocumentId(ref) === documentId))
    .map(line => line.key));
  const pending = [...destinations];
  for (let index = 0; index < pending.length; index++) {
    for (const key of dependentLines.get(pending[index]) ?? []) {
      if (destinations.has(key)) continue;
      destinations.add(key);
      pending.push(key);
    }
  }
  return version.lines.filter(line => destinations.has(line.key));
}

export function getDocument(id: string, actorId: string, state?: Workspace): DocumentDetail {
  getActor(actorId);
  // The state argument binds this read to the caller's workspace/API snapshot. No state is
  // modified and no full-identifier view is available, including for cleared staff.
  void state;
  const document = documentIndex.get(id);
  if (!document) throw new Error('That source document does not exist.');
  return {
    document: { ...metadata(document), pages: masked(document.pages) },
    values: packet.extracted_values.filter(value => value.document_id === id).map(safeValue),
    uses: packet.return_versions.flatMap(version => documentDestinations(version, id).map(line => ({
      version: version.version, key: line.key, label: maskSensitiveText(line.label), value: masked(line.value),
    }))),
  };
}

function pointer(root: unknown, path: string): unknown {
  if (!path || path === '/') return root;
  return path.replace(/^\//, '').split('/').reduce<unknown>((current, part) => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
  }, root);
}
function dotPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, root);
}
function evidenceText(value: unknown): string {
  return maskSensitiveText(typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? 'No source value found.');
}

export function resolveSource(ref: string, actorId = 'st-01', version = 'v3', state?: Workspace): Evidence {
  getActor(actorId);
  const lineRef = /^line:(v[123]):(.+)$/.exec(ref);
  const line = getVersion(lineRef?.[1] ?? version).lines.find(l => l.key === (lineRef?.[2] ?? ref));
  if (line) return { ref, type: 'return_line', label: `${line.key} · ${maskSensitiveText(line.label)}`, value: masked(line.value), text: evidenceText(line) };
  const value = valueIndex.get(ref);
  if (value) {
    const safe = safeValue(value);
    return { ref, type: 'extracted_value', label: safe.label, documentId: safe.document_id,
      page: safe.page, field: safe.field, value: safe.value, text: safe.text_as_read, confidence: safe.confidence };
  }
  const docMatch = /^doc:(D\d+)#page(\d+)$/.exec(ref);
  if (docMatch || documentIndex.has(ref)) {
    const id = docMatch?.[1] ?? ref;
    const doc = documentIndex.get(id);
    const page = Number(docMatch?.[2] ?? 1);
    const content = doc?.pages.find(item => item.page === page);
    return { ref, type: 'document_page', label: doc?.title ?? id, documentId: id, page,
      text: content ? maskSensitiveText(content.printed_content) : 'Source page not found.', missing: !content };
  }
  const clientCollections = [packet.client.questionnaire, packet.client.messages, packet.client.call_notes];
  const clientRecord = clientCollections.flat().find(item => item.id === ref);
  if (clientRecord) return { ref, type: 'client_evidence', label: ref, text: evidenceText(clientRecord) };
  if (ref.startsWith('py:/')) return resolvedRecord(ref, 'prior_year', pointer(packet.prior_years, ref.slice(3)));
  if (ref.startsWith('packet:/')) return resolvedRecord(ref, 'packet_record', pointer(packetJson, ref.slice(7)));
  if (ref.startsWith('agency:/')) return resolvedRecord(ref, 'agency_record', pointer(packet.tax_agency_records, ref.slice(7)));
  if (ref.startsWith('ref:rule.')) return resolvedRecord(ref, 'rule', packet.engine_reference.rules[ref.slice(9)]);
  if (ref.startsWith('timeline:')) return resolvedRecord(ref, 'timeline', packet.timeline.find(item => item.id === ref.slice(9)));
  if (ref.startsWith('household:')) return resolvedRecord(ref, 'household', packet.household.people.find(item => item.id === ref.slice(10)));
  if (ref.startsWith('ref:param.')) return resolvedRecord(ref, 'parameter', dotPath(packet.engine_reference.parameters, ref.slice(10)));
  if (ref.startsWith('ref:fx.SEK.')) return resolvedRecord(ref, 'parameter', dotPath(packet.engine_reference.parameters, `fx.SEK.${ref.slice(11)}`));
  if (ref.startsWith('asset:')) {
    const current = getVersion(version).assets.find(item => item.asset_id === ref.slice(6));
    const assets = pointer(packet.prior_years, '/asset_records');
    const found = current ?? (Array.isArray(assets) ? assets.find(item => item.asset_id === ref.slice(6)) : undefined);
    return resolvedRecord(ref, 'asset', found);
  }
  const local = /^local:(question|judgment|notice|attachment|link|note|plan|task|reconciliation|lineAdjustment|history):(.+)$/.exec(ref);
  if (local) {
    const collections: Record<string, string> = {
      question: 'questions', judgment: 'judgments', notice: 'notices', attachment: 'attachments', link: 'links',
      plan: 'plans', task: 'tasks', reconciliation: 'reconciliations', lineAdjustment: 'lineAdjustments', history: 'history',
    };
    const workpaper = (state as (Workspace & { workpaper?: Record<string, unknown> }) | undefined)?.workpaper;
    const records = local[1] === 'note' ? state?.notes : workpaper?.[collections[local[1]]];
    const record = Array.isArray(records) ? records.find(item => item && typeof item === 'object' && item.id === local[2]) : undefined;
    return resolvedRecord(ref, `local_${local[1]}`, record);
  }
  return { ref, type: 'unresolved', label: ref, text: 'No matching supplied evidence was found.', missing: true };
}
function resolvedRecord(ref: string, type: string, value: unknown): Evidence {
  return { ref, type, label: ref, text: evidenceText(value), missing: value === undefined };
}

export function getVersionLines(version = 'v3', actorId = 'st-01'): ReturnLine[] {
  getActor(actorId);
  return getVersion(version).lines.map(line => masked({ ...line, version }));
}

export function getBootstrap(actorId: string, workspace: Workspace): Bootstrap {
  const actor = getActor(actorId);
  const resolved = (issueId: string) => {
    const latest = [...workspace.investigations].reverse().find(item => item.issueId === issueId);
    return workspace.adjustments.some(item => item.issueId === issueId && item.status === 'active') ||
      (issues.find(issue => issue.id === issueId)?.kind !== 'adjustment' && latest?.result === 'resolved' && latest.authority?.trim());
  };
  const sourceIndex: Bootstrap['sourceIndex'] = {};
  for (const value of packet.extracted_values) sourceIndex[value.id] = {
    documentId: value.document_id, page: value.page, field: value.field, label: maskSensitiveText(value.label),
  };
  for (const document of packet.documents) for (const page of document.pages) {
    sourceIndex[`doc:${document.id}#page${page.page}`] = { documentId: document.id, page: page.page, label: document.title };
  }
  const versions: VersionMeta[] = packet.return_versions.map(version => ({
    version: version.version, computedAt: version.computed_at, trigger: version.trigger,
    summary: masked(version.summary), lineCount: version.lines.length, diagnosticCount: version.diagnostics.length,
    documentsUsed: [...version.documents_used], documentsSuperseded: [...version.documents_superseded],
  }));
  return {
    actor, actors: actors.map(item => ({ ...item })),
    stats: { documentCount: packet.documents.length,
      pageCount: packet.documents.reduce((total, doc) => total + doc.page_count, 0),
      valueCount: packet.extracted_values.length, issueCount: issues.length,
      openHighIssues: issues.filter(issue => issue.severity === 'high' && !resolved(issue.id)).length,
      activeAdjustments: workspace.adjustments.filter(item => item.status === 'active').length,
      openNotes: workspace.notes.filter(note => note.status === 'open').length, revision: workspace.revision },
    versions, documents: packet.documents.map(metadata), issues: masked(issues),
    lines: getVersionLines('v3', actorId), sourceIndex, workspace: masked(workspace),
  };
}

export function traceLine(key: string, version = 'v3', actorId = 'st-01', state?: Workspace): TraceGraph {
  getActor(actorId); void state;
  const lines = getVersion(version).lines;
  const index = new Map(lines.map(line => [line.key, line]));
  if (!index.has(key)) throw new Error('That return line does not exist in this engine version.');
  const graph: TraceGraph = { root: key, version, nodes: [], edges: [] };
  const seen = new Set<string>();
  function visit(lineKey: string): void {
    if (seen.has(lineKey)) return;
    seen.add(lineKey);
    const line = index.get(lineKey);
    if (!line) return;
    graph.nodes.push({ id: lineKey, type: 'line', label: maskSensitiveText(line.label), value: masked(line.value), line: masked({ ...line, version }) });
    if (line.rule) {
      const ruleId = `rule:${line.rule}`;
      graph.edges.push({ from: lineKey, to: ruleId, relation: 'rule' });
      if (!seen.has(ruleId)) {
        seen.add(ruleId);
        graph.nodes.push({ id: ruleId, type: 'rule', label: line.rule, text: maskSensitiveText(packet.engine_reference.rules[line.rule] ?? 'Rule description is not included in the supplied engine reference.') });
      }
    }
    for (const input of line.inputs) {
      graph.edges.push({ from: lineKey, to: input, relation: 'input' });
      visit(input);
    }
    for (const ref of line.sources) {
      const sourceId = `source:${ref}`;
      graph.edges.push({ from: lineKey, to: sourceId, relation: 'source' });
      if (!seen.has(sourceId)) {
        seen.add(sourceId);
        const evidence = resolveSource(ref, actorId, version);
        graph.nodes.push({ id: sourceId, type: 'evidence', label: evidence.label, value: evidence.value, evidence });
      }
    }
  }
  visit(key);
  return graph;
}
