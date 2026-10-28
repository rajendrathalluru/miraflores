import { NextRequest } from 'next/server';
import { db, load, persist } from '@/lib/db';
import { guard, getActor, json, failure } from '@/lib/server';
import { applyCommand, DomainError } from '@/lib/workflow';
import { digest } from '@/lib/packet';
export async function POST(req: NextRequest) {
  try {
    guard(req);
    const b = await req.json();
    if (typeof b.requestId !== 'string' || b.requestId.length > 100)
      throw new DomainError('A unique request identity is required.');
    const { packet } = await load(b.engagementId);
    const actor = await getActor(packet);
    if (actor.id !== b.actorId)
      throw new DomainError('The role changed in another tab. Refresh before saving.', 409);
    const database = await db();
    const fingerprint = digest({
      actor: actor.id,
      revision: b.expectedRevision,
      command: b.command,
    });
    const result = await database.transaction(async (tx) => {
      const { rows } = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [
        b.engagementId,
      ]);
      if (!rows[0]) throw new DomainError('Engagement not found.', 404);
      const receipt = await tx.query(
        'SELECT * FROM command_receipts WHERE engagement_id=$1 AND request_id=$2',
        [b.engagementId, b.requestId],
      );
      if (receipt.rows[0]) {
        if (receipt.rows[0].actor_id !== actor.id || receipt.rows[0].fingerprint !== fingerprint)
          throw new DomainError('Request identity cannot be reused for a different action.', 409);
        return { revision: receipt.rows[0].revision, replayed: true };
      }
      if (rows[0].revision !== b.expectedRevision)
        throw new DomainError(
          `A colleague saved revision ${rows[0].revision}. Your draft is retained; refresh and review before saving again.`,
          409,
        );
      const s = applyCommand(rows[0].raw_packet, rows[0].state, actor, b.command);
      await persist(tx, b.engagementId, rows[0].revision, s);
      await tx.query(
        'INSERT INTO command_receipts(engagement_id,request_id,actor_id,fingerprint,revision) VALUES($1,$2,$3,$4,$5)',
        [b.engagementId, b.requestId, actor.id, fingerprint, s.revision],
      );
      return { revision: s.revision, replayed: false };
    });
    return json(result);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const id = req.nextUrl.searchParams.get('id') || '';
    const requestId = req.nextUrl.searchParams.get('requestId') || '';
    const { database, packet } = await load(id);
    const a = await getActor(packet);
    const { rows } = await database.query(
      'SELECT revision,actor_id FROM command_receipts WHERE engagement_id=$1 AND request_id=$2',
      [id, requestId],
    );
    return json(
      rows[0]?.actor_id === a.id
        ? { status: 'committed', revision: rows[0].revision }
        : { status: 'unknown' },
    );
  } catch (e) {
    return failure(e);
  }
}
