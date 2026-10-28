import { NextRequest } from 'next/server';
import { load, persist } from '@/lib/db';
import { guard, getActor, json, failure } from '@/lib/server';
import { applyCommand, DomainError } from '@/lib/workflow';
export async function POST(req: NextRequest) {
  try {
    guard(req);
    const b = await req.json();
    const { packet, database } = await load(b.id);
    const actor = await getActor(packet);
    if (actor.id !== b.actorId || !actor.sensitive_data_clearance)
      throw new DomainError('This role cannot reveal protected values.', 403);
    const ev = packet.extracted_values.find((x) => x.id === b.ref);
    if (!ev || !['ssn', 'ein', 'account_number'].includes(ev.value_type))
      throw new DomainError('Select a protected source field.');
    await database.transaction(async (tx) => {
      const { rows } = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [b.id]);
      const state = applyCommand(packet, rows[0].state, actor, {
        type: 'reveal_log',
        target: b.ref,
        reason: b.reason,
      });
      await persist(tx, b.id, rows[0].revision, state);
    });
    return json({ value: ev.value, expiresIn: 15 });
  } catch (e) {
    return failure(e);
  }
}
