"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, FileText, GitBranch, Link2, Loader2, LockKeyhole, MessageSquare, Search, ShieldCheck, Undo2 } from 'lucide-react';
import type { DocumentDetail, ExtractedValue, ReviewContext } from '../../lib/contracts';
import { Badge, Empty, RecordData, date, errorMessage, money, reviewed } from './workpaper-ui';
import styles from '../review-workbench.module.css';

type Props = {
  data: RecordData; busy: boolean; onCommand: (command: RecordData) => Promise<boolean>;
  onOpenSource: (ref: string) => void; version?: string; selectedIssueId?: string | null;
  selectedRef?: string | null; onSelectRef?: (ref: string, version?: string) => void;
  onSelectIssue?: (id: string) => void; onDirtyChange?: (dirty: boolean) => void;
  onNavigate?: (target: 'records' | 'evidence' | 'operations') => void;
  active?: boolean;
};
type Selection = { kind: 'issue' | 'ref'; id: string; version?: string; globalVersion?: string };
type Draft = {
  reason: string; authority: string; note: string; question: string; verification: string;
  method: string; outcome: string; recipient: string; dispositionReason: string; disposition: string;
  signature: string; targetRef: string; targetDocument: string; mode: 'decision' | 'verify' | 'note' | 'question' | 'document';
};
const blankDraft = (): Draft => ({ reason: '', authority: '', note: '', question: '', verification: '', method: 'agreed_to_source_document', outcome: 'open', recipient: '', dispositionReason: '', disposition: 'used', signature: '', targetRef: '', targetDocument: '', mode: 'decision' });
const hasText = (draft: Draft) => !![draft.reason, draft.authority, draft.note, draft.question, draft.verification, draft.dispositionReason, draft.recipient].some(value => value.trim()) || draft.method !== 'agreed_to_source_document' || draft.outcome !== 'open' || draft.disposition !== 'used';
const methods = ['agreed_to_source_document', 'recalculated', 'confirmed_with_client', 'agreed_to_prior_year', 'agreed_to_third_party_record'];
const readable = (value: string) => value.replaceAll('_', ' ');
const areas = ['Intake and identity', 'Wages and stock compensation', 'Investments and digital assets', 'Business and books to tax', 'Rentals and property sale', 'K-1s and S corporation basis', 'Retirement', 'Foreign reporting', 'Deductions and credits', 'Payments and penalties', 'California allocation', 'Carryovers and prior preparer', 'Outside filings'];
function display(value: unknown, unit = '') {
  if (value == null) return 'Not established';
  if (typeof value === 'number') return /USD|dollar/i.test(unit) ? money(value, 2) : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${/mile/i.test(unit) ? ' miles' : ''}`;
  return String(value);
}
function lineUnit(line?: { key?: string; label?: string; value?: unknown }) {
  if (typeof line?.value !== 'number') return '';
  return /\.44[abc]$/.test(line.key || '') || /^(?:business|commuting|other|total|odometer)\b.*\bmiles\b/i.test(line.label || '') ? 'miles' : 'USD';
}
function contextSignature(context: ReviewContext | null) {
  if (!context) return '';
  return JSON.stringify({ selection: context.selection, issue: context.issue, evidence: context.evidence, lines: context.lines, decisions: context.decisions, cycle: context.token.cycle, replay: context.token.replay });
}
function PrintedSource({ value, field }: { value: unknown; field?: ExtractedValue }) {
  if (value == null) return <p className={styles.meta}>No printed source content was supplied on this page.</p>;
  if (typeof value === 'string') {
    const candidates = field && !String(field.value).includes('[masked') ? [field.text_as_read, typeof field.value === 'number' ? field.value.toLocaleString('en-US', { minimumFractionDigits: field.value_type === 'money' ? 2 : 0 }) : String(field.value ?? '')] : [];
    const unique = candidates.find(candidate => candidate.length > 2 && value.includes(candidate) && value.indexOf(candidate) === value.lastIndexOf(candidate));
    const start = unique ? value.indexOf(unique) : -1;
    return <p className={styles.printedText}>{unique && start >= 0 ? <>{value.slice(0, start)}<mark>{unique}</mark>{value.slice(start + unique.length)}</> : value}</p>;
  }
  if (Array.isArray(value)) return <>{value.map((item, i) => <PrintedSource value={item} key={i}/>)}</>;
  if (typeof value === 'object') return <dl className={styles.sourceFields}>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{readable(key)}</dt><dd><PrintedSource value={item}/></dd></div>)}</dl>;
  return <span>{String(value)}</span>;
}
function LabelledValue({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return <div className={`${styles.valueCard} ${tone === 'reviewed' ? styles.reviewedValue : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

export default function ReviewWorkbench({ data, busy, onCommand, onOpenSource, version = 'v3', selectedIssueId, selectedRef, onSelectRef, onSelectIssue, onDirtyChange, onNavigate, active = true }: Props) {
  const defaultIssueId = selectedIssueId || data.issues?.[0]?.id || 'duplicate-mileage';
  const incomingSelection = selectedRef ? `ref:${selectedRef}` : `issue:${defaultIssueId}`;
  const [selection, setSelection] = useState<Selection>(() => selectedRef ? { kind: 'ref', id: selectedRef } : { kind: 'issue', id: defaultIssueId });
  const [context, setContext] = useState<ReviewContext | null>(null);
  const [lastContextError, setContextError] = useState('');
  const [completedRequestKey, setCompletedRequestKey] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [focusRef, setFocusRef] = useState('');
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<'findings' | 'documents' | 'lines'>('findings');
  const [filter, setFilter] = useState('open');
  const [pane, setPane] = useState<'queue' | 'evidence' | 'decision'>('evidence');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState('');
  const [historicalLines, setHistoricalLines] = useState<{ version: string; actorId: string; lines: RecordData[] } | null>(null);
  const [lineError, setLineError] = useState('');
  const externalSelection = useRef(incomingSelection);
  const requestCounter = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const actorId = String(data.actor?.id || '');
  const currentVersion = selection.version && selection.globalVersion === version ? selection.version : version;
  const requestKey = `${actorId}:${currentVersion}:${selection.kind}:${selection.id}:${data.workspace?.revision}:${refresh}`;
  const loading = active && completedRequestKey !== requestKey;
  const contextError = completedRequestKey === requestKey ? lastContextError : '';
  const itemKey = `${actorId}:${data.workspace?.workpaper?.cycle || 0}:${currentVersion}:${selection.kind}:${selection.id}`;
  const draft = drafts[itemKey] || blankDraft();
  const signature = useMemo(() => contextSignature(context), [context]);
  const dirty = Object.values(drafts).some(hasText);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!active) return;
    if (incomingSelection !== externalSelection.current) {
      externalSelection.current = incomingSelection;
      setSelection(selectedRef ? { kind: 'ref', id: selectedRef } : { kind: 'issue', id: defaultIssueId });
      setFocusRef(''); setMessage(''); setPane('evidence');
    }
  }, [incomingSelection, selectedRef, defaultIssueId, active]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); const requestId = ++requestCounter.current;
    const params = new URLSearchParams({ [selection.kind === 'issue' ? 'issueId' : 'ref']: selection.id, version: currentVersion });
    fetch(`/api/review-context?${params}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The selected review context could not be loaded.');
      if (requestId === requestCounter.current) { setContext(result as ReviewContext); setContextError(''); }
    }).catch(error => { if (!controller.signal.aborted) setContextError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted && requestId === requestCounter.current) setCompletedRequestKey(requestKey); });
    return () => controller.abort();
  }, [selection.id, selection.kind, currentVersion, actorId, data.workspace?.revision, refresh, active, requestKey]);
  useEffect(() => {
    if (!active || queue !== 'lines' || currentVersion === 'v3') return;
    const controller = new AbortController();
    fetch(`/api/lines?version=${encodeURIComponent(currentVersion)}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The version’s numbers could not be loaded.');
      setHistoricalLines({ version: currentVersion, actorId, lines: result.lines || [] }); setLineError('');
    }).catch(error => { if (!controller.signal.aborted) setLineError(errorMessage(error)); });
    return () => controller.abort();
  }, [queue, currentVersion, active, actorId]);

  const contextMatches = !!context && (context.token.replay?.at ?? null) === (data.workspace?.workpaper?.replayAt ?? null) && context.actor.id === actorId && context.token.engineVersion === currentVersion && (selection.kind === 'issue' ? context.issue?.id === selection.id : context.selection.ref === selection.id);
  const activeContext = contextMatches ? context : null;
  const draftChanged = hasText(draft) && !!draft.signature && signature !== draft.signature;
  const stale = !activeContext || activeContext.token.editRevision !== data.workspace?.revision;
  const issue = activeContext?.issue;
  const permitted = (action: string) => !!activeContext?.permittedActions.includes(action) && !loading && !stale && !draftChanged && !contextError;
  function edit(patch: Partial<Draft>) {
    setDrafts(previous => {
      const current = previous[itemKey] || blankDraft();
      return { ...previous, [itemKey]: { ...current, ...patch, signature: hasText(current) ? current.signature : signature,
        targetRef: hasText(current) ? current.targetRef : verifyRef, targetDocument: hasText(current) ? current.targetDocument : focusedDocument?.document.id || '' } };
    }); setMessage('');
  }
  function select(next: Selection) {
    setSelection({ ...next, globalVersion: version }); setFocusRef(''); setMessage(''); setPane('evidence');
    externalSelection.current = `${next.kind}:${next.id}`;
    if (next.kind === 'issue') onSelectIssue?.(next.id);
    else onSelectRef?.(next.id, next.version || currentVersion);
  }
  async function save(command: RecordData, fields: (keyof Draft)[] = []) {
    if (loading || stale || draftChanged || !activeContext) return;
    const key = itemKey; const submitted = draft;
    if (await onCommand({ ...command, expectedRevision: activeContext.token.editRevision })) {
      setDrafts(previous => {
        const current = previous[key] || blankDraft(); const defaults = blankDraft();
        const next = { ...current, ...Object.fromEntries(fields.map(field => [field, current[field] === submitted[field] ? defaults[field] : current[field]])) };
        if (!hasText(next)) next.signature = '';
        return { ...previous, [key]: next };
      }); setMessage('Saved to the review record. Original evidence is preserved.'); setRefresh(value => value + 1);
    } else setMessage('The action was not confirmed. Your draft is retained; review the workspace error before trying again.');
  }
  function source(ref: string) {
    const doc = activeContext?.documents.find(item => item.values.some(field => field.id === ref) || ref.startsWith(`doc:${item.document.id}#`));
    if (doc) { setFocusRef(ref); setPane('evidence'); }
    else onOpenSource(/^(?:F\d+|Sch[A-Za-z0-9]+|FTB\d+|ScheduleS)\./.test(ref) ? `line:${activeContext?.token.engineVersion || currentVersion}:${ref}` : ref);
  }

  const documents = activeContext?.documents || [];
  const explicitDocumentRef = issue?.sourceRefs.find(ref => ref.startsWith('doc:'));
  const explicitDocumentMatch = explicitDocumentRef ? /^doc:(D\d+)#page(\d+)/.exec(explicitDocumentRef) : null;
  const initialLinkedField = documents.flatMap(item => item.values).find(item => issue?.sourceRefs.includes(item.id) && (!explicitDocumentMatch || (item.document_id === explicitDocumentMatch[1] && item.page === Number(explicitDocumentMatch[2]))));
  const preferred = focusRef || initialLinkedField?.id || explicitDocumentRef || activeContext?.evidence.find(item => item.documentId)?.ref || activeContext?.selection.ref || '';
  const matchedField = documents.flatMap(item => item.values).find(field => field.id === preferred);
  const matchDoc = /^doc:(D\d+)#page(\d+)/.exec(preferred);
  const focusedEvidence = activeContext?.evidence.find(item => item.ref === preferred);
  const focusedDocument: DocumentDetail | undefined = documents.find(item => item.document.id === (matchedField?.document_id || matchDoc?.[1] || focusedEvidence?.documentId)) || documents[0];
  const page = matchedField?.page || Number(matchDoc?.[2]) || focusedEvidence?.page || 1;
  const pageFields = focusedDocument?.values.filter(field => field.page === page) || [];
  const field: ExtractedValue | undefined = matchedField || pageFields[0];
  const verifyRef = field?.id || activeContext?.selection.ref || '';
  const actionRef = hasText(draft) ? draft.targetRef || verifyRef : verifyRef;
  const actionDocument = hasText(draft) ? draft.targetDocument || focusedDocument?.document.id : focusedDocument?.document.id;
  const pageData = focusedDocument?.document.pages.find(item => item.page === page);
  const activeAdjustment = activeContext?.decisions.adjustments.find(item => item.status === 'active' && (!issue || item.issueId === issue.id));
  const workflow = data.workspace?.workpaper || {};
  const coverage = activeContext?.coverage;
  const canExitReplay = ['preparer', 'reviewer', 'partner', 'quality_reviewer'].includes(String(data.actor?.role));
  const issueRows = (data.issues || []).filter((item: RecordData) => `${item.title} ${item.area} ${item.description}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'reviewed' ? reviewed(item, data.workspace) : !reviewed(item, data.workspace))));
  const documentRows = (data.documents || []).filter((item: RecordData) => `${item.id} ${item.title} ${item.issuer}`.toLowerCase().includes(query.toLowerCase()));
  const availableLines = currentVersion === 'v3' ? data.lines || [] : historicalLines?.version === currentVersion && historicalLines.actorId === actorId ? historicalLines.lines : [];
  const lineRows = availableLines.filter((item: RecordData) => `${item.key} ${item.label} ${item.value}`.toLowerCase().includes(query.toLowerCase())).slice(0, 80);
  const notes = activeContext?.decisions.notes || [];
  const verification = activeContext?.decisions.verifications.find(item => item.ref === actionRef);
  const client = data.actor?.role === 'client';

  return <div className={styles.workbench} ref={rootRef}>
    <header className={styles.intro}><div><div className={styles.eyebrow}>THE REVIEW WORKSPACE</div><h1>A number carries its proof.</h1><p>Source, extracted reading, supplied computation and human judgment, together.</p></div><div className={styles.introActions}><Badge tone="sand">{client ? 'Client inspection' : 'Human decisions'}</Badge><button className="button button-secondary button-small" onClick={() => onNavigate?.('operations')}>Completeness &amp; bulk tools <ArrowRight size={14}/></button></div></header>
    {workflow.replayAt && <div className={styles.notice} role="status"><LockKeyhole size={17}/><div><strong>Historical replay · {date(workflow.replayAt)}</strong><p>Only evidence available at this stage can be inspected. A selected engine version may not have existed yet. Current decisions are read-only.</p>{canExitReplay ? <button className="button button-secondary button-small" disabled={busy} onClick={async () => { if (await onCommand({ type: 'workflow', action: 'set_replay', payload: { eventId: null }, expectedRevision: data.workspace.revision })) setRefresh(value => value + 1); }}>Return to current review <ArrowRight size={13}/></button> : <p>A tax-staff persona can return this shared workspace to the current review.</p>}</div></div>}
    <section className={styles.coverage} aria-label="Workpaper coverage">
      <div><strong>{(data.issues || []).filter((item: RecordData) => !reviewed(item, data.workspace)).length}</strong><span>open findings</span></div>
      <div><strong>{coverage?.documents.completed ?? '—'}<small>/{coverage?.documents.total ?? '—'}</small></strong><span>documents accounted for</span></div>
      <div><strong>{coverage?.areas.completed ?? '—'}<small>/{coverage?.areas.total ?? '—'}</small></strong><span>areas concluded</span></div>
      <div><strong>{coverage?.outsideFilings.completed ?? '—'}<small>/{coverage?.outsideFilings.total ?? '—'}</small></strong><span>outside filings accounted for</span></div>
      <div><strong>{coverage?.verifications ?? '—'}</strong><span>value verifications recorded</span></div>
      <details className={styles.coverageDetail}><summary>What remains <ChevronDown size={14}/></summary><div><strong>Finding resolution is one part of completeness.</strong><p>Verification count records saved methods; it does not certify every number.</p><ul>{areas.filter(area => workflow.areas?.[area]?.status !== 'reviewed').map(area => <li key={area}>{area}: conclusion pending</li>)}</ul><button className="text-button" onClick={() => onNavigate?.('operations')}>Review documents, areas, diligence and outside filings <ArrowRight size={13}/></button></div></details>
    </section>
    <div className={styles.mobileTabs} role="tablist" aria-label="Review workspace panes">{(['queue', 'evidence', 'decision'] as const).map((tab, index, tabs) => <button key={tab} role="tab" tabIndex={pane === tab ? 0 : -1} aria-selected={pane === tab} aria-controls={`review-pane-${tab}`} id={`review-tab-${tab}`} onClick={() => setPane(tab)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); setPane(tabs[next]); requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`#review-tab-${tabs[next]}`)?.focus()); } }}>{readable(tab)}</button>)}</div>
    <div className={styles.columns}>
      <section id="review-pane-queue" aria-label="Review queue" className={`${styles.queuePane} ${pane === 'queue' ? styles.mobileVisible : ''}`}>
        <div className={styles.paneHeading}><h2>Review queue</h2><span>Choose the work. Keep the context.</span></div>
        <div className={styles.queueTools}><div className={styles.segmented} aria-label="Choose review population">{(['findings', 'documents', 'lines'] as const).map(item => <button key={item} aria-pressed={queue === item} onClick={() => { setQueue(item); setQuery(''); }}>{item === 'lines' ? 'Numbers' : readable(item)}</button>)}</div><label className={styles.search}><Search size={15}/><input aria-label="Search review queue" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search work or a number…"/></label>{queue === 'findings' && <select aria-label="Finding review state" value={filter} onChange={event => setFilter(event.target.value)}><option value="open">Open findings</option><option value="all">All findings</option><option value="reviewed">Decision recorded</option></select>}</div>
        <div className={styles.queueList}>
          {queue === 'findings' ? issueRows.length ? issueRows.map((item: RecordData) => <button key={item.id} aria-pressed={selection.kind === 'issue' && selection.id === item.id} className={`${styles.queueItem} ${selection.kind === 'issue' && selection.id === item.id ? styles.selected : ''}`} onClick={() => select({ kind: 'issue', id: item.id })}><span className={styles.queueStatus}>{reviewed(item, data.workspace) ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {reviewed(item, data.workspace) ? 'Decision recorded' : item.kind === 'judgment' ? 'Judgment required' : 'Evidence check'}</span><strong>{item.title}</strong><span>{item.area} · {item.sourceRefs?.length || 0} source links</span></button>) : <Empty title="No matching findings" detail="Document, area and value review remain separate."/> : queue === 'documents' ? documentRows.map((item: RecordData) => <button key={item.id} className={`${styles.queueItem} ${selection.id === `doc:${item.id}#page1` ? styles.selected : ''}`} onClick={() => select({ kind: 'ref', id: `doc:${item.id}#page1` })}><span className={styles.queueStatus}><FileText size={13}/> {item.id} · {item.pageCount} pages</span><strong>{item.title}</strong><span>{readable(workflow.documents?.[item.id]?.status || 'Disposition pending')}</span></button>) : <>{lineError && <p className={styles.error} role="alert">{lineError}</p>}{!availableLines.length && <p className={styles.meta}>Loading supplied {currentVersion.toUpperCase()} numbers…</p>}{lineRows.map((item: RecordData) => <button key={item.key} className={`${styles.queueItem} ${selection.id === item.key ? styles.selected : ''}`} onClick={() => select({ kind: 'ref', id: item.key, version: currentVersion })}><span className={styles.queueStatus}><GitBranch size={13}/> {item.key} · Supplied {currentVersion.toUpperCase()}</span><strong>{item.label}</strong><span>{display(item.value, lineUnit(item))} · {workflow.verifications?.[item.key] ? 'Verification recorded' : 'Unverified'}</span></button>)}<p className={styles.queueFoot}>Showing up to 80 matching {currentVersion.toUpperCase()} lines. Search to narrow; all versions and lines remain in Return.</p></>}
        </div><div className={styles.queueFoot}><button className="text-button" onClick={() => onNavigate?.('records')}>All tax records &amp; independent checks <ArrowUpRight size={13}/></button><p>Review extends beyond the curated findings.</p></div>
      </section>

      <section id="review-pane-evidence" aria-label="Evidence and computation" className={`${styles.evidencePane} ${pane === 'evidence' ? styles.mobileVisible : ''}`}>
        <div className={styles.paneHeading}><h2>Evidence &amp; computation</h2><span>{activeContext?.selection.label || 'Loading selected context…'}</span></div>
        {contextError && <div role="alert" className={styles.error}><AlertCircle size={17}/><p>{contextError}<br/>Your drafts are retained. This selection could not be loaded.</p><button className="text-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {loading && <div className={styles.refreshing} role="status"><Loader2 size={14} className="spin"/>{activeContext ? 'Refreshing this review context…' : 'Loading the source and review context…'}</div>}
        {activeContext && <div className={styles.evidenceBody}>
          <details className={styles.contextToken}><summary><ShieldCheck size={14}/> {activeContext.token.engineVersion.toUpperCase()} · Edit {activeContext.token.editRevision} · Content {activeContext.token.contentRevision} · Cycle {activeContext.token.cycle + 1}{activeContext.token.replay && ' · Read-only replay'} <ChevronDown size={13}/></summary><dl><div><dt>Packet SHA-256</dt><dd>{activeContext.token.packetSha256}</dd></div><div><dt>Frozen parent</dt><dd>{activeContext.token.frozenParentId || 'None in this cycle'}</dd></div>{activeContext.token.frozenContentHash && <div><dt>Frozen content hash</dt><dd>{activeContext.token.frozenContentHash}</dd></div>}<div><dt>Access</dt><dd>Local evaluator sandbox · Fictional role selection</dd></div>{activeContext.token.replay && <div><dt>Replay</dt><dd>{date(activeContext.token.replay.at)} · Read-only historical availability</dd></div>}</dl></details>
          {issue && <div className={styles.selectedSummary}><span className={styles.eyebrow}>{issue.area} / {issue.kind === 'judgment' ? 'PROFESSIONAL JUDGMENT' : 'SOURCE CHECK'}</span><h3>{issue.title}</h3><p>{issue.description}</p></div>}
          <ol className={styles.provenance} aria-label="Provenance chain"><li><FileText size={15}/><span>Source record</span></li><li><ArrowRight size={12}/></li><li><Search size={15}/><span>Extracted reading</span></li><li><ArrowRight size={12}/></li><li><GitBranch size={15}/><span>Supplied computation</span></li></ol>
          {documents.length > 0 && <div className={styles.sourceToolbar}><label>Document<select aria-label="Review source document" value={focusedDocument?.document.id || ''} onChange={event => setFocusRef(`doc:${event.target.value}#page1`)}>{documents.map(item => <option key={item.document.id} value={item.document.id}>{item.document.id} · {item.document.title}</option>)}</select></label>{focusedDocument && <label>Page<select aria-label="Review source page" value={page} onChange={event => setFocusRef(`doc:${focusedDocument.document.id}#page${event.target.value}`)}>{focusedDocument.document.pages.map(item => <option value={item.page} key={item.page}>{item.page} of {focusedDocument.document.pageCount}</option>)}</select></label>}</div>}
          {focusedDocument ? <article className={styles.sourcePaper}><header><span>SIMULATED SOURCE DOCUMENT</span><button className="text-button" onClick={() => onOpenSource(field?.id || `doc:${focusedDocument.document.id}#page${page}`)}>Full viewer <ArrowUpRight size={13}/></button></header><h3>{focusedDocument.document.title}</h3>{field && <div className={styles.fieldIdentity}><strong>{field.label || readable(field.field)}</strong><code>{focusedDocument.document.id} / page {page} / {field.field} / {field.id}</code><span>Stable field identity · Synthetic locator, not verified original-image geometry</span><span>Supplied normalized box: ({field.position.x0}, {field.position.y0})–({field.position.x1}, {field.position.y1}). A text highlight is approximate and appears only for a unique matching reading.</span></div>}<div className={styles.printedScroll}><PrintedSource value={pageData?.printed_content} field={field}/></div><footer>Reflowed printed content · {focusedDocument.document.fileName} · No OCR or original image is asserted.</footer></article> : <div className={styles.referenceEvidence}>{activeContext.evidence.map(item => <article key={item.ref}><Badge>{item.type}</Badge><h3>{item.label}</h3><p>{item.text || display(item.value)}</p><button className="text-button" onClick={() => onOpenSource(item.ref)}>{item.ref} <ArrowUpRight size={13}/></button></article>)}</div>}
          {pageFields.length > 0 && <label className={styles.fieldPicker}>Exact field on this page<select aria-label="Review selected source field" value={field?.id || ''} onChange={event => setFocusRef(event.target.value)}>{pageFields.map(item => <option value={item.id} key={item.id}>{item.label || item.field} · {item.id}</option>)}</select></label>}
          <div className={styles.values}>{field && <LabelledValue label="Extracted reading" value={<>{display(field.value, field.value_type === 'money' ? 'USD' : /mile/i.test(field.label) ? 'miles' : '')}<small>{Math.round(field.confidence * 100)}% extraction confidence · Human verification is separate</small></>}/>}<LabelledValue label={`${activeContext.token.engineVersion.toUpperCase()} supplied engine ${issue && currentVersion === 'v3' ? 'input' : 'value'}`} value={issue && currentVersion === 'v3' ? display(issue.original, issue.unit) : display((activeContext.lines.find(item => item.key === activeContext.selection.ref) || activeContext.lines[0])?.value, lineUnit(activeContext.lines.find(item => item.key === activeContext.selection.ref) || activeContext.lines[0]))}/></div>
          {activeContext.checks.length > 0 && <section className={styles.checkSection}><h3><ShieldCheck size={17}/> Independent source checks</h3>{activeContext.checks.map(check => <details key={check.id} className={styles.check}><summary><span>{check.status === 'agrees' ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>} {check.title}</span><Badge tone={check.status === 'agrees' ? 'sage' : 'sand'}>{readable(check.status)}</Badge></summary><p>{check.method}</p><div className={styles.checkNumbers}><span>Engine / comparison <strong>{display(check.engineValue, check.unit)}</strong></span><span>Independent <strong>{display(check.independentValue, check.unit)}</strong></span></div><p>{check.detail}</p><div className={styles.sourceLinks}>{check.sourceRefs.map(ref => <button key={ref} onClick={() => source(ref)}>{ref} <ArrowUpRight size={11}/></button>)}</div></details>)}</section>}
          <section className={styles.computation}><h3><GitBranch size={17}/> How the supplied number was built</h3>{activeContext.computation ? <><code className={styles.rule}>{activeContext.computation.nodes.find(node => node.id === activeContext.computation?.root)?.line?.rule || activeContext.lines[0]?.rule || 'Direct source / supplied computation'}</code>{activeContext.computation.nodes.filter(node => node.type === 'rule').map(node => <p key={node.id}>{node.text || node.label}</p>)}<div className={styles.computationInputs}>{activeContext.lines.slice(0, 12).map(line => <button key={line.key} onClick={() => onOpenSource(`line:${activeContext.token.engineVersion}:${line.key}`)}><span><code>{line.key}</code>{line.label}</span><strong>{display(line.value, lineUnit(line))}</strong><ArrowUpRight size={12}/></button>)}</div></> : <p className={styles.meta}>This selection is source evidence. Open a linked return destination to inspect its supplied computation.</p>}</section>
          {focusedDocument && <details className={styles.reverse}><summary><Link2 size={15}/> All recorded destinations ({focusedDocument.uses.length}) <ChevronDown size={13}/></summary>{focusedDocument.uses.length ? <div>{focusedDocument.uses.map(use => <button key={`${use.version}:${use.key}`} onClick={() => select({ kind: 'ref', id: use.key, version: use.version })}><Badge>{use.version}</Badge><span><code>{use.key}</code>{use.label}</span><ArrowUpRight size={13}/></button>)}</div> : <p>No direct destination is recorded. Review supporting use and record a specific unused/disposition reason; absence alone does not establish non-use.</p>}<p className={styles.meta}>Saved disposition: {readable(workflow.documents?.[focusedDocument.document.id]?.status || 'needs review')}{workflow.documents?.[focusedDocument.document.id]?.reason ? ` — ${workflow.documents[focusedDocument.document.id].reason}` : ''}</p></details>}
          {activeContext.changes.events.length > 0 && <details className={styles.history}><summary>Changes since your last seen revision ({activeContext.changes.events.length}) <ChevronDown size={13}/></summary>{activeContext.changes.events.slice(-8).reverse().map(event => <article key={event.id}><strong className={styles.meta}>{readable(event.type)} · Edit {event.revision}</strong><p>{event.detail}</p><small>{date(event.at)} · {data.actors?.find((actor: RecordData) => actor.id === event.actorId)?.name || event.actorId}</small></article>)}<p className={styles.meta}>These are workspace events after revision {activeContext.changes.sinceRevision}. Review relevant changes before acknowledging them in Team.</p></details>}<p className={styles.disclaimer}>{activeContext.disclaimer}</p>
        </div>}
      </section>

      <section id="review-pane-decision" aria-label="Human decision" className={`${styles.decisionPane} ${pane === 'decision' ? styles.mobileVisible : ''}`}>
        <div className={styles.paneHeading}><h2>Human decision</h2><span>{hasText(draft) ? 'Draft · not saved' : 'Review the evidence before recording a conclusion'}</span></div>
        <div className={styles.decisionBody}>
          {client && <div className={styles.notice}><LockKeyhole size={16}/><p>Client role can inspect this fictional workpaper. Tax decisions are recorded by staff. Your assigned questions and approvals are in Team.</p></div>}
          {activeContext && currentVersion !== 'v3' && <div className={styles.notice}><GitBranch size={16}/><p>{currentVersion.toUpperCase()} is an immutable historical engine version. Its sources and computation can be inspected. Select v3 to record current decisions.</p><button className="button button-secondary button-small" onClick={() => select({ ...selection, version: 'v3' })}>Inspect current v3 <ArrowRight size={13}/></button></div>}
          {draftChanged && <div role="alert" className={styles.conflict}><strong>The selected review context changed.</strong><p>Your draft is retained. Inspect the fresh source, computation and saved decisions before resubmitting.</p><button className="button button-secondary button-small" onClick={() => setDrafts(previous => ({ ...previous, [itemKey]: { ...draft, signature } }))}>I reviewed this refreshed context</button></div>}
          {stale && !loading && <p role="status" className={styles.meta}>This context is behind the workspace revision. Refresh before saving.</p>}
          {!client && <><div className={styles.decisionTabs} role="group" aria-label="Decision type">{([['decision', 'Decision'], ['verify', 'Verify'], ['note', 'Note'], ['question', 'Question'], ['document', 'Document']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={draft.mode === key} onClick={() => edit({ mode: key })}>{label}</button>)}</div>
          {draft.mode === 'decision' && <>
            {issue ? <>{(issue.original != null || issue.proposed != null) && <div className={styles.overlay}><span>Separate proposed input / reviewed overlay</span><div><strong>{display(issue.original, issue.unit)}</strong><ArrowRight size={18}/><strong>{display(issue.proposed, issue.unit)}</strong></div><small>{issue.unit} · The original computation is preserved.</small></div>}
              {activeAdjustment ? <div className={styles.savedDecision}><Badge tone="sage">Adjustment recorded</Badge><p>{activeAdjustment.reason}</p><small>{date(activeAdjustment.createdAt)} · {data.actors?.find((actor: RecordData) => actor.id === activeAdjustment.actorId)?.name || activeAdjustment.actorId}</small><label>Reason to undo<textarea aria-label="Undo adjustment reason" rows={3} value={draft.reason} onChange={event => edit({ reason: event.target.value })}/></label><button className="button button-secondary" disabled={busy || !draft.reason.trim() || !permitted('undo_adjustment')} onClick={() => save({ type: 'undo_adjustment', adjustmentId: activeAdjustment.id, reason: draft.reason }, ['reason'])}><Undo2 size={14}/> Undo, retaining history</button></div> : <><label>Evidence reviewed &amp; reason<textarea aria-label="Decision evidence and reason" value={draft.reason} onChange={event => edit({ reason: event.target.value })} rows={5} placeholder="Explain what the sources establish, what remains uncertain, and why this treatment is supported."/></label>{issue.kind !== 'adjustment' && <><label>Authority relied on<textarea aria-label="Decision authority" value={draft.authority} onChange={event => edit({ authority: event.target.value })} rows={3} placeholder="Cite the supplied rule or specific professional authority."/></label><label>Conclusion<select aria-label="Investigation conclusion" value={draft.outcome} onChange={event => edit({ outcome: event.target.value })}><option value="open">Open · Evidence still needed</option><option value="resolved">Resolved · Supported conclusion</option></select></label></>}
              <button className="button button-primary" disabled={busy || !draft.reason.trim() || (issue.kind !== 'adjustment' && draft.outcome === 'resolved' && !draft.authority.trim()) || !permitted(issue.kind === 'adjustment' ? 'accept_adjustment' : 'save_investigation')} onClick={() => save(issue.kind === 'adjustment' ? { type: 'accept_adjustment', issueId: issue.id, reason: draft.reason } : { type: 'save_investigation', issueId: issue.id, body: draft.reason, authority: draft.authority, result: draft.outcome }, ['reason', 'authority', 'outcome'])}>{busy ? <Loader2 size={15} className="spin"/> : <Check size={15}/>} {issue.kind === 'adjustment' ? 'Accept adjustment & preserve original' : 'Save supported investigation'}</button>{issue.kind === 'adjustment' && data.actor?.role !== 'preparer' && <p className={styles.meta}>Only the preparer changes inputs; review staff can verify evidence and record notes.</p>}</>}
              <div className={styles.effect}><strong>{/Exact supplied/i.test(issue.taxEffect.method) ? 'Supplied isolated alternative' : /Estimate/i.test(issue.taxEffect.method) ? 'Estimated tax effects' : 'Effect assessment'}</strong><dl><div><dt>Federal</dt><dd>{money(issue.taxEffect.federal)}</dd></div><div><dt>California</dt><dd>{money(issue.taxEffect.california)}</dd></div></dl><p>{issue.taxEffect.method}</p><p>These effects do not produce a combined corrected final tax.</p></div>
            </> : <div className={styles.notice}><GitBranch size={18}/><p>This number or source can be verified, linked to a note or questioned here. Use adjustment tools for a general line overlay with explicit estimated effects.</p></div>}
          </>}
          {draft.mode === 'verify' && <><p className={styles.meta}>Verification applies to <strong>{actionRef || 'the selected reference'}</strong>. Confidence alone does not verify a value.</p>{verification && <div className={styles.savedDecision}><Badge tone="sage">Method recorded</Badge><p>{readable(String(verification.method || ''))}</p><p>{String(verification.note || '')}</p></div>}<label>Verification method<select value={draft.method} onChange={event => edit({ method: event.target.value })}>{methods.map(method => <option value={method} key={method}>{readable(method)}</option>)}</select></label><label>Evidence and verification conclusion<textarea aria-label="Verification evidence and conclusion" rows={5} value={draft.verification} onChange={event => edit({ verification: event.target.value })} placeholder="Identify what you checked and explain any unresolved difference."/></label><button className="button button-primary" disabled={busy || !draft.verification.trim() || !actionRef || !permitted('workflow:verify_value')} onClick={() => save({ type: 'workflow', action: 'verify_value', payload: { ref: actionRef, method: draft.method, note: draft.verification } }, ['verification', 'method'])}><ShieldCheck size={15}/> Record verification</button></>}
          {draft.mode === 'note' && <><p className={styles.meta}>Open notes block filing until a staff member records their resolution.</p><label>Blocking review note<textarea aria-label="Contextual blocking review note" rows={5} value={draft.note} onChange={event => edit({ note: event.target.value })} placeholder="Describe the unresolved concern and the evidence needed."/></label><button className="button button-primary" disabled={busy || !draft.note.trim() || !permitted('add_note')} onClick={() => save({ type: 'add_note', ...(issue ? { issueId: issue.id } : {}), body: `${draft.note}\n\nContext: ${actionRef || activeContext?.selection.ref || selection.id}` }, ['note'])}><MessageSquare size={15}/> Save blocking note</button></>}
          {draft.mode === 'question' && <><p className={styles.meta}>Create a question for an in-app respondent. Their answer becomes linked evidence. No external message is sent.</p><label>Recipient<select aria-label="Contextual question recipient" value={draft.recipient} onChange={event => edit({ recipient: event.target.value })}><option value="">Choose the person who can answer…</option>{(data.actors || []).map((actor: RecordData) => <option key={actor.id} value={actor.id}>{actor.name} · {readable(actor.role)}</option>)}</select></label><label>Question and evidence needed<textarea aria-label="Contextual question" rows={5} value={draft.question} onChange={event => edit({ question: event.target.value })}/></label><button className="button button-primary" disabled={busy || !draft.question.trim() || !draft.recipient || !permitted('workflow:add_question')} onClick={() => save({ type: 'workflow', action: 'add_question', payload: { recipientId: draft.recipient, body: draft.question, sourceRefs: [...new Set([actionRef, ...(issue?.sourceRefs || [])].filter(Boolean))] } }, ['question', 'recipient'])}><MessageSquare size={15}/> Save assigned question</button></>}
          {draft.mode === 'document' && <>{focusedDocument ? <><p className={styles.meta}>Account for <strong>{actionDocument}</strong> specifically. Retain duplicate and corrected pages as evidence.</p><label>Disposition<select value={draft.disposition} onChange={event => edit({ disposition: event.target.value })}><option value="used">Used · Evidence supports the return/review</option><option value="unused">Unused · Reason documented</option><option value="needs_review">Needs further review</option></select></label><label>Reason and scope of use<textarea aria-label="Document disposition reason" rows={5} value={draft.dispositionReason} onChange={event => edit({ dispositionReason: event.target.value })}/></label><button className="button button-primary" disabled={busy || !draft.dispositionReason.trim() || !permitted('workflow:document_disposition')} onClick={() => save({ type: 'workflow', action: 'document_disposition', payload: { documentId: actionDocument, status: draft.disposition, reason: draft.dispositionReason } }, ['dispositionReason', 'disposition'])}><FileText size={15}/> Save document disposition</button></> : <p>Select a document in Evidence or the document queue to record its disposition.</p>}</>}
          </>}
          {message && <p role="status" className={styles.savedMessage}>{message}</p>}
          {hasText(draft) && <button className={styles.discard} onClick={() => { if (window.confirm('Discard this unsaved decision draft?')) setDrafts(previous => ({ ...previous, [itemKey]: blankDraft() })); }}>Discard this draft</button>}
          {(notes.length > 0 || (activeContext?.decisions.investigations.length || 0) > 0) && <details className={styles.history} open><summary>Relevant decisions &amp; review notes <ChevronDown size={13}/></summary>{activeContext?.decisions.investigations.map(item => <article key={item.id}><Badge tone={item.result === 'resolved' ? 'sage' : 'sand'}>{item.result}</Badge><p>{item.body}</p>{item.authority && <small>Authority: {item.authority}</small>}</article>)}{notes.map(note => <article key={note.id}><Badge tone={note.status === 'open' ? 'coral' : 'sage'}>{note.status === 'open' ? 'Blocks filing' : 'Resolved'}</Badge><p>{note.body}</p><small>{date(note.createdAt)} · {data.actors?.find((actor: RecordData) => actor.id === note.actorId)?.name || note.actorId}</small></article>)}</details>}
          <div className={styles.decisionFoot}><LockKeyhole size={13}/><span>Material decisions reopen affected approvals. Filing, signatures and role selection are case-study simulations.</span></div>
        </div>
      </section>
    </div>
  </div>;
}
