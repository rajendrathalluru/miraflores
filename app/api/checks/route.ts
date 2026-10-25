import { getChecks } from '@/lib/checks';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, json } from '@/lib/server';

export async function GET() {
  try {
    const { ownerId, actor } = await requestContext();
    return json(getChecks(actor.id, await loadWorkspace(ownerId)));
  } catch (error) { return failure(error); }
}
