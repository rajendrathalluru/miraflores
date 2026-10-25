/** Server-only, revision-consistent read model. Never import this module in a client. */
import packet from '../data/packet.json';
import type { ReviewChanges, ReviewContext, Workspace } from './contracts';
import { getActor, getDocument, getVersionLines, masked, resolveSource, traceLine } from './packet';
import { getIssue, issues } from './issues';
import { contentRevision, currentFrozen, REVIEW_AREAS, REQUIRED_OUTSIDE_FILINGS, workflowBlockers, workflowState } from './workflow';
import { getChecks } from './checks';
import { HttpError } from './http-error';

export const PACKET_SHA256 = 'ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19';

/** Conservative change scope: unknown material actions remain workspace-wide. */
export function getReviewChanges(state: Workspace, sinceRevision: number, actorId?: string): ReviewChanges {
  const actor = actorId ? getActor(actorId) : null;
  const events = state.audit.filter(event => event.revision > sinceRevision && (actor?.role !== 'client' || event.actorId === actor.id));
  const changedRefs = new Set<string>();
  for (const event of events) {
    if (event.targetId) changedRefs.add(event.targetId);
    if (event.issueId) {
      changedRefs.add(event.issueId);
      const issue = issues.find(item => item.id === event.issueId);
      for (const ref of [...(issue?.lineKeys ?? []), ...(issue?.sourceRefs ?? [])]) changedRefs.add(ref);
    }
    // Absence of a precise target is not evidence that the selected financial facts
    // stayed unchanged. Do not invite a client to silently merge such a mutation.
    changedRefs.add(event.material ? 'workspace:content' : 'workspace:activity');
  }
  return masked({ sinceRevision, events: events.slice(-50), changedRefs: [...changedRefs] });
}

