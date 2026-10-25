/** Public, serializable contracts. This module never imports the source packet. */
export type Role = 'preparer' | 'reviewer' | 'partner' | 'firm_administrator' | 'quality_reviewer' | 'client';
export interface Actor { id: string; name: string; role: Role; clearance: boolean; activeFrom?: string }
export type Scalar = string | number | boolean | null;
export interface TaxEffect { federal: number | null; california: number | null; method: string }
export interface Issue {
  id: string; title: string; area: string; severity: 'high' | 'medium' | 'low';
  description: string; original: number | null; proposed: number | null; unit: string;
  sourceRefs: string[]; lineKeys: string[]; taxEffect: TaxEffect;
  kind: 'adjustment' | 'judgment' | 'check';
}
export interface ReturnLine {
  key: string; jurisdiction: string; form: string; line: string; label: string;
  value: Scalar; rule: string; inputs: string[]; sources: string[]; note?: string | null;
  version?: string;
}
export interface DocumentMeta {
  id: string; title: string; documentType: string; issuer: string; belongsTo: string;
  taxYear: number; receivedAt: string; fileName: string; pageCount: number;
  extraction: { status: string; values: number; reason: string | null };
  corrected: boolean; usedIn: string[]; supersededIn: string[]; issueIds: string[];
}
export interface Adjustment {
  id: string; issueId: string; actorId: string; reason: string; createdAt: string;
  revision: number; original: number | null; proposed: number | null;
  taxEffect: TaxEffect; status: 'active' | 'undone'; undoneAt?: string; undoReason?: string;
}
export interface ReviewNote {
  id: string; actorId: string; issueId?: string; body: string; status: 'open' | 'resolved';
  createdAt: string; resolvedAt?: string; resolvedBy?: string; resolution?: string;
}
export interface Signoff {
  id: string; actorId: string; level: 'reviewer' | 'partner' | 'client';
  revision: number; contentRevision: number; createdAt: string;
  status: 'active' | 'invalidated'; invalidatedAt?: string; invalidatedByRevision?: number;
}
export interface AuditEvent {
  id: string; revision: number; actorId: string; type: string; at: string;
  material: boolean; detail: string; issueId?: string; targetId?: string;
}
export interface Filing {
  id: string; actorId: string; at: string; revision: number; status: 'frozen';
  version: string; adjustmentIds: string[]; signoffIds: string[]; note: string;
  packetSha256: string; contentHash?: string;
  snapshot: { revision: number; adjustments: Adjustment[]; notes: ReviewNote[];
    signoffs: Signoff[]; investigations: Investigation[] };
}
export interface Question {
  id: string; actorId: string; issueId?: string; body: string; createdAt: string; status: 'draft';
}
export interface Investigation {
  id: string; actorId: string; issueId: string; body: string; result: string; createdAt: string;
}
export interface Workspace {
  revision: number; adjustments: Adjustment[]; notes: ReviewNote[]; signoffs: Signoff[];
  audit: AuditEvent[]; filings: Filing[]; questions: Question[]; investigations: Investigation[];
}
export interface Command {
  type: 'accept_adjustment' | 'undo_adjustment' | 'add_note' | 'resolve_note' | 'sign_off' |
    'client_approve' | 'freeze' | 'draft_question' | 'save_investigation';
  issueId?: string; adjustmentId?: string; reason?: string; body?: string; noteId?: string;
  text?: string; result?: string; level?: 'reviewer' | 'partner' | 'client';
  /** Optional optimistic concurrency guard; the API should also check database revision. */
  expectedRevision?: number;
}
export interface VersionMeta {
  version: string; computedAt: string; trigger: string;
  summary: Record<string, Record<string, Scalar>>; lineCount: number;
  diagnosticCount: number; documentsUsed: string[]; documentsSuperseded: string[];
}
export interface Bootstrap {
  actor: Actor; actors: Actor[];
  stats: { documentCount: number; pageCount: number; valueCount: number; issueCount: number;
    openHighIssues: number; activeAdjustments: number; openNotes: number; revision: number };
  versions: VersionMeta[]; documents: DocumentMeta[]; issues: Issue[]; lines: ReturnLine[];
  sourceIndex: Record<string, { documentId: string; page: number; field?: string; label?: string }>;
  workspace: Workspace;
}
export interface ExtractedValue {
  id: string; document_id: string; page: number; field: string; label: string;
  value: Scalar; value_type: string; text_as_read: string;
  position: { x0: number; y0: number; x1: number; y1: number }; confidence: number;
}
export interface DocumentDetail {
  document: DocumentMeta & { pages: { page: number; printed_content: string }[] };
  values: ExtractedValue[];
  uses: { version: string; key: string; label: string; value: Scalar }[];
}
export interface Evidence {
  ref: string; type: string; label: string; documentId?: string; page?: number;
  field?: string; value?: Scalar; text?: string; confidence?: number; missing?: boolean;
}
export interface TraceGraph {
  root: string; version: string;
  nodes: { id: string; type: 'line' | 'evidence' | 'rule'; label: string;
    value?: Scalar; line?: ReturnLine; evidence?: Evidence; text?: string }[];
  edges: { from: string; to: string; relation: 'input' | 'source' | 'rule' }[];
}
