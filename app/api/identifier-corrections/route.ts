import { assertIdentifierAccess, decryptCorrection, encryptCorrection, getSensitiveSource, type EncryptedIdentifier } from '@/lib/identifiers';
import { executeCommand } from '@/lib/repository';
import { requestContext, database, readBody, failure, json, HttpError } from '@/lib/server';

export async function POST(request: Request) {
  try {
    const { ownerId, actor } = await requestContext(true);
    if (!actor.clearance || !['preparer', 'reviewer', 'partner', 'quality_reviewer'].includes(actor.role)) throw new HttpError(403, 'Only cleared tax staff can correct an identifier.');
    const { expectedRevision, actorId, ref, value, reason } = await readBody(request);
    if (actorId !== undefined && actorId !== actor.id) throw new HttpError(409, 'The demo role changed. Reopen the source before recording a protected correction.');
    if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof ref !== 'string') throw new HttpError(400, 'Provide a valid source reference and expected workspace revision.');
    const prepared = await encryptCorrection(ownerId, actor.id, ref, value, reason);
    const workspace = await executeCommand(ownerId, actor.id, expectedRevision,
      { type: 'workflow', action: 'identifier_correction', payload: prepared.metadata }, undefined, [prepared.statement]);
    return json({ id: prepared.metadata.id, ref, revision: workspace.revision, status: 'encrypted', notice: 'Correction recorded securely; source packet remains unchanged.' }, 201);
  } catch (error) { return failure(error); }
}

export async function GET(request: Request) {
  try {
    const { ownerId, actor } = await requestContext();
    if (!actor.clearance || actor.role === 'client') throw new HttpError(403, 'Sensitive-data clearance is required to reveal a correction.');
    assertIdentifierAccess(actor.id);
    const url = new URL(request.url);
    if (url.searchParams.get('reveal') !== '1') throw new HttpError(400, 'Use an explicit reveal request to open a protected correction.');
    const ref = url.searchParams.get('ref') || '';
    getSensitiveSource(actor.id, ref);
    const record = await database().prepare('SELECT id, owner_id, actor_id, ref, ciphertext, iv, tag, created_at FROM identifier_corrections WHERE owner_id = ? AND ref = ? ORDER BY rowid DESC LIMIT 1').bind(ownerId, ref).first<EncryptedIdentifier>();
    if (!record) throw new HttpError(404, 'No protected correction is recorded for this source field.');
    const value = await decryptCorrection(record);
    await database().prepare('INSERT INTO sensitive_views (id, owner_id, actor_id, target_id, viewed_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), ownerId, actor.id, `correction:${record.id}`, new Date().toISOString()).run();
    return json({ id: record.id, ref, value, createdAt: record.created_at, actorId: record.actor_id });
  } catch (error) { return failure(error); }
}