export function buildReviewContext(state: Workspace, actorId: string, options: { issueId?: string; ref?: string; version?: string; sinceRevision?: number } = {}): ReviewContext {
  const actor = getActor(actorId);
  const w = workflowState(state);
  const version = options.version ?? 'v3';
  if (!['v1', 'v2', 'v3'].includes(version)) throw new HttpError(400, 'Choose a supplied engine version.');
  if (options.issueId && options.ref) throw new HttpError(400, 'Choose either an issue or an evidence reference.');
  const issue = options.issueId ? getIssue(options.issueId) : null;
  const ref = issue?.id ?? options.ref ?? issues[0].id;
  if (ref.length > 250) throw new HttpError(400, 'Choose a valid review reference.');
  const fallbackIssue = !options.issueId && !options.ref ? issues[0] : issue;
  const selectedIssue = fallbackIssue;
  const allLines = getVersionLines(version, actorId);
  const explicitLine = /^line:(v[123]):(.+)$/.exec(ref);
  if (explicitLine && explicitLine[1] !== version) throw new HttpError(400, 'The line reference and selected engine version must agree.');
  const lineRef = explicitLine?.[2] ?? ref;
  const selectedLine = allLines.find(line => line.key === lineRef);
  const lineKeys = selectedIssue?.lineKeys ?? (selectedLine ? [selectedLine.key] : []);
  const lines = allLines.filter(line => lineKeys.includes(line.key));
  let computation = lines[0] ? traceLine(lines[0].key, version, actorId, state) : null;
  const sourceRefs = new Set(selectedIssue?.sourceRefs ?? (selectedLine ? selectedLine.sources : [ref]));
  for (const node of computation?.nodes ?? []) if (node.evidence) sourceRefs.add(node.evidence.ref);
  const cutoff = w.replayAt ? Date.parse(w.replayAt) : null;
  const selectedVersion = packet.return_versions.find(item => item.version === version)!;
  if (cutoff !== null && Date.parse(selectedVersion.computed_at) > cutoff) throw new HttpError(400, 'This engine version was not yet available at the selected replay time. Choose an earlier version or leave replay.');
  const available = (sourceRef: string): boolean => {
    if (cutoff === null) return true;
    const ev = packet.extracted_values.find(item => item.id === sourceRef);
    const documentId = ev?.document_id ?? /^doc:(D\d+)#/.exec(sourceRef)?.[1] ?? (/^D\d+$/.test(sourceRef) ? sourceRef : undefined);
    if (documentId) return packet.documents.some(document => document.id === documentId && Date.parse(document.received_at) <= cutoff);
    const communication = [...packet.client.questionnaire, ...packet.client.messages, ...packet.client.call_notes].find(item => item.id === sourceRef) as { answered_at?: string; sent_at?: string; at?: string } | undefined;
    const at = communication?.answered_at ?? communication?.sent_at ?? communication?.at;
    if (at) return Date.parse(at) <= cutoff;
    // Current authored work is never presented as backdated historical evidence.
    return !sourceRef.startsWith('local:');
  };
  const evidence = [...sourceRefs].map(sourceRef => available(sourceRef) ? resolveSource(sourceRef, actorId, version, state) : { ref: sourceRef, type: 'unavailable_in_replay', label: sourceRef, missing: true, text: 'Not available in the selected historical view.' });
  if (!selectedIssue && !selectedLine && evidence.every(item => item.missing)) throw new HttpError(404, 'That review reference is unavailable.');
  if (computation && cutoff !== null) computation = { ...computation, nodes: computation.nodes.map(node => node.evidence && !available(node.evidence.ref) ? { ...node, value: undefined, evidence: { ref: node.evidence.ref, type: 'unavailable_in_replay', label: node.evidence.ref, missing: true, text: 'Not available in the selected historical view.' } } : node) };
  const documentIds = [...new Set(evidence.flatMap(item => 'documentId' in item && item.documentId ? [item.documentId] : []))];
  const documents = documentIds.map(id => getDocument(id, actorId, state));
  const relevant = (refs: unknown) => Array.isArray(refs) && refs.some(item => typeof item === 'string' && (sourceRefs.has(item) || lineKeys.includes(item)));
  const relatedIssueIds = new Set(issues.filter(item => item.id === selectedIssue?.id || item.lineKeys.some(key => lineKeys.includes(key)) || item.sourceRefs.some(source => sourceRefs.has(source))).map(item => item.id));
  const isStaff = ['preparer', 'reviewer', 'partner', 'quality_reviewer'].includes(actor.role);
  const frozen = currentFrozen(state);
  const parentId = frozen?.id ?? (String(w.amendments.at(-1)?.originalFilingId ?? '') || null);
  const parent = state.filings.find(item => item.id === parentId);
  const permittedActions: string[] = [];
  if (cutoff === null && version === 'v3' && isStaff) {
    permittedActions.push('draft_question');
    if (!frozen) {
      permittedActions.push('add_note', 'save_investigation', 'workflow:verify_value', 'workflow:judgment', 'workflow:add_question', 'workflow:document_disposition');
      if (actor.role === 'preparer' && selectedIssue?.kind === 'adjustment') {
        if (state.adjustments.some(item => item.issueId === selectedIssue.id && item.status === 'active')) permittedActions.push('undo_adjustment');
        else permittedActions.push('accept_adjustment');
      }
    }
  }
  const sinceRevision = options.sinceRevision ?? w.lastSeen[actorId] ?? 0;
  if (!Number.isSafeInteger(sinceRevision) || sinceRevision < 0 || sinceRevision > state.revision) throw new HttpError(400, 'Choose an existing change revision.');
  const client = actor.role === 'client';
  const outsideObligations = [
    ...REQUIRED_OUTSIDE_FILINGS.map(filing => w.outsideFilings.find(record => record.filingId === filing.id)),
    ...w.outsideFilings.filter(record => !REQUIRED_OUTSIDE_FILINGS.some(filing => filing.id === record.filingId)),
  ];
  const decisions: ReviewContext['decisions'] = {
    adjustments: client ? [] : state.adjustments.filter(item => relatedIssueIds.has(item.issueId)),
    lineAdjustments: client ? [] : w.lineAdjustments.filter(item => lineKeys.includes(String(item.lineKey))),
    investigations: client ? [] : state.investigations.filter(item => relatedIssueIds.has(item.issueId) || relevant(item.sourceRefs)),
    notes: client ? [] : state.notes.filter(item => !item.issueId || relatedIssueIds.has(item.issueId)),
    verifications: client ? [] : Object.entries(w.verifications).filter(([key]) => sourceRefs.has(key) || lineKeys.includes(key)).map(([, value]) => value),
    judgments: client ? [] : w.judgments.filter(item => relevant(item.sourceRefs)),
    questions: w.questions.filter(item => (!client || item.recipientId === actorId || item.actorId === actorId) && (relevant(item.sourceRefs) || selectedIssue?.sourceRefs.some(source => Array.isArray(item.sourceRefs) && item.sourceRefs.includes(source)))),
  };
  // In replay, authored current decisions remain visible as current context, never
  // as historical facts; editing is disabled and this distinction is explicit.
  return masked({
    token: { engagementId: 'okafor-lindqvist-2025', packetSha256: PACKET_SHA256, engineVersion: version,
      editRevision: state.revision, contentRevision: contentRevision(state), cycle: w.cycle,
      frozenParentId: parentId, frozenContentHash: parent?.contentHash ?? null,
      replay: w.replayAt ? { at: w.replayAt, eventId: w.replayEventId ?? null, readOnly: true } : null },
    actor, accessMode: 'local-evaluator-sandbox',
    selection: { ref, label: selectedIssue?.title ?? selectedLine?.label ?? evidence[0]?.label ?? ref, kind: selectedIssue ? 'issue' : selectedLine ? 'line' : 'evidence' },
    issue: selectedIssue, evidence, documents, computation, lines, decisions,
    checks: version === 'v3' && cutoff === null ? getChecks(actorId, state).checks.filter(check => check.lineKeys.some(key => lineKeys.includes(key)) || check.sourceRefs.some(source => sourceRefs.has(source))) : [],
    blockers: client ? ['Approvals use the current reviewed content. Staff review readiness is managed by the firm.'] : workflowBlockers(state, true),
    coverage: {
      documents: { completed: packet.documents.filter(document => ['used', 'unused'].includes(String(w.documents[document.id]?.status))).length, total: packet.documents.length },
      areas: { completed: REVIEW_AREAS.filter(area => w.areas[area]?.status === 'reviewed').length, total: REVIEW_AREAS.length },
      outsideFilings: { completed: outsideObligations.filter(record => record && ['prepared_elsewhere', 'completed', 'not_required'].includes(String(record.status)) && record.responsible && record.body).length, total: outsideObligations.length },
      verifications: Object.keys(w.verifications).length,
    },
    permittedActions, changes: getReviewChanges(state, sinceRevision, actorId),
    disclaimer: cutoff !== null ? 'Read-only historical availability. Current findings and authored decisions are not rewound or backdated. No edits are permitted in this view.' : version !== 'v3' ? 'Read-only supplied historical engine version. Current decisions remain v3 review context; they do not change this imported version. Return to v3 to record a decision.' : 'Source observation, extracted reading, supplied computation and reviewed estimates remain separate facts. Simulated source positions are approximate; the engine has not been rerun. Fictional evaluator roles are not authenticated client identities.',
  });
}

export function conflictDetails(state: Workspace, expectedRevision: number, actorId: string) {
  const changes = getReviewChanges(state, Math.max(0, Number.isSafeInteger(expectedRevision) ? expectedRevision : 0), actorId);
  return { currentRevision: state.revision, contentRevision: contentRevision(state), changedRefs: changes.changedRefs, changes: changes.events };
}
