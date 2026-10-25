import { getBootstrap, masked } from '@/lib/packet';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, database } from '@/lib/server';
export async function GET() {
  try {
    const { ownerId, actor } = await requestContext();
    const workspace = await loadWorkspace(ownerId);
    const data = getBootstrap(actor.id, workspace);
    const runs = actor.role === 'client' ? [] : (await database().prepare('SELECT id, input_revision, prompt, result, created_at FROM agent_runs WHERE owner_id = ? ORDER BY created_at').bind(ownerId).all<{ id: string; input_revision: number; prompt: string; result: string; created_at: string }>()).results.map(r => ({ ...r, result: JSON.parse(r.result) }));
    return new Response(JSON.stringify(masked({ format: 'miraflores-workpaper-v1', exportedAt: new Date().toISOString(), note: 'Development review record. Supplied engine figures and estimated effects remain distinct; this is not a filed tax return or the completed self-contained examination package.', ...data, investigations: runs }), null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="miraflores-review-r${workspace.revision}.json"`, 'Cache-Control': 'private, no-store' },
    });
  } catch (e) { return failure(e); }
}
