import { loadWorkspace } from '@/lib/repository';
import { operationView } from '@/lib/workflow';
import { requestContext, database, failure, json } from '@/lib/server';
export async function GET() {
  try {
    const { ownerId, actor } = await requestContext();
    const state = await loadWorkspace(ownerId);
    const logs = actor.role === 'client' ? [] : (await database().prepare('SELECT actor_id AS actorId, target_id AS targetId, viewed_at AS viewedAt FROM sensitive_views WHERE owner_id = ? ORDER BY viewed_at DESC LIMIT 100').bind(ownerId).all()).results;
    return json({ ...operationView(state, actor.id), logs });
  } catch (e) { return failure(e); }
}
