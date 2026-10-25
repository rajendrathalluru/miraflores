import { createHash } from 'node:crypto';
import { getLocalDatabase, type LocalDatabase } from './database';
import { HttpError } from './http-error';
import { initialWorkspace, applyCommand } from './domain';
import type { Command, Workspace } from './contracts';

// Repository boundary: a PostgreSQL implementation can replace this adapter
// without changing the domain command handlers or client contracts.
export async function loadWorkspace(ownerId: string, db = getLocalDatabase()): Promise<Workspace> {
  const row = await db.prepare('SELECT data FROM workspaces WHERE owner_id = ?').bind(ownerId).first<{ data: string }>();
  return row ? JSON.parse(row.data) as Workspace : initialWorkspace();
}

export interface AttachmentInsert { id: string; name: string; objectKey: string; contentType: string; size: number; issueId: string | null }
interface CommandReceipt { body_sha256: string; revision: number; result: string }
export function validateRequestId(requestId: string) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) throw new HttpError(400, 'Use a valid request identity (8–128 letters, digits, hyphens or underscores).');
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function commandFingerprint(expectedRevision: number, command: Command): string {
  return createHash('sha256').update(JSON.stringify(canonical({ expectedRevision, command }))).digest('hex');
}
export async function loadCommandReceipt(ownerId: string, actorId: string, requestId: string, db = getLocalDatabase()): Promise<CommandReceipt | null> {
  validateRequestId(requestId);
  return db.prepare('SELECT body_sha256, revision, result FROM command_receipts WHERE owner_id = ? AND actor_id = ? AND request_id = ?')
    .bind(ownerId, actorId, requestId).first<CommandReceipt>();
}
function receiptResult(receipt: CommandReceipt, fingerprint: string): Workspace {
  if (receipt.body_sha256 !== fingerprint) throw new HttpError(409, 'Request identity conflict: this identity was already committed with different content.');
  return JSON.parse(receipt.result) as Workspace;
}

export async function executeCommand(ownerId: string, actorId: string, expectedRevision: number, command: Command, attachment?: AttachmentInsert, extraMutations: { sql: string; args: string[] }[] = [], options: { requestId?: string; database?: LocalDatabase } = {}): Promise<Workspace> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new HttpError(400, 'An expected revision is required.');
  const db = options.database ?? getLocalDatabase();
  const fingerprint = commandFingerprint(expectedRevision, command);
  if (options.requestId) {
    validateRequestId(options.requestId);
    const receipt = await loadCommandReceipt(ownerId, actorId, options.requestId, db);
    if (receipt) return receiptResult(receipt, fingerprint);
  }
  const baseline = initialWorkspace();
  await db.prepare('INSERT OR IGNORE INTO workspaces (owner_id, revision, data, updated_at) VALUES (?, 0, ?, ?)')
    .bind(ownerId, JSON.stringify(baseline), new Date().toISOString()).run();
  const current = await loadWorkspace(ownerId, db);
  if (current.revision !== expectedRevision) {
    const receipt = options.requestId ? await loadCommandReceipt(ownerId, actorId, options.requestId, db) : null;
    if (receipt) return receiptResult(receipt, fingerprint);
    throw new HttpError(409, 'Another action changed this workspace. Refresh and review the latest revision.');
  }
  const next = applyCommand(current, { ...command, expectedRevision }, actorId);
  if (command.type === 'freeze') {
    const filing = next.filings.at(-1);
    if (filing?.snapshot) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(filing.snapshot)));
      filing.contentHash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
    }
  }
  try { await db.batch([
    { sql: 'UPDATE workspaces SET revision = ?, data = ?, updated_at = ? WHERE owner_id = ? AND revision = ?',
      args: [next.revision, JSON.stringify(next), new Date().toISOString(), ownerId, expectedRevision], expectChanges: 1 },
    ...(attachment ? [{ sql: 'INSERT INTO attachments (id, owner_id, name, object_key, content_type, size, issue_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [attachment.id, ownerId, attachment.name, attachment.objectKey, attachment.contentType, attachment.size, attachment.issueId, new Date().toISOString()] }] : []),
    ...extraMutations,
    ...(options.requestId ? [{ sql: 'INSERT INTO command_receipts (owner_id, actor_id, request_id, body_sha256, revision, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [ownerId, actorId, options.requestId, fingerprint, next.revision, JSON.stringify(next), new Date().toISOString()] }] : []),
  ]); } catch (error) {
    // A competing retry may have committed the same request after our first lookup.
    // The failed CAS/receipt insert rolls back before this lookup; never duplicate audit.
    if (options.requestId) {
      const receipt = await loadCommandReceipt(ownerId, actorId, options.requestId, db);
      if (receipt) return receiptResult(receipt, fingerprint);
    }
    throw error;
  }
  return next;
}
