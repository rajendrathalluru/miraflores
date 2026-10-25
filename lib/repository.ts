import { database, HttpError } from '@/lib/server';
import { initialWorkspace, applyCommand } from '@/lib/domain';
import type { Command, Workspace } from '@/lib/contracts';

// Repository boundary: a PostgreSQL implementation can replace this adapter
// without changing the domain command handlers or client contracts.
export async function loadWorkspace(ownerId: string): Promise<Workspace> {
  const row = await database().prepare('SELECT data FROM workspaces WHERE owner_id = ?').bind(ownerId).first<{ data: string }>();
  return row ? JSON.parse(row.data) as Workspace : initialWorkspace();
}

export async function executeCommand(ownerId: string, actorId: string, expectedRevision: number, command: Command): Promise<Workspace> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new HttpError(400, 'An expected revision is required.');
  const db = database();
  const baseline = initialWorkspace();
  await db.prepare('INSERT OR IGNORE INTO workspaces (owner_id, revision, data, updated_at) VALUES (?, 0, ?, ?)')
    .bind(ownerId, JSON.stringify(baseline), new Date().toISOString()).run();
  const current = await loadWorkspace(ownerId);
  if (current.revision !== expectedRevision) throw new HttpError(409, 'Another action changed this workspace. Refresh and review the latest revision.');
  const next = applyCommand(current, { ...command, expectedRevision }, actorId);
  if (command.type === 'freeze') {
    const filing = next.filings.at(-1);
    if (filing?.snapshot) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(filing.snapshot)));
      filing.contentHash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
    }
  }
  const result = await db.prepare('UPDATE workspaces SET revision = ?, data = ?, updated_at = ? WHERE owner_id = ? AND revision = ?')
    .bind(next.revision, JSON.stringify(next), new Date().toISOString(), ownerId, expectedRevision).run();
  if (result.meta.changes !== 1) throw new HttpError(409, 'This workspace changed while your action was being saved. Refresh before trying again.');
  return next;
}
