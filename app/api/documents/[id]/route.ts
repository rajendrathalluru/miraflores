import { getDocument } from '@/lib/packet';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, json, HttpError } from '@/lib/server';
import { workflowState } from '@/lib/workflow';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { ownerId, actor } = await requestContext();
    const { id } = await context.params;
    if (!/^D\d{2}$/.test(id)) throw new HttpError(404, 'Document not found.');
    const state = await loadWorkspace(ownerId);
    const original = workflowState(state).originals[id];
    return json({ ...getDocument(id, actor.id, state), original: actor.clearance && original ? original : null,
      canRevealIdentifiers: actor.clearance && actor.role !== 'client', revision: state.revision });
  } catch (e) { return failure(e); }
}
