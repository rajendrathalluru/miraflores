import { assertIdentifierAccess, decryptCorrection, getSensitiveSource, type EncryptedIdentifier } from '@/lib/identifiers';
import { requestContext, database, failure, json, HttpError } from '@/lib/server';

export async function GET(request: Request) {
  try {
    const { ownerId, actor } = await requestContext();
    if (!actor.clearance || actor.role === 'client') throw new HttpError(403, 'Sensitive-data clearance is required to reveal a source.');
    assertIdentifierAccess(actor.id);
    const ref = new URL(request.url).searchParams.get('ref') || '';
    const source = getSensitiveSource(actor.id, ref);
    const correction = await database().prepare('SELECT id, owner_id, actor_id, ref, ciphertext, iv, tag, created_at FROM identifier_corrections WHERE owner_id = ? AND ref = ? ORDER BY rowid DESC LIMIT 1').bind(ownerId, ref).first<EncryptedIdentifier>();
    const corrected = correction ? { id: correction.id, value: await decryptCorrection(correction), actorId: correction.actor_id, createdAt: correction.created_at } : null;
    await database().prepare('INSERT INTO sensitive_views (id, owner_id, actor_id, target_id, viewed_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), ownerId, actor.id, `source:${ref}${correction ? `;correction:${correction.id}` : ''}`, new Date().toISOString()).run();
    return json({ ...source, correction: corrected, notice: 'Explicit sensitive view. Access is logged. Hide this view when finished.' });
  } catch (error) { return failure(error); }
}
