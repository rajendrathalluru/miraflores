import { getDocument } from '@/lib/packet';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, json, HttpError } from '@/lib/server';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { ownerId, actor } = await requestContext();
    const { id } = await context.params;
    if (!/^D\d{2}$/.test(id)) throw new HttpError(404, 'Document not found.');
    return json(getDocument(id, actor.id, await loadWorkspace(ownerId)));
  } catch (e) { return failure(e); }
}
